import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rolePermissions } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

import {
  AuthError,
  ensureActiveUser,
  normalizeSessionUser,
  type SessionUser,
} from "./rbac";
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
  await requireUserPermission(user, permission);
  return user;
}

export async function listRolePermissions(role: SessionUser["role"]) {
  const rows = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, role));

  return rows.map((row) => row.permissionId as Permission);
}

export async function hasUserPermission(
  user: SessionUser,
  permission: Permission,
) {
  ensureActiveUser(user);
  const [match] = await db
    .select({ permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, user.role),
        eq(rolePermissions.permissionId, permission),
      ),
    )
    .limit(1);

  return Boolean(match);
}

export async function requireUserPermission(
  user: SessionUser,
  permission: Permission,
) {
  if (!(await hasUserPermission(user, permission))) {
    throw new AuthError(
      "FORBIDDEN",
      "Anda tidak memiliki akses untuk aksi ini.",
    );
  }
}
