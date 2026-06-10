import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:8082";
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

const adminEmail = "qa.admin.rbac@example.com";
const adminPassword = "Admin@123456";

const results = [];
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

function record(name, pass, details = "") {
  results.push({ name, pass, details });
}

async function ensureSeed(db) {
  const campuses = db.collection("campuses");
  const courses = db.collection("courses");
  const batches = db.collection("batches");
  const users = db.collection("users");
  const students = db.collection("students");
  const feeAssignments = db.collection("fee_assignments");
  const installments = db.collection("installments");
  const docs = db.collection("student_documents");

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

  let course = await courses.findOne({ campus_id: campusId });
  if (!course) {
    const ins = await courses.insertOne({
      campus_id: campusId,
      name: "QA NEET",
      gross_fee: 120000,
      registration_fee: 5000,
      material_fee: 0,
      duration_months: 12,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    course = { _id: ins.insertedId, name: "QA NEET", gross_fee: 120000, registration_fee: 5000 };
  }
  const courseId = course._id.toString();

  let batch = await batches.findOne({ campus_id: campusId, course_id: courseId });
  if (!batch) {
    const ins = await batches.insertOne({
      campus_id: campusId,
      course_id: courseId,
      name: "QA Batch",
      timing: "08:00 AM",
      capacity: 60,
      status: "active",
      academic_year: "2025-26",
      start_date: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    batch = { _id: ins.insertedId, name: "QA Batch" };
  }
  const batchId = batch._id.toString();

  const admissionNo = `QA/${Date.now()}`;
  const studentIns = await students.insertOne({
    full_name: "QA Flow Student",
    date_of_birth: "2008-06-01",
    gender: "male",
    mobile: "9999999999",
    permanent_address: "QA Address",
    father_name: "QA Father",
    father_mobile: "9999999998",
    class_year: "12th",
    course_id: courseId,
    batch_id: batchId,
    campus_id: campusId,
    admission_number: admissionNo,
    academic_year: "2025-26",
    registration_date: today(),
    joining_date: today(),
    admission_date: today(),
    status: "active",
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const studentId = studentIns.insertedId.toString();

  const faIns = await feeAssignments.insertOne({
    student_id: studentId,
    course_id: courseId,
    gross_fee: Number(course.gross_fee || 120000),
    discount_amount: 0,
    discount_reason: null,
    net_payable: 120000,
    plan_kind: "plan_3",
    registration_fee: Number(course.registration_fee || 5000),
    registration_fee_paid: Number(course.registration_fee || 5000),
    material_fee: 0,
    transport_fee_monthly: 0,
    hostel_fee_monthly: 0,
    concession_cancelled_amount: 0,
    confirmed: true,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  const feeAssignmentId = faIns.insertedId.toString();

  const due1 = new Date();
  due1.setDate(due1.getDate() - 10);
  const due2 = new Date();
  due2.setDate(due2.getDate() + 20);
  const due3 = new Date();
  due3.setDate(due3.getDate() + 80);

  await installments.insertMany([
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 0,
      amount: Number(course.registration_fee || 5000),
      amount_paid: Number(course.registration_fee || 5000),
      due_date: today(),
      month_label: "Registration Fee",
      status: "paid",
      late_fee: 0,
      is_registration: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 1,
      amount: 40000,
      amount_paid: 0,
      due_date: due1.toISOString().slice(0, 10),
      month_label: "Installment 1",
      status: "overdue",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 2,
      amount: 40000,
      amount_paid: 0,
      due_date: due2.toISOString().slice(0, 10),
      month_label: "Installment 2",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      fee_assignment_id: feeAssignmentId,
      student_id: studentId,
      installment_no: 3,
      amount: 40000,
      amount_paid: 0,
      due_date: due3.toISOString().slice(0, 10),
      month_label: "Installment 3",
      status: "due",
      late_fee: 0,
      is_registration: false,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ]);

  await docs.insertOne({
    student_id: studentId,
    label: "QA Certificate",
    file_url: "data:text/plain;base64,UUEgQ2VydGlmaWNhdGU=",
    mime_type: "text/plain",
    size_bytes: 14,
    uploaded_by: null,
    uploaded_by_name: "QA Script",
    created_at: nowIso(),
  });

  return { studentId, admissionNo };
}

async function main() {
  if (!MONGO_URI) {
    console.error("MONGO_URI is required for QA script");
    process.exit(1);
  }

  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const db = mongo.db(DB_NAME);
  const { studentId } = await ensureSeed(db);
  const planUpgrades = db.collection("plan_upgrades");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("pageerror", (err) => {
    record("No page crash (runtime error)", false, String(err?.message || err));
  });

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Admin Login" }).click();
    await page.fill("#si-email", adminEmail);
    await page.fill("#si-pass", adminPassword);
    await page.getByRole("button", { name: "Sign in as Admin" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    record("Admin login", true, "Reached dashboard.");

    await page.goto(`${BASE_URL}/students/${studentId}`, { waitUntil: "networkidle" });
    const titleVisible = await page.getByText("QA Flow Student").first().isVisible();
    record("Student detail loads", titleVisible, titleVisible ? "Page rendered." : "Student title missing.");

    const downloadLinkVisible = await page.getByRole("link", { name: "Download" }).first().isVisible();
    record(
      "Certificate/document download action visible",
      downloadLinkVisible,
      downloadLinkVisible ? "Download link present." : "Download link not found.",
    );

    const beforeUpgrades = await planUpgrades.countDocuments({ student_id: studentId });
    await page.getByRole("button", { name: "Re-plan Late Joiner" }).click();
    await page.getByRole("button", { name: "Apply re-plan" }).click();
    await page.waitForTimeout(1800);
    const afterUpgrades = await planUpgrades.countDocuments({ student_id: studentId });
    const replanApplied = afterUpgrades > beforeUpgrades;
    record(
      "Customized re-plan apply",
      replanApplied,
      replanApplied
        ? `Plan upgrades increased ${beforeUpgrades} -> ${afterUpgrades}.`
        : "Plan upgrade record not created.",
    );

    await page.goto(`${BASE_URL}/students/${studentId}/admission-form`, { waitUntil: "networkidle" });
    const printBtn = await page.getByRole("button", { name: "Print" }).isVisible();
    const admissionSnippet = printBtn ? "" : (await page.locator("body").innerText()).slice(0, 220);
    record(
      "Admission form/certificate page opens",
      printBtn,
      printBtn ? "Print button visible." : `Print button missing. url=${page.url()} body=${admissionSnippet}`,
    );

    await page.goto(`${BASE_URL}/reports`, { waitUntil: "networkidle" });
    const paymentTab = page.getByRole("tab", { name: /Payment History/ });
    const paymentTabVisible = await paymentTab.isVisible();
    let paymentTitle = false;
    let reportsSnippet = "";
    if (paymentTabVisible) {
      await paymentTab.click();
      await page.waitForTimeout(1200);
      const reportMain = await page.locator("main").innerText();
      paymentTitle = reportMain.includes("Student-wise Payment History");
      if (!paymentTitle) reportsSnippet = reportMain.slice(0, 220);
    }
    record(
      "Payment History report tab",
      paymentTitle,
      paymentTitle
        ? "Tab rendered."
        : `Tab render failed. url=${page.url()} body=${reportsSnippet || (await page.locator("body").innerText()).slice(0, 220)}`,
    );

    const dueTab = page.getByRole("tab", { name: /Due Tracker/ });
    const dueTabVisible = await dueTab.isVisible();
    let dueTitle = false;
    let dueSnippet = "";
    if (dueTabVisible) {
      await dueTab.click();
      await page.waitForTimeout(1200);
      const reportMain = await page.locator("main").innerText();
      dueTitle = reportMain.includes("Installment Due Tracker");
      if (!dueTitle) dueSnippet = reportMain.slice(0, 220);
    }
    record(
      "Due Tracker report tab",
      dueTitle,
      dueTitle
        ? "Tab rendered."
        : `Tab render failed. url=${page.url()} body=${dueSnippet || (await page.locator("body").innerText()).slice(0, 220)}`,
    );
  } catch (err) {
    record("QA script execution", false, err?.message || String(err));
  } finally {
    await browser.close();
    await mongo.close();
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log("\nCORE PRODUCT QA RESULTS");
  console.log("=======================");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"} | ${r.name}${r.details ? ` | ${r.details}` : ""}`);
  }
  console.log("-----------------------");
  console.log(`TOTAL: ${results.length} | PASS: ${pass} | FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Core product QA failed:", err);
  process.exit(1);
});
