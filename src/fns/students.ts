import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { getDb, toObj, toObjs, nextSequence, calcInstallmentStatus } from "./db";
import { getSettingsFn } from "./settings";
import { requirePermission } from "./security";

// ── helpers ──────────────────────────────────────────────────────────────────

async function attachCourseAndBatch(db: any, docs: any[]) {
  if (!docs.length) return docs;
  const courseIds = [...new Set(docs.map((d) => d.course_id).filter(Boolean))];
  const batchIds = [...new Set(docs.map((d) => d.batch_id).filter(Boolean))];

  const safeOId = (id: string) => {
    try {
      return new ObjectId(id);
    } catch {
      return id as any;
    }
  };

  const [courses, batches] = await Promise.all([
    courseIds.length
      ? db
          .collection("courses")
          .find({ _id: { $in: courseIds.map(safeOId) } })
          .project({ name: 1, gross_fee: 1 })
          .toArray()
      : Promise.resolve([]),
    batchIds.length
      ? db
          .collection("batches")
          .find({ _id: { $in: batchIds.map(safeOId) } })
          .project({ name: 1, timing: 1 })
          .toArray()
      : Promise.resolve([]),
  ]);

  const cMap: Record<string, any> = {};
  for (const c of courses) cMap[c._id.toString()] = c;
  const bMap: Record<string, any> = {};
  for (const b of batches) bMap[b._id.toString()] = b;

  return docs.map((d) => ({
    ...d,
    courses:
      d.course_id && cMap[d.course_id]
        ? { name: cMap[d.course_id].name, gross_fee: cMap[d.course_id].gross_fee }
        : null,
    batches:
      d.batch_id && bMap[d.batch_id]
        ? { id: d.batch_id, name: bMap[d.batch_id].name, timing: bMap[d.batch_id].timing }
        : null,
  }));
}

// ── students list / detail ────────────────────────────────────────────────────

export const getStudentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { status?: string; courseId?: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const filter: Record<string, any> = {};
    if (data.status && data.status !== "all") filter.status = data.status;
    if (data.courseId && data.courseId !== "all") filter.course_id = data.courseId;
    if (data.campusId) filter.campus_id = data.campusId;
    const docs = await db
      .collection("students")
      .find(filter)
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();
    const withIds = toObjs(docs);
    return attachCourseAndBatch(db, withIds);
  });

export const getStudentFn = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };
    const doc = await db.collection("students").findOne({ _id: safeOId(data.id) });
    if (!doc) return null;
    const withId = toObj(doc);
    const list = await attachCourseAndBatch(db, [withId]);
    return list[0];
  });

export const searchStudentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string; statusFilter?: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const term = data.q.trim();
    const filter: Record<string, any> = {
      $or: [
        { full_name: { $regex: term, $options: "i" } },
        { admission_number: { $regex: term, $options: "i" } },
        { mobile: { $regex: term, $options: "i" } },
      ],
    };
    if (data.statusFilter && data.statusFilter !== "all") {
      filter.status = data.statusFilter;
    } else {
      filter.status = "active";
    }
    if (data.campusId) filter.campus_id = data.campusId;
    const docs = await db.collection("students").find(filter).limit(20).toArray();
    const withIds = toObjs(docs);
    return attachCourseAndBatch(db, withIds);
  });

