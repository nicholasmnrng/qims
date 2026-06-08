import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/audit/log";
import { dispatchPendingNotifications } from "@/server/runtime/notification-dispatch";
import { dispatchNotificationsSchema } from "@/server/validation/runtime";

export async function POST(request: Request) {
  try {
    const actor = await requireSessionPermission(request, "roles:manage");
    const input = dispatchNotificationsSchema.parse(await request.json().catch(() => ({})));
    const result = await dispatchPendingNotifications(input);

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "notification_worker.dispatch",
      entityType: "notification_recipients",
      entityId: "pending",
      afterValue: result,
      reason: input.reason ?? "Manual notification worker dispatch",
      request,
    });

    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
