import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { writeFile } from "node:fs/promises";

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:8082";
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

const adminEmail = "qa.admin.rbac@example.com";
const adminPassword = "Admin@123456";
const ts = Date.now();

function isoNow() {
  return new Date().toISOString();
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

const results = [];
function addResult(module, scenario, pass, details = "") {
  results.push({ module, scenario, pass, details });
}

async function ensureRegressionSeed(db) {
  const users = db.collection("users");
  const campuses = db.collection("campuses");
  const courses = db.collection("courses");
  const batches = db.collection("batches");
  const students = db.collection("students");
  const feeAssignments = db.collection("fee_assignments");
  const installments = db.collection("installments");

  await users.updateOne(
    { email: adminEmail },
    {
      $set: {
        email: adminEmail,
        password_hash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
        status: "ACTIVE",
        full_name: "QA Admin",
        updated_at: isoNow(),
      },
      $setOnInsert: { created_at: isoNow() },
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
      created_at: isoNow(),
      updated_at: isoNow(),
    });
    campus = { _id: ins.insertedId, name: "QA Campus" };
  }
  const campusId = campus._id.toString();

  let course = await courses.findOne({ campus_id: campusId, is_active: { $ne: false } });
  if (!course) {
    const ins = await courses.insertOne({
      campus_id: campusId,
      name: "QA Regression Course",
      gross_fee: 150000,
      registration_fee: 10000,
      material_fee: 0,
      duration_months: 12,
      is_active: true,
      created_at: isoNow(),
      updated_at: isoNow(),
    });
    course = { _id: ins.insertedId, name: "QA Regression Course", gross_fee: 150000 };
  }
  const courseId = course._id.toString();

  let batch = await batches.findOne({ campus_id: campusId, course_id: courseId, status: { $ne: "closed" } });
  if (!batch) {
    const ins = await batches.insertOne({
      campus_id: campusId,
      course_id: courseId,
      name: "QA Regression Batch",
      timing: "08:00 AM",
      capacity: 60,
      status: "active",
      academic_year: "2025-26",
      start_date: null,
      created_at: isoNow(),
      updated_at: isoNow(),
    });
    batch = { _id: ins.insertedId, name: "QA Regression Batch" };
  }
  const batchId = batch._id.toString();

  const admissionNumber = `QAREG/${ts}`;
  const studentIns = await students.insertOne({
    full_name: `QA Regression Student ${ts}`,
    date_of_birth: "2008-06-01",
    gender: "male",
    mobile: "9898989898",
    permanent_address: "Regression Address",
    father_name: "Regression Father",
    father_mobile: "9797979797",
    class_year: "12th",
    course_id: courseId,
    batch_id: batchId,
    campus_id: campusId,
    admission_number: admissionNumber,
    academic_year: "2025-26",
    registration_date: today(),
    joining_date: today(),
    admission_date: today(),
    status: "active",
    created_at: isoNow(),
    updated_at: isoNow(),
  });
  const studentId = studentIns.insertedId.toString();

  const faIns = await feeAssignments.insertOne({
    student_id: studentId,
    course_id: courseId,
    gross_fee: Number(course.gross_fee || 150000),
    discount_amount: 0,
    net_payable: 150000,
    plan_kind: "plan_3",
    registration_fee: 10000,
    registration_fee_paid: 10000,
    material_fee: 0,
    transport_fee_monthly: 0,
    hostel_fee_monthly: 0,
    concession_cancelled_amount: 0,
    confirmed: true,
    created_at: isoNow(),
    updated_at: isoNow(),
  });

  const feeAssignmentId = faIns.insertedId.toString();
  const d1 = new Date();
  d1.setDate(d1.getDate() - 5);
  const d2 = new Date();
  d2.setDate(d2.getDate() + 30);
  await installments.insertMany([
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 0,
      amount: 10000,
      amount_paid: 10000,
      due_date: today(),
      month_label: "Registration Fee",
      status: "paid",
      late_fee: 0,
      is_registration: true,
      created_at: isoNow(),
      updated_at: isoNow(),
    },
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 1,
      amount: 50000,
      amount_paid: 0,
      due_date: d1.toISOString().slice(0, 10),
      month_label: "Installment 1",
      status: "overdue",
      late_fee: 0,
      is_registration: false,
      created_at: isoNow(),
      updated_at: isoNow(),
    },
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 2,
      amount: 50000,
      amount_paid: 0,
      due_date: d2.toISOString().slice(0, 10),
      month_label: "Installment 2",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: isoNow(),
      updated_at: isoNow(),
    },
  ]);

  return { studentId, admissionNumber };
}