export const updateStudentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; updates: Record<string, any> }) => d)
  .handler(async ({ data }) => {
    await requirePermission("canEditStudentProfile");
    const db = await getDb();
    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };
    await db
      .collection("students")
      .updateOne(
        { _id: safeOId(data.id) },
        { $set: { ...data.updates, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

// ── enrollment ────────────────────────────────────────────────────────────────

export const nextAdmissionNumberFn = createServerFn({ method: "GET" })
  .inputValidator((d: { year: string }) => d)
  .handler(async ({ data }) => {
    await requirePermission("canEnrollStudents");
    const db = await getDb();
    const settings = (await getSettingsFn()) as any;
    const prefix = settings?.admission_prefix || "ENA";
    return nextSequence(db, "admission", prefix, data.year, 4);
  });

export const createEnrollmentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      student: Record<string, any>;
      feeAssignment: Record<string, any>;
      installments: Array<{
        installment_no: number;
        amount: number;
        due_date: string;
        month_label: string;
      }>;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requirePermission("canEnrollStudents");
    const db = await getDb();
    const now = new Date().toISOString();

    // Insert student
    const studentResult = await db.collection("students").insertOne({
      ...data.student,
      status: "active",
      created_at: now,
      updated_at: now,
    });
    const studentId = studentResult.insertedId.toString();

    // Insert fee assignment
    const faResult = await db.collection("fee_assignments").insertOne({
      ...data.feeAssignment,
      student_id: studentId,
      concession_cancelled_amount: 0,
      confirmed: true,
      created_at: now,
      updated_at: now,
    });
    const faId = faResult.insertedId.toString();

    // Insert installments
    const joiningRows = data.installments.map((inst) => ({
      fee_assignment_id: faId,
      student_id: studentId,
      installment_no: inst.installment_no,
      amount: inst.amount,
      amount_paid: 0,
      due_date: inst.due_date,
      month_label: inst.month_label,
      status: calcInstallmentStatus(inst.amount, 0, inst.due_date),
      late_fee: 0,
      is_registration: false,
      created_at: now,
      updated_at: now,
    }));
    const registrationFee = Number(data.feeAssignment?.registration_fee || 0);
    const registrationDate = (data.student?.registration_date as string | undefined) || now.slice(0, 10);
    const registrationRows =
      registrationFee > 0
        ? [
            {
              fee_assignment_id: faId,
              student_id: studentId,
              installment_no: 0,
              amount: registrationFee,
              amount_paid: registrationFee,
              due_date: registrationDate,
              month_label: "Registration Fee",
              status: "paid",
              late_fee: 0,
              is_registration: true,
              created_at: now,
              updated_at: now,
            },
          ]
        : [];
    await db.collection("installments").insertMany([...registrationRows, ...joiningRows]);

    return { studentId, faId };
  });

export const createDocumentFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      student_id: string;
      label: string;
      file_url: string;
      mime_type: string | null;
      size_bytes: number | null;
      uploaded_by: string | null;
      uploaded_by_name: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const result = await db.collection("student_documents").insertOne({
      ...data,
      created_at: new Date().toISOString(),
    });
    return toObj(await db.collection("student_documents").findOne({ _id: result.insertedId }));
  });

// ── student detail queries ────────────────────────────────────────────────────

export const getInstallmentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("installments")
      .find({ student_id: data.studentId })
      .sort({ installment_no: 1 })
      .toArray();
    return toObjs(docs);
  });

export const getFeeAssignmentFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const doc = await db.collection("fee_assignments").findOne({ student_id: data.studentId });
    return doc ? toObj(doc) : null;
  });

export const getPaymentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("payments")
      .find({ student_id: data.studentId })
      .sort({ payment_date: -1 })
      .toArray();
    return toObjs(docs);
  });

export const getDocumentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("student_documents")
      .find({ student_id: data.studentId })
      .sort({ created_at: -1 })
      .toArray();
    return toObjs(docs);
  });

export const getTransfersFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("student_transfers")
      .find({ student_id: data.studentId })
      .sort({ created_at: -1 })
      .toArray();
    const transfers = toObjs(docs);

    // Attach batch names
    const batchIds = [
      ...new Set([
        ...transfers.map((t: any) => t.from_batch_id).filter(Boolean),
        ...transfers.map((t: any) => t.to_batch_id).filter(Boolean),
      ]),
    ];
    if (batchIds.length) {
      const safeOId = (id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return id as any;
        }
      };
      const batches = await db
        .collection("batches")
        .find({ _id: { $in: batchIds.map(safeOId) } })
        .project({ name: 1 })
        .toArray();
      const bMap: Record<string, string> = {};
      for (const b of batches) bMap[b._id.toString()] = b.name as string;
      return transfers.map((t: any) => ({
        ...t,
        from_batch: t.from_batch_id ? { name: bMap[t.from_batch_id] || null } : null,
        to_batch: t.to_batch_id ? { name: bMap[t.to_batch_id] || null } : null,
      }));
    }
    return transfers;
  });

