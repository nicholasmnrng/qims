import { describe, expect, it } from "vitest";

import {
  exportReportSchema,
  issueReportQuerySchema,
  taskCompletionReportQuerySchema,
} from "./reports";

describe("reports validation", () => {
  it("accepts task completion filters with PRD task status", () => {
    expect(
      taskCompletionReportQuerySchema.parse({
        dateFrom: "2026-06-01",
        dateTo: "2026-06-08",
        status: "done",
        priority: "high",
      }),
    ).toMatchObject({
      status: "done",
      priority: "high",
    });
  });

  it("rejects issue reports with unknown severity", () => {
    expect(() =>
      issueReportQuerySchema.parse({
        severity: "urgent",
      }),
    ).toThrow();
  });

  it("requires an audit reason for report export", () => {
    expect(() =>
      exportReportSchema.parse({
        reportType: "issues",
        format: "csv",
      }),
    ).toThrow();
  });

  it("accepts small report export payloads", () => {
    expect(
      exportReportSchema.parse({
        reportType: "task-completion",
        format: "json",
        filters: {
          areaId: "33333333-3333-4333-8333-333333333333",
        },
        reason: "Weekly QA review",
      }),
    ).toMatchObject({
      reportType: "task-completion",
      format: "json",
    });
  });
});
