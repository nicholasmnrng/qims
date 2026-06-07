import { auth } from "@/server/auth";
import { writeAuditLog } from "@/server/audit/log";
import { getSessionFromRequest } from "@/server/auth/session";
import { handleApiError } from "@/server/api/errors";
import { toUserRole } from "@/server/auth/roles";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    const response = await auth.api.signOut({
      headers: request.headers,
      asResponse: true,
    });

    await writeAuditLog({
      actorId: session?.user?.id ?? null,
      actorRole: toUserRole(session?.user?.role),
      action: "auth.logout",
      entityType: "auth_session",
      entityId: session?.session?.id ?? null,
      request,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
