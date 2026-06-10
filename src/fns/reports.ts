import { createServerFn } from "@tanstack/react-start";
import { getDb, toObjs, toObjectId } from "./db";

// Single shared helper — converts a string ID to ObjectId safely
const safeOId = (id: string) => toObjectId(id) ?? (id as any);

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashTodayCollectionFn = createServerFn({ method: "GET" })
  .inputValidator((d: { today: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("payments")
      .find({ payment_date: data.today, status: { $ne: "cancelled" } })
      .toArray();
    const filteredPayments = data.campusId
      ? (() => {
          const studentIds = [...new Set(docs.map((p) => p.student_id as string).filter(Boolean))];
          if (!studentIds.length) return [];
          return db
            .collection("students")
            .find({ _id: { $in: studentIds.map(safeOId) }, campus_id: data.campusId })
            .project({ _id: 1 })
            .toArray()
            .then((students) => {
              const allowed = new Set(students.map((s) => s._id.toString()));
              return docs.filter((p) => allowed.has(String(p.student_id)));
            });
        })()
      : Promise.resolve(docs);
    const payments = await filteredPayments;
    const total = payments.reduce((s, p) => s + Number(p.amount), 0);
    const byMode: Record<string, number> = {};
    for (const p of payments) {
      const m = p.payment_mode as string;
      byMode[m] = (byMode[m] || 0) + Number(p.amount);
    }
    return { total, byMode };
  });

export const getDashDuesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { today: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    let studentIds: string[] | null = null;
    if (data.campusId) {
      const students = await db
        .collection("students")
        .find({ campus_id: data.campusId }, { projection: { _id: 1 } })
        .toArray();
      studentIds = students.map((s) => s._id.toString());
      if (!studentIds.length) return { outstanding: 0, overdueCount: 0, dueToday: 0 };
    }
    const docs = await db
      .collection("installments")
      .find(studentIds ? { student_id: { $in: studentIds } } : {})
      .toArray();
    const outstanding = docs.reduce(
      (s, i) => s + Math.max(0, Number(i.amount) - Number(i.amount_paid)),
      0,
    );
    const overdueCount = docs.filter(
      (i) =>
        i.status !== "paid" &&
        (i.due_date as string) < data.today,
    ).length;
    const dueToday = docs.filter(
      (i) => (i.due_date as string) === data.today && i.status !== "paid",
    ).length;
    return { outstanding, overdueCount, dueToday };
  });

export const getDashRecentPaymentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("payments")
      .find({})
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    const payments = toObjs(docs);

    const studentIds = [...new Set(payments.map((p: any) => p.student_id).filter(Boolean))];
    if (!studentIds.length) return [];
    const studentFilter: Record<string, unknown> = { _id: { $in: studentIds.map(safeOId) } };
    if (data.campusId) studentFilter.campus_id = data.campusId;
    const students = await db
      .collection("students")
      .find(studentFilter)
      .project({ full_name: 1, admission_number: 1 })
      .toArray();
    const sMap: Record<string, any> = {};
    for (const s of students) sMap[s._id.toString()] = s;
    return payments
      .filter((p: any) => Boolean(sMap[p.student_id]))
      .slice(0, 10)
      .map((p: any) => ({
        ...p,
        student_name: sMap[p.student_id]?.full_name || null,
      }));
  });

export const getDashNewEnrollmentsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
  const db = await getDb();
  const today = new Date();
  const sinceMonth = new Date(today);
  sinceMonth.setDate(sinceMonth.getDate() - 30);
  const sinceWeek = new Date(today);
  sinceWeek.setDate(sinceWeek.getDate() - 7);
  const campusFilter = data.campusId ? { campus_id: data.campusId } : {};

  const [month, week] = await Promise.all([
    db.collection("students").countDocuments({
      ...campusFilter,
      admission_date: { $gte: sinceMonth.toISOString().slice(0, 10) },
    }),
    db.collection("students").countDocuments({
      ...campusFilter,
      admission_date: { $gte: sinceWeek.toISOString().slice(0, 10) },
    }),
  ]);
  return { month, week };
});

