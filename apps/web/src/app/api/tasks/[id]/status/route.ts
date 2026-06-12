import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  getTaskOrThrow,
  publishOperationalRealtime,
  requireOperationalPermission,
  taskClosedAt,
  writeTaskEvent,
} from "@/server/api/supervisor";
import {
  auditInspectorWrite,
  assertCriticalSopsAcknowledged,
  getOwnTaskOrThrow,
  requireOwnTaskPermission,
} from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requireUserPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { updateOwnTaskStatusSchema } from "@/server/validation/inspector";
import { updateTaskStatusSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionUser = await requireSession(request);
    if (sessionUser.role === "inspector") {
      await requireUserPermission(sessionUser, "tasks:update-own");
      const actor = await requireOwnTaskPermission(request);
      const before = await getOwnTaskOrThrow(actor.id, id);
      const input = updateOwnTaskStatusSchema.parse(await request.json());
      await assertCriticalSopsAcknowledged(actor.id);
      const reason =
        input.reason ?? input.progressNote ?? "Inspector status update";
      const task = await db.transaction(async (tx) => {
        const [updated] = await tx
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
          eventType: "task.status_update_own",
          oldValue: { status: before.status },
          newValue: {
            status: updated.status,
            progressNote: input.progressNote ?? null,
          },
          reason,
          actorId: actor.id,
        }, tx);

        await auditInspectorWrite({
          actor,
          action: "tasks.status_update_own",
          entityType: "tasks",
          entityId: id,
          beforeValue: before,
          afterValue: updated,
          reason,
          request,
        }, tx);

        return updated;
      });

      await publishOperationalRealtime({
        type: "task.status_changed",
        actorId: actor.id,
        userIds: [actor.id],
        areaIds: [task.areaId],
        roles: ["supervisor"],
        payload: { taskId: task.id, status: task.status },
      });

      return ok(task);
    }

    const actor = await requireOperationalPermission(request, "tasks:manage");
    const before = await getTaskOrThrow(id);
    const input = updateTaskStatusSchema.parse(await request.json());
    const task = await db.transaction(async (tx) => {
      const [updated] = await tx
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
        newValue: { status: updated.status },
        reason: input.reason,
        actorId: actor.id,
      }, tx);

      await auditOperationalWrite({
        actor,
        action: "tasks.status_update",
        entityType: "tasks",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });

    await publishOperationalRealtime({
      type: "task.status_changed",
      actorId: actor.id,
      userIds: [task.assignedUserId],
      areaIds: [task.areaId],
      roles: ["supervisor"],
      payload: { taskId: task.id, status: task.status },
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
