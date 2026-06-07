import { describe, expect, it, vi } from "vitest";

import { nextRetryDelayMs } from "./notification-worker";
import { areaChannel, realtimeEventTypes, roleChannel, userChannel } from "./realtime";
import { isAllowedUpload, storageObjectKey } from "./storage";

describe("backend hardening contracts", () => {
  it("validates storage upload contract by bucket", () => {
    expect(
      isAllowedUpload({
        bucket: "issue-photos",
        entityType: "issue_reports",
        entityId: "issue-1",
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        sizeBytes: 1024,
      }),
    ).toBe(true);
    expect(
      isAllowedUpload({
        bucket: "issue-photos",
        entityType: "issue_reports",
        entityId: "issue-1",
        fileName: "photo.exe",
        contentType: "application/octet-stream",
        sizeBytes: 1024,
      }),
    ).toBe(false);
  });

  it("builds stable storage object keys", () => {
    vi.spyOn(Date, "now").mockReturnValue(1780876800000);
    expect(
      storageObjectKey({
        bucket: "sop-files",
        entityType: "procedure_versions",
        entityId: "version-1",
        fileName: "Critical SOP V1.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
      }),
    ).toBe("sop-files/procedure_versions/version-1/1780876800000-critical-sop-v1.pdf");
    vi.restoreAllMocks();
  });

  it("documents realtime channels and event types", () => {
    expect(userChannel("user-1")).toBe("user:user-1");
    expect(roleChannel("supervisor")).toBe("role:supervisor");
    expect(areaChannel("area-1")).toBe("area:area-1");
    expect(realtimeEventTypes).toContain("task.priority_changed");
  });

  it("caps notification worker retry backoff", () => {
    expect(nextRetryDelayMs(0)).toBe(1000);
    expect(nextRetryDelayMs(10)).toBe(60000);
  });
});
