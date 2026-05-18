import { createServerFn } from "@tanstack/react-start";
import { getDb, toObjs } from "./db";
import { getSessionFn } from "./auth";
import type { AppRole } from "@/lib/permissions";

export const logAuditFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      actorName: string;
      actorRole: AppRole | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      oldValue?: unknown;
      newValue?: unknown;
      reason?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const session = await getSessionFn();
    const db = await getDb();
    const now = new Date().toISOString();
    await db.collection("audit_log").insertOne({
      action: data.action,
      performed_by: session?.userId ?? null,
      performed_by_name: data.actorName,
      target_entity: data.entityType,
      target_entity_id: data.entityId ?? null,
      timestamp: now,
      before_state: data.oldValue ?? null,
      after_state: data.newValue ?? null,
      actor_id: session?.userId ?? null,
      actor_name: data.actorName,
      actor_role: data.actorRole ?? null,
      entity_type: data.entityType,
      entity_id: data.entityId ?? null,
      old_value: data.oldValue ?? null,
      new_value: data.newValue ?? null,
      reason: data.reason ?? null,
      created_at: now,
    });
    return { ok: true };
  });

export const getAuditLogFn = createServerFn({ method: "GET" })
  .inputValidator((d: { from?: string; to?: string }) => d)
  .handler(async ({ data }) => {
    const db = await getDb();
    const filter: Record<string, any> = {};
    if (data.from) filter.created_at = { $gte: data.from };
    if (data.to)
      filter.created_at = {
        ...(filter.created_at || {}),
        $lte: data.to + "T23:59:59",
      };
    const docs = await db
      .collection("audit_log")
      .find(filter)
      .sort({ created_at: -1 })
      .limit(500)
      .toArray();
    return toObjs(docs);
  });
