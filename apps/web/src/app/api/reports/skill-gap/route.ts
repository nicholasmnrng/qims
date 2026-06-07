import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { skillGapReport } from "@/server/api/reports";

export async function GET(request: Request) {
  try {
    return ok(await skillGapReport(request));
  } catch (error) {
    return handleApiError(error);
  }
}
