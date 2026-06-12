import { and, eq, inArray } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  assertCriticalSopsAcknowledged,
  getOwnTaskOrThrow,
  requireOwnTaskPermission,
} from "@/server/api/inspector";
import {
  publishOperationalRealtime,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { notificationRecipients, notifications, tasks } from "@/server/db/schema";
import { acknowledgeTaskSchema } from "@/server/validation/inspector";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireOwnTaskPermission(request);
    const { id } = await context.params;
    const input = acknowledgeTaskSchema.parse(await request.json());
    const before = await getOwnTaskOrThrow(actor.id, id);
    await assertCriticalSopsAcknowledged(actor.id);
    const reason = input.note ?? "Inspector acknowledged task or priority update";
    const taskNotifications = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.entityType, "tasks"),
          eq(notifications.entityId, id),
        ),
      );
    const task = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tasks)
        .set({
          status: before.status === "assigned" ? "acknowledged" : before.status,
          updatedBy: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning();

      if (taskNotifications.length > 0) {
        await tx
          .update(notificationRecipients)
          .set({ acknowledgedAt: new Date(), readAt: new Date() })
          .where(
            and(
              eq(notificationRecipients.userId, actor.id),
              inArray(
                notificationRecipients.notificationId,
                taskNotifications.map((notification) => notification.id),
              ),
            ),
          );
      }

      await writeTaskEvent({
        taskId: id,
        eventType: "task.acknowledge",
        oldValue: { status: before.status },
        newValue: { status: updated.status, note: input.note ?? null },
        reason,
        actorId: actor.id,
      }, tx);

      await auditInspectorWrite({
        actor,
        action: "tasks.acknowledge",
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
  } catch (error) {
    return handleApiError(error);
  }
}
