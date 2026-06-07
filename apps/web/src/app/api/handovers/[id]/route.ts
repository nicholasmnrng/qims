import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  getHandoverDetail,
  requireOperationalPermission,
} from "@/server/api/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireOperationalPermission(request, "handover:manage");
    const { id } = await context.params;
    return ok(await getHandoverDetail(id));
  } catch (error) {
    return handleApiError(error);
  }
}
