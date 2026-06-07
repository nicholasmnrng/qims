import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getAssignmentConflicts,
  listShiftAssignments,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { shiftAssignments } from "@/server/db/schema";
import { createShiftAssignmentSchema } from "@/server/validation/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "schedule:manage");
    return ok(await listShiftAssignments(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOperationalPermission(request, "schedule:manage");
    const input = createShiftAssignmentSchema.parse(await request.json());
    const conflicts = await getAssignmentConflicts(input);
    const id = randomUUID();

    const [assignment] = await db
      .insert(shiftAssignments)
      .values({
        id,
        userId: input.userId,
        shiftId: input.shiftId,
        areaId: input.areaId,
        workDate: input.workDate,
        assignmentStatus: input.assignmentStatus,
        changeReason: input.changeReason,
      })
      .returning();

    await auditOperationalWrite({
      actor,
      action: "shift_assignments.create",
      entityType: "shift_assignments",
      entityId: id,
      afterValue: assignment,
      reason: input.changeReason,
      request,
    });

    return ok({ assignment, conflicts }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
