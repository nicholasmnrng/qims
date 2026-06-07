import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  getOwnHandoverDetailOrThrow,
  requireOwnHandoverPermission,
} from "@/server/api/inspector";
import { db } from "@/server/db";
import { handovers } from "@/server/db/schema";
import { acknowledgeHandoverSchema } from "@/server/validation/inspector";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireOwnHandoverPermission(request);
    const { id } = await context.params;
    const input = acknowledgeHandoverSchema.parse(await request.json());
    const before = await getOwnHandoverDetailOrThrow(actor.id, id);
    const [handover] = await db
      .update(handovers)
      .set({
        status: "acknowledged",
        acknowledgedBy: actor.id,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(handovers.id, id))
      .returning();

    await auditInspectorWrite({
      actor,
      action: "handovers.acknowledge",
      entityType: "handovers",
      entityId: id,
      beforeValue: before.handover,
      afterValue: handover,
      reason: input.note ?? "Next shift acknowledged handover",
      request,
    });

    return ok(handover);
  } catch (error) {
    return handleApiError(error);
  }
}
