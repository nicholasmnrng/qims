import { randomUUID } from "node:crypto";

import { and, count, desc, eq, gte, inArray } from "drizzle-orm";

import { paginationMeta, parsePagination } from "@/server/api/pagination";
import { db } from "@/server/db";
import { realtimeEvents } from "@/server/db/schema";
import type { RealtimeEventType } from "@/server/contracts/realtime";

export async function publishRealtimeEvent(input: {
  type: RealtimeEventType | "notification.created";
  channel: string;
  actorId?: string | null;
  payload: Record<string, unknown>;
}) {
  const [event] = await db
    .insert(realtimeEvents)
    .values({
      id: randomUUID(),
      type: input.type,
      channel: input.channel,
      actorId: input.actorId ?? null,
      payload: input.payload,
    })
    .returning();

  return event;
}

export async function publishRealtimeEventToChannels(input: {
  type: RealtimeEventType | "notification.created";
  channels: string[];
  actorId?: string | null;
  payload: Record<string, unknown>;
}) {
  const channels = [...new Set(input.channels.filter(Boolean))];
  return Promise.all(
    channels.map((channel) =>
      publishRealtimeEvent({
        type: input.type,
        channel,
        actorId: input.actorId,
        payload: input.payload,
      }),
    ),
  );
}

export async function listRealtimeEvents(request: Request, allowedChannels: string[]) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { realtimeEventsQuerySchema } = await import("@/server/validation/runtime");
  const query = realtimeEventsQuerySchema.parse({
    channel: url.searchParams.get("channel") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    since: url.searchParams.get("since") ?? undefined,
  });
  const channels = [...new Set(allowedChannels)];
  if (query.channel && !channels.includes(query.channel)) {
    const { HttpError } = await import("@/server/api/http-error");
    throw new HttpError(403, "VALIDATION_ERROR", "Channel realtime tidak diizinkan.");
  }
  const selectedChannels = query.channel ? [query.channel] : channels;
  const where = and(
    selectedChannels.length > 0
      ? inArray(realtimeEvents.channel, selectedChannels)
      : eq(realtimeEvents.channel, "__none__"),
    query.type ? eq(realtimeEvents.type, query.type) : undefined,
    query.since ? gte(realtimeEvents.createdAt, new Date(query.since)) : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select()
      .from(realtimeEvents)
      .where(where)
      .orderBy(desc(realtimeEvents.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(realtimeEvents).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}
