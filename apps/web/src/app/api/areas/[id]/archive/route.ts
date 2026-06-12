import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import { updateMasterRecord } from "@/server/api/super-admin";
import { archiveAreaSchema } from "@/server/validation/super-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireSessionPermission(request, "master-data:manage");
    const { id } = await context.params;
    const input = archiveAreaSchema.parse(await request.json());
    return ok(
      await updateMasterRecord(
        "areas",
        id,
        { status: "archived" },
        input.reason,
        actor,
        request,
      ),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
