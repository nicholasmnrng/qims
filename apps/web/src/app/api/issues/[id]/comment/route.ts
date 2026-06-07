import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  getOwnIssueDetailOrThrow,
  requireOwnIssuePermission,
} from "@/server/api/inspector";
import { writeIssueEvent } from "@/server/api/supervisor";
import { commentIssueSchema } from "@/server/validation/inspector";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireOwnIssuePermission(request);
    const { id } = await context.params;
    const input = commentIssueSchema.parse(await request.json());
    const issue = await getOwnIssueDetailOrThrow(actor.id, id);

    await writeIssueEvent({
      issueId: id,
      eventType: "issue.comment",
      note: input.note,
      actorId: actor.id,
    });

    await auditInspectorWrite({
      actor,
      action: "issues.comment",
      entityType: "issue_reports",
      entityId: id,
      beforeValue: issue.issue,
      afterValue: { note: input.note },
      reason: input.note,
      request,
    });

    return ok({ issueId: id, note: input.note });
  } catch (error) {
    return handleApiError(error);
  }
}
