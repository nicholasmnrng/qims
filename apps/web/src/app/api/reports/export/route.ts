import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { exportReport } from "@/server/api/reports";

export async function POST(request: Request) {
  try {
    return ok(await exportReport(request));
  } catch (error) {
    return handleApiError(error);
  }
}
