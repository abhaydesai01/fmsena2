import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import dns from "node:dns";

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:8082";
const MONGO_URI =
  process.env.MONGO_URI ||
  "";
const DB_NAME = process.env.MONGO_DB_NAME || "fmsena";

const adminEmail = "qa.admin.rbac@example.com";
const adminPassword = "Admin@123456";
const userEmail = "qa.user.rbac@example.com";
const userPassword = "User@123456";

const now = () => new Date().toISOString();

// Work around local resolver intermittently refusing SRV lookups.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

function defaultPrivileges(role) {
  const allFalse = {
    canEnrollStudents: false,
    canViewAggregateFinancials: false,
    canCancelConcession: false,
    canRevokeConcessionCancellation: false,
    canGenerateReports: false,
    canAssignRoles: false,
    canExportReports: false,
    canViewPaymentHistory: false,
    canEditStudentProfile: false,
    canViewFeeCategory: false,
  };

  if (role === "ADMIN") {
    return {
      ...allFalse,
      canEnrollStudents: true,
      canViewAggregateFinancials: true,
      canCancelConcession: true,
      canRevokeConcessionCancellation: true,
      canGenerateReports: true,
      canAssignRoles: true,
      canExportReports: true,
      canViewPaymentHistory: true,
      canEditStudentProfile: true,
      canViewFeeCategory: true,
    };
  }

  if (role === "ACCOUNTANT") {
    return {
      ...allFalse,
      canCancelConcession: true,
      canGenerateReports: true,
      canExportReports: true,
      canViewPaymentHistory: true,
      canViewFeeCategory: true,
    };
  }

  return {
    ...allFalse,
    canEnrollStudents: true,
    canEditStudentProfile: true,
    canViewFeeCategory: true,
  };
}

async function waitFor(fn, timeoutMs = 12000, intervalMs = 300) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (value) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function checkEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

const results = [];
function record(name, pass, details = "") {
  results.push({ name, pass, details });
}

