import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";

import { writeAuditLog } from "@/server/audit/log";
import { requireSession, requireSessionPermission } from "@/server/auth/session";
import { requireRole } from "@/server/auth/rbac";
import { db } from "@/server/db";
import {
  areas,
  handoverItems,
  handovers,
  inspectorSettings,
  issueEvents,
  issueReports,
  notificationRecipients,
  notifications,
  offlineDrafts,
  procedureAcknowledgements,
  procedureVersionTargets,
  procedureVersions,
  procedures,
  shifts,
  shiftAssignments,
  skillMatrix,
  taskEvents,
  tasks,
  type SkillLevel,
  type TaskPriority,
  type TaskStatus,
} from "@/server/db/schema";
import { HttpError } from "./http-error";
import { paginationMeta, parsePagination } from "./pagination";
import { toAuditValue } from "./super-admin";

export async function requireInspector(request: Request) {
  const actor = await requireSession(request);
  requireRole(actor, ["inspector"]);
  return actor;
}

export async function requireOwnTaskPermission(request: Request) {
  const actor = await requireSessionPermission(request, "tasks:update-own");
  requireRole(actor, ["inspector"]);
  return actor;
}

export async function requireOwnSopPermission(request: Request) {
  const actor = await requireSessionPermission(request, "sop:acknowledge");
  requireRole(actor, ["inspector"]);
  return actor;
}

export async function requireOwnHandoverPermission(request: Request) {
  const actor = await requireSessionPermission(request, "handover:create-own");
  requireRole(actor, ["inspector"]);
  return actor;
}

export async function requireOwnIssuePermission(request: Request) {
  const actor = await requireSessionPermission(request, "issues:create-own");
  requireRole(actor, ["inspector"]);
  return actor;
}

export async function requireOwnNotificationPermission(request: Request) {
  const actor = await requireSessionPermission(request, "notifications:read");
  requireRole(actor, ["inspector"]);
  return actor;
}

export type InspectorActor = Awaited<ReturnType<typeof requireInspector>>;

export function localWorkDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function auditInspectorWrite(input: {
  actor: InspectorActor;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
  request: Request;
}) {
  await writeAuditLog({
    actorId: input.actor.id,
    actorRole: input.actor.role,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeValue: toAuditValue(input.beforeValue),
    afterValue: toAuditValue(input.afterValue),
    reason: input.reason,
    request: input.request,
  });
}

function priorityRank(priority: TaskPriority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority];
}

function activeTaskStatus(status: TaskStatus) {
  return !["closed", "cancelled"].includes(status);
}

export async function getOwnTaskOrThrow(userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.assignedUserId, userId)))
    .limit(1);

  if (!task) {
    throw new HttpError(404, "NOT_FOUND", "Task tidak ditemukan untuk inspector ini.");
  }

  return task;
}

export async function getOwnShiftAssignmentOrThrow(userId: string, assignmentId: string) {
  const [assignment] = await db
    .select()
    .from(shiftAssignments)
    .where(and(eq(shiftAssignments.id, assignmentId), eq(shiftAssignments.userId, userId)))
    .limit(1);

  if (!assignment) {
    throw new HttpError(404, "NOT_FOUND", "Assignment tidak ditemukan.");
  }

  return assignment;
}

export async function assertInspectorAreaAccess(userId: string, areaId: string) {
  const [assignment] = await db
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.userId, userId),
        eq(shiftAssignments.areaId, areaId),
        ne(shiftAssignments.assignmentStatus, "cancelled"),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new HttpError(
      403,
      "VALIDATION_ERROR",
      "Area tidak terkait assignment inspector.",
    );
  }
}

