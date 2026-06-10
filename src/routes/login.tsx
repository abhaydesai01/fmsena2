import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSessionFn } from "@/fns/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Calculator, ArrowLeft, UserPlus } from "lucide-react";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    let session = null;
    try {
      session = await getSessionFn();
    } catch {
      // If session check fails, keep user on login instead of hard-failing route.
      return;
    }
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

type Portal = "admin" | "accountant" | "enrollment_officer";

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const expectedRole =
    portal === "admin" ? "ADMIN" : portal === "accountant" ? "ACCOUNTANT" : "ENROLLMENT_OFFICER";
  const portalLabel =
    portal === "admin" ? "Admin" : portal === "accountant" ? "Accountant" : "Enrollment Officer";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password, expectedRole);
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) return toast.error(error);
    toast.success("Account created — you can now sign in.");
  };

  if (!portal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground font-bold text-xl">
              E
            </div>
            <CardTitle className="text-2xl">ENA Fees Management</CardTitle>
            <CardDescription>Excellent NEET Academy · Dharwad</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Choose your portal to continue
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPortal("admin")}
                className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="font-semibold">Admin Login</div>
                <p className="text-xs text-muted-foreground text-center">
                  Manage campuses, courses, fee structures &amp; students
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPortal("accountant")}
                className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <Calculator className="h-6 w-6" />
                </div>
                <div className="font-semibold">Accountant Login</div>
                <p className="text-xs text-muted-foreground text-center">
                  Collect fees, clear dues &amp; manage installments
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPortal("enrollment_officer")}
                className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-card-foreground shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition">
                  <UserPlus className="h-6 w-6" />
                </div>
                <div className="font-semibold">Enrollment Officer</div>
                <p className="text-xs text-muted-foreground text-center">
                  Enroll students and maintain profile details
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground">
            {portal === "admin" ? (
              <ShieldCheck className="h-6 w-6" />
            ) : portal === "accountant" ? (
              <Calculator className="h-6 w-6" />
            ) : (
              <UserPlus className="h-6 w-6" />
            )}
          </div>
          <CardTitle className="text-2xl">{portalLabel} Portal</CardTitle>
          <CardDescription>ENA Fees Management · Dharwad</CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => {
              setPortal(null);
              setEmail("");
              setPassword("");
              setFullName("");
            }}
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Choose different portal
          </button>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input
                    id="si-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="si-pass">Password</Label>
                  <Input
                    id="si-pass"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : `Sign in as ${portalLabel}`}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <Label htmlFor="su-name">Full Name</Label>
                  <Input
                    id="su-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input
                    id="su-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="su-pass">Password</Label>
                  <Input
                    id="su-pass"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating…" : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  The first registered user becomes Admin. Subsequent users are Accountants.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
