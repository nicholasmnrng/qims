import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { listPermissions } from "@/server/auth/rbac";

export async function GET(request: Request) {
  try {
    const user = await requireSession(request);

    return ok({
      user,
      permissions: listPermissions(user.role),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
