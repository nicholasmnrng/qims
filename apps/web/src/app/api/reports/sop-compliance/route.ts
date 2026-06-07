import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { sopComplianceReport } from "@/server/api/reports";

export async function GET(request: Request) {
  try {
    return ok(await sopComplianceReport(request));
  } catch (error) {
    return handleApiError(error);
  }
}
