import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listRoles, requireSuperAdmin } from "@/server/api/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok({ items: await listRoles() });
  } catch (error) {
    return handleApiError(error);
  }
}