export const getPlanUpgradesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("plan_upgrades")
      .find({ student_id: data.studentId })
      .sort({ created_at: -1 })
      .toArray();
    return toObjs(docs);
  });

export const getConcessionCancelsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { studentId: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("concession_cancellations")
      .find({ student_id: data.studentId })
      .sort({ created_at: -1 })
      .toArray();
    return toObjs(docs);
  });

// ── student actions ───────────────────────────────────────────────────────────

export const updateInstallmentAmountFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; amount: number }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };
    const inst = await db.collection("installments").findOne({ _id: safeOId(data.id) });
    if (!inst) throw new Error("Installment not found");
    const newStatus = calcInstallmentStatus(
      data.amount,
      Number(inst.amount_paid),
      inst.due_date as string,
    );
    await db
      .collection("installments")
      .updateOne(
        { _id: safeOId(data.id) },
        { $set: { amount: data.amount, status: newStatus, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

export const createTransferFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      student_id: string;
      kind: string;
      from_batch_id?: string | null;
      to_batch_id?: string | null;
      from_campus_id?: string | null;
      to_campus_id?: string | null;
      from_class?: string | null;
      to_class?: string | null;
      reason?: string | null;
      performed_by?: string | null;
      performed_by_name?: string;
      batch_id_update?: string | null;
      campus_id_update?: string | null;
      class_year_update?: string | null;
      course_id_update?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const now = new Date().toISOString();
    const {
      batch_id_update,
      campus_id_update,
      class_year_update,
      course_id_update,
      student_id,
      ...transferData
    } = data;

    // Update student fields
    const studentUpdate: Record<string, any> = { updated_at: now };
    if (batch_id_update !== undefined) studentUpdate.batch_id = batch_id_update;
    if (campus_id_update !== undefined) studentUpdate.campus_id = campus_id_update;
    if (class_year_update !== undefined) studentUpdate.class_year = class_year_update;
    if (course_id_update !== undefined) studentUpdate.course_id = course_id_update;

    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };
    await db
      .collection("students")
      .updateOne({ _id: safeOId(student_id) }, { $set: studentUpdate });

    // Insert transfer record
    await db.collection("student_transfers").insertOne({
      ...transferData,
      student_id,
      created_at: now,
    });

    return { ok: true };
  });

