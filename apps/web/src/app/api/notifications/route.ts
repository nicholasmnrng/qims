import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listNotificationRecords } from "@/server/api/supervisor";
import { listOwnNotifications } from "@/server/api/inspector";
import { requireSession } from "@/server/auth/session";
import { requireUserPermission } from "@/server/auth/session";

export async function GET(request: Request) {
  try {
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      await requireUserPermission(actor, "notifications:read");
      return ok(await listOwnNotifications(request, actor.id));
    }

    await requireUserPermission(actor, "notifications:read");
    return ok(await listNotificationRecords(request));
  } catch (error) {
    return handleApiError(error);
  }
}
