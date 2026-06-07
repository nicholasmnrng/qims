import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { taskCompletionReport } from "@/server/api/reports";

export async function GET(request: Request) {
  try {
    return ok(await taskCompletionReport(request));
  } catch (error) {
    return handleApiError(error);
  }
}
