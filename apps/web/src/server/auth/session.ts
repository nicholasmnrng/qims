import { auth } from "@/server/auth";
import { normalizeSessionUser, requirePermission, type SessionUser } from "./rbac";
import type { Permission } from "./permissions";

export async function getSessionFromRequest(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function requireSession(request: Request): Promise<SessionUser> {
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    throw new Error("UNAUTHENTICATED");
  }

  return normalizeSessionUser(session.user);
}

export async function requireSessionPermission(
  request: Request,
  permission: Permission,
) {
  const user = await requireSession(request);
  requirePermission(user, permission);
  return user;
}
