import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSessionFn, signInFn, signUpFn, signOutFn, type SessionUser } from "@/fns/auth";
import {
  hasPermission as can,
  hasRole as hasAnyRole,
  roleLabel,
  type AppRole,
  type PrivilegeKey,
  type Privileges,
} from "@/lib/permissions";
export { roleLabel } from "@/lib/permissions";

export type Session = SessionUser;

interface AuthContextValue {
  session: Session | null;
  user: { id: string; email: string } | null;
  role: AppRole | null;
  privileges: Privileges | null;
  forcePasswordReset: boolean;
  fullName: string;
  loading: boolean;
  isAdmin: boolean;
  isAccountant: boolean;
  isEnrollmentOfficer: boolean;
  hasPermission: (permission: PrivilegeKey) => boolean;
  hasRole: (roles: AppRole[]) => boolean;
  signIn: (email: string, password: string, expectedRole?: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessionFn()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string, expectedRole = "") => {
    const result = await signInFn({ data: { email, password, expectedRole } });
    if (result.error) return { error: result.error };
    if (result.session) setSession(result.session);
    return {};
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const result = await signUpFn({ data: { email, password, fullName, role: "" } });
    if (result.error) return { error: result.error };
    if (result.session) setSession(result.session);
    return {};
  };

  const signOut = async () => {
    await signOutFn();
    setSession(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        session,
        user: session ? { id: session.userId, email: session.email } : null,
        role: session?.role ?? null,
        privileges: session?.privileges ?? null,
        forcePasswordReset: Boolean(session?.forcePasswordReset),
        fullName: session?.fullName ?? "",
        loading,
        isAdmin: session?.role === "ADMIN",
        isAccountant: session?.role === "ACCOUNTANT",
        isEnrollmentOfficer: session?.role === "ENROLLMENT_OFFICER",
        hasPermission: (permission) =>
          can(session ? { role: session.role, privileges: session.privileges } : null, permission),
        hasRole: (roles) =>
          hasAnyRole(
            session ? { role: session.role, privileges: session.privileges } : null,
            roles,
          ),
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
