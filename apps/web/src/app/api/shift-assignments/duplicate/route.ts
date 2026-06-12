import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getAssignmentConflicts,
  publishOperationalRealtime,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { shiftAssignments } from "@/server/db/schema";
import { duplicateShiftAssignmentsSchema } from "@/server/validation/supervisor";

export async function POST(request: Request) {
  try {
    const actor = await requireOperationalPermission(request, "schedule:manage");
    const input = duplicateShiftAssignmentsSchema.parse(await request.json());
    const source = await db
      .select()
      .from(shiftAssignments)
      .where(
        and(
          eq(shiftAssignments.workDate, input.fromDate),
          input.shiftId ? eq(shiftAssignments.shiftId, input.shiftId) : undefined,
        ),
      );

    const rows = source.map((assignment) => ({
      id: randomUUID(),
      userId: assignment.userId,
      shiftId: assignment.shiftId,
      areaId: assignment.areaId,
      workDate: input.toDate,
      assignmentStatus: "draft" as const,
      changeReason: input.reason,
    }));

    const created = await db.transaction(async (tx) => {
      const duplicated =
        rows.length > 0
          ? await tx.insert(shiftAssignments).values(rows).returning()
          : [];

      await auditOperationalWrite({
        actor,
        action: "shift_assignments.duplicate",
        entityType: "shift_assignments",
        entityId: `${input.fromDate}->${input.toDate}`,
        beforeValue: source,
        afterValue: duplicated,
        reason: input.reason,
        request,
      }, tx);

      return duplicated;
    });
    const conflicts = (
      await Promise.all(
        created.map((assignment) =>
          getAssignmentConflicts({
            userId: assignment.userId,
            areaId: assignment.areaId,
            workDate: assignment.workDate,
            excludeAssignmentId: assignment.id,
          }),
        ),
      )
    ).flat();

    await publishOperationalRealtime({
      type: "schedule.updated",
      actorId: actor.id,
      userIds: created.map((assignment) => assignment.userId),
      areaIds: created.map((assignment) => assignment.areaId),
      roles: ["supervisor"],
      payload: {
        workDate: input.toDate,
        shiftId: input.shiftId ?? null,
        duplicatedCount: created.length,
      },
    });

    return ok({ duplicatedCount: created.length, assignments: created, conflicts });
  } catch (error) {
    return handleApiError(error);
  }
}
