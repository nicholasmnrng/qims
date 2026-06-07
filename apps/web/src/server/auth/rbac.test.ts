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

const qaManager: SessionUser = {
  id: "qa-1",
  email: "qa@example.com",
  name: "QA Manager",
  role: "qa_manager",
  status: "active",
};

describe("RBAC foundation", () => {
  it("allows a role to use its assigned permission", () => {
    expect(hasPermission("supervisor", "schedule:manage")).toBe(true);
    expect(hasPermission("inspector", "tasks:update-own")).toBe(true);
  });

  it("blocks a role from permissions outside its scope", () => {
    expect(hasPermission("inspector", "schedule:manage")).toBe(false);
    expect(hasPermission("inspector", "roles:manage")).toBe(false);
    expect(() => requirePermission(inspector, "schedule:manage")).toThrow(
      "Anda tidak memiliki akses",
    );
    expect(() => requirePermission(inspector, "roles:manage")).toThrow(
      "Anda tidak memiliki akses",
    );
  });

  it("allows QA Manager reports while blocking operational writes", () => {
    expect(hasPermission("qa_manager", "reports:read")).toBe(true);
    expect(hasPermission("qa_manager", "reports:export")).toBe(true);
    expect(hasPermission("qa_manager", "tasks:manage")).toBe(false);
    expect(hasPermission("qa_manager", "issues:manage")).toBe(false);
    expect(() => requirePermission(qaManager, "reports:read")).not.toThrow();
    expect(() => requirePermission(qaManager, "tasks:manage")).toThrow(
      "Anda tidak memiliki akses",
    );
  });

  it("blocks inactive users even when role permission exists", () => {
    expect(() =>
      requirePermission({ ...inspector, status: "inactive" }, "tasks:update-own"),
    ).toThrow("User tidak aktif");
  });
});
