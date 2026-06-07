import type { UserRole } from "@/server/db/schema";

export const permissions = [
  "auth:session:read",
  "users:read",
  "users:write",
  "roles:manage",
  "master-data:manage",
  "schedule:manage",
  "tasks:manage",
  "tasks:update-own",
  "sop:manage",
  "sop:acknowledge",
  "skill-matrix:manage",
  "handover:manage",
  "handover:create-own",
  "issues:manage",
  "issues:create-own",
  "notifications:read",
  "reports:read",
  "reports:export",
  "audit:read",
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissionMap: Record<UserRole, Permission[]> = {
  super_admin: [...permissions],
  qa_manager: [
    "auth:session:read",
    "reports:read",
    "reports:export",
    "audit:read",
    "notifications:read",
  ],
  supervisor: [
    "auth:session:read",
    "users:read",
    "schedule:manage",
    "tasks:manage",
    "sop:manage",
    "skill-matrix:manage",
    "handover:manage",
    "issues:manage",
    "notifications:read",
    "reports:read",
  ],
  inspector: [
    "auth:session:read",
    "tasks:update-own",
    "sop:acknowledge",
    "handover:create-own",
    "issues:create-own",
    "notifications:read",
  ],
  auditor: ["auth:session:read", "reports:read", "audit:read"],
};