export async function listOwnTasks(request: Request, userId: string) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { ownTaskListQuerySchema } = await import("@/server/validation/inspector");
  const query = ownTaskListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
  });
  const where = and(
    eq(tasks.assignedUserId, userId),
    query.status ? eq(tasks.status, query.status) : undefined,
  );
  const [items, total] = await Promise.all([
    db
      .select({
        task: getTableColumns(tasks),
        area: { id: areas.id, code: areas.code, name: areas.name },
      })
      .from(tasks)
      .innerJoin(areas, eq(areas.id, tasks.areaId))
      .where(where)
      .orderBy(asc(tasks.priority), asc(tasks.dueAt), desc(tasks.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(tasks).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getOwnTaskDetail(userId: string, taskId: string) {
  const task = await getOwnTaskOrThrow(userId, taskId);
  const events = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.createdAt));

  return { task, events };
}

async function inspectorContext(userId: string) {
  const assignments = await db
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.userId, userId),
        ne(shiftAssignments.assignmentStatus, "cancelled"),
      ),
    )
    .orderBy(desc(shiftAssignments.workDate));
  const skills = await db
    .select({ areaId: skillMatrix.areaId, skillLevel: skillMatrix.skillLevel })
    .from(skillMatrix)
    .where(eq(skillMatrix.userId, userId));

  return {
    areaIds: [...new Set(assignments.map((item) => item.areaId))],
    shiftIds: [...new Set(assignments.map((item) => item.shiftId))],
    skillLevels: [...new Set(skills.map((item) => item.skillLevel))],
  };
}

function targetMatchesInspector(
  target: typeof procedureVersionTargets.$inferSelect,
  context: { areaIds: string[]; shiftIds: string[]; skillLevels: SkillLevel[] },
) {
  if (target.targetType === "all_inspectors") return true;
  if (target.targetType === "area") return Boolean(target.targetId && context.areaIds.includes(target.targetId));
  if (target.targetType === "shift") return Boolean(target.targetId && context.shiftIds.includes(target.targetId));
  if (target.targetType === "skill_level") {
    return Boolean(target.targetId && context.skillLevels.includes(target.targetId as SkillLevel));
  }
  return false;
}

export async function relevantProcedureVersionIds(userId: string) {
  const context = await inspectorContext(userId);
  const targets = await db
    .select()
    .from(procedureVersionTargets)
    .orderBy(asc(procedureVersionTargets.targetType));

  return [
    ...new Set(
      targets
        .filter((target) => targetMatchesInspector(target, context))
        .map((target) => target.procedureVersionId),
    ),
  ];
}

export async function listOwnProcedures(request: Request, userId: string) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const versionIds = await relevantProcedureVersionIds(userId);
  if (versionIds.length === 0) {
    return { items: [], meta: paginationMeta(pagination.page, pagination.limit, 0) };
  }

  const rows = await db
    .select({
      procedure: getTableColumns(procedures),
      version: getTableColumns(procedureVersions),
      acknowledgement: getTableColumns(procedureAcknowledgements),
    })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .leftJoin(
      procedureAcknowledgements,
      and(
        eq(procedureAcknowledgements.procedureVersionId, procedureVersions.id),
        eq(procedureAcknowledgements.userId, userId),
      ),
    )
    .where(
      and(
        inArray(procedureVersions.id, versionIds),
        eq(procedures.status, "published"),
        isNull(procedures.archivedAt),
      ),
    )
    .orderBy(desc(procedureVersions.publishedAt), desc(procedureVersions.createdAt));

  const start = pagination.offset;
  const end = start + pagination.limit;

  return {
    items: rows.slice(start, end),
    meta: paginationMeta(pagination.page, pagination.limit, rows.length),
  };
}

