import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "";
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

if (!MONGO_URI) {
  console.error("MONGO_URI is required. Load your .env before running this script.");
  process.exit(1);
}

const QA_EMAIL_RE = /^qa\..+@example\.com$/i;
const QA_ADM_RE = /^QA/i;
const QA_NAME_RE = /^QA\s/i;
const QA_COURSE_RE = /^QA\s/i;
const QA_BATCH_RE = /^QA\s/i;
const QA_CAMPUS_RE = /^QA\s/i;

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
});

const toIdStrings = (docs) => docs.map((d) => String(d._id));
const toObjectIds = (docs) => docs.map((d) => d._id);

try {
  await client.connect();
  const db = client.db(DB_NAME);

  const qaUsers = await db
    .collection("users")
    .find({ email: { $regex: QA_EMAIL_RE } }, { projection: { _id: 1 } })
    .toArray();
  const qaUserIds = toIdStrings(qaUsers);
  const qaUserObjectIds = toObjectIds(qaUsers);

  const qaStudents = await db
    .collection("students")
    .find(
      {
        $or: [
          { admission_number: { $regex: QA_ADM_RE } },
          { full_name: { $regex: QA_NAME_RE } },
        ],
      },
      { projection: { _id: 1 } },
    )
    .toArray();
  const qaStudentIds = toIdStrings(qaStudents);
  const qaStudentObjectIds = toObjectIds(qaStudents);

  const qaCourses = await db
    .collection("courses")
    .find({ name: { $regex: QA_COURSE_RE } }, { projection: { _id: 1 } })
    .toArray();
  const qaCourseIds = toIdStrings(qaCourses);
  const qaCourseObjectIds = toObjectIds(qaCourses);

  const qaBatches = await db
    .collection("batches")
    .find({ name: { $regex: QA_BATCH_RE } }, { projection: { _id: 1 } })
    .toArray();
  const qaBatchIds = toIdStrings(qaBatches);
  const qaBatchObjectIds = toObjectIds(qaBatches);

  const qaCampuses = await db
    .collection("campuses")
    .find({ name: { $regex: QA_CAMPUS_RE } }, { projection: { _id: 1 } })
    .toArray();
  const qaCampusIds = toIdStrings(qaCampuses);
  const qaCampusObjectIds = toObjectIds(qaCampuses);

  const report = {};

  // Student-linked cleanup
  if (qaStudentIds.length) {
    report.installments = (await db.collection("installments").deleteMany({ student_id: { $in: qaStudentIds } }))
      .deletedCount;
    report.payments = (await db.collection("payments").deleteMany({ student_id: { $in: qaStudentIds } }))
      .deletedCount;
    report.fee_assignments = (
      await db.collection("fee_assignments").deleteMany({ student_id: { $in: qaStudentIds } })
    ).deletedCount;
    report.plan_upgrades = (await db.collection("plan_upgrades").deleteMany({ student_id: { $in: qaStudentIds } }))
      .deletedCount;
    report.concession_cancellations = (
      await db.collection("concession_cancellations").deleteMany({ student_id: { $in: qaStudentIds } })
    ).deletedCount;
    report.student_documents = (
      await db.collection("student_documents").deleteMany({ student_id: { $in: qaStudentIds } })
    ).deletedCount;
    report.student_transfers = (
      await db.collection("student_transfers").deleteMany({ student_id: { $in: qaStudentIds } })
    ).deletedCount;
    report.reminders = (await db.collection("reminders").deleteMany({ student_id: { $in: qaStudentIds } }))
      .deletedCount;
    report.students = (await db.collection("students").deleteMany({ _id: { $in: qaStudentObjectIds } }))
      .deletedCount;
  } else {
    report.installments = 0;
    report.payments = 0;
    report.fee_assignments = 0;
    report.plan_upgrades = 0;
    report.concession_cancellations = 0;
    report.student_documents = 0;
    report.student_transfers = 0;
    report.reminders = 0;
    report.students = 0;
  }

  // QA users
  report.users = qaUserIds.length
    ? (await db.collection("users").deleteMany({ _id: { $in: qaUserObjectIds } })).deletedCount
    : 0;

  // QA batches/courses/campuses
  report.batches = qaBatchIds.length
    ? (await db.collection("batches").deleteMany({ _id: { $in: qaBatchObjectIds } })).deletedCount
    : 0;
  report.courses = qaCourseIds.length
    ? (await db.collection("courses").deleteMany({ _id: { $in: qaCourseObjectIds } })).deletedCount
    : 0;
  report.campuses = qaCampusIds.length
    ? (await db.collection("campuses").deleteMany({ _id: { $in: qaCampusObjectIds } })).deletedCount
    : 0;

  console.log("QA/mock cleanup complete:");
  console.log(JSON.stringify(report, null, 2));
} catch (err) {
  console.error("QA/mock cleanup failed:", err?.message || err);
  process.exit(1);
} finally {
  await client.close();
}
