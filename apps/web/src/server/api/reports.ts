import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";

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
import { HttpError } from "./http-error";

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
  const url = new URL(request.url);
  const { reportFiltersSchema, toReportFilters } = await import(
    "@/server/validation/reports"
  );
  const parsedFilters = reportFiltersSchema.parse(toReportFilters(url.searchParams));
  const filters = {
    ...parsedFilters,
    dateFrom: parsedFilters.dateFrom ?? today,
    dateTo: parsedFilters.dateTo ?? today,
  };
  const activeAreas = await db
    .select({ id: areas.id, code: areas.code, name: areas.name })
    .from(areas)
    .where(
      and(
        eq(areas.status, "active"),
        filters.areaId ? eq(areas.id, filters.areaId) : undefined,
      ),
    );
  const todayAssignments = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        gte(shiftAssignments.workDate, filters.dateFrom),
        lte(shiftAssignments.workDate, filters.dateTo),
        filters.shiftId ? eq(shiftAssignments.shiftId, filters.shiftId) : undefined,
        filters.areaId ? eq(shiftAssignments.areaId, filters.areaId) : undefined,
        filters.inspectorId
          ? eq(shiftAssignments.userId, filters.inspectorId)
          : undefined,
        ne(shiftAssignments.assignmentStatus, "cancelled"),
      ),
    );
  const todayTasks = await db
    .select({ task: tasks })
    .from(tasks)
    .leftJoin(
      shiftAssignments,
      eq(shiftAssignments.id, tasks.shiftAssignmentId),
    )
    .where(
      and(
        filters.dateFrom
          ? gte(tasks.createdAt, startOfDate(filters.dateFrom)!)
          : undefined,
        filters.dateTo
          ? lte(tasks.createdAt, endOfDate(filters.dateTo)!)
          : undefined,
        filters.shiftId
          ? eq(shiftAssignments.shiftId, filters.shiftId)
          : undefined,
        filters.areaId ? eq(tasks.areaId, filters.areaId) : undefined,
        filters.inspectorId
          ? eq(tasks.assignedUserId, filters.inspectorId)
          : undefined,
        filters.priority ? eq(tasks.priority, filters.priority) : undefined,
      ),
    )
    .then((rows) => rows.map((row) => row.task));
  const openTasks = todayTasks.filter((task) => !["closed", "cancelled"].includes(task.status));
  const criticalTasks = openTasks.filter((task) => task.priority === "critical");
  const issueRows = await db
    .select({ issue: issueReports })
    .from(issueReports)
    .leftJoin(
      shiftAssignments,
      eq(shiftAssignments.id, issueReports.shiftAssignmentId),
    )
    .where(
      and(
        gte(issueReports.createdAt, startOfDate(filters.dateFrom)!),
        lte(issueReports.createdAt, endOfDate(filters.dateTo)!),
        filters.shiftId
          ? eq(shiftAssignments.shiftId, filters.shiftId)
          : undefined,
        filters.areaId ? eq(issueReports.areaId, filters.areaId) : undefined,
        filters.inspectorId
          ? eq(issueReports.reportedBy, filters.inspectorId)
          : undefined,
        filters.severity
          ? eq(issueReports.severity, filters.severity)
          : undefined,
      ),
    )
    .then((rows) => rows.map((row) => row.issue));
  const handoverRows = await db
    .select()
    .from(handovers)
    .where(
      and(
        gte(handovers.createdAt, startOfDate(filters.dateFrom)!),
        lte(handovers.createdAt, endOfDate(filters.dateTo)!),
        filters.areaId ? eq(handovers.areaId, filters.areaId) : undefined,
        or(
          eq(handovers.status, "draft"),
          eq(handovers.status, "submitted"),
          eq(handovers.status, "read_by_next_shift"),
        ),
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
    filters,
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
  const { shiftCompletionReportQuerySchema, toReportFilters } = await import(
    "@/server/validation/reports"
  );
  const filters = shiftCompletionReportQuerySchema.parse(
    toReportFilters(searchParams),
  );
  const where = and(
    filters.dateFrom ? gte(shiftAssignments.workDate, filters.dateFrom) : undefined,
    filters.dateTo ? lte(shiftAssignments.workDate, filters.dateTo) : undefined,
    filters.shiftId ? eq(shiftAssignments.shiftId, filters.shiftId) : undefined,
    filters.areaId ? eq(shiftAssignments.areaId, filters.areaId) : undefined,
    filters.inspectorId ? eq(shiftAssignments.userId, filters.inspectorId) : undefined,
    filters.status ? eq(shiftAssignments.assignmentStatus, filters.status as never) : undefined,
  );
  const [items, total] = await Promise.all([
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
  ]);
  const taskRows =
    items.length === 0
      ? []
      : await db
          .select()
          .from(tasks)
          .where(
            inArray(
              tasks.shiftAssignmentId,
              items.map((item) => item.assignment.id),
            ),
          );
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
    filters.shiftId ? eq(shiftAssignments.shiftId, filters.shiftId) : undefined,
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
      .leftJoin(
        shiftAssignments,
        eq(shiftAssignments.id, tasks.shiftAssignmentId),
      )
      .innerJoin(areas, eq(areas.id, tasks.areaId))
      .leftJoin(users, eq(users.id, tasks.assignedUserId))
      .where(where)
      .orderBy(desc(tasks.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ value: count() })
      .from(tasks)
      .leftJoin(
        shiftAssignments,
        eq(shiftAssignments.id, tasks.shiftAssignmentId),
      )
      .where(where),
    db
      .select({ task: tasks })
      .from(tasks)
      .leftJoin(
        shiftAssignments,
        eq(shiftAssignments.id, tasks.shiftAssignmentId),
      )
      .where(where)
      .then((rows) => rows.map((row) => row.task)),
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
  const { pagination, searchParams } = parseReportRequest(request);
  const { sopComplianceReportQuerySchema, toReportFilters } = await import(
    "@/server/validation/reports"
  );
  const filters = sopComplianceReportQuerySchema.parse(
    toReportFilters(searchParams),
  );
  const rows = await db
    .select({
      procedure: procedures,
      version: procedureVersions,
    })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .where(
      and(
        eq(procedures.status, "published"),
        isNull(procedures.archivedAt),
        filters.dateFrom
          ? gte(procedureVersions.publishedAt, startOfDate(filters.dateFrom)!)
          : undefined,
        filters.dateTo
          ? lte(procedureVersions.publishedAt, endOfDate(filters.dateTo)!)
          : undefined,
      ),
    )
    .orderBy(desc(procedureVersions.publishedAt), desc(procedureVersions.createdAt));
  let cohortUserIds: Set<string> | null = null;
  if (filters.inspectorId) {
    cohortUserIds = new Set([filters.inspectorId]);
  } else if (filters.areaId || filters.shiftId) {
    const cohort = await db
      .select({ userId: shiftAssignments.userId })
      .from(shiftAssignments)
      .where(
        and(
          filters.areaId
            ? eq(shiftAssignments.areaId, filters.areaId)
            : undefined,
          filters.shiftId
            ? eq(shiftAssignments.shiftId, filters.shiftId)
            : undefined,
          filters.dateFrom
            ? gte(shiftAssignments.workDate, filters.dateFrom)
            : undefined,
          filters.dateTo
            ? lte(shiftAssignments.workDate, filters.dateTo)
            : undefined,
          ne(shiftAssignments.assignmentStatus, "cancelled"),
        ),
      );
    cohortUserIds = new Set(cohort.map((row) => row.userId));
  }
  const items = [];

  for (const item of rows) {
    const resolvedRecipientIds = await resolveProcedureRecipients(item.version.id);
    const recipientIds = cohortUserIds
      ? resolvedRecipientIds.filter((userId) => cohortUserIds.has(userId))
      : resolvedRecipientIds;
    if (cohortUserIds && recipientIds.length === 0) continue;
    const acknowledgements = await db
      .select()
      .from(procedureAcknowledgements)
      .where(eq(procedureAcknowledgements.procedureVersionId, item.version.id));
    const acknowledgedUserIds = new Set(
      acknowledgements
        .filter((ack) => Boolean(ack.understoodAt))
        .map((ack) => ack.userId),
    );
    const understood = recipientIds.filter((id) =>
      acknowledgedUserIds.has(id),
    ).length;
    const metrics = {
      targetCount: recipientIds.length,
      acknowledgedCount: understood,
      pendingCount: Math.max(recipientIds.length - understood, 0),
      complianceRate: completionRate(understood, recipientIds.length),
    };
    if (filters.status === "acknowledged" && metrics.pendingCount > 0) continue;
    if (filters.status === "pending" && metrics.pendingCount === 0) continue;
    items.push({
      ...item,
      metrics,
    });
  }

  return {
    items: items.slice(pagination.offset, pagination.offset + pagination.limit),
    meta: paginationMeta(pagination.page, pagination.limit, items.length),
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
    filters.shiftId ? eq(shiftAssignments.shiftId, filters.shiftId) : undefined,
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
      .leftJoin(
        shiftAssignments,
        eq(shiftAssignments.id, issueReports.shiftAssignmentId),
      )
      .leftJoin(areas, eq(areas.id, issueReports.areaId))
      .leftJoin(users, eq(users.id, issueReports.reportedBy))
      .where(where)
      .orderBy(desc(issueReports.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ value: count() })
      .from(issueReports)
      .leftJoin(
        shiftAssignments,
        eq(shiftAssignments.id, issueReports.shiftAssignmentId),
      )
      .where(where),
    db
      .select({ issue: issueReports })
      .from(issueReports)
      .leftJoin(
        shiftAssignments,
        eq(shiftAssignments.id, issueReports.shiftAssignmentId),
      )
      .where(where)
      .then((rows) => rows.map((row) => row.issue)),
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

function reportMeta(value: unknown) {
  return (value as {
    meta?: { total?: number; totalPages?: number; page?: number; limit?: number };
  }).meta;
}

async function resolveReportData(reportType: string, request: Request) {
  return reportType === "shift-completion"
    ? shiftCompletionReport(request)
    : reportType === "task-completion"
      ? taskCompletionReport(request)
      : reportType === "sop-compliance"
        ? sopComplianceReport(request)
        : reportType === "skill-gap"
          ? skillGapReport(request)
          : issuesReport(request);
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
  const asyncExport = request.headers.get("x-qims-async-export") === "true";
  const buildReportRequest = (page: number) => {
    params.set("page", String(page));
    return new Request(
      `http://qims.local/api/reports/${input.reportType}?${params.toString()}`,
      { headers: request.headers },
    );
  };
  const firstPage = await resolveReportData(
    input.reportType,
    buildReportRequest(1),
  );
  const firstMeta = reportMeta(firstPage);
  const total = firstMeta?.total ?? flattenRows(firstPage).length;
  if (!asyncExport && total > 100) {
    throw new HttpError(
      409,
      "CONFLICT",
      "Direct export dibatasi 100 baris. Gunakan async export job.",
      { total, directExportLimit: 100 },
    );
  }
  if (asyncExport && total > 5000) {
    throw new HttpError(
      409,
      "CONFLICT",
      "Local async export dibatasi 5000 baris. Gunakan production worker.",
      { total, localAsyncExportLimit: 5000 },
    );
  }

  const rows = flattenRows(firstPage);
  const totalPages = firstMeta?.totalPages ?? 1;
  if (asyncExport) {
    for (let page = 2; page <= totalPages; page += 1) {
      const pageData = await resolveReportData(
        input.reportType,
        buildReportRequest(page),
      );
      rows.push(...flattenRows(pageData));
    }
  }
  const jsonData =
    asyncExport && totalPages > 1
      ? {
          ...(firstPage as Record<string, unknown>),
          items: rows,
          meta: {
            page: 1,
            limit: rows.length,
            total,
            totalPages: 1,
          },
        }
      : firstPage;
  const payload =
    input.format === "csv" ? toCsv(rows) : JSON.stringify(jsonData, null, 2);

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