export async function getOwnProcedureVersionOrThrow(userId: string, versionId: string) {
  const versionIds = await relevantProcedureVersionIds(userId);
  if (!versionIds.includes(versionId)) {
    throw new HttpError(404, "NOT_FOUND", "SOP tidak relevan untuk inspector ini.");
  }

  const [row] = await db
    .select({
      procedure: getTableColumns(procedures),
      version: getTableColumns(procedureVersions),
      acknowledgement: getTableColumns(procedureAcknowledgements),
    })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .leftJoin(
      procedureAcknowledgements,
      and(
        eq(procedureAcknowledgements.procedureVersionId, procedureVersions.id),
        eq(procedureAcknowledgements.userId, userId),
      ),
    )
    .where(
      and(
        eq(procedureVersions.id, versionId),
        eq(procedures.status, "published"),
        isNull(procedures.archivedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new HttpError(404, "NOT_FOUND", "SOP tidak ditemukan.");
  }

  return row;
}

export async function getOwnProcedureDetail(userId: string, procedureId: string) {
  const versionIds = await relevantProcedureVersionIds(userId);
  if (versionIds.length === 0) {
    throw new HttpError(404, "NOT_FOUND", "SOP tidak relevan untuk inspector ini.");
  }

  const [row] = await db
    .select({
      procedure: getTableColumns(procedures),
      version: getTableColumns(procedureVersions),
      acknowledgement: getTableColumns(procedureAcknowledgements),
    })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .leftJoin(
      procedureAcknowledgements,
      and(
        eq(procedureAcknowledgements.procedureVersionId, procedureVersions.id),
        eq(procedureAcknowledgements.userId, userId),
      ),
    )
    .where(
      and(
        eq(procedures.id, procedureId),
        inArray(procedureVersions.id, versionIds),
        eq(procedures.status, "published"),
        isNull(procedures.archivedAt),
      ),
    )
    .orderBy(desc(procedureVersions.versionNumber))
    .limit(1);

  if (!row) {
    throw new HttpError(404, "NOT_FOUND", "SOP tidak ditemukan.");
  }

  return row;
}

export async function getTodayMission(userId: string, workDate: string) {
  const [assignment] = await db
    .select({
      assignment: getTableColumns(shiftAssignments),
      shift: getTableColumns(shifts),
      area: getTableColumns(areas),
    })
    .from(shiftAssignments)
    .innerJoin(shifts, eq(shifts.id, shiftAssignments.shiftId))
    .innerJoin(areas, eq(areas.id, shiftAssignments.areaId))
    .where(
      and(
        eq(shiftAssignments.userId, userId),
        eq(shiftAssignments.workDate, workDate),
        ne(shiftAssignments.assignmentStatus, "cancelled"),
      ),
    )
    .orderBy(desc(shiftAssignments.publishedAt), desc(shiftAssignments.createdAt))
    .limit(1);

  const taskRows = await db
    .select({
      task: getTableColumns(tasks),
      area: { id: areas.id, code: areas.code, name: areas.name },
    })
    .from(tasks)
    .innerJoin(areas, eq(areas.id, tasks.areaId))
    .where(eq(tasks.assignedUserId, userId))
    .orderBy(asc(tasks.priority), asc(tasks.dueAt), desc(tasks.createdAt))
    .limit(20);
  const activeTasks = taskRows.filter((item) => activeTaskStatus(item.task.status));
  const topPriority = [...activeTasks].sort(
    (a, b) => priorityRank(a.task.priority) - priorityRank(b.task.priority),
  )[0] ?? null;

  const proceduresForInspector = await listOwnProcedures(
    new Request(`http://qims.local/api/procedures?page=1&limit=10`),
    userId,
  );
  const pendingSops = proceduresForInspector.items.filter(
    (item) => !item.acknowledgement?.understoodAt,
  );

  const latestHandovers =
    assignment?.assignment.areaId
      ? await db
          .select()
          .from(handovers)
          .where(
            and(
              eq(handovers.areaId, assignment.assignment.areaId),
              or(eq(handovers.status, "submitted"), eq(handovers.status, "read_by_next_shift")),
            ),
          )
          .orderBy(desc(handovers.submittedAt), desc(handovers.createdAt))
          .limit(3)
      : [];

  const unreadNotifications = await db
    .select({ value: count() })
    .from(notificationRecipients)
    .where(and(eq(notificationRecipients.userId, userId), isNull(notificationRecipients.readAt)));

  const [settings] = await db
    .select()
    .from(inspectorSettings)
    .where(eq(inspectorSettings.userId, userId))
    .limit(1);

  return {
    serverTime: new Date().toISOString(),
    workDate,
    assignment: assignment ?? null,
    topPriority,
    activeTasks,
    pendingSops,
    latestHandovers,
    unreadNotificationCount: unreadNotifications[0]?.value ?? 0,
    settings: settings ?? defaultInspectorSettings(userId),
    offlineCacheHints: {
      cacheable: ["assignment", "activeTasks", "pendingSops", "latestHandovers"],
      draftTypes: ["handover", "issue", "task_note"],
    },
  };
}

export function defaultInspectorSettings(userId: string) {
  return {
    userId,
    ecoModeEnabled: true,
    lowDataModeEnabled: true,
    compactModeEnabled: true,
    darkModePreferred: true,
    backgroundSyncEnabled: false,
    updatedAt: new Date(),
  };
}

export async function listOwnNotifications(request: Request, userId: string) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { notificationListQuerySchema } = await import("@/server/validation/inspector");
  const query = notificationListQuerySchema.parse({
    unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
  });
  const where = and(
    eq(notificationRecipients.userId, userId),
    query.unreadOnly ? isNull(notificationRecipients.readAt) : undefined,
  );
  const [items, total] = await Promise.all([
    db
      .select({
        recipient: getTableColumns(notificationRecipients),
        notification: getTableColumns(notifications),
      })
      .from(notificationRecipients)
      .innerJoin(notifications, eq(notifications.id, notificationRecipients.notificationId))
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(notificationRecipients).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function listOwnHandovers(request: Request, userId: string) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const assignmentRows = await db
    .select({ areaId: shiftAssignments.areaId })
    .from(shiftAssignments)
    .where(eq(shiftAssignments.userId, userId));
  const areaIds = [...new Set(assignmentRows.map((item) => item.areaId))];
  const where = or(
    eq(handovers.submittedBy, userId),
    areaIds.length > 0 ? inArray(handovers.areaId, areaIds) : undefined,
  );
  const [items, total] = await Promise.all([
    db
      .select()
      .from(handovers)
      .where(where)
      .orderBy(desc(handovers.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(handovers).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getOwnHandoverDetailOrThrow(userId: string, handoverId: string) {
  const assignmentRows = await db
    .select({ areaId: shiftAssignments.areaId })
    .from(shiftAssignments)
    .where(eq(shiftAssignments.userId, userId));
  const areaIds = [...new Set(assignmentRows.map((item) => item.areaId))];
  const [handover] = await db
    .select()
    .from(handovers)
    .where(
      and(
        eq(handovers.id, handoverId),
        or(
          eq(handovers.submittedBy, userId),
          areaIds.length > 0 ? inArray(handovers.areaId, areaIds) : undefined,
        ),
      ),
    )
    .limit(1);

  if (!handover) {
    throw new HttpError(404, "NOT_FOUND", "Handover tidak ditemukan.");
  }

  const items = await db
    .select()
    .from(handoverItems)
    .where(eq(handoverItems.handoverId, handoverId));

  return { handover, items };
}

export async function listOwnIssues(request: Request, userId: string) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const where = eq(issueReports.reportedBy, userId);
  const [items, total] = await Promise.all([
    db
      .select()
      .from(issueReports)
      .where(where)
      .orderBy(desc(issueReports.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(issueReports).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getOwnIssueDetailOrThrow(userId: string, issueId: string) {
  const [issue] = await db
    .select()
    .from(issueReports)
    .where(and(eq(issueReports.id, issueId), eq(issueReports.reportedBy, userId)))
    .limit(1);

  if (!issue) {
    throw new HttpError(404, "NOT_FOUND", "Issue tidak ditemukan.");
  }

  const events = await db
    .select()
    .from(issueEvents)
    .where(eq(issueEvents.issueId, issueId))
    .orderBy(desc(issueEvents.createdAt));

  return { issue, events };
}

export async function getOwnNotificationRecipientOrThrow(userId: string, id: string) {
  const [recipient] = await db
    .select()
    .from(notificationRecipients)
    .where(and(eq(notificationRecipients.id, id), eq(notificationRecipients.userId, userId)))
    .limit(1);

  if (!recipient) {
    throw new HttpError(404, "NOT_FOUND", "Notifikasi tidak ditemukan.");
  }

  return recipient;
}

export async function listOwnOfflineDrafts(request: Request, userId: string) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { offlineDraftListQuerySchema } = await import("@/server/validation/inspector");
  const query = offlineDraftListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    draftType: url.searchParams.get("draftType") ?? undefined,
  });
  const where = and(
    eq(offlineDrafts.userId, userId),
    query.status ? eq(offlineDrafts.status, query.status) : undefined,
    query.draftType ? eq(offlineDrafts.draftType, query.draftType) : undefined,
  );
  const [items, total] = await Promise.all([
    db
      .select()
      .from(offlineDrafts)
      .where(where)
      .orderBy(desc(offlineDrafts.updatedAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(offlineDrafts).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}
