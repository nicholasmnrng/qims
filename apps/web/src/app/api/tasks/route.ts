import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  listTasks,
  notificationPriorityForTask,
  requireOperationalPermission,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { createTaskSchema } from "@/server/validation/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "tasks:manage");
    return ok(await listTasks(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOperationalPermission(request, "tasks:manage");
    const input = createTaskSchema.parse(await request.json());
    const id = randomUUID();
    const [task] = await db
      .insert(tasks)
      .values({
        id,
        title: input.title,
        description: input.description ?? null,
        areaId: input.areaId,
        assignedUserId: input.assignedUserId ?? null,
        shiftAssignmentId: input.shiftAssignmentId ?? null,
        priority: input.priority,
        status: input.status,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        attachmentUrl: input.attachmentUrl ?? null,
        checklist: input.checklist,
        createdBy: actor.id,
        updatedBy: actor.id,
      })
      .returning();

    await writeTaskEvent({
      taskId: id,
      eventType: "task.create",
      newValue: task,
      reason: input.reason,
      actorId: actor.id,
    });

    if (task.assignedUserId) {
      await createNotification({
        title: "Task inspeksi baru",
        message: task.title,
        type: "assignment_change",
        priority: notificationPriorityForTask(task.priority),
        entityType: "tasks",
        entityId: id,
        createdBy: actor.id,
        recipientIds: [task.assignedUserId],
      });
    }

    await auditOperationalWrite({
      actor,
      action: "tasks.create",
      entityType: "tasks",
      entityId: id,
      afterValue: task,
      reason: input.reason,
      request,
    });

    return ok(task, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
