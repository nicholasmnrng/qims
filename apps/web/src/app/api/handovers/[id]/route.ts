import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { getHandoverDetail } from "@/server/api/supervisor";
import { getOwnHandoverDetailOrThrow } from "@/server/api/inspector";
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
      await requireUserPermission(actor, "handover:create-own");
      return ok(await getOwnHandoverDetailOrThrow(actor.id, id));
    }

    await requireUserPermission(actor, "handover:manage");
    return ok(await getHandoverDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
