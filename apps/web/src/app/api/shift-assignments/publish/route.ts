import { and, eq, inArray } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  getMissingAreaCoverage,
  publishOperationalRealtime,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { shiftAssignments } from "@/server/db/schema";
import { publishShiftAssignmentsSchema } from "@/server/validation/supervisor";

export async function POST(request: Request) {
  try {
    const actor = await requireOperationalPermission(request, "schedule:manage");
    const input = publishShiftAssignmentsSchema.parse(await request.json());
    const where = and(
      eq(shiftAssignments.workDate, input.workDate),
      input.shiftId ? eq(shiftAssignments.shiftId, input.shiftId) : undefined,
      input.assignmentIds?.length
        ? inArray(shiftAssignments.id, input.assignmentIds)
        : undefined,
      eq(shiftAssignments.assignmentStatus, "draft"),
    );

    const before = await db.select().from(shiftAssignments).where(where);
    const published = await db.transaction(async (tx) => {
      const updated = await tx
        .update(shiftAssignments)
        .set({
          assignmentStatus: "published",
          publishedAt: new Date(),
          publishedBy: actor.id,
          changeReason: input.reason,
          updatedAt: new Date(),
        })
        .where(where)
        .returning();

      await auditOperationalWrite({
        actor,
        action: "shift_assignments.publish",
        entityType: "shift_assignments",
        entityId: input.workDate,
        beforeValue: before,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });
    const missingCoverage = await getMissingAreaCoverage(input.workDate);

    if (published.length > 0) {
      await createNotification({
        title: "Jadwal shift dipublish",
        message: "Assignment shift terbaru sudah tersedia.",
        type: "schedule_update",
        priority: "normal",
        entityType: "shift_assignments",
        entityId: input.workDate,
        createdBy: actor.id,
        recipientIds: published.map((assignment) => assignment.userId),
      });
    }

    await publishOperationalRealtime({
      type: "schedule.updated",
      actorId: actor.id,
      userIds: published.map((assignment) => assignment.userId),
      areaIds: published.map((assignment) => assignment.areaId),
      roles: ["supervisor"],
      payload: {
        workDate: input.workDate,
        shiftId: input.shiftId ?? null,
        publishedCount: published.length,
      },
    });

    return ok({ publishedCount: published.length, assignments: published, missingCoverage });
  } catch (error) {
    return handleApiError(error);
  }
}
