import type { UserRole, UserStatus } from "@/server/db/schema";
import { rolePermissionMap, type Permission } from "./permissions";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "USER_INACTIVE",
    message: string,
  ) {
    super(message);
  }
}

export function normalizeSessionUser(user: unknown): SessionUser {
  const value = user as Partial<SessionUser> | undefined;

  if (!value?.id || !value.email || !value.name || !value.role) {
    throw new AuthError("UNAUTHENTICATED", "Session tidak valid.");
  }

  return {
    id: value.id,
    email: value.email,
    name: value.name,
    role: value.role,
    status: value.status ?? "active",
  };
}

export function ensureActiveUser(user: SessionUser) {
  if (user.status !== "active") {
    throw new AuthError("USER_INACTIVE", "User tidak aktif.");
  }
}

export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissionMap[role]?.includes(permission) ?? false;
}

export function requirePermission(user: SessionUser, permission: Permission) {
  ensureActiveUser(user);

  if (!hasPermission(user.role, permission)) {
    throw new AuthError("FORBIDDEN", "Anda tidak memiliki akses untuk aksi ini.");
  }
}

export function requireRole(user: SessionUser, roles: UserRole[]) {
  ensureActiveUser(user);

  if (!roles.includes(user.role)) {
    throw new AuthError("FORBIDDEN", "Role Anda tidak memiliki akses untuk aksi ini.");
  }
}

export function listPermissions(role: UserRole) {
  return rolePermissionMap[role] ?? [];
}
