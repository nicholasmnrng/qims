import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import {
  getMasterRecord,
  updateMasterRecord,
} from "@/server/api/super-admin";
import { updateAreaSchema } from "@/server/validation/super-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSessionPermission(request, "auth:session:read");
    const { id } = await context.params;
    return ok(await getMasterRecord("areas", id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireSessionPermission(request, "master-data:manage");
    const { id } = await context.params;
    const { reason, ...input } = updateAreaSchema.parse(await request.json());
    return ok(await updateMasterRecord("areas", id, input, reason, actor, request));
  } catch (error) {
    return handleApiError(error);
  }
}
