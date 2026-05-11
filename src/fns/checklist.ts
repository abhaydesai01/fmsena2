import { createServerFn } from "@tanstack/react-start";
import { getDb } from "./db";

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
