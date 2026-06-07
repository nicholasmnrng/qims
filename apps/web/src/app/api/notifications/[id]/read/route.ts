import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
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
    await getOwnNotificationRecipientOrThrow(actor.id, id);
    const [recipient] = await db
      .update(notificationRecipients)
      .set({ readAt: new Date() })
      .where(eq(notificationRecipients.id, id))
      .returning();

    return ok(recipient);
  } catch (error) {
    return handleApiError(error);
  }
}
