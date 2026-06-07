import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  getTaskOrThrow,
  notificationPriorityForTask,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { taskEvents, tasks } from "@/server/db/schema";
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

      await tx.insert(taskEvents).values({
        id: randomUUID(),
        taskId: id,
        eventType: "task.priority_change",
        oldValue: { priority: before.priority },
        newValue: { priority: updated.priority },
        reason: input.reason,
        actorId: actor.id,
      });

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

    await auditOperationalWrite({
      actor,
      action: "tasks.priority_update",
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
