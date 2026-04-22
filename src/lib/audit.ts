import { supabase } from "@/integrations/supabase/client";

export async function logAudit(opts: {
  actorName: string;
  actorRole: "admin" | "cashier" | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_log").insert({
    actor_id: user.id,
    actor_name: opts.actorName,
    actor_role: opts.actorRole,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    old_value: (opts.oldValue ?? null) as never,
    new_value: (opts.newValue ?? null) as never,
    reason: opts.reason ?? null,
  });
}