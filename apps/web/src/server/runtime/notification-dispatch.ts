import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db";
import {
  deviceTokens,
  notificationRecipients,
  notifications,
} from "@/server/db/schema";

export async function dispatchPendingNotifications(input: {
  limit: number;
  mode: "mock" | "provider";
}) {
  const rows = await db
    .select({
      recipient: notificationRecipients,
      notification: notifications,
    })
    .from(notificationRecipients)
    .innerJoin(notifications, eq(notifications.id, notificationRecipients.notificationId))
    .where(eq(notificationRecipients.deliveryStatus, "pending"))
    .limit(input.limit);

  if (rows.length === 0) {
    return { mode: input.mode, processed: 0, delivered: 0, failed: 0, items: [] };
  }

  const activeTokens = await db
    .select()
    .from(deviceTokens)
    .where(
      and(
        inArray(
          deviceTokens.userId,
          rows.map((row) => row.recipient.userId),
        ),
        eq(deviceTokens.status, "active"),
      ),
    );
  const tokensByUser = new Map(activeTokens.map((token) => [token.userId, token]));
  const deliveredRecipientIds: string[] = [];
  const failedRecipientIds: string[] = [];
  const deliveredTokenIds: string[] = [];

  for (const row of rows) {
    const token = tokensByUser.get(row.recipient.userId);
    if (token) {
      deliveredRecipientIds.push(row.recipient.id);
      deliveredTokenIds.push(token.id);
      continue;
    }
    failedRecipientIds.push(row.recipient.id);
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    if (deliveredRecipientIds.length > 0) {
      await tx
        .update(notificationRecipients)
        .set({
          deliveryStatus: "delivered",
          deliveredAt: now,
        })
        .where(inArray(notificationRecipients.id, deliveredRecipientIds));
    }

    if (failedRecipientIds.length > 0) {
      await tx
        .update(notificationRecipients)
        .set({
          deliveryStatus: "failed",
        })
        .where(inArray(notificationRecipients.id, failedRecipientIds));
    }

    if (deliveredTokenIds.length > 0) {
      await tx
        .update(deviceTokens)
        .set({
          lastDeliveredAt: now,
          lastError: null,
          updatedAt: now,
        })
        .where(inArray(deviceTokens.id, deliveredTokenIds));
    }
  });

  return {
    mode: input.mode,
    processed: rows.length,
    delivered: deliveredRecipientIds.length,
    failed: failedRecipientIds.length,
    items: rows.map((row) => ({
      recipientId: row.recipient.id,
      notificationId: row.notification.id,
      userId: row.recipient.userId,
      delivered: deliveredRecipientIds.includes(row.recipient.id),
    })),
  };
}
