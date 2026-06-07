import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { getIssueDetail } from "@/server/api/supervisor";
import { getOwnIssueDetailOrThrow } from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/rbac";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      requirePermission(actor, "issues:create-own");
      return ok(await getOwnIssueDetailOrThrow(actor.id, id));
    }

    requirePermission(actor, "issues:manage");
    return ok(await getIssueDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
