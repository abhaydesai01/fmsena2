import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";
const CAMPUS_ID = process.env.CAMPUS_ID || null;
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);
const DRY_RUN = process.env.DRY_RUN === "1";

if (!MONGO_URI) {
  console.error("MONGO_URI is required");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
});

const fmt = (d) => d.toISOString().slice(0, 10);

try {
  await client.connect();
  const db = client.db(DB_NAME);
  const today = new Date(TODAY);
  const before7 = new Date(today);
  before7.setDate(today.getDate() + 7);
  const after7 = new Date(today);
  after7.setDate(today.getDate() - 7);
  const dueDates = [fmt(before7), fmt(today), fmt(after7)];

  const studentsFilter = {};
  if (CAMPUS_ID) studentsFilter.campus_id = CAMPUS_ID;

  const students = await db
    .collection("students")
    .find(studentsFilter, { projection: { _id: 1, full_name: 1, mobile: 1 } })
    .toArray();
  const studentMap = {};
  for (const s of students) studentMap[s._id.toString()] = { full_name: s.full_name, mobile: s.mobile };
  const studentIds = Object.keys(studentMap);
  if (!studentIds.length) {
    console.log("No students matched filter.");
    process.exit(0);
  }

  const pendingInst = await db
    .collection("installments")
    .find({
      student_id: { $in: studentIds },
      is_registration: { $ne: true },
      status: { $ne: "paid" },
      due_date: { $in: dueDates },
    })
    .toArray();

  const writes = [];
  for (const inst of pendingInst) {
    const dueDate = String(inst.due_date);
    let kind = "on_due";
    if (dueDate === fmt(before7)) kind = "before_7_days";
    else if (dueDate === fmt(after7)) kind = "after_7_days";
    const reminderKey = `${inst.student_id}:${inst._id.toString()}:${kind}:${TODAY}`;
    const student = studentMap[String(inst.student_id)];
    if (!student?.mobile) continue;
    const pending = Math.max(0, Number(inst.amount) - Number(inst.amount_paid));
    writes.push({
      updateOne: {
        filter: { reminder_key: reminderKey },
        update: {
          $setOnInsert: {
            reminder_key: reminderKey,
            student_id: inst.student_id,
            installment_id: inst._id.toString(),
            recipient_mobile: student.mobile,
            kind,
            channel: "sms",
            message: `Fee reminder: ${student.full_name}, installment due on ${dueDate}. Pending amount ${pending}.`,
            triggered_by: "system",
            language: "en",
            created_at: new Date().toISOString(),
          },
        },
        upsert: true,
      },
    });
  }

  if (!DRY_RUN && writes.length) {
    const result = await db.collection("reminders").bulkWrite(writes, { ordered: false });
    console.log(`matched=${result.matchedCount}`);
    console.log(`inserted=${result.upsertedCount}`);
    console.log(`modified=${result.modifiedCount}`);
  } else {
    console.log(`dry_run=1 pending_writes=${writes.length}`);
  }
} catch (error) {
  console.error("Reminder cron failed:", error.message);
  process.exit(1);
} finally {
  await client.close();
}
