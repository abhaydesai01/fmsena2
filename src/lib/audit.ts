import { logAuditFn } from "@/fns/audit";
import type { AppRole } from "@/lib/permissions";

export async function logAudit(opts: {
  actorName: string;
  actorRole: AppRole | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  try {
    await logAuditFn({
      data: {
        actorName: opts.actorName,
        actorRole: opts.actorRole,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId ?? null,
        oldValue: opts.oldValue ?? null,
        newValue: opts.newValue ?? null,
        reason: opts.reason,
      },
    });
  } catch (e) {
    console.warn("logAudit failed:", e);
  }
}