async function main() {
  if (!MONGO_URI) throw new Error("MONGO_URI is required");
  const mongo = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await mongo.connect();
  const db = mongo.db(DB_NAME);
  const users = db.collection("users");
  const audit = db.collection("audit_log");

  try {
    const adminHash = await bcrypt.hash(adminPassword, 12);
    const userHash = await bcrypt.hash(userPassword, 12);

    await users.updateOne(
      { email: adminEmail },
      {
        $set: {
          email: adminEmail,
          password_hash: adminHash,
          role: "ADMIN",
          status: "ACTIVE",
          full_name: "QA Admin",
          privileges: defaultPrivileges("ADMIN"),
          updated_at: now(),
        },
        $setOnInsert: { created_at: now() },
      },
      { upsert: true },
    );

    await users.updateOne(
      { email: userEmail },
      {
        $set: {
          email: userEmail,
          password_hash: userHash,
          role: "ACCOUNTANT",
          status: "ACTIVE",
          full_name: "QA Target User",
          privileges: {
            ...defaultPrivileges("ACCOUNTANT"),
            canEnrollStudents: true,
            canViewAggregateFinancials: true,
          },
          updated_at: now(),
        },
        $setOnInsert: { created_at: now() },
      },
      { upsert: true },
    );

    const adminDoc = await users.findOne({ email: adminEmail });
    const userDocBefore = await users.findOne({ email: userEmail });
    if (!adminDoc || !userDocBefore) throw new Error("Unable to seed QA users");

    await audit.deleteMany({
      target_entity: "user",
      target_entity_id: userDocBefore._id.toString(),
      action: { $in: ["assign_role", "assign_custom_privileges"] },
    });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Admin Login" }).click();
    await page.fill("#si-email", adminEmail);
    await page.fill("#si-pass", adminPassword);
    await page.getByRole("button", { name: "Sign in as Admin" }).click();
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    } catch (e) {
      await page.screenshot({ path: "qa-login-failure.png", fullPage: true });
      const errorText = await page.locator("body").innerText();
      throw new Error(
        `Login did not reach /dashboard. current_url=${page.url()} body_snippet=${errorText.slice(0, 400)}`,
      );
    }
    await page.goto(`${BASE_URL}/users`, { waitUntil: "networkidle" });
    await page.waitForSelector("table");

    const targetRow = page.locator("tr", { hasText: userEmail });
    const adminRow = page.locator("tr", { hasText: adminEmail });

    const userRowExists = (await targetRow.count()) > 0;
    record("Create users (QA setup visible in User Management)", userRowExists, userRowExists ? "User row found." : "User row missing.");

    // Change role to Enrollment Officer
    await targetRow.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Enrollment Officer" }).click();

    const roleChanged = await waitFor(async () => {
      const doc = await users.findOne({ email: userEmail });
      return doc?.role === "ENROLLMENT_OFFICER";
    });
    const userAfterRole1 = await users.findOne({ email: userEmail });
    const defaultEnrollPrivileges = defaultPrivileges("ENROLLMENT_OFFICER");
    const roleResetApplied =
      roleChanged && checkEqual(userAfterRole1?.privileges ?? {}, defaultEnrollPrivileges);
    record(
      "Change role applies defaults (ACCOUNTANT -> ENROLLMENT_OFFICER)",
      roleResetApplied,
      roleResetApplied ? "Role and privileges reset to role defaults." : "Role/default privilege reset failed.",
    );

    // Custom privileges update
    await targetRow.getByRole("button", { name: "Privileges" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 15000 });
    const canEditLabel = dialog.getByText("canEditStudentProfile").first();
    if (await canEditLabel.isVisible().catch(() => false)) {
      await canEditLabel.click();
    } else {
      // Fallback: ENROLLMENT_OFFICER privilege order is canEnrollStudents, canEditStudentProfile, canViewFeeCategory.
      await dialog.locator("label").nth(1).click();
    }
    await dialog.getByRole("button", { name: "Save" }).click();

    const customUpdated = await waitFor(async () => {
      const doc = await users.findOne({ email: userEmail });
      return doc?.privileges?.canEditStudentProfile === false;
    });
    record(
      "Assign custom privileges persists",
      customUpdated,
      customUpdated ? "canEditStudentProfile toggled OFF and saved." : "Custom privilege did not persist.",
    );

    // Role reset check again
    await targetRow.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Accountant" }).click();

    const roleChangedBack = await waitFor(async () => {
      const doc = await users.findOne({ email: userEmail });
      return doc?.role === "ACCOUNTANT";
    });
    const userAfterRole2 = await users.findOne({ email: userEmail });
    const defaultAccountant = defaultPrivileges("ACCOUNTANT");
    const resetBackApplied =
      roleChangedBack && checkEqual(userAfterRole2?.privileges ?? {}, defaultAccountant);
    record(
      "Privilege reset on subsequent role change (-> ACCOUNTANT)",
      resetBackApplied,
      resetBackApplied ? "Custom toggles cleared and accountant defaults restored." : "Privileges were not reset on role change.",
    );

    // Self demotion guard in UI
    const adminRoleSelectCount = await adminRow.getByRole("combobox").count();
    const adminDeactivateBtn = adminRow.getByRole("button", { name: "Deactivate" });
    const hasDisabledDeactivate = (await adminDeactivateBtn.count()) > 0 ? await adminDeactivateBtn.isDisabled() : false;
    const selfDemotionBlocked = adminRoleSelectCount === 0 && hasDisabledDeactivate;
    record(
      "Admin self-demotion/self-deactivation blocked",
      selfDemotionBlocked,
      selfDemotionBlocked
        ? "No role dropdown for self-admin and deactivate action is disabled."
        : "Self-admin guard not enforced in UI.",
    );

    // Audit + metadata checks
    const latestUser = await users.findOne({ email: userEmail });
    const privilegeMetaValid =
      !!latestUser?.privilege_meta?.last_modified_by &&
      !!latestUser?.privilege_meta?.last_modified_at &&
      latestUser?.privilege_meta?.last_modified_by === adminDoc._id.toString();
    record(
      "Last Modified By + timestamp saved",
      privilegeMetaValid,
      privilegeMetaValid
        ? `last_modified_by=${latestUser.privilege_meta.last_modified_by}`
        : "Missing/incorrect privilege metadata.",
    );

    const auditRows = await audit
      .find({
        target_entity: "user",
        target_entity_id: latestUser._id.toString(),
        action: { $in: ["assign_role", "assign_custom_privileges"] },
      })
      .sort({ created_at: -1 })
      .toArray();
    const hasRoleAudit = auditRows.some((a) => a.action === "assign_role");
    const hasCustomAudit = auditRows.some((a) => a.action === "assign_custom_privileges");
    const hasRequiredFields = auditRows.every(
      (a) =>
        a.performed_by &&
        a.target_entity &&
        a.timestamp &&
        Object.prototype.hasOwnProperty.call(a, "before_state") &&
        Object.prototype.hasOwnProperty.call(a, "after_state"),
    );
    record(
      "Audit log entries include action, performer, target, timestamp, before/after",
      hasRoleAudit && hasCustomAudit && hasRequiredFields,
      `entries=${auditRows.length}`,
    );

    await browser.close();
  } finally {
    await mongo.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  console.log("\nRBAC QA RESULTS");
  console.log("===============");
  for (const item of results) {
    console.log(`${item.pass ? "PASS" : "FAIL"} | ${item.name}${item.details ? ` | ${item.details}` : ""}`);
  }
  console.log("---------------");
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("QA script failed:", err);
  process.exit(1);
});
