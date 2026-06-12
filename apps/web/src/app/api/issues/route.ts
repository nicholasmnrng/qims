import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listIssues } from "@/server/api/supervisor";
import {
  listOwnIssues,
  requireOwnIssuePermission,
} from "@/server/api/inspector";
import {
  createInspectorIssue,
  publishInspectorIssueSignals,
} from "@/server/api/inspector-writes";
import { requireSession } from "@/server/auth/session";
import { requireUserPermission } from "@/server/auth/session";
import { createIssueSchema } from "@/server/validation/inspector";

export async function GET(request: Request) {
  try {
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      await requireUserPermission(actor, "issues:create-own");
      return ok(await listOwnIssues(request, actor.id));
    }

    await requireUserPermission(actor, "issues:manage");
    return ok(await listIssues(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOwnIssuePermission(request);
    const input = createIssueSchema.parse(await request.json());
    const issue = await createInspectorIssue({
      actor,
      payload: input,
      request,
    });
    await publishInspectorIssueSignals({
      actor,
      issue,
    });

    return ok(issue, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
