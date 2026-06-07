import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  getMasterRecord,
  requireSuperAdmin,
  updateMasterRecord,
} from "@/server/api/super-admin";
import { updateShiftSchema } from "@/server/validation/super-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await context.params;
    return ok(await getMasterRecord("shifts", id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireSuperAdmin(request);
    const { id } = await context.params;
    const { reason, ...input } = updateShiftSchema.parse(await request.json());
    return ok(await updateMasterRecord("shifts", id, input, reason, actor, request));
  } catch (error) {
    return handleApiError(error);
  }
}
