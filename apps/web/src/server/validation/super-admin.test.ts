import { describe, expect, it } from "vitest";

import {
  archiveAreaSchema,
  auditLogListQuerySchema,
  createAreaSchema,
  createShiftSchema,
  createUserSchema,
  updateRolePermissionsSchema,
  updateUserSchema,
  validateRolePermissionInvariants,
} from "./super-admin";

describe("super admin validation", () => {
  it("requires a reason when creating a managed user", () => {
    expect(() =>
      createUserSchema.parse({
        name: "Admin Created Inspector",
        email: "inspector@example.com",
        password: "password123",
        role: "inspector",
      }),
    ).toThrow();
  });

  it("accepts valid master area payloads", () => {
    expect(
      createAreaSchema.parse({
        code: "AREA-01",
        name: "Area 01",
        minimumSkillLevel: "competent",
        reason: "Initial master data",
      }),
    ).toMatchObject({
      code: "AREA-01",
      status: "active",
      minimumSkillLevel: "competent",
    });
  });

  it("rejects shift time outside HH:mm format", () => {
    expect(() =>
      createShiftSchema.parse({
        name: "Invalid Shift",
        startTime: "7 pagi",
        endTime: "19:00",
        timezone: "Asia/Makassar",
        reason: "Invalid test",
      }),
    ).toThrow();
  });

  it("requires at least one user field update", () => {
    expect(() => updateUserSchema.parse({ reason: "No actual change" })).toThrow();
  });

  it("requires reason for area archive", () => {
    expect(() => archiveAreaSchema.parse({})).toThrow();
  });

  it("accepts role permission update payloads", () => {
    expect(
      updateRolePermissionsSchema.parse({
        permissionIds: ["users:read", "audit:read"],
        reason: "Adjust read-only role",
      }),
    ).toMatchObject({
      permissionIds: ["users:read", "audit:read"],
    });
  });

  it("rejects duplicate role permissions", () => {
    expect(() =>
      updateRolePermissionsSchema.parse({
        permissionIds: ["users:read", "users:read"],
        reason: "Duplicate permission test",
      }),
    ).toThrow();
  });

  it("protects the minimum Super Admin permission set", () => {
    expect(() =>
      validateRolePermissionInvariants("super_admin", ["audit:read"]),
    ).toThrow("Super Admin wajib mempertahankan permission");

    expect(() =>
      validateRolePermissionInvariants("super_admin", [
        "auth:session:read",
        "users:read",
        "users:write",
        "roles:manage",
        "master-data:manage",
        "audit:read",
      ]),
    ).not.toThrow();
  });

  it("accepts audit actor and date filters", () => {
    expect(
      auditLogListQuerySchema.parse({
        actor: "Cladtek Admin",
        action: "users.update",
        entityType: "users",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }),
    ).toMatchObject({
      actor: "Cladtek Admin",
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
    });
  });

  it("rejects an inverted audit date range", () => {
    expect(() =>
      auditLogListQuerySchema.parse({
        dateFrom: "2026-06-30",
        dateTo: "2026-06-01",
      }),
    ).toThrow("dateFrom tidak boleh melewati dateTo");
  });
});
