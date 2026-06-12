import { z } from "zod";

import {
  assignmentStatusValues,
  issueSeverityValues,
  issueStatusValues,
  taskPriorityValues,
  taskStatusValues,
} from "@/server/db/schema";

const authUserIdSchema = z.string().trim().min(1).max(160);

export const reportFiltersSchema = z
  .object({
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    shiftId: z.string().uuid().optional(),
    areaId: z.string().uuid().optional(),
    inspectorId: authUserIdSchema.optional(),
    status: z.string().trim().optional(),
    severity: z.enum(issueSeverityValues).optional(),
    priority: z.enum(taskPriorityValues).optional(),
  })
  .refine(
    (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    {
      message: "dateFrom tidak boleh melewati dateTo.",
      path: ["dateTo"],
    },
  );

export const taskCompletionReportQuerySchema = reportFiltersSchema.safeExtend({
  status: z.enum(taskStatusValues).optional(),
});

export const issueReportQuerySchema = reportFiltersSchema.safeExtend({
  status: z.enum(issueStatusValues).optional(),
});

export const shiftCompletionReportQuerySchema = reportFiltersSchema.safeExtend({
  status: z.enum(assignmentStatusValues).optional(),
});

export const sopComplianceReportQuerySchema = reportFiltersSchema.safeExtend({
  status: z.enum(["acknowledged", "pending"] as const).optional(),
});

export const exportReportSchema = z.object({
  reportType: z.enum([
    "shift-completion",
    "task-completion",
    "sop-compliance",
    "skill-gap",
    "issues",
  ] as const),
  format: z.enum(["json", "csv"] as const).default("csv"),
  filters: reportFiltersSchema.default({}),
  reason: z.string().trim().min(1).max(500),
});

export function toReportFilters(searchParams: URLSearchParams) {
  return {
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    shiftId: searchParams.get("shiftId") ?? undefined,
    areaId: searchParams.get("areaId") ?? undefined,
    inspectorId: searchParams.get("inspectorId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    severity: searchParams.get("severity") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
  };
}