export const cancelConcessionFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      student_id: string;
      fee_assignment_id: string;
      original_discount: number;
      cancelled_amount: number;
      new_net_payable: number;
      new_discount: number;
      reason: string | null;
      performed_by: string | null;
      performed_by_name: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requirePermission("canCancelConcession");
    const db = await getDb();
    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };
    const now = new Date().toISOString();

    // Update fee assignment
    const fa = await db
      .collection("fee_assignments")
      .findOne({ _id: safeOId(data.fee_assignment_id) });
    if (!fa) throw new Error("Fee assignment not found");

    await db.collection("fee_assignments").updateOne(
      { _id: safeOId(data.fee_assignment_id) },
      {
        $set: {
          discount_amount: data.new_discount,
          net_payable: data.new_net_payable,
          concession_cancelled_amount:
            Number(fa.concession_cancelled_amount || 0) + data.cancelled_amount,
          updated_at: now,
        },
      },
    );

    // Find next unpaid installment and add cancelled amount
    const installments = await db
      .collection("installments")
      .find({ fee_assignment_id: data.fee_assignment_id })
      .sort({ installment_no: 1 })
      .toArray();

    const nextUnpaid = installments.find((i) => Number(i.amount) - Number(i.amount_paid) > 0);
    if (nextUnpaid) {
      const newAmount = Number(nextUnpaid.amount) + data.cancelled_amount;
      const newStatus = calcInstallmentStatus(
        newAmount,
        Number(nextUnpaid.amount_paid),
        nextUnpaid.due_date as string,
      );
      await db
        .collection("installments")
        .updateOne(
          { _id: nextUnpaid._id },
          { $set: { amount: newAmount, status: newStatus, updated_at: now } },
        );
    }

    // Insert cancellation record
    await db.collection("concession_cancellations").insertOne({
      student_id: data.student_id,
      fee_assignment_id: data.fee_assignment_id,
      original_discount: data.original_discount,
      cancelled_amount: data.cancelled_amount,
      new_net_payable: data.new_net_payable,
      reason: data.reason,
      performed_by: data.performed_by,
      performed_by_name: data.performed_by_name,
      created_at: now,
      revoked_at: null,
      revoked_by: null,
      revoked_by_name: null,
      revocation_reason: null,
    });

    return { ok: true };
  });

export const revokeConcessionCancellationFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      concessionCancelId: string;
      reason: string | null;
      performed_by: string | null;
      performed_by_name: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requirePermission("canRevokeConcessionCancellation");
    const db = await getDb();
    const now = new Date().toISOString();
    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };

    const cancelRecord = await db
      .collection("concession_cancellations")
      .findOne({ _id: safeOId(data.concessionCancelId) });
    if (!cancelRecord) throw new Error("Concession cancellation record not found");
    if (cancelRecord.revoked_at) throw new Error("Cancellation already revoked");

    const cancelledAmount = Number(cancelRecord.cancelled_amount || 0);
    if (cancelledAmount <= 0) throw new Error("Invalid cancellation amount");

    const feeAssignmentId = cancelRecord.fee_assignment_id as string;
    const feeAssignment = await db
      .collection("fee_assignments")
      .findOne({ _id: safeOId(feeAssignmentId) });
    if (!feeAssignment) throw new Error("Fee assignment not found");

    const discountAmount = Number(feeAssignment.discount_amount || 0);
    const netPayable = Number(feeAssignment.net_payable || 0);
    const concessionCancelledAmount = Number(feeAssignment.concession_cancelled_amount || 0);

    await db.collection("fee_assignments").updateOne(
      { _id: safeOId(feeAssignmentId) },
      {
        $set: {
          discount_amount: discountAmount + cancelledAmount,
          net_payable: Math.max(0, netPayable - cancelledAmount),
          concession_cancelled_amount: Math.max(0, concessionCancelledAmount - cancelledAmount),
          updated_at: now,
        },
      },
    );

    const installments = await db
      .collection("installments")
      .find({ fee_assignment_id: feeAssignmentId })
      .sort({ installment_no: 1 })
      .toArray();
    const nextUnpaid = installments.find((i) => Number(i.amount) - Number(i.amount_paid) > 0);
    if (nextUnpaid) {
      const nextAmount = Math.max(0, Number(nextUnpaid.amount) - cancelledAmount);
      const nextStatus = calcInstallmentStatus(
        nextAmount,
        Number(nextUnpaid.amount_paid),
        nextUnpaid.due_date as string,
      );
      await db
        .collection("installments")
        .updateOne(
          { _id: nextUnpaid._id },
          { $set: { amount: nextAmount, status: nextStatus, updated_at: now } },
        );
    }

    await db.collection("concession_cancellations").updateOne(
      { _id: safeOId(data.concessionCancelId) },
      {
        $set: {
          revoked_at: now,
          revoked_by: data.performed_by,
          revoked_by_name: data.performed_by_name,
          revocation_reason: data.reason ?? null,
          updated_at: now,
        },
      },
    );

    return { ok: true };
  });

