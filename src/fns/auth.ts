import { createServerFn } from "@tanstack/react-start";
import { SignJWT, jwtVerify } from "jose";
import * as bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "./db";
import {
  defaultPrivilegesForRole,
  normalizeRole,
  sanitizePrivilegesForRole,
  type AppRole,
  type Privileges,
} from "@/lib/permissions";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fmsena-super-secret-jwt-key-change-in-production",
);
const COOKIE_NAME = "fmsena_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  userId: string;
  email: string;
  role: AppRole;
  fullName: string;
  status: "ACTIVE" | "INACTIVE";
  privileges: Privileges;
  forcePasswordReset: boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

function readAuthCookie(): string | null {
  try {
    return getCookie(COOKIE_NAME) ?? null;
  } catch {
    return null;
  }
}

function setAuthCookie(token: string) {
  try {
    setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE,
    });
  } catch {}
}

function clearAuthCookie() {
  try {
    deleteCookie(COOKIE_NAME, { path: "/" });
  } catch {}
}

const safeOId = (id: string) => {
  try {
    return new ObjectId(id);
  } catch {
    return id as unknown as ObjectId;
  }
};

function toSessionUser(user: any): SessionUser {
  const role = normalizeRole(user.role as string);
  return {
    userId: user._id.toString(),
    email: user.email as string,
    role,
    fullName: (user.full_name as string) || "User",
    status: (user.status as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE",
    privileges: sanitizePrivilegesForRole(
      role,
      (user.privileges as Partial<Privileges> | undefined) ?? null,
    ),
    forcePasswordReset: Boolean(user.force_password_reset),
  };
}

// ── server functions ─────────────────────────────────────────────────────────

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const token = readAuthCookie();
    if (!token) return null;
    const decoded = await verifyToken(token);
    if (!decoded?.userId) return null;

    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: safeOId(decoded.userId) });
    const fallback = await db.collection("users").findOne({ email: decoded.email });
    const source = user ?? fallback;
    if (!source) return null;
    const session = toSessionUser(source);
    const status = session.status;
    if (status !== "ACTIVE") return null;
    return session;
  },
);

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; expectedRole: string }) => d)
  .handler(async ({ data }): Promise<{ session: SessionUser | null; error?: string }> => {
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: data.email.toLowerCase().trim() });

    if (!user) return { session: null, error: "Invalid email or password" };

    const valid = await bcrypt.compare(data.password, user.password_hash as string);
    if (!valid) return { session: null, error: "Invalid email or password" };

    const role = normalizeRole(user.role as string);
    const expected = data.expectedRole ? normalizeRole(data.expectedRole) : null;
    if (expected && role !== expected) {
      return {
        session: null,
        error: `This account is not a ${expected === "ADMIN" ? "Admin" : expected === "ACCOUNTANT" ? "Accountant" : "Enrollment Officer"}. Use the correct portal.`,
      };
    }

    const status = (user.status as "ACTIVE" | "INACTIVE" | undefined) ?? "ACTIVE";
    if (status !== "ACTIVE") {
      return { session: null, error: "Your account is inactive. Contact an administrator." };
    }

    const session: SessionUser = toSessionUser(user);

    const token = await signToken(session);
    setAuthCookie(token);
    return { session };
  });

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; fullName: string; role: string }) => d)
  .handler(async ({ data }): Promise<{ session: SessionUser | null; error?: string }> => {
    const db = await getDb();
    const existing = await db
      .collection("users")
      .findOne({ email: data.email.toLowerCase().trim() });

    if (existing) return { session: null, error: "Email already registered" };

    // First user gets admin, subsequent get accountant
    const userCount = await db.collection("users").countDocuments();
    const role: AppRole = userCount === 0 ? "ADMIN" : "ACCOUNTANT";

    const password_hash = await bcrypt.hash(data.password, 12);
    const result = await db.collection("users").insertOne({
      email: data.email.toLowerCase().trim(),
      password_hash,
      role,
      status: "ACTIVE",
      force_password_reset: false,
      privileges: defaultPrivilegesForRole(role),
      full_name: data.fullName.trim() || "User",
      created_at: new Date().toISOString(),
    });

    const session: SessionUser = {
      userId: result.insertedId.toString(),
      email: data.email.toLowerCase().trim(),
      role,
      fullName: data.fullName.trim() || "User",
      status: "ACTIVE",
      privileges: defaultPrivilegesForRole(role),
      forcePasswordReset: false,
    };

    const token = await signToken(session);
    setAuthCookie(token);
    return { session };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  clearAuthCookie();
  return { ok: true };
});

export const resetPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d: { currentPassword: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    if (!data.newPassword || data.newPassword.length < 6) {
      return { ok: false, error: "New password must be at least 6 characters" };
    }

    const session = await getSessionFn();
    if (!session) return { ok: false, error: "Not authenticated" };

    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: safeOId(session.userId) });
    if (!user) return { ok: false, error: "User not found" };

    const currentHash = user.password_hash as string;
    const currentValid = await bcrypt.compare(data.currentPassword, currentHash);
    if (!currentValid) return { ok: false, error: "Current password is incorrect" };

    const password_hash = await bcrypt.hash(data.newPassword, 12);
    await db.collection("users").updateOne(
      { _id: safeOId(session.userId) },
      {
        $set: {
          password_hash,
          force_password_reset: false,
          updated_at: new Date().toISOString(),
        },
      },
    );

    const updated = await db.collection("users").findOne({ _id: safeOId(session.userId) });
    if (!updated) return { ok: false, error: "Unable to refresh session" };
    const nextSession = toSessionUser(updated);
    const token = await signToken(nextSession);
    setAuthCookie(token);
    return { ok: true };
  });
