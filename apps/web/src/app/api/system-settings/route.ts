import { handleApiError } from "@/server/api/errors";
import { assertRateLimit } from "@/server/api/rate-limit";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import {
  listSystemSettings,
  upsertSystemSetting,
} from "@/server/api/super-admin";
import { updateSystemSettingsSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSessionPermission(request, "master-data:manage");
    return ok({ items: await listSystemSettings() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertRateLimit(request, {
      namespace: "system-settings.update",
      limit: 20,
      windowMs: 300_000,
    });
    const actor = await requireSessionPermission(request, "master-data:manage");
    const input = updateSystemSettingsSchema.parse(await request.json());
    return ok(
      await upsertSystemSetting(
        input.key,
        input.value,
        input.reason,
        actor,
        request,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
