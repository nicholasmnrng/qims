import { randomUUID } from "node:crypto";

import { and, eq, gte, ne } from "drizzle-orm";
import type { z } from "zod";

import {
  auditInspectorWrite,
  assertInspectorAreaAccess,
  getOwnIssueDetailOrThrow,
  getOwnShiftAssignmentOrThrow,
  getOwnTaskOrThrow,
  localWorkDate,
  type InspectorActor,
} from "@/server/api/inspector";
import {
  createNotification,
  notifyActiveSupervisors,
  publishOperationalRealtime,
  writeIssueEvent,
  writeTaskEvent,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import {
  handoverItems,
  handovers,
  issueReports,
  offlineDrafts,
  shiftAssignments,
} from "@/server/db/schema";
import {
  createHandoverSchema,
  createIssueSchema,
  taskNoteDraftPayloadSchema,
} from "@/server/validation/inspector";
import { HttpError } from "@/server/api/http-error";

type HandoverInput = z.infer<typeof createHandoverSchema>;
type IssueInput = z.infer<typeof createIssueSchema>;
type TaskNoteInput = z.infer<typeof taskNoteDraftPayloadSchema>;

async function markDraftSynced(
  database: Parameters<Parameters<typeof db.transaction>[0]>[0],
  draftId: string | undefined,
  entityType: string,
  entityId: string,
) {
  if (!draftId) return;
  await database
    .update(offlineDrafts)
    .set({
      status: "synced",
      syncedEntityType: entityType,
      syncedEntityId: entityId,
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(offlineDrafts.id, draftId));
}

export async function createInspectorHandover(input: {
  actor: InspectorActor;
  payload: HandoverInput;
  request: Request;
  offlineDraftId?: string;
}) {
  const assignment = await getOwnShiftAssignmentOrThrow(
    input.actor.id,
    input.payload.fromShiftAssignmentId,
  );
  if (assignment.areaId !== input.payload.areaId) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      "Area handover harus sesuai assignment inspector.",
    );
  }

  for (const item of input.payload.items) {
    if (item.relatedTaskId) {
      await getOwnTaskOrThrow(input.actor.id, item.relatedTaskId);
    }
    if (item.relatedIssueId) {
      await getOwnIssueDetailOrThrow(input.actor.id, item.relatedIssueId);
    }
  }
  await assertInspectorAreaAccess(input.actor.id, input.payload.areaId);

  const handover = await db.transaction(async (tx) => {
    const handoverId = randomUUID();
    const [created] = await tx
      .insert(handovers)
      .values({
        id: handoverId,
        fromShiftAssignmentId: input.payload.fromShiftAssignmentId,
        toShiftId: input.payload.toShiftId ?? null,
        areaId: input.payload.areaId,
        submittedBy: input.actor.id,
        status: input.payload.status,
        submittedAt: input.payload.status === "submitted" ? new Date() : null,
      })
      .returning();

    await tx.insert(handoverItems).values(
      input.payload.items.map((item) => ({
        id: randomUUID(),
        handoverId,
        category: item.category,
        note: item.note,
        severity: item.severity,
        attachmentUrl: item.attachmentUrl ?? null,
        relatedTaskId: item.relatedTaskId ?? null,
        relatedIssueId: item.relatedIssueId ?? null,
      })),
    );

    await auditInspectorWrite({
      actor: input.actor,
      action:
        input.payload.status === "submitted"
          ? "handovers.submit"
          : "handovers.draft",
      entityType: "handovers",
      entityId: handoverId,
      afterValue: { handover: created, items: input.payload.items },
      reason: "Inspector handover",
      request: input.request,
    }, tx);
    await markDraftSynced(tx, input.offlineDraftId, "handovers", handoverId);

    return created;
  });

  return { handover, assignment };
}

