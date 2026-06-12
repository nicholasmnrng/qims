import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import {
  createMasterRecord,
  listSimpleMasterData,
} from "@/server/api/super-admin";
import { createSiteSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSessionPermission(request, "master-data:manage");
    return ok(await listSimpleMasterData("sites", request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSessionPermission(request, "master-data:manage");
    const { reason, ...input } = createSiteSchema.parse(await request.json());
    const created = await createMasterRecord("sites", input, actor, request, reason);
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
