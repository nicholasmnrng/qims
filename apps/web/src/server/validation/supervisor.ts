import { z } from "zod";

import {
  assignmentStatusValues,
  handoverStatusValues,
  issueSeverityValues,
  issueStatusValues,
  procedureCategoryValues,
  procedureStatusValues,
  procedureTargetTypeValues,
  skillLevelValues,
  taskPriorityValues,
  taskStatusValues,
} from "@/server/db/schema";

export const listByOperationalFiltersSchema = z.object({
  areaId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  workDate: z.string().date().optional(),
  status: z.string().trim().optional(),
});

export const createShiftAssignmentSchema = z.object({
  userId: z.string().uuid(),
  shiftId: z.string().uuid(),
  areaId: z.string().uuid(),
  workDate: z.string().date(),
  assignmentStatus: z.enum(assignmentStatusValues).default("draft"),
  changeReason: z.string().trim().min(1).max(500),
});

export const updateShiftAssignmentSchema = createShiftAssignmentSchema
  .partial({
    userId: true,
    shiftId: true,
    areaId: true,
    workDate: true,
    assignmentStatus: true,
  })
  .required({ changeReason: true })
  .refine(
    (value) =>
      value.userId !== undefined ||
      value.shiftId !== undefined ||
      value.areaId !== undefined ||
      value.workDate !== undefined ||
      value.assignmentStatus !== undefined,
    "Minimal satu field assignment harus diubah.",
  );

export const publishShiftAssignmentsSchema = z.object({
  workDate: z.string().date(),
  shiftId: z.string().uuid().optional(),
  assignmentIds: z.array(z.string().uuid()).optional(),
  reason: z.string().trim().min(1).max(500),
});

export const duplicateShiftAssignmentsSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
  shiftId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(500),
});

const checklistItemSchema = z.object({
  label: z.string().trim().min(1).max(160),
  done: z.boolean().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  areaId: z.string().uuid(),
  assignedUserId: z.string().uuid().nullable().optional(),
  shiftAssignmentId: z.string().uuid().nullable().optional(),
  priority: z.enum(taskPriorityValues).default("medium"),
  status: z.enum(taskStatusValues).default("draft"),
  dueAt: z.string().datetime().nullable().optional(),
  attachmentUrl: z.string().url().nullable().optional(),
  checklist: z.array(checklistItemSchema).optional(),
  reason: z.string().trim().min(1).max(500),
});

export const updateTaskSchema = createTaskSchema
  .partial({
    title: true,
    description: true,
    areaId: true,
    assignedUserId: true,
    shiftAssignmentId: true,
    priority: true,
    status: true,
    dueAt: true,
    attachmentUrl: true,
    checklist: true,
  })
  .required({ reason: true });

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatusValues),
  reason: z.string().trim().min(1).max(500),
});

export const updateTaskPrioritySchema = z.object({
  priority: z.enum(taskPriorityValues),
  reason: z.string().trim().min(1).max(500),
});

export const createProcedureSchema = z.object({
  title: z.string().trim().min(1).max(180),
  category: z.enum(procedureCategoryValues),
  status: z.enum(procedureStatusValues).default("draft"),
  reason: z.string().trim().min(1).max(500),
});

export const createProcedureVersionSchema = z.object({
  content: z.string().trim().max(10000).nullable().optional(),
  attachmentUrl: z.string().url().nullable().optional(),
  effectiveDate: z.string().date().nullable().optional(),
  isCritical: z.boolean().default(false),
  targets: z
    .array(
      z.object({
        targetType: z.enum(procedureTargetTypeValues),
        targetId: z.string().nullable().optional(),
      }),
    )
    .default([{ targetType: "all_inspectors" }]),
  reason: z.string().trim().min(1).max(500),
});

export const publishProcedureVersionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const upsertSkillMatrixSchema = z.object({
  userId: z.string().uuid(),
  areaId: z.string().uuid(),
  skillLevel: z.enum(skillLevelValues),
  assessedAt: z.string().datetime().nullable().optional(),
  validUntil: z.string().date().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(1).max(500),
});

export const listSkillMatrixQuerySchema = z.object({
  areaId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  level: z.enum(skillLevelValues).optional(),
});

export const listHandoversQuerySchema = z.object({
  areaId: z.string().uuid().optional(),
  status: z.enum(handoverStatusValues).optional(),
});

export const listIssuesQuerySchema = z.object({
  areaId: z.string().uuid().optional(),
  severity: z.enum(issueSeverityValues).optional(),
  status: z.enum(issueStatusValues).optional(),
});

export const updateIssueStatusSchema = z.object({
  status: z.enum(issueStatusValues),
  note: z.string().trim().max(1000).nullable().optional(),
  reason: z.string().trim().min(1).max(500),
});
