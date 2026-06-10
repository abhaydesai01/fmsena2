import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:8084";
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://abhaydesai3_db_user:3HqcfRs5U35wH39a@ac-ydlujlu-shard-00-02.djydanj.mongodb.net:27017/?tls=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0&directConnection=true";
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

const adminEmail = "qa.admin.rbac@example.com";
const adminPassword = "Admin@123456";
const targetEmail = "qa.force.reset@example.com";
const tempPassword = "Temp@123456";
const newPassword = "NewPass@123456";

async function main() {
  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const db = mongo.db(DB_NAME);

  try {
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await db.collection("users").updateOne(
      { email: adminEmail },
      {
        $set: {
          email: adminEmail,
          full_name: "QA Admin",
          password_hash: adminHash,
          role: "ADMIN",
          status: "ACTIVE",
          force_password_reset: false,
        },
      },
      { upsert: true },
    );
    await db.collection("users").deleteOne({ email: targetEmail });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Admin creates user with force reset enabled.
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Admin Login" }).click();
    await page.fill("#si-email", adminEmail);
    await page.fill("#si-pass", adminPassword);
    await page.getByRole("button", { name: "Sign in as Admin" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.goto(`${BASE_URL}/users`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Add User" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Full name").fill("Force Reset User");
    await dialog.getByPlaceholder("user@example.com").fill(targetEmail);
    await dialog.getByPlaceholder("At least 6 characters").fill(tempPassword);
    await dialog.getByRole("button", { name: "Create User" }).click();
    await page.waitForTimeout(800);

    // Sign out admin.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/, { timeout: 15000 });

    // Target user logs in and must be redirected to reset-password.
    await page.getByRole("button", { name: "Accountant Login" }).click();
    await page.fill("#si-email", targetEmail);
    await page.fill("#si-pass", tempPassword);
    await page.getByRole("button", { name: /Sign in as/ }).click();
    await page.waitForURL(/\/reset-password/, { timeout: 30000 });

    // Reset password.
    await page.locator("#current-password").fill(tempPassword);
    await page.locator("#new-password").fill(newPassword);
    await page.locator("#confirm-password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    const userAfter = await db.collection("users").findOne({ email: targetEmail });
    const flagCleared = userAfter?.force_password_reset === false;
    const newHashWorks = await bcrypt.compare(newPassword, userAfter?.password_hash || "");

    console.log("FORCE RESET QA");
    console.log("==============");
    console.log(`PASS | Redirect to /reset-password on first login`);
    console.log(`PASS | Password update flow reaches dashboard`);
    console.log(`${flagCleared ? "PASS" : "FAIL"} | force_password_reset cleared in DB`);
    console.log(`${newHashWorks ? "PASS" : "FAIL"} | New password persisted`);

    await browser.close();
    if (!flagCleared || !newHashWorks) process.exit(1);
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error("FORCE RESET QA FAILED:", err);
  process.exit(1);
});
