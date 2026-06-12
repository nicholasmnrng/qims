import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  getTaskOrThrow,
  notificationPriorityForTask,
  publishOperationalRealtime,
  requireOperationalPermission,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { updateTaskPrioritySchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "tasks:manage");
    const { id } = await context.params;
    const input = updateTaskPrioritySchema.parse(await request.json());
    const before = await getTaskOrThrow(id);
    const task = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tasks)
        .set({
          priority: input.priority,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning();

      await writeTaskEvent({
        taskId: id,
        eventType: "task.priority_change",
        oldValue: { priority: before.priority },
        newValue: { priority: updated.priority },
        reason: input.reason,
        actorId: actor.id,
      }, tx);

      await auditOperationalWrite({
        actor,
        action: "tasks.priority_update",
        entityType: "tasks",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });

    if (task.assignedUserId) {
      await createNotification({
        title: "Prioritas task berubah",
        message: `${task.title} sekarang ${task.priority}.`,
        type: "priority_change",
        priority: notificationPriorityForTask(task.priority),
        entityType: "tasks",
        entityId: id,
        createdBy: actor.id,
        recipientIds: [task.assignedUserId],
      });
    }

    await publishOperationalRealtime({
      type: "task.priority_changed",
      actorId: actor.id,
      userIds: [task.assignedUserId],
      areaIds: [task.areaId],
      roles: ["supervisor"],
      payload: {
        taskId: task.id,
        priority: task.priority,
        assignedUserId: task.assignedUserId,
      },
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
