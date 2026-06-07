import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { getSessionFromRequest } from "@/server/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    return ok({
      authenticated: Boolean(session),
      session,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
