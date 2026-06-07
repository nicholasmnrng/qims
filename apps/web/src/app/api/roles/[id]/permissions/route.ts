import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSuperAdmin, updateRolePermissions } from "@/server/api/super-admin";
import { isUserRole } from "@/server/auth/roles";
import { HttpError } from "@/server/api/http-error";
import { updateRolePermissionsSchema } from "@/server/validation/super-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireSuperAdmin(request);
    const { id } = await context.params;
    if (!isUserRole(id)) {
      throw new HttpError(404, "NOT_FOUND", "Role tidak ditemukan.");
    }

    const input = updateRolePermissionsSchema.parse(await request.json());
    return ok(
      await updateRolePermissions(
        id,
        input.permissionIds,
        input.reason,
        actor,
        request,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
