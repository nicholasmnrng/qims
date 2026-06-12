import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getAssignmentConflicts,
  getShiftAssignmentOrThrow,
  publishOperationalRealtime,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { shiftAssignments } from "@/server/db/schema";
import { updateShiftAssignmentSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireOperationalPermission(request, "schedule:manage");
    const { id } = await context.params;
    return ok(await getShiftAssignmentOrThrow(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "schedule:manage");
    const { id } = await context.params;
    const before = await getShiftAssignmentOrThrow(id);
    const input = updateShiftAssignmentSchema.parse(await request.json());
    const next = {
      userId: input.userId ?? before.userId,
      areaId: input.areaId ?? before.areaId,
      workDate: input.workDate ?? before.workDate,
    };
    const conflicts = await getAssignmentConflicts({
      ...next,
      excludeAssignmentId: id,
    });

    const assignment = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shiftAssignments)
        .set({
          userId: input.userId,
          shiftId: input.shiftId,
          areaId: input.areaId,
          workDate: input.workDate,
          assignmentStatus: input.assignmentStatus,
          changeReason: input.changeReason,
          updatedAt: new Date(),
        })
        .where(eq(shiftAssignments.id, id))
        .returning();

      await auditOperationalWrite({
        actor,
        action: "shift_assignments.update",
        entityType: "shift_assignments",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: input.changeReason,
        request,
      }, tx);

      return updated;
    });
    await publishOperationalRealtime({
      type: "schedule.updated",
      actorId: actor.id,
      userIds: [before.userId, assignment.userId],
      areaIds: [before.areaId, assignment.areaId],
      roles: ["supervisor"],
      payload: {
        assignmentId: assignment.id,
        workDate: assignment.workDate,
        shiftId: assignment.shiftId,
        status: assignment.assignmentStatus,
      },
    });

    return ok({ assignment, conflicts });
  } catch (error) {
    return handleApiError(error);
  }
}