export const getDashBatchesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
  const db = await getDb();
  const campusFilter = data.campusId ? { campus_id: data.campusId } : {};
  const [batchDocs, studentDocs] = await Promise.all([
    db.collection("batches").find(campusFilter).toArray(),
    db
      .collection("students")
      .find(campusFilter, { projection: { batch_id: 1 } })
      .toArray(),
  ]);

  const courseIds = [...new Set(batchDocs.map((b) => b.course_id as string).filter(Boolean))];
  const courses = courseIds.length
    ? await db.collection("courses").find({ _id: { $in: courseIds.map(safeOId) } }).project({ name: 1 }).toArray()
    : [];
  const cMap: Record<string, string> = {};
  for (const c of courses) cMap[c._id.toString()] = c.name as string;

  const counts: Record<string, number> = {};
  for (const s of studentDocs) {
    const k = s.batch_id as string;
    counts[k] = (counts[k] || 0) + 1;
  }

  return batchDocs.map((b) => ({
    id: b._id.toString(),
    name: b.name,
    capacity: b.capacity,
    status: b.status,
    course_name: cMap[b.course_id as string] || null,
    enrolled: counts[b._id.toString()] ?? 0,
  }));
});

// ── Defaulters ────────────────────────────────────────────────────────────────

export const getDefaultersFn = createServerFn({ method: "GET" })
  .inputValidator((d: { today: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    let studentIdsForCampus: string[] | null = null;
    if (data.campusId) {
      const students = await db
        .collection("students")
        .find({ campus_id: data.campusId }, { projection: { _id: 1 } })
        .toArray();
      studentIdsForCampus = students.map((s) => s._id.toString());
      if (!studentIdsForCampus.length) return [];
    }
    const filter: Record<string, unknown> = {
      due_date: { $lt: data.today },
      status: { $ne: "paid" },
    };
    if (studentIdsForCampus) filter.student_id = { $in: studentIdsForCampus };
    const docs = await db
      .collection("installments")
      .find(filter)
      .sort({ due_date: 1 })
      .limit(500)
      .toArray();
    const installments = toObjs(docs);

    const studentIds = [...new Set(installments.map((i: any) => i.student_id).filter(Boolean))];
    if (!studentIds.length) return [];
    const students = await db
      .collection("students")
      .find({ _id: { $in: studentIds.map(safeOId) } })
      .toArray();
    const sMap: Record<string, any> = {};
    for (const s of students) sMap[s._id.toString()] = s;

    const courseIds = [...new Set(Object.values(sMap).map((s: any) => s.course_id).filter(Boolean))];
    const courses = courseIds.length
      ? await db.collection("courses").find({ _id: { $in: (courseIds as string[]).map(safeOId) } }).project({ name: 1 }).toArray()
      : [];
    const cMap: Record<string, string> = {};
    for (const c of courses) cMap[c._id.toString()] = c.name as string;

    return installments.map((i: any) => {
      const s = sMap[i.student_id];
      return {
        ...i,
        student_id: i.student_id,
        student_name: s?.full_name || null,
        admission_number: s?.admission_number || null,
        mobile: s?.mobile || null,
        course_name: s ? (cMap[s.course_id] || null) : null,
      };
    });
  });

export const sendReminderFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { studentId: string; mobile: string; channel: string; message: string }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    await db.collection("reminders").insertOne({
      student_id: data.studentId,
      recipient_mobile: data.mobile,
      kind: "overdue",
      channel: data.channel,
      message: data.message,
      triggered_by: null,
      language: "en",
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const getInstallmentDueBucketsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { today: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    let studentIds: string[] | null = null;
    if (data.campusId) {
      const students = await db
        .collection("students")
        .find({ campus_id: data.campusId }, { projection: { _id: 1 } })
        .toArray();
      studentIds = students.map((s) => s._id.toString());
      if (!studentIds.length) return { dueToday: [], dueThisWeek: [], overdue: [] };
    }

    const today = new Date(data.today);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);
    const todayIso = today.toISOString().slice(0, 10);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);

    const filter: Record<string, any> = {
      status: { $ne: "paid" },
      is_registration: { $ne: true },
      due_date: { $lte: weekEndIso },
    };
    if (studentIds) filter.student_id = { $in: studentIds };
    const docs = await db.collection("installments").find(filter).sort({ due_date: 1 }).toArray();
    const rows = toObjs(docs);
    const dueToday = rows.filter((r: any) => r.due_date === todayIso);
    const dueThisWeek = rows.filter((r: any) => r.due_date > todayIso && r.due_date <= weekEndIso);
    const overdue = rows.filter((r: any) => r.due_date < todayIso);
    return { dueToday, dueThisWeek, overdue };
  });

