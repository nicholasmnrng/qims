import { randomUUID } from "node:crypto";

import { db } from "@/server/db";
import { auditLogs, type UserRole } from "@/server/db/schema";
import { getClientIp, getUserAgent } from "@/server/api/request";

type AuditInput = {
  actorId?: string | null;
  actorRole?: UserRole | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  reason?: string | null;
  request?: Request;
};

export async function writeAuditLog(input: AuditInput) {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    beforeValue: input.beforeValue ?? null,
    afterValue: input.afterValue ?? null,
    reason: input.reason ?? null,
    ipAddress: input.request ? getClientIp(input.request) : null,
    userAgent: input.request ? getUserAgent(input.request) : null,
  });
}
