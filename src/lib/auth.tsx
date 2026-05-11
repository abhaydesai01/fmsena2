import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSessionFn, signInFn, signUpFn, signOutFn, type SessionUser } from "@/fns/auth";

export type Role = "admin" | "cashier";

export function roleLabel(r: Role | null | undefined): string {
  if (r === "admin") return "Admin";
  if (r === "cashier") return "Accountant";
  return "—";
}

export type Session = SessionUser;

interface AuthContextValue {
  session: Session | null;
  user: { id: string; email: string } | null;
  role: Role | null;
  fullName: string;
  loading: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isAccountant: boolean;
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
        fullName: session?.fullName ?? "",
        loading,
        isAdmin: session?.role === "admin",
        isCashier: session?.role === "cashier",
        isAccountant: session?.role === "cashier",
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
