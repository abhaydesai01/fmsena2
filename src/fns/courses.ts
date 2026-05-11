import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { getDb, toObj, toObjs } from "./db";

// ── Courses ──────────────────────────────────────────────────────────────────

export const getCoursesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string; activeOnly?: boolean }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const filter: Record<string, any> = {};
    if (data.campusId) filter.campus_id = data.campusId;
    if (data.activeOnly) filter.is_active = true;
    const docs = await db
      .collection("courses")
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();
    return toObjs(docs);
  });

export const getCourseStudentCountsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection("students")
    .find({}, { projection: { course_id: 1 } })
    .toArray();
  const map: Record<string, number> = {};
  for (const d of docs) {
    const k = d.course_id as string;
    map[k] = (map[k] || 0) + 1;
  }
  return map;
});

export const createCourseFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      academic_year: string;
      duration_months: number;
      gross_fee: number;
      registration_fee: number;
      material_fee: number;
      test_series_fee: number;
      is_active: boolean;
      campus_id: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const now = new Date().toISOString();
    const result = await db.collection("courses").insertOne({ ...data, created_at: now, updated_at: now });
    return toObj(await db.collection("courses").findOne({ _id: result.insertedId }));
  });

export const updateCourseFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      name: string;
      academic_year: string;
      duration_months: number;
      gross_fee: number;
      registration_fee: number;
      material_fee: number;
      test_series_fee: number;
      is_active: boolean;
      campus_id: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    const db = await getDb();
    await db
      .collection("courses")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

export const toggleCourseActiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; is_active: boolean }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    await db
      .collection("courses")
      .updateOne(
        { _id: new ObjectId(data.id) },
        { $set: { is_active: data.is_active, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

// ── Batches ──────────────────────────────────────────────────────────────────

export const getBatchesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { campusId?: string; courseId?: string; excludeClosed?: boolean }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const filter: Record<string, any> = {};
    if (data.campusId) filter.campus_id = data.campusId;
    if (data.courseId) filter.course_id = data.courseId;
    if (data.excludeClosed) filter.status = { $ne: "closed" };
    const docs = await db
      .collection("batches")
      .find(filter)
      .sort({ created_at: -1 })
      .toArray();

    // Attach course name
    const courseIds = [...new Set(docs.map((d) => d.course_id as string))];
    const courses = await db
      .collection("courses")
      .find({ _id: { $in: courseIds.map((id) => { try { return new ObjectId(id); } catch { return id as any; } }) } })
      .project({ name: 1 })
      .toArray();
    const courseMap: Record<string, string> = {};
    for (const c of courses) courseMap[c._id.toString()] = c.name as string;

    return toObjs(docs).map((b: any) => ({
      ...b,
      courses: courseMap[b.course_id] ? { name: courseMap[b.course_id] } : null,
    }));
  });

export const getBatchStudentCountsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection("students")
    .find({}, { projection: { batch_id: 1 } })
    .toArray();
  const map: Record<string, number> = {};
  for (const d of docs) {
    const k = d.batch_id as string;
    map[k] = (map[k] || 0) + 1;
  }
  return map;
});

export const createBatchFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      course_id: string;
      name: string;
      timing: string;
      capacity: number;
      academic_year: string;
      start_date: string | null;
      status: string;
      campus_id: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const now = new Date().toISOString();
    const result = await db.collection("batches").insertOne({ ...data, created_at: now, updated_at: now });
    return toObj(await db.collection("batches").findOne({ _id: result.insertedId }));
  });

export const updateBatchFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      course_id: string;
      name: string;
      timing: string;
      capacity: number;
      academic_year: string;
      start_date: string | null;
      status: string;
      campus_id: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    const db = await getDb();
    await db
      .collection("batches")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

export const setBatchStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    await db
      .collection("batches")
      .updateOne(
        { _id: new ObjectId(data.id) },
        { $set: { status: data.status, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

export const deleteBatchFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const count = await db.collection("students").countDocuments({ batch_id: data.id });
    if (count > 0) throw new Error(`Cannot delete: ${count} student(s) enrolled in this batch.`);
    await db.collection("batches").deleteOne({ _id: new ObjectId(data.id) });
    return { ok: true };
  });
