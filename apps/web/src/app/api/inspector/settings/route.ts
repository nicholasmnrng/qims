import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditInspectorWrite,
  defaultInspectorSettings,
  requireInspector,
} from "@/server/api/inspector";
import { db } from "@/server/db";
import { inspectorSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { updateInspectorSettingsSchema } from "@/server/validation/inspector";

export async function GET(request: Request) {
  try {
    const actor = await requireInspector(request);
    const [settings] = await db
      .select()
      .from(inspectorSettings)
      .where(eq(inspectorSettings.userId, actor.id))
      .limit(1);

    return ok(settings ?? defaultInspectorSettings(actor.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireInspector(request);
    const input = updateInspectorSettingsSchema.parse(await request.json());
    const [settings] = await db
      .insert(inspectorSettings)
      .values({
        userId: actor.id,
        ...input,
      })
      .onConflictDoUpdate({
        target: inspectorSettings.userId,
        set: {
          ...input,
          updatedAt: new Date(),
        },
      })
      .returning();

    await auditInspectorWrite({
      actor,
      action: "inspector_settings.update",
      entityType: "inspector_settings",
      entityId: actor.id,
      afterValue: settings,
      reason: "Inspector updated eco-mode settings",
      request,
    });

    return ok(settings);
  } catch (error) {
    return handleApiError(error);
  }
}
