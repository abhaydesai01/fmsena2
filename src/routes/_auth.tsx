import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!session) {
    throw redirect({ to: "/login" });
  }
  return <AppShell />;
}