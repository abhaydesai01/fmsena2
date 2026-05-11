import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/fns/auth";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
  component: AppShell,
});
