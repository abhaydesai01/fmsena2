import { MongoClient, Db, ObjectId } from "mongodb";
import * as nodeOs from "node:os";
import * as nodeCrypto from "node:crypto";

// The MongoDB Node.js driver calls require("os") and require("crypto") lazily
// inside function bodies. In an ESM / Cloudflare-Workers context there is no
// global `require`, so those calls throw "require is not defined".
// We patch globalThis.require ONCE here, before any MongoClient is created,
// so the driver's internal require() falls through to the correct ESM module.
if (typeof require === "undefined") {
  (globalThis as any).require = (mod: string) => {
    if (mod === "os") return nodeOs;
    if (mod === "crypto") return nodeCrypto;
    throw new Error(`require('${mod}') is not available in this runtime`);
  };
}

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://abhaydesai3_db_user:3HqcfRs5U35wH39a@cluster0.djydanj.mongodb.net/?appName=Cluster0";
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

let _client: MongoClient | null = null;
let _indexesReady = false;

async function ensureIndexes(db: Db) {
  if (_indexesReady) return;
  _indexesReady = true;
  try {
    await Promise.all([
      db.collection("students").createIndex({ campus_id: 1, status: 1 }),
      db.collection("students").createIndex({ campus_id: 1, course_id: 1, status: 1 }),
      db.collection("students").createIndex({ admission_number: 1 }, { sparse: true }),
      db.collection("students").createIndex({ mobile: 1 }, { sparse: true }),
      db.collection("installments").createIndex({ student_id: 1, installment_no: 1 }),
      db.collection("installments").createIndex({ student_id: 1, status: 1, due_date: 1 }),
      db.collection("installments").createIndex({ status: 1, due_date: 1 }),
      db.collection("payments").createIndex({ payment_date: 1, status: 1 }),
      db.collection("payments").createIndex({ student_id: 1, created_at: -1 }),
      db.collection("payments").createIndex({ created_at: -1 }),
      db.collection("fee_assignments").createIndex({ student_id: 1 }),
      db.collection("courses").createIndex({ campus_id: 1, is_active: 1 }),
      db.collection("batches").createIndex({ campus_id: 1, course_id: 1, status: 1 }),
    ]);
  } catch (e) {
    // Index creation should never block request handling.
    console.warn("Index warm-up skipped:", (e as Error)?.message || e);
  }
}

export async function getDb(): Promise<Db> {
  if (!_client) {
    _client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    await _client.connect();
  }
  const db = _client.db(DB_NAME);
  await ensureIndexes(db);
  return db;
}

/** Convert a MongoDB document (_id) to a plain object with string `id` field */
export function toObj<T = Record<string, unknown>>(doc: any): T {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id?.toString() ?? rest.id } as T;
}

export function toObjs<T = Record<string, unknown>>(docs: any[]): T[] {
  return (docs || []).map(toObj<T>);
}

/** Safely convert string to ObjectId, returning null on failure */
export function toObjectId(id: string | undefined | null): ObjectId | null {
  if (!id) return null;
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/**
 * Atomic counter for sequential numbering (admission/receipt numbers).
 * Mimics next_admission_number / next_receipt_number RPCs.
 */
export async function nextSequence(
  db: Db,
  key: string,
  prefix: string,
  year: string,
  width: number,
): Promise<string> {
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: `${key}_${year}` as any },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  const seq = result?.seq ?? 1;
  return `${prefix}/${year}/${String(seq).padStart(width, "0")}`;
}

/** Compute installment status given amount, amount_paid, and due_date */
export function calcInstallmentStatus(
  amount: number,
  amount_paid: number,
  due_date: string,
): "paid" | "partial" | "overdue" | "due" {
  if (amount_paid >= amount) return "paid";
  const today = new Date().toISOString().slice(0, 10);
  if (amount_paid > 0) return "partial";
  if (due_date < today) return "overdue";
  return "due";
}
