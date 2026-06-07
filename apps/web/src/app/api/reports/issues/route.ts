import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { issuesReport } from "@/server/api/reports";

export async function GET(request: Request) {
  try {
    return ok(await issuesReport(request));
  } catch (error) {
    return handleApiError(error);
  }
}
