import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listAuditLogs, requireSuperAdmin } from "@/server/api/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok(await listAuditLogs(request));
  } catch (error) {
    return handleApiError(error);
  }
}
