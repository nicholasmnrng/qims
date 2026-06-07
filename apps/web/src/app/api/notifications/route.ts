import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  listNotificationRecords,
  requireOperationalPermission,
} from "@/server/api/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "notifications:read");
    return ok(await listNotificationRecords(request));
  } catch (error) {
    return handleApiError(error);
  }
}
