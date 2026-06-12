import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  getOwnProcedureVersionOrThrow,
  requireOwnSopPermission,
} from "@/server/api/inspector";
import { publishOperationalRealtime } from "@/server/api/supervisor";
import { db } from "@/server/db";
import { procedureAcknowledgements } from "@/server/db/schema";
import { acknowledgeProcedureVersionSchema } from "@/server/validation/inspector";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireOwnSopPermission(request);
    const { id } = await context.params;
    const procedure = await getOwnProcedureVersionOrThrow(actor.id, id);
    const input = acknowledgeProcedureVersionSchema.parse(await request.json());

    if (procedure.version.isCritical && !input.criticalConfirmed) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "SOP critical wajib dikonfirmasi.",
          },
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const acknowledgement = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(procedureAcknowledgements)
        .values({
          id: randomUUID(),
          procedureVersionId: id,
          userId: actor.id,
          readAt: now,
          understoodAt: now,
          criticalConfirmedAt: input.criticalConfirmed ? now : null,
          note: input.note ?? null,
        })
        .onConflictDoUpdate({
          target: [
            procedureAcknowledgements.userId,
            procedureAcknowledgements.procedureVersionId,
          ],
          set: {
            readAt: now,
            understoodAt: now,
            criticalConfirmedAt: input.criticalConfirmed ? now : null,
            note: input.note ?? null,
            updatedAt: now,
          },
        })
        .returning();

      await auditInspectorWrite({
        actor,
        action: "procedure_versions.acknowledge",
        entityType: "procedure_versions",
        entityId: id,
        afterValue: saved,
        reason: input.note ?? "Inspector acknowledged SOP",
        request,
      }, tx);

      return saved;
    });

    await publishOperationalRealtime({
      type: "sop.acknowledged",
      actorId: actor.id,
      userIds: [actor.id],
      roles: ["supervisor"],
      payload: { procedureVersionId: id, userId: actor.id },
    });

    return ok(acknowledgement);
  } catch (error) {
    return handleApiError(error);
  }
}
