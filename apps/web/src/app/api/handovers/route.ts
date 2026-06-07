import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listHandovers } from "@/server/api/supervisor";
import {
  auditInspectorWrite,
  assertInspectorAreaAccess,
  getOwnIssueDetailOrThrow,
  getOwnShiftAssignmentOrThrow,
  getOwnTaskOrThrow,
  listOwnHandovers,
  requireOwnHandoverPermission,
} from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { handoverItems, handovers } from "@/server/db/schema";
import { createHandoverSchema } from "@/server/validation/inspector";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
  try {
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      requirePermission(actor, "handover:create-own");
      return ok(await listOwnHandovers(request, actor.id));
    }

    requirePermission(actor, "handover:manage");
    return ok(await listHandovers(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOwnHandoverPermission(request);
    const input = createHandoverSchema.parse(await request.json());
    const assignment = await getOwnShiftAssignmentOrThrow(
      actor.id,
      input.fromShiftAssignmentId,
    );
    if (assignment.areaId !== input.areaId) {
      return Response.json(
        {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Area handover harus sesuai assignment inspector.",
          },
        },
        { status: 400 },
      );
    }

    for (const item of input.items) {
      if (item.relatedTaskId) {
        await getOwnTaskOrThrow(actor.id, item.relatedTaskId);
      }
      if (item.relatedIssueId) {
        await getOwnIssueDetailOrThrow(actor.id, item.relatedIssueId);
      }
    }
    await assertInspectorAreaAccess(actor.id, input.areaId);

    const handover = await db.transaction(async (tx) => {
      const handoverId = randomUUID();
      const [created] = await tx
        .insert(handovers)
        .values({
          id: handoverId,
          fromShiftAssignmentId: input.fromShiftAssignmentId,
          toShiftId: input.toShiftId ?? null,
          areaId: input.areaId,
          submittedBy: actor.id,
          status: input.status,
          submittedAt: input.status === "submitted" ? new Date() : null,
        })
        .returning();

      await tx.insert(handoverItems).values(
        input.items.map((item) => ({
          id: randomUUID(),
          handoverId,
          category: item.category,
          note: item.note,
          severity: item.severity,
          attachmentUrl: item.attachmentUrl ?? null,
          relatedTaskId: item.relatedTaskId ?? null,
          relatedIssueId: item.relatedIssueId ?? null,
        })),
      );

      return created;
    });

    await auditInspectorWrite({
      actor,
      action: input.status === "submitted" ? "handovers.submit" : "handovers.draft",
      entityType: "handovers",
      entityId: handover.id,
      afterValue: { handover, items: input.items },
      reason: "Inspector handover",
      request,
    });

    return ok(handover, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
