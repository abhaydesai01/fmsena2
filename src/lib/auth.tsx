import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type Role = "admin" | "cashier";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: Role | null;
  fullName: string;
  loading: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
        setFullName("");
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) fetchRole(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, full_name")
      .eq("user_id", userId)
      .order("role", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) {
      setRole(data.role as Role);
      setFullName(data.full_name || "");
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string, full: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: full } },
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  return (
    <AuthCtx.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        fullName,
        loading,
        isAdmin: role === "admin",
        isCashier: role === "cashier",
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