export const upgradePlanFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      student_id: string;
      fee_assignment_id: string;
      from_plan: string;
      to_plan: string;
      reason: string;
      performed_by: string | null;
      performed_by_name: string;
      new_installments: Array<{
        installment_no: number;
        amount: number;
        due_date: string;
        month_label: string;
      }>;
      delete_installment_ids: string[];
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const safeOId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch {
        return id as any;
      }
    };
    const now = new Date().toISOString();

    // Delete unpaid installments
    if (data.delete_installment_ids.length > 0) {
      await db.collection("installments").deleteMany({
        _id: { $in: data.delete_installment_ids.map(safeOId) },
      });
    }

    // Insert new installments
    if (data.new_installments.length > 0) {
      await db.collection("installments").insertMany(
        data.new_installments.map((inst) => ({
          fee_assignment_id: data.fee_assignment_id,
          student_id: data.student_id,
          installment_no: inst.installment_no,
          amount: inst.amount,
          amount_paid: 0,
          due_date: inst.due_date,
          month_label: inst.month_label,
          status: calcInstallmentStatus(inst.amount, 0, inst.due_date),
          late_fee: 0,
          is_registration: false,
          created_at: now,
          updated_at: now,
        })),
      );
    }

    // Update fee assignment plan_kind
    await db
      .collection("fee_assignments")
      .updateOne(
        { _id: safeOId(data.fee_assignment_id) },
        { $set: { plan_kind: data.to_plan, updated_at: now } },
      );

    // Insert plan upgrade record
    await db.collection("plan_upgrades").insertOne({
      student_id: data.student_id,
      fee_assignment_id: data.fee_assignment_id,
      from_plan: data.from_plan,
      to_plan: data.to_plan,
      reason: data.reason,
      performed_by: data.performed_by,
      performed_by_name: data.performed_by_name,
      created_at: now,
    });

    return { ok: true };
  });

// ── browse (for collect page) ─────────────────────────────────────────────────

export const getBrowseStudentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { courseId?: string; studentStatus?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const filter: Record<string, any> = {};
    if (data.courseId && data.courseId !== "all") filter.course_id = data.courseId;
    if (data.studentStatus && data.studentStatus !== "all") filter.status = data.studentStatus;

    const studentDocs = await db
      .collection("students")
      .find(filter)
      .sort({ full_name: 1 })
      .limit(500)
      .toArray();
    const students = toObjs(studentDocs);

    if (!students.length) return [];

    // Get installments for all these students
    const studentIds = students.map((s: any) => s.id);
    const installments = await db
      .collection("installments")
      .find({ student_id: { $in: studentIds } })
      .toArray();

    const today = new Date().toISOString().slice(0, 10);
    const agg: Record<string, { total: number; paid: number; hasOverdue: boolean }> = {};
    for (const i of installments) {
      const sid = i.student_id as string;
      const a = agg[sid] || { total: 0, paid: 0, hasOverdue: false };
      a.total += Number(i.amount);
      a.paid += Number(i.amount_paid);
      const remaining = Number(i.amount) - Number(i.amount_paid);
      if (remaining > 0 && (i.due_date as string) < today) a.hasOverdue = true;
      agg[sid] = a;
    }

    // Attach course and batch names
    const withNames = await attachCourseAndBatch(db, students);
    return withNames.map((s: any) => {
      const a = agg[s.id] || { total: 0, paid: 0, hasOverdue: false };
      const due = a.total - a.paid;
      let pay_status: "paid" | "partial" | "due" | "overdue" = "due";
      if (a.total === 0) pay_status = "due";
      else if (due <= 0) pay_status = "paid";
      else if (a.hasOverdue) pay_status = "overdue";
      else if (a.paid > 0) pay_status = "partial";
      return { ...s, total: a.total, paid: a.paid, due, pay_status };
    });
  });
