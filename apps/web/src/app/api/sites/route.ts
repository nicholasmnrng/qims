import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  createMasterRecord,
  listSimpleMasterData,
  requireSuperAdmin,
} from "@/server/api/super-admin";
import { createSiteSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok(await listSimpleMasterData("sites", request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdmin(request);
    const { reason, ...input } = createSiteSchema.parse(await request.json());
    const created = await createMasterRecord("sites", input, actor, request, reason);
    return ok(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
