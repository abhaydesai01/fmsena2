import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";
import * as bcrypt from "bcryptjs";
import {
  defaultPrivilegesForRole,
  normalizeRole,
  sanitizePrivilegesForRole,
  type AppRole,
  type Privileges,
} from "@/lib/permissions";
import { requireRole } from "./security";
import { getDb, toObjs } from "./db";

const safeOId = (id: string) => {
  try {
    return new ObjectId(id);
  } catch {
    return id as any;
  }
};

async function writeAudit(params: {
  action: string;
  performedBy: string;
  performedByName: string;
  targetEntity: string;
  targetEntityId: string;
  beforeState: unknown;
  afterState: unknown;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection("audit_log").insertOne({
    action: params.action,
    performed_by: params.performedBy,
    performed_by_name: params.performedByName,
    target_entity: params.targetEntity,
    target_entity_id: params.targetEntityId,
    timestamp: now,
    before_state: params.beforeState ?? null,
    after_state: params.afterState ?? null,
    actor_id: params.performedBy,
    actor_name: params.performedByName,
    actor_role: "ADMIN",
    entity_type: params.targetEntity,
    entity_id: params.targetEntityId,
    old_value: params.beforeState ?? null,
    new_value: params.afterState ?? null,
    created_at: now,
  });
}

function normalizeUser(doc: any) {
  const role = normalizeRole(doc.role as string);
  return {
    id: doc.id,
    name: (doc.full_name as string) || "User",
    email: doc.email as string,
    role,
    status: (doc.status as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE",
    privileges: sanitizePrivilegesForRole(
      role,
      (doc.privileges as Partial<Privileges> | undefined) ?? null,
    ),
    lastModifiedBy: doc.privilege_meta?.last_modified_by ?? null,
    lastModifiedByName: doc.privilege_meta?.last_modified_by_name ?? null,
    lastModifiedAt: doc.privilege_meta?.last_modified_at ?? null,
    createdAt: doc.created_at ?? null,
  };
}

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole(["ADMIN"]);
  const db = await getDb();
  const docs = await db.collection("users").find({}).sort({ created_at: 1 }).toArray();
  return toObjs(docs).map(normalizeUser);
});

export const createUserFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      email: string;
      password: string;
      role: AppRole;
      status: "ACTIVE" | "INACTIVE";
      forcePasswordReset: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const actor = await requireRole(["ADMIN"]);
    const db = await getDb();

    const email = data.email.toLowerCase().trim();
    const fullName = data.name.trim();
    const password = data.password;
    if (!email) throw new Error("Email is required");
    if (!fullName) throw new Error("Name is required");
    if (!password || password.length < 6) {
      throw new Error("Temporary password must be at least 6 characters");
    }

    const exists = await db.collection("users").findOne({ email });
    if (exists) throw new Error("A user with this email already exists");

    const role = normalizeRole(data.role);
    const status = data.status;
    const forcePasswordReset = Boolean(data.forcePasswordReset);
    const now = new Date().toISOString();
    const privileges = defaultPrivilegesForRole(role);
    const password_hash = await bcrypt.hash(password, 12);

    const insert = await db.collection("users").insertOne({
      email,
      password_hash,
      role,
      status,
      force_password_reset: forcePasswordReset,
      privileges,
      full_name: fullName,
      created_at: now,
      updated_at: now,
      privilege_meta: {
        last_modified_by: actor.userId,
        last_modified_by_name: actor.fullName,
        last_modified_at: now,
      },
    });

    await writeAudit({
      action: "create_user",
      performedBy: actor.userId,
      performedByName: actor.fullName,
      targetEntity: "user",
      targetEntityId: insert.insertedId.toString(),
      beforeState: null,
      afterState: {
        name: fullName,
        email,
        role,
        status,
        forcePasswordReset,
        privileges,
      },
    });

    return { ok: true, userId: insert.insertedId.toString() };
  });

