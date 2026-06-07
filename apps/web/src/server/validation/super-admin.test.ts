import { describe, expect, it } from "vitest";

import {
  archiveAreaSchema,
  createAreaSchema,
  createShiftSchema,
  createUserSchema,
  updateRolePermissionsSchema,
  updateUserSchema,
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
});
