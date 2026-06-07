import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listHandovers, requireOperationalPermission } from "@/server/api/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "handover:manage");
    return ok(await listHandovers(request));
  } catch (error) {
    return handleApiError(error);
  }
}
