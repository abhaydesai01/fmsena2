import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/fns/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/login" });
  },
});