export const runAutomatedRemindersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { today: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const today = new Date(data.today);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const before7 = new Date(today);
    before7.setDate(today.getDate() + 7);
    const after7 = new Date(today);
    after7.setDate(today.getDate() - 7);

    const dueDates = [fmt(before7), fmt(today), fmt(after7)];
    const studentsFilter: Record<string, any> = {};
    if (data.campusId) studentsFilter.campus_id = data.campusId;
    const students = await db
      .collection("students")
      .find(studentsFilter, { projection: { _id: 1, full_name: 1, mobile: 1 } })
      .toArray();
    const studentMap: Record<string, { full_name: string; mobile: string }> = {};
    for (const s of students) studentMap[s._id.toString()] = { full_name: s.full_name, mobile: s.mobile };
    const studentIds = Object.keys(studentMap);
    if (!studentIds.length) return { created: 0 };

    const pendingInst = await db
      .collection("installments")
      .find({
        student_id: { $in: studentIds },
        is_registration: { $ne: true },
        status: { $ne: "paid" },
        due_date: { $in: dueDates },
      })
      .toArray();

    let created = 0;
    for (const inst of pendingInst) {
      const dueDate = String(inst.due_date);
      let kind = "on_due";
      if (dueDate === fmt(before7)) kind = "before_7_days";
      else if (dueDate === fmt(after7)) kind = "after_7_days";
      const reminderKey = `${inst.student_id}:${inst._id.toString()}:${kind}:${data.today}`;
      const exists = await db.collection("reminders").findOne({ reminder_key: reminderKey });
      if (exists) continue;
      const student = studentMap[String(inst.student_id)];
      if (!student?.mobile) continue;
      const pending = Math.max(0, Number(inst.amount) - Number(inst.amount_paid));
      await db.collection("reminders").insertOne({
        reminder_key: reminderKey,
        student_id: inst.student_id,
        installment_id: inst._id.toString(),
        recipient_mobile: student.mobile,
        kind,
        channel: "sms",
        message: `Fee reminder: ${student.full_name}, installment due on ${dueDate}. Pending amount ${pending}.`,
        triggered_by: "system",
        language: "en",
        created_at: new Date().toISOString(),
      });
      created += 1;
    }
    return { created };
  });

// ── Reports ───────────────────────────────────────────────────────────────────

export const getCollectionsReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { from: string; to: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const docs = await db
      .collection("payments")
      .find({
        payment_date: { $gte: data.from, $lte: data.to },
        status: { $ne: "cancelled" },
      })
      .sort({ payment_date: -1 })
      .limit(1000)
      .toArray();
    const payments = toObjs(docs);

    const studentIds = [...new Set(payments.map((p: any) => p.student_id).filter(Boolean))];
    const studentFilter: Record<string, unknown> = { _id: { $in: studentIds.map(safeOId) } };
    if (data.campusId) studentFilter.campus_id = data.campusId;
    const students = studentIds.length
      ? await db
          .collection("students")
          .find(studentFilter)
          .project({ full_name: 1, admission_number: 1 })
          .toArray()
      : [];
    const sMap: Record<string, any> = {};
    for (const s of students) sMap[s._id.toString()] = s;

    return payments
      .filter((p: any) => Boolean(sMap[p.student_id]))
      .map((p: any) => ({
      ...p,
      students: sMap[p.student_id]
        ? { full_name: sMap[p.student_id].full_name, admission_number: sMap[p.student_id].admission_number }
        : null,
      }));
  });

