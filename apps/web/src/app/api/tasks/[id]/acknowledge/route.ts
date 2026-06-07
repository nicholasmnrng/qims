import { and, eq, inArray } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  getOwnTaskOrThrow,
  requireOwnTaskPermission,
} from "@/server/api/inspector";
import { writeTaskEvent } from "@/server/api/supervisor";
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
    const [task] = await db
      .update(tasks)
      .set({
        status: before.status === "assigned" ? "acknowledged" : before.status,
        updatedBy: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    const taskNotifications = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.entityType, "tasks"),
          eq(notifications.entityId, id),
        ),
      );

    if (taskNotifications.length > 0) {
      await db
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
      newValue: { status: task.status, note: input.note ?? null },
      reason: input.note ?? "Inspector acknowledged task or priority update",
      actorId: actor.id,
    });

    await auditInspectorWrite({
      actor,
      action: "tasks.acknowledge",
      entityType: "tasks",
      entityId: id,
      beforeValue: before,
      afterValue: task,
      reason: input.note ?? "Inspector acknowledged task or priority update",
      request,
    });

    return ok(task);
  } catch (error) {
    return handleApiError(error);
  }
}
