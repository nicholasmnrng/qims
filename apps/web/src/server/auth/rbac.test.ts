import { describe, expect, it } from "vitest";

import {
  hasPermission,
  requirePermission,
  type SessionUser,
} from "./rbac";

const inspector: SessionUser = {
  id: "inspector-1",
  email: "inspector@example.com",
  name: "Inspector",
  role: "inspector",
  status: "active",
};

describe("RBAC foundation", () => {
  it("allows a role to use its assigned permission", () => {
    expect(hasPermission("supervisor", "schedule:manage")).toBe(true);
    expect(hasPermission("inspector", "tasks:update-own")).toBe(true);
  });

  it("blocks a role from permissions outside its scope", () => {
    expect(hasPermission("inspector", "schedule:manage")).toBe(false);
    expect(() => requirePermission(inspector, "schedule:manage")).toThrow(
      "Anda tidak memiliki akses",
    );
  });

  it("blocks inactive users even when role permission exists", () => {
    expect(() =>
      requirePermission({ ...inspector, status: "inactive" }, "tasks:update-own"),
    ).toThrow("User tidak aktif");
  });
});
