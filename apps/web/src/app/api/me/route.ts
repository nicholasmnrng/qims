import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  listRolePermissions,
  requireSession,
} from "@/server/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requireSession(request);

    return ok({
      user,
      permissions: await listRolePermissions(user.role),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
