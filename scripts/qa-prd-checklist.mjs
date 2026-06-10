import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:8082";
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

const adminEmail = "qa.admin.rbac@example.com";
const adminPassword = "Admin@123456";
const stamp = Date.now();

const results = [];
function add(name, pass, details = "") {
  results.push({ name, pass, details });
}

function nowIso() {
  return new Date().toISOString();
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function seed(db) {
  const users = db.collection("users");
  const campuses = db.collection("campuses");
  const courses = db.collection("courses");
  const batches = db.collection("batches");
  const students = db.collection("students");
  const feeAssignments = db.collection("fee_assignments");
  const installments = db.collection("installments");
  const reminders = db.collection("reminders");

  await users.updateOne(
    { email: adminEmail },
    {
      $set: {
        email: adminEmail,
        password_hash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
        status: "ACTIVE",
        full_name: "QA Admin",
        updated_at: nowIso(),
      },
      $setOnInsert: { created_at: nowIso() },
    },
    { upsert: true },
  );

  let campus = await campuses.findOne({ is_active: { $ne: false } });
  if (!campus) {
    const ins = await campuses.insertOne({
      name: "QA Campus",
      city: "Dharwad",
      address: "QA",
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    campus = { _id: ins.insertedId, name: "QA Campus" };
  }
  const campusId = campus._id.toString();

  let course = await courses.findOne({ campus_id: campusId, is_active: { $ne: false } });
  if (!course) {
    const ins = await courses.insertOne({
      campus_id: campusId,
      name: "QA PRD Course",
      gross_fee: 100000,
      registration_fee: 10000,
      material_fee: 0,
      duration_months: 12,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    course = { _id: ins.insertedId, name: "QA PRD Course", gross_fee: 100000, registration_fee: 10000 };
  }
  const courseId = course._id.toString();

  let batch = await batches.findOne({ campus_id: campusId, course_id: courseId, status: { $ne: "closed" } });
  if (!batch) {
    const ins = await batches.insertOne({
      campus_id: campusId,
      course_id: courseId,
      name: "QA PRD Batch",
      timing: "08:00 AM",
      capacity: 60,
      status: "active",
      academic_year: "2025-26",
      start_date: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    batch = { _id: ins.insertedId, name: "QA PRD Batch" };
  }
  const batchId = batch._id.toString();

  const studentAdmissionNo = `QAPRD/${stamp}`;
  const studentIns = await students.insertOne({
    full_name: `QA PRD Student ${stamp}`,
    date_of_birth: "2008-06-01",
    gender: "male",
    mobile: "8888888888",
    permanent_address: "QA PRD Address",
    father_name: "QA Father",
    father_mobile: "7777777777",
    class_year: "12th",
    course_id: courseId,
    batch_id: batchId,
    campus_id: campusId,
    admission_number: studentAdmissionNo,
    academic_year: "2025-26",
    registration_date: todayIso(),
    joining_date: todayIso(),
    admission_date: todayIso(),
    status: "active",
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const studentId = studentIns.insertedId.toString();

  const faIns = await feeAssignments.insertOne({
    student_id: studentId,
    course_id: courseId,
    gross_fee: Number(course.gross_fee || 100000),
    discount_amount: 0,
    net_payable: 100000,
    plan_kind: "plan_3",
    registration_fee: Number(course.registration_fee || 10000),
    registration_fee_paid: Number(course.registration_fee || 10000),
    material_fee: 0,
    transport_fee_monthly: 0,
    hostel_fee_monthly: 0,
    concession_cancelled_amount: 0,
    confirmed: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const faId = faIns.insertedId.toString();

  const dueToday = todayIso();
  const dueFuture = new Date();
  dueFuture.setDate(dueFuture.getDate() + 30);
  await installments.insertMany([
    {
      fee_assignment_id: faId,
      student_id: studentId,
      installment_no: 0,
      amount: Number(course.registration_fee || 10000),
      amount_paid: Number(course.registration_fee || 10000),
      due_date: dueToday,
      month_label: "Registration Fee",
      status: "paid",
      late_fee: 0,
      is_registration: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: faId,
      student_id: studentId,
      installment_no: 1,
      amount: 45000,
      amount_paid: 0,
      due_date: dueToday,
      month_label: "Installment 1",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: faId,
      student_id: studentId,
      installment_no: 2,
      amount: 45000,
      amount_paid: 0,
      due_date: dueFuture.toISOString().slice(0, 10),
      month_label: "Installment 2",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ]);

  // Reminder validation student (due today/+7/-7)
  const reminderAdm = `QAREM/${stamp}`;
  const remStudentIns = await students.insertOne({
    full_name: `QA Reminder Student ${stamp}`,
    date_of_birth: "2008-06-01",
    gender: "female",
    mobile: "6666666666",
    permanent_address: "Reminder Address",
    father_name: "Reminder Father",
    father_mobile: "5555555555",
    class_year: "12th",
    course_id: courseId,
    batch_id: batchId,
    campus_id: campusId,
    admission_number: reminderAdm,
    academic_year: "2025-26",
    registration_date: todayIso(),
    joining_date: todayIso(),
    admission_date: todayIso(),
    status: "active",
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const reminderStudentId = remStudentIns.insertedId.toString();
  const remFaIns = await feeAssignments.insertOne({
    student_id: reminderStudentId,
    course_id: courseId,
    gross_fee: 90000,
    discount_amount: 0,
    net_payable: 90000,
    plan_kind: "plan_5",
    registration_fee: 10000,
    registration_fee_paid: 10000,
    material_fee: 0,
    transport_fee_monthly: 0,
    hostel_fee_monthly: 0,
    concession_cancelled_amount: 0,
    confirmed: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const remFaId = remFaIns.insertedId.toString();
  const plus7 = new Date();
  plus7.setDate(plus7.getDate() + 7);
  const minus7 = new Date();
  minus7.setDate(minus7.getDate() - 7);
  await installments.insertMany([
    {
      fee_assignment_id: remFaId,
      student_id: reminderStudentId,
      installment_no: 1,
      amount: 10000,
      amount_paid: 0,
      due_date: plus7.toISOString().slice(0, 10),
      month_label: "Installment 1",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: remFaId,
      student_id: reminderStudentId,
      installment_no: 2,
      amount: 10000,
      amount_paid: 0,
      due_date: todayIso(),
      month_label: "Installment 2",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: remFaId,
      student_id: reminderStudentId,
      installment_no: 3,
      amount: 10000,
      amount_paid: 0,
      due_date: minus7.toISOString().slice(0, 10),
      month_label: "Installment 3",
      status: "overdue",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ]);
  await reminders.deleteMany({ student_id: reminderStudentId });

  return {
    campusId,
    courseName: String(course.name),
    batchName: String(batch.name),
    studentId,
    studentAdmissionNo,
    reminderStudentId,
  };
}

async function selectRadixByLabel(page, labelText, optionRegex) {
  const label = page.locator("label").filter({ hasText: labelText }).first();
  await label.waitFor({ state: "visible", timeout: 15000 });
  const trigger = label.locator("xpath=following::*[@role='combobox'][1]");
  await trigger.click();
  await page.getByRole("option", { name: optionRegex }).first().click();
}

async function fillInputByLabel(page, labelText, value, type = "text") {
  const label = page.locator("label").filter({ hasText: labelText }).first();
  await label.waitFor({ state: "visible", timeout: 15000 });
  const input =
    type === "text"
      ? label.locator("xpath=following::input[1]")
      : label.locator(`xpath=following::input[@type='${type}'][1]`);
  await input.fill(value);
}

async function fillTextareaByLabel(page, labelText, value) {
  const label = page.locator("label").filter({ hasText: labelText }).first();
  await label.waitFor({ state: "visible", timeout: 15000 });
  const area = label.locator("xpath=following::textarea[1]");
  await area.fill(value);
}

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const db = mongo.db(DB_NAME);
  const seeded = await seed(db);
  const reminders = db.collection("reminders");

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Admin Login" }).click();
    await page.fill("#si-email", adminEmail);
    await page.fill("#si-pass", adminPassword);
    await page.getByRole("button", { name: "Sign in as Admin" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    // Enrollment formula verification
    await page.goto(`${BASE_URL}/enroll`, { waitUntil: "networkidle" });
    await page.waitForLoadState("networkidle");
    await page.getByText("1 · Student Profile").waitFor({ timeout: 20000 });
    await fillInputByLabel(page, "Full Name *", `QA Formula ${stamp}`);
    await fillInputByLabel(page, "Date of Birth *", "2008-06-01", "date");
    await fillInputByLabel(page, "Mobile *", "9999999999");
    await fillTextareaByLabel(page, "Permanent Address *", "QA Address");
    await fillInputByLabel(page, "Father's Name *", "QA Father");
    await fillInputByLabel(page, "Father's Mobile *", "8888888888");
    await fillInputByLabel(page, "Registration Date *", "2026-06-01", "date");
    await fillInputByLabel(page, "Joining Date *", "2026-06-01", "date");

    await selectRadixByLabel(page, "Course *", new RegExp(seeded.courseName));
    await selectRadixByLabel(page, "Batch *", new RegExp(seeded.batchName));
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(500);

    const formulaBanner = (await page.locator("main").innerText()).includes(
      "Formula: 1st installment = Joining Date",
    );
    add("Enrollment formula banner visible", formulaBanner, "Step-2 formula helper.");

    await selectRadixByLabel(page, "Instalment Plan *", /Plan 3 · 5 instalments/);
    await page.waitForTimeout(400);
    const textPlan5 = await page.locator("main").innerText();
    const plan5DatesOk =
      textPlan5.includes("01 Jun 2026") &&
      textPlan5.includes("31 Jul 2026") &&
      (textPlan5.includes("29 Sept 2026") || textPlan5.includes("29 Sep 2026")) &&
      textPlan5.includes("29 Oct 2026") &&
      textPlan5.includes("28 Nov 2026");
    add(
      "Installment formula dates (J, +60, +120, +150, +180) match expected",
      plan5DatesOk,
      "Validated against 01 Jun 2026 example.",
    );

    await page.getByRole("button", { name: "Back" }).click();
    await selectRadixByLabel(page, "Type of Admission", /Residential/);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForTimeout(400);
    let residentialText = await page.locator("main").innerText();
    let residentialOk = residentialText.includes("Residential student: standardized schedule applied");
    if (!residentialOk) {
      await page.getByRole("button", { name: "Back" }).click();
      const hostelSwitch = page
        .locator("label")
        .filter({ hasText: "Hostel required" })
        .first()
        .locator("xpath=ancestor::div[1]/following::button[1]");
      if (await hostelSwitch.isVisible().catch(() => false)) {
        await hostelSwitch.click();
      }
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(400);
      residentialText = await page.locator("main").innerText();
      residentialOk = residentialText.includes("Residential student: standardized schedule applied");
    }
    add(
      "Residential student auto-standardized 5-installment plan",
      residentialOk,
      "Residential banner + count check.",
    );

    // Step-3 first installment collect + receipt
    await page.goto(`${BASE_URL}/collect`, { waitUntil: "networkidle" });
    await page
      .getByPlaceholder("Type name, admission number, or mobile (min 2 chars)…")
      .fill(seeded.studentAdmissionNo);
    await page.waitForTimeout(1000);
    await page.getByText(seeded.studentAdmissionNo).first().click();
    await page.locator("table button").filter({ hasText: "Collect" }).first().click();
    const dialogVisible = await page.getByRole("dialog").isVisible({ timeout: 10000 }).catch(() => false);
    let collectDetails = `dialogVisible=${dialogVisible}`;
    if (dialogVisible) {
      const amountInput = page.getByRole("dialog").locator('input[type="number"]').first();
      await amountInput.fill("1000");
      await page.getByRole("button", { name: "Record & Generate Receipt" }).click();
      await page.waitForTimeout(2500);
      const bodyAfter = await page.locator("body").innerText();
      if (bodyAfter.includes("Payment failed")) collectDetails += " | toast=Payment failed";
      if (bodyAfter.includes("Receipt has been generated")) collectDetails += " | receipt_msg_seen";
    }
    const receiptOk =
      (await page.getByText("Payment recorded").isVisible({ timeout: 30000 }).catch(() => false)) ||
      (await page.getByText("Receipt has been generated").isVisible().catch(() => false));
    add(
      "First installment can be collected and receipt generated",
      receiptOk,
      collectDetails,
    );

    // Student profile dashboard metrics
    await page.goto(`${BASE_URL}/students/${seeded.studentId}`, { waitUntil: "networkidle" });
    const studentMain = await page.locator("main").innerText();
    const profileMetricsOk =
      studentMain.includes("Total Course Fee") &&
      studentMain.includes("Registration Paid") &&
      studentMain.includes("Installments Paid") &&
      studentMain.includes("Pending Installments") &&
      studentMain.includes("Upcoming Due Date") &&
      studentMain.includes("Overdue Amount") &&
      studentMain.includes("Payments");
    add(
      "Student profile shows fee dashboard metrics + payment history",
      profileMetricsOk,
      "Cards and payments section present.",
    );

    // Alerts notifications 7 days before / on due / 7 days after
    await execFileAsync(
      "node",
      ["scripts/cron-reminders.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MONGO_URI,
          MONGO_DB_NAME: DB_NAME,
          CAMPUS_ID: seeded.campusId,
          TODAY: todayIso(),
          DRY_RUN: "0",
        },
      },
    );
    const remRows = await reminders.find({ student_id: seeded.reminderStudentId }).toArray();
    const kinds = new Set(remRows.map((r) => String(r.kind)));
    const remindersOk =
      kinds.has("before_7_days") && kinds.has("on_due") && kinds.has("after_7_days");
    add(
      "Alerts generated for 7-day before / due-day / 7-day after",
      remindersOk,
      `Kinds: ${Array.from(kinds).join(", ") || "none"}`,
    );

    // Reports
    await page.goto(`${BASE_URL}/reports`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /Due Tracker/ }).click();
    await page.waitForTimeout(2000);
    const dueTrackerText = await page.locator("main").innerText();
    const dueLower = dueTrackerText.toLowerCase();
    const dueTrackerOk =
      (dueLower.includes("installment due tracker") || dueLower.includes("due today")) &&
      dueLower.includes("due this") &&
      dueLower.includes("overdue");
    add(
      "Reports: Installments Due Today / This Week / Overdue",
      dueTrackerOk,
      dueTrackerOk ? "Due tracker tab content." : dueTrackerText.slice(0, 220),
    );

    await page.getByRole("tab", { name: /Outstanding/ }).click();
    await page.waitForTimeout(2000);
    const outstandingText = await page.locator("main").innerText();
    const outLower = outstandingText.toLowerCase();
    const outstandingOk =
      outLower.includes("outstanding") &&
      (outLower.includes("students with dues") || outLower.includes("total outstanding"));
    add(
      "Reports: Campus-wise pending fees (Outstanding)",
      outstandingOk,
      outstandingOk ? "Outstanding tab." : outstandingText.slice(0, 220),
    );

    await page.getByRole("tab", { name: /By Course/ }).click();
    await page.waitForTimeout(600);
    const byCourseText = await page.locator("main").innerText();
    const coursePendingOk =
      byCourseText.includes("By Course") && byCourseText.includes(seeded.courseName);
    add("Reports: Course-wise pending fees", coursePendingOk, `Course=${seeded.courseName}`);

    await page.getByRole("tab", { name: /Payment History/ }).click();
    await page.waitForTimeout(600);
    const paymentHistoryOk = (await page.locator("main").innerText()).includes(
      "Student-wise Payment History",
    );
    add("Reports: Student-wise payment history", paymentHistoryOk, "Payment history tab.");
  } catch (error) {
    add("Checklist execution", false, error?.message || String(error));
  } finally {
    await browser.close();
    await mongo.close();
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;

  const report = [];
  report.push("# PRD Checklist QA Sign-off");
  report.push("");
  report.push(`Date: ${new Date().toISOString()}`);
  report.push(`Environment: ${BASE_URL}`);
  report.push(`Summary: **${pass}/${results.length} passed**, **${fail} failed**`);
  report.push("");
  report.push("| Scenario | Status | Notes |");
  report.push("|---|---|---|");
  for (const r of results) {
    report.push(`| ${r.name} | ${r.pass ? "PASS" : "FAIL"} | ${r.details || "—"} |`);
  }
  report.push("");
  report.push(
    fail === 0
      ? "Sign-off: ✅ All PRD checklist scenarios passed."
      : "Sign-off: ❌ Some PRD checklist scenarios failed.",
  );
  report.push("");

  await writeFile("docs/qa-prd-checklist-signoff.md", report.join("\n"), "utf8");

  console.log("\nPRD CHECKLIST QA RESULTS");
  console.log("========================");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"} | ${r.name} | ${r.details}`);
  }
  console.log("------------------------");
  console.log(`TOTAL: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  console.log("Report: docs/qa-prd-checklist-signoff.md");

  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("PRD checklist QA failed:", err);
  process.exit(1);
});
