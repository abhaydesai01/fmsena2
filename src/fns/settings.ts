import { createServerFn } from "@tanstack/react-start";
import { getDb, toObj } from "./db";

const DEFAULT_SETTINGS = {
  institute_name: "Excellent NEET Academy",
  institute_address: "Dharwad",
  active_academic_year: "2025-26",
  admission_prefix: "ENA",
  receipt_prefix: "RCP",
  grace_period_days: 5,
  late_fee_amount: 0,
  late_fee_percent: 0,
  bounce_charge: 500,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const getSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  let doc = await db.collection("settings").findOne({});
  if (!doc) {
    const result = await db.collection("settings").insertOne({ ...DEFAULT_SETTINGS });
    doc = await db.collection("settings").findOne({ _id: result.insertedId });
  }
  return toObj(doc);
});

export const updateSettingsFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      institute_name: string;
      institute_address: string;
      active_academic_year: string;
      admission_prefix: string;
      receipt_prefix: string;
      grace_period_days: number;
      late_fee_amount: number;
      late_fee_percent: number;
      bounce_charge: number;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await getDb();
    const { id, ...updates } = data;
    await db
      .collection("settings")
      .updateOne({}, { $set: { ...updates, updated_at: new Date().toISOString() } });
    return { ok: true };
  });
