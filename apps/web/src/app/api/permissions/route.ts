import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listPermissions, requireSuperAdmin } from "@/server/api/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok({ items: await listPermissions() });
  } catch (error) {
    return handleApiError(error);
  }
}
