import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import { listRealtimeEvents } from "@/server/runtime/realtime-events";

export async function GET(request: Request) {
  try {
    await requireSessionPermission(request, "notifications:read");
    return ok(await listRealtimeEvents(request));
  } catch (error) {
    return handleApiError(error);
  }
}
