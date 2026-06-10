import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/fns/auth";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    let session = null;
    try {
      session = await getSessionFn();
    } catch {
      // Transient session fetch errors should still land user on login.
      throw redirect({ to: "/login" });
    }
    if (session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/login" });
  },
});
