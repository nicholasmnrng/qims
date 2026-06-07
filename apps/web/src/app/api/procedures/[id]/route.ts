import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { getProcedureDetail } from "@/server/api/supervisor";
import { getOwnProcedureDetail } from "@/server/api/inspector";
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
      requirePermission(actor, "sop:acknowledge");
      return ok(await getOwnProcedureDetail(actor.id, id));
    }

    requirePermission(actor, "sop:manage");
    return ok(await getProcedureDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
