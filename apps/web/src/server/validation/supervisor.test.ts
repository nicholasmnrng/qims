import { describe, expect, it } from "vitest";

import { isSkillSufficient } from "@/server/api/supervisor";
import {
  createShiftAssignmentSchema,
  createTaskSchema,
  listHandoversQuerySchema,
  listIssuesQuerySchema,
  listNotificationRecordsQuerySchema,
  listShiftAssignmentsQuerySchema,
  publishShiftAssignmentsSchema,
  publishProcedureVersionSchema,
  updateIssueStatusSchema,
  updateTaskPrioritySchema,
  upsertSkillMatrixSchema,
} from "./supervisor";

describe("supervisor validation", () => {
  it("requires a reason for shift assignment changes", () => {
    expect(() =>
      createShiftAssignmentSchema.parse({
        userId: "better-auth-user-id",
        shiftId: "22222222-2222-4222-8222-222222222222",
        areaId: "33333333-3333-4333-8333-333333333333",
        workDate: "2026-06-07",
      }),
    ).toThrow();
  });

  it("accepts schedule publish payloads with an audit reason", () => {
    expect(
      publishShiftAssignmentsSchema.parse({
        workDate: "2026-06-07",
        reason: "Publish approved schedule",
      }),
    ).toMatchObject({
      workDate: "2026-06-07",
    });
  });

  it("requires task priority changes to carry a reason", () => {
    expect(() => updateTaskPrioritySchema.parse({ priority: "critical" })).toThrow();
  });

  it("accepts task creation payloads with checklist and due time", () => {
    expect(
      createTaskSchema.parse({
        title: "Inspect weld line A",
        areaId: "33333333-3333-4333-8333-333333333333",
        priority: "high",
        dueAt: "2026-06-07T08:00:00.000Z",
        checklist: [{ label: "Check surface condition" }],
        reason: "Daily inspection plan",
      }),
    ).toMatchObject({
      priority: "high",
      status: "draft",
    });
  });

  it("validates skill matrix level against known PRD levels", () => {
    expect(
      upsertSkillMatrixSchema.parse({
        userId: "better-auth-user-id",
        areaId: "33333333-3333-4333-8333-333333333333",
        skillLevel: "competent",
        reason: "Assessment update",
      }),
    ).toMatchObject({
      skillLevel: "competent",
    });
  });

  it("uses PRD skill order for assignment sufficiency checks", () => {
    expect(isSkillSufficient("expert", "competent")).toBe(true);
    expect(isSkillSufficient("beginner", "competent")).toBe(false);
    expect(isSkillSufficient(null, "not_trained")).toBe(true);
  });

  it("requires issue status updates and SOP publish to be auditable", () => {
    expect(() => updateIssueStatusSchema.parse({ status: "closed" })).toThrow();
    expect(() => publishProcedureVersionSchema.parse({})).toThrow();
  });

  it("validates assignment filters including date range and skill level", () => {
    expect(
      listShiftAssignmentsQuerySchema.parse({
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
        skillLevel: "competent",
        status: "published",
      }),
    ).toMatchObject({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
      skillLevel: "competent",
    });
    expect(() =>
      listShiftAssignmentsQuerySchema.parse({
        dateFrom: "2026-06-30",
        dateTo: "2026-06-01",
      }),
    ).toThrow();
  });

  it("validates handover and issue operational date filters", () => {
    expect(
      listHandoversQuerySchema.parse({
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }),
    ).toBeTruthy();
    expect(
      listIssuesQuerySchema.parse({
        shiftAssignmentId: "44444444-4444-4444-8444-444444444444",
        dateFrom: "2026-06-01",
      }),
    ).toBeTruthy();
  });

  it("validates notification recipient and delivery filters", () => {
    expect(
      listNotificationRecordsQuerySchema.parse({
        type: "priority_change",
        priority: "critical",
        recipientUserId: "better-auth-user-id",
        deliveryStatus: "delivered",
        readStatus: "read",
        acknowledgementStatus: "acknowledged",
      }),
    ).toMatchObject({
      type: "priority_change",
      deliveryStatus: "delivered",
      readStatus: "read",
    });
  });
});
