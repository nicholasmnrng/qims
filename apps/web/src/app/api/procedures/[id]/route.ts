import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  getProcedureDetail,
  requireOperationalPermission,
} from "@/server/api/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireOperationalPermission(request, "sop:manage");
    const { id } = await context.params;
    return ok(await getProcedureDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
