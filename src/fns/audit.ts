import { createServerFn } from "@tanstack/react-start";
import { getDb, toObjs } from "./db";
import { getSessionFn } from "./auth";

export const logAuditFn = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      actorName: string;
      actorRole: "admin" | "cashier" | null;
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
    await db.collection("audit_log").insertOne({
      actor_id: session?.userId ?? null,
      actor_name: data.actorName,
      actor_role: data.actorRole ?? null,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId ?? null,
      old_value: data.oldValue ?? null,
      new_value: data.newValue ?? null,
      reason: data.reason ?? null,
      created_at: new Date().toISOString(),
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
