import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  createMasterRecord,
  listSimpleMasterData,
  requireSuperAdmin,
} from "@/server/api/super-admin";
import { createAreaSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok(await listSimpleMasterData("areas", request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdmin(request);
    const { reason, ...input } = createAreaSchema.parse(await request.json());
    return ok(await createMasterRecord("areas", input, actor, request, reason), {
      status: 201,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
