import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  createMasterRecord,
  listSimpleMasterData,
  requireSuperAdmin,
} from "@/server/api/super-admin";
import { createShiftSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok(await listSimpleMasterData("shifts", request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdmin(request);
    const { reason, ...input } = createShiftSchema.parse(await request.json());
    return ok(await createMasterRecord("shifts", input, actor, request, reason), {
      status: 201,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