export const getStudentPaymentHistoryReportFn = createServerFn({ method: "GET" })
  .inputValidator(
    (d: {
      from: string;
      to: string;
      campusId?: string;
      q?: string;
      mode?: string;
      status?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const paymentFilter: Record<string, any> = {
      payment_date: { $gte: data.from, $lte: data.to },
    };
    if (data.mode && data.mode !== "all") paymentFilter.payment_mode = data.mode;
    if (data.status && data.status !== "all") paymentFilter.status = data.status;

    const q = String(data.q || "").trim();
    let scopedStudentIds: string[] | null = null;
    if (q || data.campusId) {
      const studentFilter: Record<string, any> = {};
      if (data.campusId) studentFilter.campus_id = data.campusId;
      if (q) {
        studentFilter.$or = [
          { full_name: { $regex: q, $options: "i" } },
          { admission_number: { $regex: q, $options: "i" } },
          { mobile: { $regex: q, $options: "i" } },
        ];
      }
      const students = await db
        .collection("students")
        .find(studentFilter, { projection: { _id: 1 } })
        .toArray();
      scopedStudentIds = students.map((s) => s._id.toString());
      if (!scopedStudentIds.length) return [];
      paymentFilter.student_id = { $in: scopedStudentIds };
    }

    const docs = await db
      .collection("payments")
      .find(paymentFilter)
      .sort({ payment_date: -1, created_at: -1 })
      .limit(2000)
      .toArray();
    const payments = toObjs(docs);
    const studentIds = [...new Set(payments.map((p: any) => p.student_id).filter(Boolean))];
    if (!studentIds.length) return [];

    const students = await db
      .collection("students")
      .find({ _id: { $in: studentIds.map(safeOId) } })
      .project({ full_name: 1, admission_number: 1, mobile: 1, course_id: 1 })
      .toArray();
    const sMap: Record<string, any> = {};
    for (const s of students) sMap[s._id.toString()] = s;

    const courseIds = [...new Set(students.map((s) => s.course_id as string).filter(Boolean))];
    const courses = courseIds.length
      ? await db
          .collection("courses")
          .find({ _id: { $in: courseIds.map(safeOId) } })
          .project({ name: 1 })
          .toArray()
      : [];
    const cMap: Record<string, string> = {};
    for (const c of courses) cMap[c._id.toString()] = c.name as string;

    return payments
      .filter((p: any) => Boolean(sMap[p.student_id]))
      .map((p: any) => {
        const s = sMap[p.student_id];
        return {
          ...p,
          students: {
            full_name: s.full_name,
            admission_number: s.admission_number,
            mobile: s.mobile,
            courses: s.course_id ? { name: cMap[s.course_id] || null } : null,
          },
        };
      });
  });

export const getOutstandingReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const studentFilter: Record<string, unknown> = {};
  if (data.campusId) studentFilter.campus_id = data.campusId;
  const students = await db
    .collection("students")
    .find(studentFilter)
    .project({ _id: 1, full_name: 1, admission_number: 1, course_id: 1 })
    .toArray();
  const studentIds = students.map((s) => s._id.toString());
  if (!studentIds.length) return [];
  const docs = await db
    .collection("installments")
    .find({ status: { $ne: "paid" }, student_id: { $in: studentIds } })
    .limit(2000)
    .toArray();

  const courseIds = [...new Set(students.map((s) => s.course_id as string).filter(Boolean))];
  const courses = courseIds.length
    ? await db.collection("courses").find({ _id: { $in: courseIds.map(safeOId) } }).project({ name: 1 }).toArray()
    : [];
  const cMap: Record<string, string> = {};
  for (const c of courses) cMap[c._id.toString()] = c.name as string;
  const sMap: Record<string, any> = {};
  for (const s of students) sMap[s._id.toString()] = { ...s, course_name: cMap[s.course_id as string] || "—" };

  const map = new Map<string, { student_id: string; name: string; adm: string; course: string; outstanding: number; overdue: number }>();
  for (const i of docs) {
    const sid = i.student_id as string;
    const s = sMap[sid];
    if (!s) continue;
    const remain = Number(i.amount) - Number(i.amount_paid);
    const cur = map.get(sid) || { student_id: sid, name: s.full_name, adm: s.admission_number, course: s.course_name, outstanding: 0, overdue: 0 };
    cur.outstanding += remain;
    if ((i.due_date as string) < today) cur.overdue += remain;
    map.set(sid, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
});

export const getMonthlyDuesReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { month: string; statusFilter?: string; campusId?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const [y, m] = data.month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(y, m, 0);
    const end = endDate.toISOString().slice(0, 10);

    const filter: Record<string, any> = { due_date: { $gte: start, $lte: end } };
    if (data.statusFilter && data.statusFilter !== "all") filter.status = data.statusFilter;

    if (data.campusId) {
      const students = await db
        .collection("students")
        .find({ campus_id: data.campusId }, { projection: { _id: 1 } })
        .toArray();
      const ids = students.map((s) => s._id.toString());
      if (!ids.length) return [];
      filter.student_id = { $in: ids };
    }
    const docs = await db.collection("installments").find(filter).sort({ due_date: 1 }).toArray();
    const installments = toObjs(docs);

    const studentIds = [...new Set(installments.map((i: any) => i.student_id).filter(Boolean))];
    const students = studentIds.length
      ? await db.collection("students").find({ _id: { $in: studentIds.map(safeOId) } }).toArray()
      : [];
    const sMap: Record<string, any> = {};
    for (const s of students) sMap[s._id.toString()] = s;

    const courseIds = [...new Set(students.map((s) => s.course_id as string).filter(Boolean))];
    const batchIds = [...new Set(students.map((s) => s.batch_id as string).filter(Boolean))];
    const [courses, batches] = await Promise.all([
      courseIds.length ? db.collection("courses").find({ _id: { $in: courseIds.map(safeOId) } }).project({ name: 1 }).toArray() : Promise.resolve([]),
      batchIds.length ? db.collection("batches").find({ _id: { $in: batchIds.map(safeOId) } }).project({ name: 1 }).toArray() : Promise.resolve([]),
    ]);
    const cMap: Record<string, string> = {};
    for (const c of courses) cMap[c._id.toString()] = c.name as string;
    const bMap: Record<string, string> = {};
    for (const b of batches) bMap[b._id.toString()] = b.name as string;

    return installments.map((i: any) => {
      const s = sMap[i.student_id];
      return {
        ...i,
        students: s ? {
          id: s._id.toString(), full_name: s.full_name, admission_number: s.admission_number, mobile: s.mobile,
          courses: cMap[s.course_id] ? { name: cMap[s.course_id] } : null,
          batches: bMap[s.batch_id] ? { name: bMap[s.batch_id] } : null,
        } : null,
      };
    });
  });

