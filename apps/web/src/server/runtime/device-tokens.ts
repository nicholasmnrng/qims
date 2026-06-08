import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { deviceTokens, type DeviceTokenPlatform } from "@/server/db/schema";

export async function listOwnDeviceTokens(userId: string) {
  return db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.userId, userId))
    .orderBy(desc(deviceTokens.lastRegisteredAt));
}

export async function registerDeviceToken(input: {
  userId: string;
  token: string;
  platform: DeviceTokenPlatform;
  deviceName?: string | null;
}) {
  const now = new Date();
  const [token] = await db
    .insert(deviceTokens)
    .values({
      id: randomUUID(),
      userId: input.userId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName ?? null,
      status: "active",
      lastRegisteredAt: now,
    })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: {
        userId: input.userId,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
        status: "active",
        lastRegisteredAt: now,
        lastError: null,
        updatedAt: now,
      },
    })
    .returning();

  return token;
}
