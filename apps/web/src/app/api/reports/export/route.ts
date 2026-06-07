import { handleApiError } from "@/server/api/errors";
import { assertRateLimit } from "@/server/api/rate-limit";
import { ok } from "@/server/api/response";
import { exportReport } from "@/server/api/reports";

export async function POST(request: Request) {
  try {
    assertRateLimit(request, {
      namespace: "reports.export",
      limit: 10,
      windowMs: 60_000,
    });
    return ok(await exportReport(request));
  } catch (error) {
    return handleApiError(error);
  }
}
