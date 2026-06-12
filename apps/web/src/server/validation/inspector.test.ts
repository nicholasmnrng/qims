import { describe, expect, it } from "vitest";

import {
  hasOfflineDraftConflict,
} from "@/server/api/inspector";
import {
  acknowledgeProcedureVersionSchema,
  createHandoverSchema,
  createIssueSchema,
  syncOfflineDraftsSchema,
  taskNoteDraftPayloadSchema,
  updateInspectorSettingsSchema,
  updateOwnTaskStatusSchema,
} from "./inspector";
import { realtimeEventsQuerySchema } from "./runtime";

describe("inspector validation", () => {
  it("requires a reason when an inspector blocks a task", () => {
    expect(() => updateOwnTaskStatusSchema.parse({ status: "blocked" })).toThrow();
  });

  it("accepts own task progress status updates", () => {
    expect(
      updateOwnTaskStatusSchema.parse({
        status: "in_progress",
        progressNote: "Started inspection",
      }),
    ).toMatchObject({ status: "in_progress" });
  });

  it("requires read and understood confirmation for SOP acknowledgement", () => {
    expect(() =>
      acknowledgeProcedureVersionSchema.parse({
        read: true,
        understood: false,
      }),
    ).toThrow();
  });

  it("accepts compact handover payloads with template categories", () => {
    expect(
      createHandoverSchema.parse({
        fromShiftAssignmentId: "11111111-1111-4111-8111-111111111111",
        areaId: "33333333-3333-4333-8333-333333333333",
        items: [
          {
            category: "pending_work",
            note: "Pending UT check on line A",
            severity: "medium",
          },
        ],
      }),
    ).toMatchObject({ status: "submitted" });
  });

  it("accepts issue reports with PRD category and severity values", () => {
    expect(
      createIssueSchema.parse({
        title: "Equipment unavailable",
        category: "equipment_issue",
        severity: "high",
      }),
    ).toMatchObject({ severity: "high" });
  });

  it("accepts offline draft sync batches", () => {
    expect(
      syncOfflineDraftsSchema.parse({
        drafts: [
          {
            localDraftId: "draft-1",
            draftType: "handover",
            payload: { note: "Saved while offline" },
          },
        ],
      }),
    ).toHaveProperty("drafts");
  });

  it("accepts explicit offline conflict resolution and task notes", () => {
    expect(
      syncOfflineDraftsSchema.parse({
        drafts: [
          {
            localDraftId: "draft-2",
            draftType: "task_note",
            payload: {
              taskId: "11111111-1111-4111-8111-111111111111",
              note: "Progress saved offline",
            },
            conflictResolution: "keep_local",
          },
        ],
      }),
    ).toBeTruthy();
    expect(
      taskNoteDraftPayloadSchema.parse({
        taskId: "11111111-1111-4111-8111-111111111111",
        note: "Progress saved offline",
      }),
    ).toBeTruthy();
  });

  it("detects a newer server draft with different payload", () => {
    expect(
      hasOfflineDraftConflict({
        serverUpdatedAt: new Date("2026-06-13T02:00:00.000Z"),
        clientUpdatedAt: new Date("2026-06-13T01:00:00.000Z"),
        serverPayload: { note: "server" },
        clientPayload: { note: "client" },
      }),
    ).toBe(true);
    expect(
      hasOfflineDraftConflict({
        serverUpdatedAt: new Date("2026-06-13T02:00:00.000Z"),
        clientUpdatedAt: new Date("2026-06-13T03:00:00.000Z"),
        serverPayload: { note: "server" },
        clientPayload: { note: "client" },
      }),
    ).toBe(false);
  });

  it("accepts partial eco-mode setting updates", () => {
    expect(
      updateInspectorSettingsSchema.parse({
        ecoModeEnabled: true,
        lowDataModeEnabled: true,
      }),
    ).toMatchObject({ ecoModeEnabled: true });
  });

  it("validates realtime polling cursor and event type", () => {
    expect(
      realtimeEventsQuerySchema.parse({
        channel: "user:inspector-id",
        type: "task.priority_changed",
        since: "2026-06-13T00:00:00.000Z",
      }),
    ).toMatchObject({
      type: "task.priority_changed",
    });
  });
});
