import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { writeAuditLog } from "@/server/audit/log";
import {
  listOwnDeviceTokens,
  registerDeviceToken,
} from "@/server/runtime/device-tokens";
import { registerDeviceTokenSchema } from "@/server/validation/runtime";

export async function GET(request: Request) {
  try {
    const actor = await requireSession(request);
    return ok({ items: await listOwnDeviceTokens(actor.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSession(request);
    const input = registerDeviceTokenSchema.parse(await request.json());
    const token = await registerDeviceToken({
        userId: actor.id,
        token: input.token,
        platform: input.platform,
        deviceName: input.deviceName ?? null,
      });

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "device_tokens.register",
      entityType: "device_tokens",
      entityId: token.id,
      afterValue: {
        id: token.id,
        platform: token.platform,
        status: token.status,
        deviceName: token.deviceName,
      },
      reason: "Device token registered",
      request,
    });

    return ok(token, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