export async function publishInspectorHandoverSignals(input: {
  actor: InspectorActor;
  handover: typeof handovers.$inferSelect;
  assignmentWorkDate: string;
}) {
  if (input.handover.status !== "submitted") return;

  const recipients = input.handover.areaId
    ? await db
        .select({ userId: shiftAssignments.userId })
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.areaId, input.handover.areaId),
            input.handover.toShiftId
              ? eq(shiftAssignments.shiftId, input.handover.toShiftId)
              : undefined,
            gte(
              shiftAssignments.workDate,
              input.assignmentWorkDate || localWorkDate(),
            ),
            ne(shiftAssignments.assignmentStatus, "cancelled"),
            ne(shiftAssignments.userId, input.actor.id),
          ),
        )
    : [];
  const recipientIds = [...new Set(recipients.map((row) => row.userId))];

  if (recipientIds.length > 0) {
    await createNotification({
      title: "Handover shift tersedia",
      message: "Handover area Anda siap dibaca dan di-acknowledge.",
      type: "system_alert",
      priority: "normal",
      entityType: "handovers",
      entityId: input.handover.id,
      createdBy: input.actor.id,
      recipientIds,
    });
  }

  await publishOperationalRealtime({
    type: "handover.submitted",
    actorId: input.actor.id,
    userIds: recipientIds,
    areaIds: [input.handover.areaId],
    roles: ["supervisor"],
    payload: {
      handoverId: input.handover.id,
      areaId: input.handover.areaId,
    },
  });
}

export async function createInspectorIssue(input: {
  actor: InspectorActor;
  payload: IssueInput;
  request: Request;
  offlineDraftId?: string;
}) {
  if (input.payload.taskId) {
    await getOwnTaskOrThrow(input.actor.id, input.payload.taskId);
  }
  if (input.payload.shiftAssignmentId) {
    await getOwnShiftAssignmentOrThrow(
      input.actor.id,
      input.payload.shiftAssignmentId,
    );
  }
  if (input.payload.areaId) {
    await assertInspectorAreaAccess(input.actor.id, input.payload.areaId);
  }

  const id = randomUUID();
  return db.transaction(async (tx) => {
    const [issue] = await tx
      .insert(issueReports)
      .values({
        id,
        title: input.payload.title,
        description: input.payload.description ?? null,
        category: input.payload.category,
        severity: input.payload.severity,
        areaId: input.payload.areaId ?? null,
        taskId: input.payload.taskId ?? null,
        shiftAssignmentId: input.payload.shiftAssignmentId ?? null,
        reportedBy: input.actor.id,
        attachmentUrl: input.payload.attachmentUrl ?? null,
      })
      .returning();

    await writeIssueEvent({
      issueId: id,
      eventType: "issue.create",
      newValue: issue,
      note: "Inspector reported issue",
      actorId: input.actor.id,
    }, tx);
    await auditInspectorWrite({
      actor: input.actor,
      action: "issues.create",
      entityType: "issue_reports",
      entityId: id,
      afterValue: issue,
      reason: "Inspector issue report",
      request: input.request,
    }, tx);
    await markDraftSynced(tx, input.offlineDraftId, "issue_reports", id);

    return issue;
  });
}

export async function publishInspectorIssueSignals(input: {
  actor: InspectorActor;
  issue: typeof issueReports.$inferSelect;
}) {
  if (input.issue.severity === "critical" || input.issue.severity === "high") {
    await notifyActiveSupervisors({
      title: "Issue lapangan prioritas tinggi",
      message: input.issue.title,
      type: "issue_alert",
      priority: input.issue.severity,
      entityType: "issue_reports",
      entityId: input.issue.id,
      createdBy: input.actor.id,
    });
  }

  await publishOperationalRealtime({
    type: "issue.created",
    actorId: input.actor.id,
    userIds: [input.actor.id],
    areaIds: [input.issue.areaId],
    roles: ["supervisor"],
    payload: {
      issueId: input.issue.id,
      severity: input.issue.severity,
      areaId: input.issue.areaId,
    },
  });
}

export async function createInspectorTaskNote(input: {
  actor: InspectorActor;
  payload: TaskNoteInput;
  request: Request;
  offlineDraftId?: string;
}) {
  const task = await getOwnTaskOrThrow(input.actor.id, input.payload.taskId);
  await db.transaction(async (tx) => {
    await writeTaskEvent({
      taskId: task.id,
      eventType: "task.progress_note",
      oldValue: null,
      newValue: { note: input.payload.note },
      reason: input.payload.note,
      actorId: input.actor.id,
    }, tx);
    await auditInspectorWrite({
      actor: input.actor,
      action: "tasks.progress_note",
      entityType: "tasks",
      entityId: task.id,
      afterValue: { note: input.payload.note },
      reason: input.payload.note,
      request: input.request,
    }, tx);
    await markDraftSynced(tx, input.offlineDraftId, "tasks", task.id);
  });

  return task;
}
