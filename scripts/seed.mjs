/**
 * Seed script — run once to bootstrap the database.
 *
 * Usage:
 *   node scripts/seed.mjs
 *
 * What it does:
 *   1. Creates the first admin user (email + password of your choice below)
 *   2. Creates one default campus
 *   3. Seeds institute settings
 *
 * Edit the SEED_* constants below before running.
 */

import { MongoClient } from "mongodb";
import { createHash } from "crypto";

// ─── CONFIG — edit these ───────────────────────────────────────────────────
const MONGO_URI =
  process.env.MONGO_URI ||
  "";
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

const ADMIN_EMAIL = "admin@example.com";   // ← change to your email
const ADMIN_PASSWORD = "Admin@123456";     // ← change to a strong password
const ADMIN_NAME = "Super Admin";          // ← change to your name

const CAMPUS_NAME = "Dharwad";
const CAMPUS_CITY = "Dharwad";

// ─── helpers ───────────────────────────────────────────────────────────────

// bcryptjs is a dependency of the project — use it via dynamic import
async function hashPassword(plain) {
  // Dynamic import so this script can run with node --experimental-vm-modules
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(plain, 12);
}

// ─── main ──────────────────────────────────────────────────────────────────
const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
});

try {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required. Set it in your environment (.env).");
  }
  await client.connect();
  console.log("✓ Connected to MongoDB");

  const db = client.db(DB_NAME);
  const now = new Date().toISOString();

  // 1. Admin user
  const existingAdmin = await db
    .collection("users")
    .findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (existingAdmin) {
    console.log(`⚠  User ${ADMIN_EMAIL} already exists — skipping user creation.`);
  } else {
    const password_hash = await hashPassword(ADMIN_PASSWORD);
    const userResult = await db.collection("users").insertOne({
      email: ADMIN_EMAIL.toLowerCase(),
      password_hash,
      role: "admin",
      full_name: ADMIN_NAME,
      created_at: now,
    });
    console.log(`✓ Admin user created  →  id: ${userResult.insertedId}`);
    console.log(`   email   : ${ADMIN_EMAIL}`);
    console.log(`   password: ${ADMIN_PASSWORD}`);
  }

  // 2. Default campus
  const existingCampus = await db.collection("campuses").findOne({});
  if (existingCampus) {
    console.log(`⚠  Campus already exists (${existingCampus.name}) — skipping.`);
  } else {
    const campusResult = await db.collection("campuses").insertOne({
      name: CAMPUS_NAME,
      city: CAMPUS_CITY,
      address: null,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
    console.log(`✓ Campus created  →  id: ${campusResult.insertedId}  name: ${CAMPUS_NAME}`);
  }

  // 3. Institute settings
  const existingSettings = await db.collection("settings").findOne({});
  if (existingSettings) {
    console.log("⚠  Settings already exist — skipping.");
  } else {
    await db.collection("settings").insertOne({
      institute_name: "Excellent NEET Academy",
      institute_address: CAMPUS_CITY,
      active_academic_year: "2025-26",
      admission_prefix: "ENA",
      receipt_prefix: "RCP",
      grace_period_days: 5,
      late_fee_amount: 0,
      late_fee_percent: 0,
      bounce_charge: 500,
      created_at: now,
      updated_at: now,
    });
    console.log("✓ Default institute settings seeded.");
  }

  // 4. MongoDB indexes for performance
  await db.collection("students").createIndex({ campus_id: 1, status: 1 });
  await db.collection("students").createIndex({ admission_number: 1 }, { unique: true, sparse: true });
  await db.collection("students").createIndex({ full_name: "text", mobile: 1, admission_number: 1 });
  await db.collection("installments").createIndex({ student_id: 1, installment_no: 1 });
  await db.collection("installments").createIndex({ fee_assignment_id: 1, installment_no: 1 });
  await db.collection("payments").createIndex({ student_id: 1, payment_date: -1 });
  await db.collection("payments").createIndex({ receipt_number: 1 }, { unique: true, sparse: true });
  await db.collection("audit_log").createIndex({ created_at: -1 });
  await db.collection("courses").createIndex({ campus_id: 1, is_active: 1 });
  await db.collection("batches").createIndex({ course_id: 1, campus_id: 1, status: 1 });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("sequences").createIndex({ key: 1 }, { unique: true });
  console.log("✓ Indexes created.");

  console.log("\n🎉 Seed complete. You can now run the app and log in:");
  console.log(`   Email   : ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log("\n⚠  Change the password immediately after first login via Settings → Profile.");
} catch (err) {
  console.error("✗ Seed failed:", err.message);
  process.exit(1);
} finally {
  await client.close();
}
