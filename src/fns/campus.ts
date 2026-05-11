import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import { getDb, toObj, toObjs } from "./db";

export const getCampusesFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection("campuses")
    .find({})
    .sort({ name: 1 })
    .toArray();
  return toObjs(docs);
});

export const getCampusesManageFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection("campuses")
    .find({})
    .sort({ created_at: -1 })
    .toArray();
  return toObjs(docs);
});

export const getCampusCourseCounts = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db.collection("courses").find({}, { projection: { campus_id: 1 } }).toArray();
  const map: Record<string, number> = {};
  for (const d of docs) {
    const k = d.campus_id as string;
    map[k] = (map[k] || 0) + 1;
  }
  return map;
});

export const createCampusFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      city: string | null;
      address: string | null;
      is_active: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const now = new Date().toISOString();
    const result = await db.collection("campuses").insertOne({
      ...data,
      created_at: now,
      updated_at: now,
    });
    return toObj(await db.collection("campuses").findOne({ _id: result.insertedId }));
  });

export const updateCampusFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      name: string;
      city: string | null;
      address: string | null;
      is_active: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, ...updates } = data;
    const db = await getDb();
    await db
      .collection("campuses")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

export const toggleCampusActiveFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; is_active: boolean }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    await db
      .collection("campuses")
      .updateOne(
        { _id: new ObjectId(data.id) },
        { $set: { is_active: data.is_active, updated_at: new Date().toISOString() } },
      );
    return { ok: true };
  });

export const deleteCampusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const [courses, batches, students] = await Promise.all([
      db.collection("courses").countDocuments({ campus_id: data.id }),
      db.collection("batches").countDocuments({ campus_id: data.id }),
      db.collection("students").countDocuments({ campus_id: data.id }),
    ]);
    if (courses + batches + students > 0) {
      throw new Error(
        `Cannot delete: ${courses} course(s), ${batches} batch(es), ${students} student(s) attached.`,
      );
    }
    await db.collection("campuses").deleteOne({ _id: new ObjectId(data.id) });
    return { ok: true };
  });
