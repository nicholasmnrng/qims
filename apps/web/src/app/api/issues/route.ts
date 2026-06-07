import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listIssues, requireOperationalPermission } from "@/server/api/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "issues:manage");
    return ok(await listIssues(request));
  } catch (error) {
    return handleApiError(error);
  }
}
