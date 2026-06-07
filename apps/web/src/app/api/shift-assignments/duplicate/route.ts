import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getAssignmentConflicts,
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

    const created =
      rows.length > 0
        ? await db.insert(shiftAssignments).values(rows).returning()
        : [];
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

    await auditOperationalWrite({
      actor,
      action: "shift_assignments.duplicate",
      entityType: "shift_assignments",
      entityId: `${input.fromDate}->${input.toDate}`,
      beforeValue: source,
      afterValue: created,
      reason: input.reason,
      request,
    });

    return ok({ duplicatedCount: created.length, assignments: created, conflicts });
  } catch (error) {
    return handleApiError(error);
  }
}
