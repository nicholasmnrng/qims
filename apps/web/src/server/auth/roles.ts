import { userRoleValues, type UserRole } from "@/server/db/schema";

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (userRoleValues as readonly string[]).includes(value)
  );
}

export function toUserRole(value: unknown): UserRole | null {
  return isUserRole(value) ? value : null;
}
