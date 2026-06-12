import { z } from "zod";

import {
  handoverItemCategoryValues,
  issueCategoryValues,
  issueSeverityValues,
  offlineDraftTypeValues,
  taskStatusValues,
} from "@/server/db/schema";

export const todayMissionQuerySchema = z.object({
  workDate: z.string().date().optional(),
});

export const ownTaskListQuerySchema = z.object({
  status: z.enum(taskStatusValues).optional(),
});

export const updateOwnTaskStatusSchema = z
  .object({
    status: z.enum([
      "acknowledged",
      "in_progress",
      "blocked",
      "done",
    ] as const),
    reason: z.string().trim().min(1).max(500).optional(),
    progressNote: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) => value.status !== "blocked" || Boolean(value.reason),
    "Task blocked wajib memiliki reason.",
  );

export const acknowledgeTaskSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const acknowledgeProcedureVersionSchema = z
  .object({
    read: z.boolean().default(true),
    understood: z.boolean().default(true),
    criticalConfirmed: z.boolean().optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) => value.read && value.understood,
    "SOP acknowledgement wajib menandai telah dibaca dan dipahami.",
  );

const handoverItemSchema = z.object({
  category: z.enum(handoverItemCategoryValues),
  note: z.string().trim().min(1).max(2000),
  severity: z.enum(issueSeverityValues).default("low"),
  attachmentUrl: z.string().url().nullable().optional(),
  relatedTaskId: z.string().uuid().nullable().optional(),
  relatedIssueId: z.string().uuid().nullable().optional(),
});

export const createHandoverSchema = z.object({
  fromShiftAssignmentId: z.string().uuid(),
  toShiftId: z.string().uuid().nullable().optional(),
  areaId: z.string().uuid(),
  status: z.enum(["draft", "submitted"] as const).default("submitted"),
  items: z.array(handoverItemSchema).min(1).max(20),
});

export const acknowledgeHandoverSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const createIssueSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(3000).nullable().optional(),
  category: z.enum(issueCategoryValues),
  severity: z.enum(issueSeverityValues).default("medium"),
  areaId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  shiftAssignmentId: z.string().uuid().nullable().optional(),
  attachmentUrl: z.string().url().nullable().optional(),
});

export const commentIssueSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

export const notificationListQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
});

export const offlineDraftListQuerySchema = z.object({
  status: z.enum(["pending", "synced", "conflict", "failed"] as const).optional(),
  draftType: z.enum(offlineDraftTypeValues).optional(),
});

export const upsertOfflineDraftSchema = z.object({
  localDraftId: z.string().trim().min(1).max(160),
  draftType: z.enum(offlineDraftTypeValues),
  payload: z.record(z.string(), z.unknown()),
  clientUpdatedAt: z.string().datetime().nullable().optional(),
  conflictResolution: z
    .enum(["keep_local", "use_server", "merge_manually"] as const)
    .optional(),
});

export const syncOfflineDraftsSchema = z.object({
  drafts: z.array(upsertOfflineDraftSchema).min(1).max(50),
});

export const taskNoteDraftPayloadSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().trim().min(1).max(1000),
});

export const updateInspectorSettingsSchema = z.object({
  ecoModeEnabled: z.boolean().optional(),
  lowDataModeEnabled: z.boolean().optional(),
  compactModeEnabled: z.boolean().optional(),
  darkModePreferred: z.boolean().optional(),
  backgroundSyncEnabled: z.boolean().optional(),
});