export const getCourseReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
  const db = await getDb();
  const courseFilter: Record<string, unknown> = {};
  if (data.campusId) courseFilter.campus_id = data.campusId;
  const courses = await db.collection("courses").find(courseFilter).project({ name: 1 }).toArray();

  return Promise.all(
    courses.map(async (c) => {
      const students = await db
        .collection("students")
        .find({ course_id: c._id.toString() })
        .project({ _id: 1 })
        .toArray();
      const sIds = students.map((s) => s._id.toString());
      if (!sIds.length) return { name: c.name, total: 0, paid: 0, outstanding: 0 };

      const installments = await db
        .collection("installments")
        .find({ student_id: { $in: sIds } })
        .toArray();
      const total = installments.reduce((s, i) => s + Number(i.amount), 0);
      const paid = installments.reduce((s, i) => s + Number(i.amount_paid), 0);
      return { name: c.name, total, paid, outstanding: total - paid };
    }),
  );
});

export const getConcessionsReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
  const db = await getDb();
  const docs = await db
    .collection("fee_assignments")
    .find({ discount_amount: { $gt: 0 } })
    .limit(2000)
    .toArray();
  const fas = toObjs(docs);

  const studentIds = [...new Set(fas.map((f: any) => f.student_id).filter(Boolean))];
  const studentFilter: Record<string, unknown> = { _id: { $in: studentIds.map(safeOId) } };
  if (data.campusId) studentFilter.campus_id = data.campusId;
  const students = studentIds.length
    ? await db.collection("students").find(studentFilter).toArray()
    : [];
  const sMap: Record<string, any> = {};
  for (const s of students) sMap[s._id.toString()] = s;

  const courseIds = [...new Set(students.map((s) => s.course_id as string).filter(Boolean))];
  const courses = courseIds.length
    ? await db.collection("courses").find({ _id: { $in: courseIds.map(safeOId) } }).project({ name: 1 }).toArray()
    : [];
  const cMap: Record<string, string> = {};
  for (const c of courses) cMap[c._id.toString()] = c.name as string;

  return fas
    .filter((f: any) => Boolean(sMap[f.student_id]))
    .map((f: any) => {
    const s = sMap[f.student_id];
    return {
      ...f,
      students: s ? {
        full_name: s.full_name, admission_number: s.admission_number, mobile: s.mobile,
        courses: cMap[s.course_id] ? { name: cMap[s.course_id] } : null,
      } : null,
    };
    });
});

