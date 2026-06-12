import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  getTaskDetail,
  getTaskOrThrow,
  notificationPriorityForTask,
  publishOperationalRealtime,
  requireOperationalPermission,
  taskClosedAt,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { getOwnTaskDetail } from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requireUserPermission } from "@/server/auth/session";
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
      await requireUserPermission(actor, "tasks:update-own");
      return ok(await getOwnTaskDetail(actor.id, id));
    }

    await requireUserPermission(actor, "tasks:manage");
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
    const task = await db.transaction(async (tx) => {
      const [updated] = await tx
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
        newValue: updated,
        reason: input.reason,
        actorId: actor.id,
      }, tx);

      await auditOperationalWrite({
        actor,
        action: "tasks.update",
        entityType: "tasks",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });

    const assignedUserId = task.assignedUserId;
    const assignmentChanged =
      assignedUserId !== null && assignedUserId !== before.assignedUserId;
    const priorityChanged = task.priority !== before.priority;
    if ((assignmentChanged || priorityChanged) && assignedUserId) {
      await createNotification({
        title: priorityChanged ? "Prioritas task berubah" : "Assignment task berubah",
        message: priorityChanged
          ? `${task.title} sekarang ${task.priority}.`
          : task.title,
        type: priorityChanged ? "priority_change" : "assignment_change",
        priority: notificationPriorityForTask(task.priority),
        entityType: "tasks",
        entityId: id,
        createdBy: actor.id,
        recipientIds: [assignedUserId],
      });
    }

    if (priorityChanged) {
      await publishOperationalRealtime({
        type: "task.priority_changed",
        actorId: actor.id,
        userIds: [before.assignedUserId, task.assignedUserId],
        areaIds: [before.areaId, task.areaId],
        roles: ["supervisor"],
        payload: {
          taskId: task.id,
          priority: task.priority,
          assignedUserId: task.assignedUserId,
        },
      });
    }

    if (task.status !== before.status) {
      await publishOperationalRealtime({
        type: "task.status_changed",
        actorId: actor.id,
        userIds: [before.assignedUserId, task.assignedUserId],
        areaIds: [before.areaId, task.areaId],
        roles: ["supervisor"],
        payload: { taskId: task.id, status: task.status },
      });
    }

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
