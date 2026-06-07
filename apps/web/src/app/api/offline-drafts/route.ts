import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  listOwnOfflineDrafts,
  requireInspector,
} from "@/server/api/inspector";
import { db } from "@/server/db";
import { offlineDrafts } from "@/server/db/schema";
import { upsertOfflineDraftSchema } from "@/server/validation/inspector";

export async function GET(request: Request) {
  try {
    const actor = await requireInspector(request);
    return ok(await listOwnOfflineDrafts(request, actor.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireInspector(request);
    const input = upsertOfflineDraftSchema.parse(await request.json());
    const now = new Date();
    const [draft] = await db
      .insert(offlineDrafts)
      .values({
        id: randomUUID(),
        userId: actor.id,
        localDraftId: input.localDraftId,
        draftType: input.draftType,
        payload: input.payload,
        status: "pending",
        clientUpdatedAt: input.clientUpdatedAt ? new Date(input.clientUpdatedAt) : null,
      })
      .onConflictDoUpdate({
        target: [offlineDrafts.userId, offlineDrafts.localDraftId],
        set: {
          draftType: input.draftType,
          payload: input.payload,
          status: "pending",
          errorCode: null,
          errorMessage: null,
          clientUpdatedAt: input.clientUpdatedAt
            ? new Date(input.clientUpdatedAt)
            : null,
          updatedAt: now,
        },
      })
      .returning();

    await auditInspectorWrite({
      actor,
      action: "offline_drafts.upsert",
      entityType: "offline_drafts",
      entityId: draft.id,
      afterValue: draft,
      reason: "Inspector offline draft saved",
      request,
    });

    return ok(draft, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