export const getChecklistCountsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const [courses, batches, students, installments, payments] = await Promise.all([
    db.collection("courses").countDocuments({ is_active: true }),
    db.collection("batches").countDocuments({ status: { $ne: "closed" } }),
    db.collection("students").countDocuments({ status: "active" }),
    db.collection("installments").countDocuments({ status: { $ne: "paid" } }),
    db.collection("payments").countDocuments({ status: { $ne: "cancelled" } }),
  ]);
  return { courses, batches, students, installments, payments };
});

export const getPlanUpgradesReportFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string }) => d)
  .handler(async ({ data }) => {
  const db = await getDb();
  const docs = await db
    .collection("plan_upgrades")
    .find({})
    .sort({ created_at: -1 })
    .limit(1000)
    .toArray();
  const upgrades = toObjs(docs);

  const studentIds = [...new Set(upgrades.map((u: any) => u.student_id).filter(Boolean))];
  if (!studentIds.length) return upgrades;
  const studentFilter: Record<string, unknown> = { _id: { $in: studentIds.map(safeOId) } };
  if (data.campusId) studentFilter.campus_id = data.campusId;
  const students = await db.collection("students").find(studentFilter).toArray();
  const sMap: Record<string, any> = {};
  for (const s of students) sMap[s._id.toString()] = s;

  const courseIds = [...new Set(students.map((s) => s.course_id as string).filter(Boolean))];
  const courses = courseIds.length
    ? await db.collection("courses").find({ _id: { $in: courseIds.map(safeOId) } }).project({ name: 1 }).toArray()
    : [];
  const cMap: Record<string, string> = {};
  for (const c of courses) cMap[c._id.toString()] = c.name as string;

  return upgrades
    .filter((u: any) => Boolean(sMap[u.student_id]))
    .map((u: any) => {
    const s = sMap[u.student_id];
    return {
      ...u,
      students: s ? {
        full_name: s.full_name, admission_number: s.admission_number,
        courses: cMap[s.course_id] ? { name: cMap[s.course_id] } : null,
      } : null,
    };
    });
});
