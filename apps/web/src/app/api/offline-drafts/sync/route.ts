import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireInspector } from "@/server/api/inspector";
import { db } from "@/server/db";
import { offlineDrafts } from "@/server/db/schema";
import { syncOfflineDraftsSchema } from "@/server/validation/inspector";

export async function POST(request: Request) {
  try {
    const actor = await requireInspector(request);
    const input = syncOfflineDraftsSchema.parse(await request.json());
    const now = new Date();
    const results = [];

    for (const draft of input.drafts) {
      try {
        const [saved] = await db
          .insert(offlineDrafts)
          .values({
            id: randomUUID(),
            userId: actor.id,
            localDraftId: draft.localDraftId,
            draftType: draft.draftType,
            payload: draft.payload,
            status: "pending",
            clientUpdatedAt: draft.clientUpdatedAt
              ? new Date(draft.clientUpdatedAt)
              : null,
          })
          .onConflictDoUpdate({
            target: [offlineDrafts.userId, offlineDrafts.localDraftId],
            set: {
              draftType: draft.draftType,
              payload: draft.payload,
              status: "pending",
              errorCode: null,
              errorMessage: null,
              clientUpdatedAt: draft.clientUpdatedAt
                ? new Date(draft.clientUpdatedAt)
                : null,
              updatedAt: now,
            },
          })
          .returning();

        results.push({
          localDraftId: draft.localDraftId,
          accepted: true,
          status: saved.status,
          serverDraftId: saved.id,
          nextAction: "submit_to_related_endpoint_when_online",
        });
      } catch (error) {
        results.push({
          localDraftId: draft.localDraftId,
          accepted: false,
          status: "failed",
          errorCode: "SYNC_FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Draft gagal disimpan.",
          nextAction: "retry_or_keep_local_draft",
        });
      }
    }

    return ok({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
