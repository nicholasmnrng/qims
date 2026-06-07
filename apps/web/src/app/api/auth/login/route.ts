import { isAPIError } from "better-auth/api";

import { auth } from "@/server/auth";
import { writeAuditLog } from "@/server/audit/log";
import { handleApiError } from "@/server/api/errors";
import { toUserRole } from "@/server/auth/roles";
import { loginSchema } from "@/server/validation/auth";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const response = await auth.api.signInEmail({
      body: input,
      headers: request.headers,
      asResponse: true,
    });

    const payload = (await response.clone().json().catch(() => null)) as
      | { user?: { id?: string; role?: string } }
      | null;

    await writeAuditLog({
      actorId: payload?.user?.id ?? null,
      actorRole: toUserRole(payload?.user?.role),
      action: "auth.login",
      entityType: "auth_session",
      entityId: payload?.user?.id ?? null,
      afterValue: { email: input.email },
      request,
    });

    return response;
  } catch (error) {
    if (isAPIError(error)) {
      await writeAuditLog({
        action: "auth.failed_login",
        entityType: "auth_session",
        afterValue: { reason: error.message },
        request,
      }).catch(() => undefined);
    }

    return handleApiError(error);
  }
}
