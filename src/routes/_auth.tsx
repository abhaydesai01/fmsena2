import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/fns/auth";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ location }) => {
    let session = null;
    try {
      session = await getSessionFn();
    } catch {
      // If session fetch fails transiently, fail closed to login instead of crashing route load.
      throw redirect({ to: "/login" });
    }
    if (!session) throw redirect({ to: "/login" });
    if (session.forcePasswordReset && location.pathname !== "/reset-password") {
      throw redirect({ to: "/reset-password" });
    }
    return { session };
  },
  component: AppShell,
});
