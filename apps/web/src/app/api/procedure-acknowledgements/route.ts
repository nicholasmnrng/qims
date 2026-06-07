import { handleApiError } from "@/server/api/errors";
import { listSopAcknowledgements } from "@/server/api/auditor";
import { ok } from "@/server/api/response";

export async function GET(request: Request) {
  try {
    return ok(await listSopAcknowledgements(request));
  } catch (error) {
    return handleApiError(error);
  }
}
