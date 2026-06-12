import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  hasOfflineDraftConflict,
  listOwnOfflineDrafts,
  requireInspector,
} from "@/server/api/inspector";
import { db } from "@/server/db";
import { offlineDrafts } from "@/server/db/schema";
import { upsertOfflineDraftSchema } from "@/server/validation/inspector";
import { HttpError } from "@/server/api/http-error";

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
    const [existing] = await db
      .select()
      .from(offlineDrafts)
      .where(
        and(
          eq(offlineDrafts.userId, actor.id),
          eq(offlineDrafts.localDraftId, input.localDraftId),
        ),
      )
      .limit(1);
    const clientUpdatedAt = input.clientUpdatedAt
      ? new Date(input.clientUpdatedAt)
      : null;
    const hasConflict = existing
      ? hasOfflineDraftConflict({
          serverUpdatedAt: existing.updatedAt,
          clientUpdatedAt,
          serverPayload: existing.payload,
          clientPayload: input.payload,
        })
      : false;
    if (hasConflict && input.conflictResolution === "use_server") {
      return ok(existing);
    }
    if (
      hasConflict &&
      input.conflictResolution !== "keep_local"
    ) {
      throw new HttpError(
        409,
        "CONFLICT",
        "Server memiliki draft yang lebih baru.",
        {
          serverDraft: existing,
          conflictOptions: ["keep_local", "use_server", "merge_manually"],
        },
      );
    }
    const now = new Date();
    const draft = await db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(offlineDrafts)
        .values({
          id: randomUUID(),
          userId: actor.id,
          localDraftId: input.localDraftId,
          draftType: input.draftType,
          payload: input.payload,
          status: "pending",
          clientUpdatedAt,
        })
        .onConflictDoUpdate({
          target: [offlineDrafts.userId, offlineDrafts.localDraftId],
          set: {
            draftType: input.draftType,
            payload: input.payload,
            status: "pending",
            errorCode: null,
            errorMessage: null,
            clientUpdatedAt,
            updatedAt: now,
          },
        })
        .returning();

      await auditInspectorWrite({
        actor,
        action: "offline_drafts.upsert",
        entityType: "offline_drafts",
        entityId: saved.id,
        afterValue: saved,
        reason: "Inspector offline draft saved",
        request,
      }, tx);

      return saved;
    });

    return ok(draft, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