export const updateUserRoleFn = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; role: AppRole }) => d)
  .handler(async ({ data }) => {
    const actor = await requireRole(["ADMIN"]);
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: safeOId(data.userId) });
    if (!user) throw new Error("User not found");

    const nextRole = normalizeRole(data.role);
    const currentRole = normalizeRole(user.role as string);
    if (actor.userId === data.userId && currentRole === "ADMIN" && nextRole !== "ADMIN") {
      throw new Error("Admin cannot demote themselves");
    }

    const privileges = defaultPrivilegesForRole(nextRole);
    const now = new Date().toISOString();
    const beforeState = {
      role: currentRole,
      privileges: sanitizePrivilegesForRole(
        currentRole,
        (user.privileges as Partial<Privileges> | undefined) ?? null,
      ),
    };
    const afterState = { role: nextRole, privileges };

    await db.collection("users").updateOne(
      { _id: safeOId(data.userId) },
      {
        $set: {
          role: nextRole,
          privileges,
          updated_at: now,
          privilege_meta: {
            last_modified_by: actor.userId,
            last_modified_by_name: actor.fullName,
            last_modified_at: now,
          },
        },
      },
    );

    await writeAudit({
      action: "assign_role",
      performedBy: actor.userId,
      performedByName: actor.fullName,
      targetEntity: "user",
      targetEntityId: data.userId,
      beforeState,
      afterState,
    });
    return { ok: true };
  });

export const updateUserPrivilegesFn = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; privileges: Partial<Privileges> }) => d)
  .handler(async ({ data }) => {
    const actor = await requireRole(["ADMIN"]);
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: safeOId(data.userId) });
    if (!user) throw new Error("User not found");

    const role = normalizeRole(user.role as string);
    if (actor.userId === data.userId && role === "ADMIN") {
      throw new Error("Admin cannot remove their own admin access");
    }

    const previous = sanitizePrivilegesForRole(
      role,
      (user.privileges as Partial<Privileges> | undefined) ?? null,
    );
    const next = sanitizePrivilegesForRole(role, { ...previous, ...data.privileges });
    if (actor.userId === data.userId && role === "ADMIN" && next.canAssignRoles === false) {
      throw new Error("Admin cannot remove their own admin access");
    }

    const now = new Date().toISOString();
    await db.collection("users").updateOne(
      { _id: safeOId(data.userId) },
      {
        $set: {
          privileges: next,
          updated_at: now,
          privilege_meta: {
            last_modified_by: actor.userId,
            last_modified_by_name: actor.fullName,
            last_modified_at: now,
          },
        },
      },
    );

    await writeAudit({
      action: "assign_custom_privileges",
      performedBy: actor.userId,
      performedByName: actor.fullName,
      targetEntity: "user",
      targetEntityId: data.userId,
      beforeState: { role, privileges: previous },
      afterState: { role, privileges: next },
    });
    return { ok: true };
  });

export const updateUserStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: { userId: string; status: "ACTIVE" | "INACTIVE" }) => d)
  .handler(async ({ data }) => {
    const actor = await requireRole(["ADMIN"]);
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: safeOId(data.userId) });
    if (!user) throw new Error("User not found");

    const role = normalizeRole(user.role as string);
    if (actor.userId === data.userId && role === "ADMIN" && data.status !== "ACTIVE") {
      throw new Error("Admin cannot deactivate themselves");
    }

    const before = (user.status as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE";
    const now = new Date().toISOString();
    await db
      .collection("users")
      .updateOne({ _id: safeOId(data.userId) }, { $set: { status: data.status, updated_at: now } });

    await writeAudit({
      action: "update_user_status",
      performedBy: actor.userId,
      performedByName: actor.fullName,
      targetEntity: "user",
      targetEntityId: data.userId,
      beforeState: { status: before },
      afterState: { status: data.status },
    });
    return { ok: true };
  });
