import { and, asc, count, desc, eq, gte, isNull, lte, ne, or } from "drizzle-orm";

import { writeAuditLog } from "@/server/audit/log";
import { requireSessionPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  areas,
  handovers,
  issueReports,
  procedureAcknowledgements,
  procedureVersions,
  procedures,
  shiftAssignments,
  shifts,
  skillLevelValues,
  skillMatrix,
  taskEvents,
  tasks,
  users,
  type SkillLevel,
  type TaskStatus,
} from "@/server/db/schema";
import { paginationMeta, parsePagination } from "./pagination";
import { resolveProcedureRecipients } from "./supervisor";

export async function requireReportsRead(request: Request) {
  return requireSessionPermission(request, "reports:read");
}

export async function requireReportsExport(request: Request) {
  return requireSessionPermission(request, "reports:export");
}

function endOfDate(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999Z`);
}

function startOfDate(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

function localWorkDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function completionRate(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 10000) / 100;
}

const skillRank: Record<SkillLevel, number> = {
  not_trained: 0,
  beginner: 1,
  intermediate: 2,
  competent: 3,
  expert: 4,
  trainer: 5,
};

function isSkillGap(actual: SkillLevel, minimum: SkillLevel) {
  return skillRank[actual] < skillRank[minimum];
}

function taskCompleted(status: TaskStatus) {
  return ["done", "verified", "closed"].includes(status);
}

export async function dashboardSummary(request: Request) {
  await requireReportsRead(request);
  const today = localWorkDate();
  const activeAreas = await db
    .select({ id: areas.id, code: areas.code, name: areas.name })
    .from(areas)
    .where(eq(areas.status, "active"));
  const todayAssignments = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.workDate, today),
        ne(shiftAssignments.assignmentStatus, "cancelled"),
      ),
    );
  const todayTasks = await db.select().from(tasks);
  const openTasks = todayTasks.filter((task) => !["closed", "cancelled"].includes(task.status));
  const criticalTasks = openTasks.filter((task) => task.priority === "critical");
  const issueRows = await db.select().from(issueReports);
  const handoverRows = await db.select().from(handovers).where(
    or(
      eq(handovers.status, "draft"),
      eq(handovers.status, "submitted"),
      eq(handovers.status, "read_by_next_shift"),
    ),
  );
  const publishedVersions = await db
    .select({ id: procedureVersions.id })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .where(and(eq(procedures.status, "published"), isNull(procedures.archivedAt)));
  const sopUnreadCounts = await Promise.all(
    publishedVersions.map(async (version) => {
      const recipientIds = await resolveProcedureRecipients(version.id);
      const acknowledgements = await db
        .select({ userId: procedureAcknowledgements.userId })
        .from(procedureAcknowledgements)
        .where(eq(procedureAcknowledgements.procedureVersionId, version.id));
      const understoodUserIds = new Set(acknowledgements.map((item) => item.userId));
      return recipientIds.filter((userId) => !understoodUserIds.has(userId)).length;
    }),
  );
  const coverageIds = new Set(todayAssignments.map((assignment) => assignment.areaId));
  const priorityEvents = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.eventType, "task.priority_change"))
    .orderBy(desc(taskEvents.createdAt))
    .limit(10);

  return {
    workDate: today,
    activeInspectorsToday: new Set(todayAssignments.map((item) => item.userId)).size,
    openCriticalTasks: criticalTasks.length,
    areaCoverage: {
      covered: activeAreas.filter((area) => coverageIds.has(area.id)).length,
      uncovered: activeAreas.filter((area) => !coverageIds.has(area.id)),
      total: activeAreas.length,
    },
    sopUnreadCount: sopUnreadCounts.reduce((total, value) => total + value, 0),
    handoverPendingCount: handoverRows.length,
    issueSeverity: countBy(issueRows.map((issue) => issue.severity)),
    taskCompletion: {
      total: todayTasks.length,
      completed: todayTasks.filter((task) => taskCompleted(task.status)).length,
      byStatus: countBy(todayTasks.map((task) => task.status)),
    },
    priorityChangeTimeline: priorityEvents,
  };
}

function parseReportRequest(request: Request) {
  const url = new URL(request.url);
  return {
    pagination: parsePagination(url.searchParams),
    searchParams: url.searchParams,
  };
}

export async function shiftCompletionReport(request: Request) {
  await requireReportsRead(request);
  const { pagination, searchParams } = parseReportRequest(request);
  const { reportFiltersSchema, toReportFilters } = await import("@/server/validation/reports");
  const filters = reportFiltersSchema.parse(toReportFilters(searchParams));
  const where = and(
    filters.dateFrom ? gte(shiftAssignments.workDate, filters.dateFrom) : undefined,
    filters.dateTo ? lte(shiftAssignments.workDate, filters.dateTo) : undefined,
    filters.shiftId ? eq(shiftAssignments.shiftId, filters.shiftId) : undefined,
    filters.areaId ? eq(shiftAssignments.areaId, filters.areaId) : undefined,
    filters.inspectorId ? eq(shiftAssignments.userId, filters.inspectorId) : undefined,
    filters.status ? eq(shiftAssignments.assignmentStatus, filters.status as never) : undefined,
  );
  const [items, total, taskRows] = await Promise.all([
    db
      .select({
        assignment: shiftAssignments,
        inspector: { id: users.id, name: users.name, email: users.email },
        area: { id: areas.id, code: areas.code, name: areas.name },
        shift: { id: shifts.id, name: shifts.name, startTime: shifts.startTime, endTime: shifts.endTime },
      })
      .from(shiftAssignments)
      .innerJoin(users, eq(users.id, shiftAssignments.userId))
      .innerJoin(areas, eq(areas.id, shiftAssignments.areaId))
      .innerJoin(shifts, eq(shifts.id, shiftAssignments.shiftId))
      .where(where)
      .orderBy(desc(shiftAssignments.workDate), asc(shifts.startTime))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(shiftAssignments).where(where),
    db.select().from(tasks),
  ]);
  const tasksByAssignment = new Map<string, typeof taskRows>();
  for (const task of taskRows) {
    if (!task.shiftAssignmentId) continue;
    const current = tasksByAssignment.get(task.shiftAssignmentId) ?? [];
    current.push(task);
    tasksByAssignment.set(task.shiftAssignmentId, current);
  }

  return {
    items: items.map((item) => {
      const assignmentTasks = tasksByAssignment.get(item.assignment.id) ?? [];
      const completed = assignmentTasks.filter((task) => taskCompleted(task.status)).length;
      return {
        ...item,
        metrics: {
          totalTasks: assignmentTasks.length,
          completedTasks: completed,
          completionRate: completionRate(completed, assignmentTasks.length),
        },
      };
    }),
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function taskCompletionReport(request: Request) {
  await requireReportsRead(request);
  const { pagination, searchParams } = parseReportRequest(request);
  const { taskCompletionReportQuerySchema, toReportFilters } = await import("@/server/validation/reports");
  const filters = taskCompletionReportQuerySchema.parse(toReportFilters(searchParams));
  const where = and(
    filters.areaId ? eq(tasks.areaId, filters.areaId) : undefined,
    filters.inspectorId ? eq(tasks.assignedUserId, filters.inspectorId) : undefined,
    filters.status ? eq(tasks.status, filters.status) : undefined,
    filters.priority ? eq(tasks.priority, filters.priority) : undefined,
    filters.dateFrom ? gte(tasks.createdAt, startOfDate(filters.dateFrom)!) : undefined,
    filters.dateTo ? lte(tasks.createdAt, endOfDate(filters.dateTo)!) : undefined,
  );
  const [items, total, allRows] = await Promise.all([
    db
      .select({
        task: tasks,
        area: { id: areas.id, code: areas.code, name: areas.name },
        inspector: { id: users.id, name: users.name, email: users.email },
      })
      .from(tasks)
      .innerJoin(areas, eq(areas.id, tasks.areaId))
      .leftJoin(users, eq(users.id, tasks.assignedUserId))
      .where(where)
      .orderBy(desc(tasks.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(tasks).where(where),
    db.select().from(tasks).where(where),
  ]);
  const completed = allRows.filter((task) => taskCompleted(task.status)).length;

  return {
    items,
    summary: {
      total: allRows.length,
      completed,
      completionRate: completionRate(completed, allRows.length),
      byStatus: countBy(allRows.map((task) => task.status)),
      byPriority: countBy(allRows.map((task) => task.priority)),
    },
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function sopComplianceReport(request: Request) {
  await requireReportsRead(request);
  const { pagination } = parseReportRequest(request);
  const rows = await db
    .select({
      procedure: procedures,
      version: procedureVersions,
    })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .where(and(eq(procedures.status, "published"), isNull(procedures.archivedAt)))
    .orderBy(desc(procedureVersions.publishedAt), desc(procedureVersions.createdAt));
  const pageItems = rows.slice(pagination.offset, pagination.offset + pagination.limit);
  const items = [];

  for (const item of pageItems) {
    const recipientIds = await resolveProcedureRecipients(item.version.id);
    const acknowledgements = await db
      .select()
      .from(procedureAcknowledgements)
      .where(eq(procedureAcknowledgements.procedureVersionId, item.version.id));
    const understood = acknowledgements.filter((ack) => Boolean(ack.understoodAt)).length;
    items.push({
      ...item,
      metrics: {
        targetCount: recipientIds.length,
        acknowledgedCount: understood,
        pendingCount: Math.max(recipientIds.length - understood, 0),
        complianceRate: completionRate(understood, recipientIds.length),
      },
    });
  }

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, rows.length),
  };
}

export async function skillGapReport(request: Request) {
  await requireReportsRead(request);
  const { pagination, searchParams } = parseReportRequest(request);
  const { reportFiltersSchema, toReportFilters } = await import("@/server/validation/reports");
  const filters = reportFiltersSchema.parse(toReportFilters(searchParams));
  const rows = await db
    .select({
      skill: skillMatrix,
      inspector: { id: users.id, name: users.name, email: users.email },
      area: { id: areas.id, code: areas.code, name: areas.name, minimumSkillLevel: areas.minimumSkillLevel },
    })
    .from(skillMatrix)
    .innerJoin(users, eq(users.id, skillMatrix.userId))
    .innerJoin(areas, eq(areas.id, skillMatrix.areaId))
    .where(
      and(
        filters.areaId ? eq(skillMatrix.areaId, filters.areaId) : undefined,
        filters.inspectorId ? eq(skillMatrix.userId, filters.inspectorId) : undefined,
      ),
    )
    .orderBy(asc(areas.name), asc(users.name));
  const gaps = rows.filter((row) => isSkillGap(row.skill.skillLevel, row.area.minimumSkillLevel));
  const activeAreas = await db
    .select()
    .from(areas)
    .where(filters.areaId ? eq(areas.id, filters.areaId) : eq(areas.status, "active"));
  const areaCoverage = activeAreas.map((area) => {
    const areaSkills = rows.filter((row) => row.area.id === area.id);
    return {
      area,
      qualifiedInspectors: areaSkills.filter(
        (row) => !isSkillGap(row.skill.skillLevel, area.minimumSkillLevel),
      ).length,
      gapCount: areaSkills.filter((row) =>
        isSkillGap(row.skill.skillLevel, area.minimumSkillLevel),
      ).length,
    };
  });

  return {
    items: gaps.slice(pagination.offset, pagination.offset + pagination.limit),
    summary: {
      totalSkills: rows.length,
      totalGaps: gaps.length,
      bySkillLevel: countBy(gaps.map((row) => row.skill.skillLevel)),
      areaCoverage,
      skillLevels: skillLevelValues,
    },
    meta: paginationMeta(pagination.page, pagination.limit, gaps.length),
  };
}

export async function issuesReport(request: Request) {
  await requireReportsRead(request);
  const { pagination, searchParams } = parseReportRequest(request);
  const { issueReportQuerySchema, toReportFilters } = await import("@/server/validation/reports");
  const filters = issueReportQuerySchema.parse(toReportFilters(searchParams));
  const where = and(
    filters.areaId ? eq(issueReports.areaId, filters.areaId) : undefined,
    filters.inspectorId ? eq(issueReports.reportedBy, filters.inspectorId) : undefined,
    filters.status ? eq(issueReports.status, filters.status) : undefined,
    filters.severity ? eq(issueReports.severity, filters.severity) : undefined,
    filters.dateFrom ? gte(issueReports.createdAt, startOfDate(filters.dateFrom)!) : undefined,
    filters.dateTo ? lte(issueReports.createdAt, endOfDate(filters.dateTo)!) : undefined,
  );
  const [items, total, allRows] = await Promise.all([
    db
      .select({
        issue: issueReports,
        area: { id: areas.id, code: areas.code, name: areas.name },
        reporter: { id: users.id, name: users.name, email: users.email },
      })
      .from(issueReports)
      .leftJoin(areas, eq(areas.id, issueReports.areaId))
      .leftJoin(users, eq(users.id, issueReports.reportedBy))
      .where(where)
      .orderBy(desc(issueReports.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(issueReports).where(where),
    db.select().from(issueReports).where(where),
  ]);
  const trend = countBy(
    allRows.map((issue) => issue.createdAt.toISOString().slice(0, 10)),
  );

  return {
    items,
    summary: {
      total: allRows.length,
      bySeverity: countBy(allRows.map((issue) => issue.severity)),
      byStatus: countBy(allRows.map((issue) => issue.status)),
      trend,
    },
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

function flattenRows(value: unknown): Record<string, unknown>[] {
  const items = (value as { items?: unknown[] }).items ?? [];
  return items.map((item) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>);
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

export async function exportReport(request: Request) {
  const actor = await requireReportsExport(request);
  const { exportReportSchema } = await import("@/server/validation/reports");
  const input = exportReportSchema.parse(await request.json());
  const params = new URLSearchParams({ page: "1", limit: "100" });
  for (const [key, value] of Object.entries(input.filters)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const reportRequest = new Request(`http://qims.local/api/reports/${input.reportType}?${params.toString()}`, {
    headers: request.headers,
  });
  const data =
    input.reportType === "shift-completion"
      ? await shiftCompletionReport(reportRequest)
      : input.reportType === "task-completion"
        ? await taskCompletionReport(reportRequest)
        : input.reportType === "sop-compliance"
          ? await sopComplianceReport(reportRequest)
          : input.reportType === "skill-gap"
            ? await skillGapReport(reportRequest)
            : await issuesReport(reportRequest);
  const rows = flattenRows(data);
  const payload = input.format === "csv" ? toCsv(rows) : JSON.stringify(data, null, 2);

  await writeAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    action: "reports.export",
    entityType: "reports",
    entityId: input.reportType,
    afterValue: {
      reportType: input.reportType,
      format: input.format,
      rowCount: rows.length,
      filters: input.filters,
    },
    reason: input.reason,
    request,
  });

  return {
    reportType: input.reportType,
    format: input.format,
    rowCount: rows.length,
    content: payload,
  };
}
