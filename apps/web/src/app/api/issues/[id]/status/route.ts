import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  getIssueOrThrow,
  publishOperationalRealtime,
  requireOperationalPermission,
  writeIssueEvent,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { issueReports } from "@/server/db/schema";
import { updateIssueStatusSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "issues:manage");
    const { id } = await context.params;
    const before = await getIssueOrThrow(id);
    const input = updateIssueStatusSchema.parse(await request.json());
    const issue = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(issueReports)
        .set({
          status: input.status,
          updatedAt: new Date(),
          closedAt:
            input.status === "closed" || input.status === "rejected"
              ? new Date()
              : null,
        })
        .where(eq(issueReports.id, id))
        .returning();

      await writeIssueEvent({
        issueId: id,
        eventType: "issue.status_update",
        oldValue: { status: before.status },
        newValue: { status: updated.status },
        note: input.note,
        actorId: actor.id,
      }, tx);

      await auditOperationalWrite({
        actor,
        action: "issues.status_update",
        entityType: "issue_reports",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });

    const recipients = [issue.reportedBy, issue.assignedTo].filter(
      (value): value is string => Boolean(value),
    );
    if (recipients.length > 0) {
      await createNotification({
        title: "Status issue berubah",
        message: `${issue.title} sekarang ${issue.status}.`,
        type: "issue_alert",
        priority:
          issue.severity === "critical" || issue.severity === "high"
            ? issue.severity
            : "normal",
        entityType: "issue_reports",
        entityId: id,
        createdBy: actor.id,
        recipientIds: recipients,
      });
    }

    await publishOperationalRealtime({
      type: "issue.status_changed",
      actorId: actor.id,
      userIds: recipients,
      areaIds: [issue.areaId],
      roles: ["supervisor"],
      payload: { issueId: issue.id, status: issue.status },
    });

    return ok(issue);
  } catch (error) {
    return handleApiError(error);
  }
}
