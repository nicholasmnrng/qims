import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { getIssueDetail } from "@/server/api/supervisor";
import { getOwnIssueDetailOrThrow } from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requireUserPermission } from "@/server/auth/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      await requireUserPermission(actor, "issues:create-own");
      return ok(await getOwnIssueDetailOrThrow(actor.id, id));
    }

    await requireUserPermission(actor, "issues:manage");
    return ok(await getIssueDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
