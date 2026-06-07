import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getTaskOrThrow,
  requireOperationalPermission,
  taskClosedAt,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { updateTaskStatusSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "tasks:manage");
    const { id } = await context.params;
    const before = await getTaskOrThrow(id);
    const input = updateTaskStatusSchema.parse(await request.json());
    const [task] = await db
      .update(tasks)
      .set({
        status: input.status,
        updatedBy: actor.id,
        updatedAt: new Date(),
        closedAt: taskClosedAt(input.status),
      })
      .where(eq(tasks.id, id))
      .returning();

    await writeTaskEvent({
      taskId: id,
      eventType: "task.status_change",
      oldValue: { status: before.status },
      newValue: { status: task.status },
      reason: input.reason,
      actorId: actor.id,
    });

    await auditOperationalWrite({
      actor,
      action: "tasks.status_update",
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
