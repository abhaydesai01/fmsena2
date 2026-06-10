import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

if (!MONGO_URI) {
  console.error("MONGO_URI is required");
  process.exit(1);
}

const client = new MongoClient(MONGO_URI, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
});

function normalizeDate(v) {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

try {
  await client.connect();
  const db = client.db(DB_NAME);
  const students = await db
    .collection("students")
    .find({}, { projection: { _id: 1, joining_date: 1, registration_date: 1, admission_date: 1, created_at: 1 } })
    .toArray();

  let updated = 0;
  const ops = [];
  for (const s of students) {
    const fallback =
      normalizeDate(s.admission_date) ||
      normalizeDate(s.created_at) ||
      new Date().toISOString().slice(0, 10);
    const joiningDate = normalizeDate(s.joining_date) || fallback;
    const registrationDate = normalizeDate(s.registration_date) || fallback;
    const next = {
      joining_date: joiningDate,
      registration_date: registrationDate,
      admission_date: joiningDate,
      updated_at: new Date().toISOString(),
    };
    if (
      normalizeDate(s.joining_date) !== next.joining_date ||
      normalizeDate(s.registration_date) !== next.registration_date ||
      normalizeDate(s.admission_date) !== next.admission_date
    ) {
      ops.push({
        updateOne: {
          filter: { _id: s._id },
          update: { $set: next },
        },
      });
      updated += 1;
    }
  }

  if (ops.length) {
    await db.collection("students").bulkWrite(ops, { ordered: false });
  }

  console.log(`students_scanned=${students.length}`);
  console.log(`students_updated=${updated}`);
  console.log("Migration complete.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exit(1);
} finally {
  await client.close();
}
