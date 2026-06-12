import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { ZodError } from "zod";

import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import {
  hasOfflineDraftConflict,
  requireInspector,
} from "@/server/api/inspector";
import {
  createInspectorHandover,
  createInspectorIssue,
  createInspectorTaskNote,
  publishInspectorHandoverSignals,
  publishInspectorIssueSignals,
} from "@/server/api/inspector-writes";
import { ok } from "@/server/api/response";
import { db } from "@/server/db";
import { offlineDrafts } from "@/server/db/schema";
import {
  createHandoverSchema,
  createIssueSchema,
  syncOfflineDraftsSchema,
  taskNoteDraftPayloadSchema,
} from "@/server/validation/inspector";

function publicSyncError(error: unknown) {
  if (error instanceof ZodError) {
    return {
      code: "VALIDATION_ERROR",
      message: "Payload draft tidak valid untuk tipe yang dipilih.",
    };
  }
  if (error instanceof HttpError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "SYNC_FAILED",
    message: "Draft belum dapat disinkronkan. Periksa data lalu coba kembali.",
  };
}

export async function POST(request: Request) {
  try {
    const actor = await requireInspector(request);
    const input = syncOfflineDraftsSchema.parse(await request.json());
    const results = [];

    for (const draft of input.drafts) {
      let serverDraftId: string | undefined;
      try {
        const [existing] = await db
          .select()
          .from(offlineDrafts)
          .where(
            and(
              eq(offlineDrafts.userId, actor.id),
              eq(offlineDrafts.localDraftId, draft.localDraftId),
            ),
          )
          .limit(1);

        if (existing?.status === "synced") {
          results.push({
            localDraftId: draft.localDraftId,
            accepted: true,
            status: "synced",
            serverDraftId: existing.id,
            syncedEntityType: existing.syncedEntityType,
            syncedEntityId: existing.syncedEntityId,
            nextAction: "remove_local_draft",
          });
          continue;
        }

        const clientUpdatedAt = draft.clientUpdatedAt
          ? new Date(draft.clientUpdatedAt)
          : null;
        const hasConflict = existing
          ? hasOfflineDraftConflict({
              serverUpdatedAt: existing.updatedAt,
              clientUpdatedAt,
              serverPayload: existing.payload,
              clientPayload: draft.payload,
            })
          : false;
        if (
          hasConflict &&
          draft.conflictResolution !== "keep_local"
        ) {
          const resolution = draft.conflictResolution ?? "merge_manually";
          if (resolution !== "use_server") {
            await db
              .update(offlineDrafts)
              .set({
                status: "conflict",
                errorCode: "SYNC_CONFLICT",
                errorMessage: "Server memiliki draft yang lebih baru.",
                updatedAt: new Date(),
              })
              .where(eq(offlineDrafts.id, existing!.id));
          }
          results.push({
            localDraftId: draft.localDraftId,
            accepted: resolution === "use_server",
            status: resolution === "use_server" ? existing!.status : "conflict",
            serverDraftId: existing!.id,
            serverPayload: existing!.payload,
            conflictOptions: ["keep_local", "use_server", "merge_manually"],
            nextAction:
              resolution === "use_server"
                ? "replace_local_with_server"
                : "choose_conflict_resolution",
          });
          continue;
        }

        const now = new Date();
        const [saved] = await db
          .insert(offlineDrafts)
          .values({
            id: randomUUID(),
            userId: actor.id,
            localDraftId: draft.localDraftId,
            draftType: draft.draftType,
            payload: draft.payload,
            status: "pending",
            clientUpdatedAt,
          })
          .onConflictDoUpdate({
            target: [offlineDrafts.userId, offlineDrafts.localDraftId],
            set: {
              draftType: draft.draftType,
              payload: draft.payload,
              status: "pending",
              syncedEntityType: null,
              syncedEntityId: null,
              errorCode: null,
              errorMessage: null,
              clientUpdatedAt,
              updatedAt: now,
            },
          })
          .returning();
        serverDraftId = saved.id;

        if (draft.draftType === "handover") {
          const payload = createHandoverSchema.parse(draft.payload);
          const { handover, assignment } = await createInspectorHandover({
            actor,
            payload,
            request,
            offlineDraftId: saved.id,
          });
          await publishInspectorHandoverSignals({
            actor,
            handover,
            assignmentWorkDate: assignment.workDate,
          });
          results.push({
            localDraftId: draft.localDraftId,
            accepted: true,
            status: "synced",
            serverDraftId: saved.id,
            syncedEntityType: "handovers",
            syncedEntityId: handover.id,
            nextAction: "remove_local_draft",
          });
          continue;
        }

        if (draft.draftType === "issue") {
          const payload = createIssueSchema.parse(draft.payload);
          const issue = await createInspectorIssue({
            actor,
            payload,
            request,
            offlineDraftId: saved.id,
          });
          await publishInspectorIssueSignals({ actor, issue });
          results.push({
            localDraftId: draft.localDraftId,
            accepted: true,
            status: "synced",
            serverDraftId: saved.id,
            syncedEntityType: "issue_reports",
            syncedEntityId: issue.id,
            nextAction: "remove_local_draft",
          });
          continue;
        }

        const payload = taskNoteDraftPayloadSchema.parse(draft.payload);
        const task = await createInspectorTaskNote({
          actor,
          payload,
          request,
          offlineDraftId: saved.id,
        });
        results.push({
          localDraftId: draft.localDraftId,
          accepted: true,
          status: "synced",
          serverDraftId: saved.id,
          syncedEntityType: "tasks",
          syncedEntityId: task.id,
          nextAction: "remove_local_draft",
        });
      } catch (error) {
        const syncError = publicSyncError(error);
        if (serverDraftId) {
          await db
            .update(offlineDrafts)
            .set({
              status: "failed",
              errorCode: syncError.code,
              errorMessage: syncError.message,
              updatedAt: new Date(),
            })
            .where(eq(offlineDrafts.id, serverDraftId));
        }
        results.push({
          localDraftId: draft.localDraftId,
          accepted: false,
          status: "failed",
          serverDraftId,
          errorCode: syncError.code,
          errorMessage: syncError.message,
          nextAction: "fix_payload_or_retry",
        });
      }
    }

    return ok({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
