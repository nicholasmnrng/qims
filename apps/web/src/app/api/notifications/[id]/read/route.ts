import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  getOwnNotificationRecipientOrThrow,
  requireOwnNotificationPermission,
} from "@/server/api/inspector";
import { db } from "@/server/db";
import { notificationRecipients } from "@/server/db/schema";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireOwnNotificationPermission(request);
    const { id } = await context.params;
    const before = await getOwnNotificationRecipientOrThrow(actor.id, id);
    const recipient = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(notificationRecipients)
        .set({ readAt: new Date() })
        .where(eq(notificationRecipients.id, id))
        .returning();

      await auditInspectorWrite({
        actor,
        action: "notifications.read",
        entityType: "notification_recipients",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: "Inspector opened notification",
        request,
      }, tx);

      return updated;
    });

    return ok(recipient);
  } catch (error) {
    return handleApiError(error);
  }
}
