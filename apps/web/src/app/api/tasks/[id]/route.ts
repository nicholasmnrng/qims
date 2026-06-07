import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getTaskDetail,
  getTaskOrThrow,
  requireOperationalPermission,
  taskClosedAt,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { getOwnTaskDetail } from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { updateTaskSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      requirePermission(actor, "tasks:update-own");
      return ok(await getOwnTaskDetail(actor.id, id));
    }

    requirePermission(actor, "tasks:manage");
    return ok(await getTaskDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "tasks:manage");
    const { id } = await context.params;
    const before = await getTaskOrThrow(id);
    const input = updateTaskSchema.parse(await request.json());
    const dueAt =
      input.dueAt === undefined
        ? undefined
        : input.dueAt
          ? new Date(input.dueAt)
          : null;
    const [task] = await db
      .update(tasks)
      .set({
        title: input.title,
        description: input.description,
        areaId: input.areaId,
        assignedUserId: input.assignedUserId,
        shiftAssignmentId: input.shiftAssignmentId,
        priority: input.priority,
        status: input.status,
        dueAt,
        attachmentUrl: input.attachmentUrl,
        checklist: input.checklist,
        updatedBy: actor.id,
        updatedAt: new Date(),
        closedAt: input.status ? taskClosedAt(input.status) : before.closedAt,
      })
      .where(eq(tasks.id, id))
      .returning();

    await writeTaskEvent({
      taskId: id,
      eventType: "task.update",
      oldValue: before,
      newValue: task,
      reason: input.reason,
      actorId: actor.id,
    });

    await auditOperationalWrite({
      actor,
      action: "tasks.update",
      entityType: "tasks",
      entityId: id,
      beforeValue: before,
      afterValue: task,
      reason: input.reason,
      request,
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
