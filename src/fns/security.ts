import { hasPermission, hasRole, type AppRole, type PrivilegeKey } from "@/lib/permissions";
import { getSessionFn } from "./auth";

export async function requireSession() {
  const session = await getSessionFn();
  if (!session) throw new Error("Access denied");
  if (session.status !== "ACTIVE") throw new Error("Access denied");
  return session;
}

export async function requireRole(roles: AppRole[]) {
  const session = await requireSession();
  if (!hasRole({ role: session.role, privileges: session.privileges }, roles)) {
    throw new Error("Access denied");
  }
  return session;
}

export async function requirePermission(permission: PrivilegeKey) {
  const session = await requireSession();
  if (!hasPermission({ role: session.role, privileges: session.privileges }, permission)) {
    throw new Error("Access denied");
  }
  return session;
}
