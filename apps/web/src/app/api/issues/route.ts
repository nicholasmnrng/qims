import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  listIssues,
  notifyActiveSupervisors,
  writeIssueEvent,
} from "@/server/api/supervisor";
import {
  auditInspectorWrite,
  assertInspectorAreaAccess,
  getOwnShiftAssignmentOrThrow,
  getOwnTaskOrThrow,
  listOwnIssues,
  requireOwnIssuePermission,
} from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { issueReports } from "@/server/db/schema";
import { createIssueSchema } from "@/server/validation/inspector";
import { randomUUID } from "node:crypto";

export async function GET(request: Request) {
  try {
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      requirePermission(actor, "issues:create-own");
      return ok(await listOwnIssues(request, actor.id));
    }

    requirePermission(actor, "issues:manage");
    return ok(await listIssues(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOwnIssuePermission(request);
    const input = createIssueSchema.parse(await request.json());
    if (input.taskId) {
      await getOwnTaskOrThrow(actor.id, input.taskId);
    }
    if (input.shiftAssignmentId) {
      await getOwnShiftAssignmentOrThrow(actor.id, input.shiftAssignmentId);
    }
    if (input.areaId) {
      await assertInspectorAreaAccess(actor.id, input.areaId);
    }

    const id = randomUUID();
    const [issue] = await db
      .insert(issueReports)
      .values({
        id,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        severity: input.severity,
        areaId: input.areaId ?? null,
        taskId: input.taskId ?? null,
        shiftAssignmentId: input.shiftAssignmentId ?? null,
        reportedBy: actor.id,
        attachmentUrl: input.attachmentUrl ?? null,
      })
      .returning();

    await writeIssueEvent({
      issueId: id,
      eventType: "issue.create",
      newValue: issue,
      note: "Inspector reported issue",
      actorId: actor.id,
    });

    if (issue.severity === "critical" || issue.severity === "high") {
      await notifyActiveSupervisors({
        title: "Issue lapangan prioritas tinggi",
        message: issue.title,
        type: "issue_alert",
        priority: issue.severity,
        entityType: "issue_reports",
        entityId: id,
        createdBy: actor.id,
      });
    }

    await auditInspectorWrite({
      actor,
      action: "issues.create",
      entityType: "issue_reports",
      entityId: id,
      afterValue: issue,
      reason: "Inspector issue report",
      request,
    });

    return ok(issue, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
