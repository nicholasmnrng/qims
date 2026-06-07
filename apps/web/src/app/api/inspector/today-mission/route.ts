import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  getTodayMission,
  localWorkDate,
  requireInspector,
} from "@/server/api/inspector";
import { todayMissionQuerySchema } from "@/server/validation/inspector";

export async function GET(request: Request) {
  try {
    const actor = await requireInspector(request);
    const url = new URL(request.url);
    const query = todayMissionQuerySchema.parse({
      workDate: url.searchParams.get("workDate") ?? undefined,
    });
    return ok(await getTodayMission(actor.id, query.workDate ?? localWorkDate()));
  } catch (error) {
    return handleApiError(error);
  }
}