async function run() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is required");
    process.exit(1);
  }

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const db = mongo.db(DB_NAME);
  const { studentId, admissionNumber } = await ensureRegressionSeed(db);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Admin Login" }).click();
    await page.fill("#si-email", adminEmail);
    await page.fill("#si-pass", adminPassword);
    await page.getByRole("button", { name: "Sign in as Admin" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    // Dashboard
    const dashboardText = await page.locator("main").innerText();
    const dashboardLoaded =
      dashboardText.includes("Dashboard") &&
      dashboardText.includes("Today at a glance") &&
      dashboardText.includes("Quick Actions");
    addResult("Dashboard", "Dashboard loads with quick actions", dashboardLoaded, "Checked heading cards.");

    // Enroll
    await page.goto(`${BASE_URL}/enroll`, { waitUntil: "networkidle" });
    const enrollText = await page.locator("main").innerText();
    const enrollLoaded =
      enrollText.includes("1 · Student Profile") &&
      enrollText.includes("Registration Date *") &&
      enrollText.includes("Joining Date *");
    addResult("Enroll", "Enrollment form renders mandatory date fields", enrollLoaded, "Joining/registration present.");

    // Students
    await page.goto(`${BASE_URL}/students`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Search name, admission no, mobile…").fill(admissionNumber);
    const studentVisible = await page.getByText(admissionNumber).first().isVisible();
    addResult("Students", "Student appears in listing and search", studentVisible, `Search=${admissionNumber}`);

    await page.goto(`${BASE_URL}/students/${studentId}`, { waitUntil: "networkidle" });
    const replanBefore = await db.collection("plan_upgrades").countDocuments({ student_id: studentId });
    await page.getByRole("button", { name: "Re-plan Late Joiner" }).click();
    await page.getByRole("button", { name: "Apply re-plan" }).click();
    await page.waitForTimeout(1400);
    const replanAfter = await db.collection("plan_upgrades").countDocuments({ student_id: studentId });
    addResult(
      "Students",
      "Customize plan (Re-plan Late Joiner) applies",
      replanAfter > replanBefore,
      `Upgrades ${replanBefore} -> ${replanAfter}`,
    );

    // Collect
    await page.goto(`${BASE_URL}/collect`, { waitUntil: "networkidle" });
    const collectLoaded = await page.getByRole("heading", { name: "Collect Fee" }).isVisible();
    addResult("Collect", "Collect fee module loads", collectLoaded, "Collect page render.");

    await page.getByPlaceholder("Type name, admission number, or mobile (min 2 chars)…").fill(admissionNumber);
    await page.waitForTimeout(1200);
    const resultVisible = await page.getByText(admissionNumber).first().isVisible();
    addResult("Collect", "Student search works in collect module", resultVisible, `Search=${admissionNumber}`);

    // Admission Form
    await page.goto(`${BASE_URL}/students/${studentId}/admission-form`, { waitUntil: "networkidle" });
    const admissionFormOk = await page.getByRole("button", { name: "Print" }).isVisible();
    addResult("Admission Form", "Admission form opens with print action", admissionFormOk, "Print button check.");

    // Reports
    await page.goto(`${BASE_URL}/reports`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /Payment History/ }).click();
    await page.waitForTimeout(600);
    const paymentHistoryOk = (await page.locator("main").innerText()).includes("Student-wise Payment History");
    addResult("Reports", "Payment History report tab renders", paymentHistoryOk, "Main content assertion.");

    await page.getByRole("tab", { name: /Due Tracker/ }).click();
    await page.waitForTimeout(600);
    const dueTrackerOk = (await page.locator("main").innerText()).includes("Installment Due Tracker");
    addResult("Reports", "Due Tracker report tab renders", dueTrackerOk, "Main content assertion.");

    // Users
    await page.goto(`${BASE_URL}/users`, { waitUntil: "networkidle" });
    const usersLoaded = await page.getByText("User Management").first().isVisible();
    addResult("Users", "User management page loads", usersLoaded, "Users page render.");

    const qaAdminVisible = await page.getByText(adminEmail).isVisible();
    addResult("Users", "Admin user visible in user listing", qaAdminVisible, adminEmail);
  } catch (err) {
    addResult("System", "Regression runner execution", false, err?.message || String(err));
  } finally {
    await browser.close();
    await mongo.close();
  }

  const total = results.length;
  const pass = results.filter((r) => r.pass).length;
  const fail = total - pass;

  const lines = [];
  lines.push("# Module-wise Regression QA Sign-off");
  lines.push("");
  lines.push(`Date: ${new Date().toISOString()}`);
  lines.push(`Environment: ${BASE_URL}`);
  lines.push("");
  lines.push(`Summary: **${pass}/${total} passed**, **${fail} failed**`);
  lines.push("");
  lines.push("| Module | Scenario | Status | Details |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    lines.push(`| ${r.module} | ${r.scenario} | ${r.pass ? "PASS" : "FAIL"} | ${r.details || "—"} |`);
  }
  lines.push("");
  lines.push(
    fail === 0
      ? "Sign-off: ✅ Module-wise regression completed and all scenarios passed."
      : "Sign-off: ❌ Module-wise regression has failures; re-test required after fixes.",
  );
  lines.push("");

  await writeFile("docs/qa-regression-signoff.md", lines.join("\n"), "utf8");

  console.log("\nMODULE REGRESSION RESULTS");
  console.log("=========================");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"} | ${r.module} | ${r.scenario} | ${r.details || ""}`);
  }
  console.log("-------------------------");
  console.log(`TOTAL: ${total} | PASS: ${pass} | FAIL: ${fail}`);
  console.log("Report: docs/qa-regression-signoff.md");

  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Regression QA failed:", err);
  process.exit(1);
});
