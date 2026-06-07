import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  listSystemSettings,
  requireSuperAdmin,
  upsertSystemSetting,
} from "@/server/api/super-admin";
import { updateSystemSettingsSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok({ items: await listSystemSettings() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireSuperAdmin(request);
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
