import { createServerFn } from "@tanstack/react-start";
import { SignJWT, jwtVerify } from "jose";
import * as bcrypt from "bcryptjs";
import { getDb } from "./db";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fmsena-super-secret-jwt-key-change-in-production",
);
const COOKIE_NAME = "fmsena_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Role = "admin" | "cashier";

export interface SessionUser {
  userId: string;
  email: string;
  role: Role;
  fullName: string;
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

// ── server functions ─────────────────────────────────────────────────────────

export const getSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    const token = readAuthCookie();
    if (!token) return null;
    return verifyToken(token);
  },
);

export const signInFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { email: string; password: string; expectedRole: string }) => d,
  )
  .handler(async ({ data }): Promise<{ session: SessionUser | null; error?: string }> => {
    const db = await getDb();
    const user = await db
      .collection("users")
      .findOne({ email: data.email.toLowerCase().trim() });

    if (!user) return { session: null, error: "Invalid email or password" };

    const valid = await bcrypt.compare(data.password, user.password_hash as string);
    if (!valid) return { session: null, error: "Invalid email or password" };

    if (data.expectedRole && user.role !== data.expectedRole) {
      return {
        session: null,
        error: `This account is not a ${data.expectedRole === "admin" ? "Admin" : "Accountant"}. Use the correct portal.`,
      };
    }

    const session: SessionUser = {
      userId: user._id.toString(),
      email: user.email as string,
      role: user.role as Role,
      fullName: user.full_name as string,
    };

    const token = await signToken(session);
    setAuthCookie(token);
    return { session };
  });

export const signUpFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { email: string; password: string; fullName: string; role: string }) => d,
  )
  .handler(async ({ data }): Promise<{ session: SessionUser | null; error?: string }> => {
    const db = await getDb();
    const existing = await db
      .collection("users")
      .findOne({ email: data.email.toLowerCase().trim() });

    if (existing) return { session: null, error: "Email already registered" };

    // First user gets admin, subsequent get cashier
    const userCount = await db.collection("users").countDocuments();
    const role: Role = userCount === 0 ? "admin" : "cashier";

    const password_hash = await bcrypt.hash(data.password, 12);
    const result = await db.collection("users").insertOne({
      email: data.email.toLowerCase().trim(),
      password_hash,
      role,
      full_name: data.fullName.trim() || "User",
      created_at: new Date().toISOString(),
    });

    const session: SessionUser = {
      userId: result.insertedId.toString(),
      email: data.email.toLowerCase().trim(),
      role,
      fullName: data.fullName.trim() || "User",
    };

    const token = await signToken(session);
    setAuthCookie(token);
    return { session };
  });

export const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  clearAuthCookie();
  return { ok: true };
});
