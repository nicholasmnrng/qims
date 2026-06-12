import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  ne,
  or,
} from "drizzle-orm";

import { writeAuditLog } from "@/server/audit/log";
import { requireSessionPermission } from "@/server/auth/session";
import {
  areaChannel,
  roleChannel,
  userChannel,
  type RealtimeEventType,
} from "@/server/contracts/realtime";
import { db } from "@/server/db";
import {
  areas,
  handoverItems,
  handovers,
  issueEvents,
  issueReports,
  notificationRecipients,
  notifications,
  procedureVersionTargets,
  procedureVersions,
  procedures,
  shifts,
  shiftAssignments,
  skillLevelValues,
  skillMatrix,
  taskEvents,
  tasks,
  users,
  type SkillLevel,
  type TaskPriority,
  type TaskStatus,
} from "@/server/db/schema";
import { HttpError } from "./http-error";
import { paginationMeta, parsePagination } from "./pagination";
import {
  publishRealtimeEvent,
  publishRealtimeEventToChannels,
} from "@/server/runtime/realtime-events";
import { actorAuditFields, toAuditValue } from "./super-admin";

export async function requireOperationalPermission(
  request: Request,
  permission:
    | "schedule:manage"
    | "tasks:manage"
    | "sop:manage"
    | "skill-matrix:manage"
    | "handover:manage"
    | "issues:manage"
    | "notifications:read",
) {
  return requireSessionPermission(request, permission);
}

export type OperationalActor = Awaited<ReturnType<typeof requireOperationalPermission>>;
type OperationalDatabase = Pick<typeof db, "insert" | "select" | "update">;

export const skillRank: Record<SkillLevel, number> = {
  not_trained: 0,
  beginner: 1,
  intermediate: 2,
  competent: 3,
  expert: 4,
  trainer: 5,
};

export function isSkillSufficient(actual: SkillLevel | null, minimum: SkillLevel) {
  return skillRank[actual ?? "not_trained"] >= skillRank[minimum];
}

export async function getAssignmentConflicts(input: {
  userId: string;
  areaId: string;
  workDate: string;
  excludeAssignmentId?: string;
}) {
  const conflicts: Array<{ type: string; message: string }> = [];
  const [inspector] = await db
    .select({
      id: users.id,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!inspector) {
    conflicts.push({ type: "inspector_not_found", message: "Inspector tidak ditemukan." });
  } else {
    if (inspector.role !== "inspector") {
      conflicts.push({
        type: "not_inspector",
        message: "User yang dipilih bukan role Inspector.",
      });
    }
    if (inspector.status !== "active") {
      conflicts.push({
        type: "inspector_inactive",
        message: "Inspector sedang tidak aktif.",
      });
    }
  }

  const [area] = await db
    .select({
      id: areas.id,
      minimumSkillLevel: areas.minimumSkillLevel,
      status: areas.status,
    })
    .from(areas)
    .where(eq(areas.id, input.areaId))
    .limit(1);

  if (!area) {
    conflicts.push({ type: "area_not_found", message: "Area tidak ditemukan." });
  } else if (area.status !== "active") {
    conflicts.push({ type: "area_inactive", message: "Area tidak aktif." });
  }

  const existing = await db
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.userId, input.userId),
        eq(shiftAssignments.workDate, input.workDate),
        ne(shiftAssignments.assignmentStatus, "cancelled"),
        input.excludeAssignmentId
          ? ne(shiftAssignments.id, input.excludeAssignmentId)
          : undefined,
      ),
    );

  if (existing.length > 0) {
    conflicts.push({
      type: "double_assignment",
      message: "Inspector sudah memiliki assignment pada tanggal tersebut.",
    });
  }

  if (area) {
    const [skill] = await db
      .select({ skillLevel: skillMatrix.skillLevel })
      .from(skillMatrix)
      .where(
        and(
          eq(skillMatrix.userId, input.userId),
          eq(skillMatrix.areaId, input.areaId),
        ),
      )
      .limit(1);

    if (!isSkillSufficient(skill?.skillLevel ?? null, area.minimumSkillLevel)) {
      conflicts.push({
        type: "skill_mismatch",
        message: "Skill inspector belum memenuhi minimum area.",
      });
    }
  }

  return conflicts;
}

export async function getMissingAreaCoverage(workDate: string) {
  const activeAreas = await db
    .select({ id: areas.id, code: areas.code, name: areas.name })
    .from(areas)
    .where(eq(areas.status, "active"));
  const assignedAreas = await db
    .select({ areaId: shiftAssignments.areaId })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.workDate, workDate),
        ne(shiftAssignments.assignmentStatus, "cancelled"),
      ),
    );
  const assignedIds = new Set(assignedAreas.map((item) => item.areaId));

  return activeAreas
    .filter((area) => !assignedIds.has(area.id))
    .map((area) => ({
      type: "area_without_inspector",
      areaId: area.id,
      message: `Area ${area.code} - ${area.name} belum memiliki inspector.`,
    }));
}

export async function createNotification(input: {
  title: string;
  message: string;
  type:
    | "schedule_update"
    | "priority_change"
    | "new_sop"
    | "issue_alert"
    | "assignment_change"
    | "system_alert";
  priority?: "critical" | "high" | "normal" | "low";
  entityType?: string;
  entityId?: string;
  createdBy: string;
  recipientIds: string[];
}) {
  if (input.recipientIds.length === 0) {
    return null;
  }

  const notificationId = randomUUID();
  const recipientIds = [...new Set(input.recipientIds)];
  await db.transaction(async (tx) => {
    await tx.insert(notifications).values({
      id: notificationId,
      title: input.title,
      message: input.message,
      type: input.type,
      priority: input.priority ?? "normal",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      createdBy: input.createdBy,
    });
    await tx.insert(notificationRecipients).values(
      recipientIds.map((userId) => ({
        id: randomUUID(),
        notificationId,
        userId,
      })),
    );
  });

  await Promise.all(
    recipientIds.map((userId) =>
      publishRealtimeEvent({
        type: "notification.created",
        channel: userChannel(userId),
        actorId: input.createdBy,
        payload: {
          notificationId,
          notificationType: input.type,
          priority: input.priority ?? "normal",
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          title: input.title,
        },
      }),
    ),
  );

  return notificationId;
}

export async function notifyActiveSupervisors(input: {
  title: string;
  message: string;
  type: "issue_alert" | "system_alert";
  priority?: "critical" | "high" | "normal" | "low";
  entityType?: string;
  entityId?: string;
  createdBy: string;
}) {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "supervisor"), eq(users.status, "active")));

  return createNotification({
    ...input,
    recipientIds: recipients.map((recipient) => recipient.id),
  });
}

export async function publishOperationalRealtime(input: {
  type: RealtimeEventType;
  actorId: string;
  payload: Record<string, unknown>;
  userIds?: Array<string | null | undefined>;
  areaIds?: Array<string | null | undefined>;
  roles?: string[];
}) {
  return publishRealtimeEventToChannels({
    type: input.type,
    actorId: input.actorId,
    payload: input.payload,
    channels: [
      ...(input.userIds ?? [])
        .filter((value): value is string => Boolean(value))
        .map(userChannel),
      ...(input.areaIds ?? [])
        .filter((value): value is string => Boolean(value))
        .map(areaChannel),
      ...(input.roles ?? []).map(roleChannel),
    ],
  });
}

export async function writeTaskEvent(input: {
  taskId: string;
  eventType: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  actorId: string;
}, database: OperationalDatabase = db) {
  await database.insert(taskEvents).values({
    id: randomUUID(),
    taskId: input.taskId,
    eventType: input.eventType,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    reason: input.reason ?? null,
    actorId: input.actorId,
  });
}

export async function writeIssueEvent(input: {
  issueId: string;
  eventType: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  note?: string | null;
  actorId: string;
}, database: OperationalDatabase = db) {
  await database.insert(issueEvents).values({
    id: randomUUID(),
    issueId: input.issueId,
    eventType: input.eventType,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    note: input.note ?? null,
    actorId: input.actorId,
  });
}

export async function getTaskOrThrow(id: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) throw new HttpError(404, "NOT_FOUND", "Task tidak ditemukan.");
  return task;
}

export async function getIssueOrThrow(id: string) {
  const [issue] = await db
    .select()
    .from(issueReports)
    .where(eq(issueReports.id, id))
    .limit(1);
  if (!issue) throw new HttpError(404, "NOT_FOUND", "Issue tidak ditemukan.");
  return issue;
}

export async function getProcedureOrThrow(id: string) {
  const [procedure] = await db
    .select()
    .from(procedures)
    .where(eq(procedures.id, id))
    .limit(1);
  if (!procedure) throw new HttpError(404, "NOT_FOUND", "SOP tidak ditemukan.");
  return procedure;
}

export async function getProcedureVersionOrThrow(id: string) {
  const [version] = await db
    .select()
    .from(procedureVersions)
    .where(eq(procedureVersions.id, id))
    .limit(1);
  if (!version) throw new HttpError(404, "NOT_FOUND", "Versi SOP tidak ditemukan.");
  return version;
}

export async function nextProcedureVersionNumber(procedureId: string) {
  const [result] = await db
    .select({ value: max(procedureVersions.versionNumber) })
    .from(procedureVersions)
    .where(eq(procedureVersions.procedureId, procedureId));
  return (result?.value ?? 0) + 1;
}

export async function createSopTargets(input: {
  procedureVersionId: string;
  targets: Array<{
    targetType: (typeof procedureVersionTargets.$inferInsert)["targetType"];
    targetId?: string | null;
  }>;
}, database: OperationalDatabase = db) {
  await database.insert(procedureVersionTargets).values(
    input.targets.map((target) => ({
      id: randomUUID(),
      procedureVersionId: input.procedureVersionId,
      targetType: target.targetType,
      targetId: target.targetId ?? null,
    })),
  );
}

export async function auditOperationalWrite(input: {
  actor: OperationalActor;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason: string;
  request: Request;
}, database: OperationalDatabase = db) {
  await writeAuditLog({
    ...actorAuditFields(input.actor),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeValue: toAuditValue(input.beforeValue),
    afterValue: toAuditValue(input.afterValue),
    reason: input.reason,
    request: input.request,
  }, database);
}

export function taskClosedAt(status: TaskStatus) {
  return status === "closed" || status === "cancelled" ? new Date() : null;
}

export function notificationPriorityForTask(priority: TaskPriority) {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  return "normal";
}

function operationalFilterParams(request: Request) {
  const url = new URL(request.url);
  return {
    pagination: parsePagination(url.searchParams),
    filters: {
      areaId: url.searchParams.get("areaId") ?? undefined,
      shiftId: url.searchParams.get("shiftId") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      workDate: url.searchParams.get("workDate") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      skillLevel: url.searchParams.get("skillLevel") ?? undefined,
    },
  };
}

export async function listShiftAssignments(request: Request) {
  const { listShiftAssignmentsQuerySchema } = await import(
    "@/server/validation/supervisor"
  );
  const { pagination, filters } = operationalFilterParams(request);
  const query = listShiftAssignmentsQuerySchema.parse(filters);
  const where = and(
    query.areaId ? eq(shiftAssignments.areaId, query.areaId) : undefined,
    query.shiftId ? eq(shiftAssignments.shiftId, query.shiftId) : undefined,
    query.userId ? eq(shiftAssignments.userId, query.userId) : undefined,
    query.workDate ? eq(shiftAssignments.workDate, query.workDate) : undefined,
    query.dateFrom ? gte(shiftAssignments.workDate, query.dateFrom) : undefined,
    query.dateTo ? lte(shiftAssignments.workDate, query.dateTo) : undefined,
    query.status ? eq(shiftAssignments.assignmentStatus, query.status) : undefined,
    query.skillLevel ? eq(skillMatrix.skillLevel, query.skillLevel) : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select({
        assignment: getTableColumns(shiftAssignments),
        inspector: {
          id: users.id,
          name: users.name,
          email: users.email,
          status: users.status,
        },
        area: {
          id: areas.id,
          code: areas.code,
          name: areas.name,
          minimumSkillLevel: areas.minimumSkillLevel,
        },
        shift: {
          id: shifts.id,
          name: shifts.name,
          startTime: shifts.startTime,
          endTime: shifts.endTime,
        },
        skill: {
          level: skillMatrix.skillLevel,
          validUntil: skillMatrix.validUntil,
        },
      })
      .from(shiftAssignments)
      .innerJoin(users, eq(users.id, shiftAssignments.userId))
      .innerJoin(areas, eq(areas.id, shiftAssignments.areaId))
      .innerJoin(shifts, eq(shifts.id, shiftAssignments.shiftId))
      .leftJoin(
        skillMatrix,
        and(
          eq(skillMatrix.userId, shiftAssignments.userId),
          eq(skillMatrix.areaId, shiftAssignments.areaId),
        ),
      )
      .where(where)
      .orderBy(desc(shiftAssignments.workDate), asc(shifts.startTime), asc(areas.name))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db
      .select({ value: count() })
      .from(shiftAssignments)
      .leftJoin(
        skillMatrix,
        and(
          eq(skillMatrix.userId, shiftAssignments.userId),
          eq(skillMatrix.areaId, shiftAssignments.areaId),
        ),
      )
      .where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getShiftAssignmentOrThrow(id: string) {
  const [assignment] = await db
    .select()
    .from(shiftAssignments)
    .where(eq(shiftAssignments.id, id))
    .limit(1);

  if (!assignment) {
    throw new HttpError(404, "NOT_FOUND", "Assignment tidak ditemukan.");
  }

  return assignment;
}

export async function listTasks(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { listByOperationalFiltersSchema } = await import(
    "@/server/validation/supervisor"
  );
  const query = listByOperationalFiltersSchema.parse({
    areaId: url.searchParams.get("areaId") ?? undefined,
    userId: url.searchParams.get("assignedUserId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  const priority = url.searchParams.get("priority");
  const q = url.searchParams.get("q");
  const where = and(
    query.areaId ? eq(tasks.areaId, query.areaId) : undefined,
    query.userId ? eq(tasks.assignedUserId, query.userId) : undefined,
    query.status ? eq(tasks.status, query.status as never) : undefined,
    priority ? eq(tasks.priority, priority as never) : undefined,
    q
      ? or(ilike(tasks.title, `%${q}%`), ilike(tasks.description, `%${q}%`))
      : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select({
        task: getTableColumns(tasks),
        area: { id: areas.id, code: areas.code, name: areas.name },
        assignedUser: { id: users.id, name: users.name, email: users.email },
      })
      .from(tasks)
      .innerJoin(areas, eq(areas.id, tasks.areaId))
      .leftJoin(users, eq(users.id, tasks.assignedUserId))
      .where(where)
      .orderBy(
        desc(tasks.priority),
        asc(tasks.status),
        desc(tasks.createdAt),
      )
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(tasks).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getTaskDetail(id: string) {
  const [task] = await db
    .select({
      task: getTableColumns(tasks),
      area: { id: areas.id, code: areas.code, name: areas.name },
      assignedUser: { id: users.id, name: users.name, email: users.email },
    })
    .from(tasks)
    .innerJoin(areas, eq(areas.id, tasks.areaId))
    .leftJoin(users, eq(users.id, tasks.assignedUserId))
    .where(eq(tasks.id, id))
    .limit(1);

  if (!task) throw new HttpError(404, "NOT_FOUND", "Task tidak ditemukan.");

  const events = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, id))
    .orderBy(desc(taskEvents.createdAt));

  return { ...task, events };
}

export async function listProcedures(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const q = url.searchParams.get("q");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const where = and(
    status ? eq(procedures.status, status as never) : undefined,
    category ? eq(procedures.category, category as never) : undefined,
    q ? ilike(procedures.title, `%${q}%`) : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select()
      .from(procedures)
      .where(where)
      .orderBy(desc(procedures.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(procedures).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getProcedureDetail(id: string) {
  const procedure = await getProcedureOrThrow(id);
  const versions = await db
    .select()
    .from(procedureVersions)
    .where(eq(procedureVersions.procedureId, id))
    .orderBy(desc(procedureVersions.versionNumber));

  const targets =
    versions.length === 0
      ? []
      : await db
          .select()
          .from(procedureVersionTargets)
          .where(
            inArray(
              procedureVersionTargets.procedureVersionId,
              versions.map((version) => version.id),
            ),
          )
          .orderBy(asc(procedureVersionTargets.targetType));

  return { procedure, versions, targets };
}

export async function listSkillMatrix(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { listSkillMatrixQuerySchema } = await import(
    "@/server/validation/supervisor"
  );
  const query = listSkillMatrixQuerySchema.parse({
    areaId: url.searchParams.get("areaId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
  });
  const where = and(
    query.areaId ? eq(skillMatrix.areaId, query.areaId) : undefined,
    query.userId ? eq(skillMatrix.userId, query.userId) : undefined,
    query.level ? eq(skillMatrix.skillLevel, query.level) : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select({
        skill: getTableColumns(skillMatrix),
        inspector: { id: users.id, name: users.name, email: users.email },
        area: {
          id: areas.id,
          code: areas.code,
          name: areas.name,
          minimumSkillLevel: areas.minimumSkillLevel,
        },
      })
      .from(skillMatrix)
      .innerJoin(users, eq(users.id, skillMatrix.userId))
      .innerJoin(areas, eq(areas.id, skillMatrix.areaId))
      .where(where)
      .orderBy(asc(areas.name), asc(users.name))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(skillMatrix).where(where),
  ]);

  const gaps = items
    .filter((item) => !isSkillSufficient(item.skill.skillLevel, item.area.minimumSkillLevel))
    .map((item) => ({
      userId: item.skill.userId,
      areaId: item.skill.areaId,
      skillLevel: item.skill.skillLevel,
      minimumSkillLevel: item.area.minimumSkillLevel,
    }));

  return {
    items,
    gaps,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getInspectorSkills(userId: string) {
  return db
    .select({
      skill: getTableColumns(skillMatrix),
      area: {
        id: areas.id,
        code: areas.code,
        name: areas.name,
        minimumSkillLevel: areas.minimumSkillLevel,
      },
    })
    .from(skillMatrix)
    .innerJoin(areas, eq(areas.id, skillMatrix.areaId))
    .where(eq(skillMatrix.userId, userId))
    .orderBy(asc(areas.name));
}

export async function listHandovers(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { listHandoversQuerySchema } = await import(
    "@/server/validation/supervisor"
  );
  const query = listHandoversQuerySchema.parse({
    areaId: url.searchParams.get("areaId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
  });
  const where = and(
    query.areaId ? eq(handovers.areaId, query.areaId) : undefined,
    query.status ? eq(handovers.status, query.status) : undefined,
    query.dateFrom
      ? gte(handovers.createdAt, new Date(`${query.dateFrom}T00:00:00.000Z`))
      : undefined,
    query.dateTo
      ? lte(handovers.createdAt, new Date(`${query.dateTo}T23:59:59.999Z`))
      : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select({
        handover: getTableColumns(handovers),
        area: { id: areas.id, code: areas.code, name: areas.name },
        submittedByUser: { id: users.id, name: users.name, email: users.email },
      })
      .from(handovers)
      .leftJoin(areas, eq(areas.id, handovers.areaId))
      .leftJoin(users, eq(users.id, handovers.submittedBy))
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

export async function getHandoverDetail(id: string) {
  const [handover] = await db
    .select()
    .from(handovers)
    .where(eq(handovers.id, id))
    .limit(1);

  if (!handover) throw new HttpError(404, "NOT_FOUND", "Handover tidak ditemukan.");

  const items = await db
    .select()
    .from(handoverItems)
    .where(eq(handoverItems.handoverId, id));

  return { handover, items };
}

export async function listIssues(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { listIssuesQuerySchema } = await import("@/server/validation/supervisor");
  const query = listIssuesQuerySchema.parse({
    areaId: url.searchParams.get("areaId") ?? undefined,
    shiftAssignmentId: url.searchParams.get("shiftAssignmentId") ?? undefined,
    severity: url.searchParams.get("severity") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
  });
  const where = and(
    query.areaId ? eq(issueReports.areaId, query.areaId) : undefined,
    query.shiftAssignmentId
      ? eq(issueReports.shiftAssignmentId, query.shiftAssignmentId)
      : undefined,
    query.severity ? eq(issueReports.severity, query.severity) : undefined,
    query.status ? eq(issueReports.status, query.status) : undefined,
    query.dateFrom
      ? gte(issueReports.createdAt, new Date(`${query.dateFrom}T00:00:00.000Z`))
      : undefined,
    query.dateTo
      ? lte(issueReports.createdAt, new Date(`${query.dateTo}T23:59:59.999Z`))
      : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select({
        issue: getTableColumns(issueReports),
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
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getIssueDetail(id: string) {
  const issue = await getIssueOrThrow(id);
  const events = await db
    .select()
    .from(issueEvents)
    .where(eq(issueEvents.issueId, id))
    .orderBy(desc(issueEvents.createdAt));

  return { issue, events };
}

export async function listNotificationRecords(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { listNotificationRecordsQuerySchema } = await import(
    "@/server/validation/supervisor"
  );
  const query = listNotificationRecordsQuerySchema.parse({
    type: url.searchParams.get("type") ?? undefined,
    priority: url.searchParams.get("priority") ?? undefined,
    recipientUserId: url.searchParams.get("recipientUserId") ?? undefined,
    deliveryStatus: url.searchParams.get("deliveryStatus") ?? undefined,
    readStatus: url.searchParams.get("readStatus") ?? undefined,
    acknowledgementStatus:
      url.searchParams.get("acknowledgementStatus") ?? undefined,
  });
  const hasRecipientFilter = Boolean(
    query.recipientUserId ||
      query.deliveryStatus ||
      query.readStatus ||
      query.acknowledgementStatus,
  );
  let matchingNotificationIds: string[] | undefined;
  if (hasRecipientFilter) {
    const matches = await db
      .select({ notificationId: notificationRecipients.notificationId })
      .from(notificationRecipients)
      .where(
        and(
          query.recipientUserId
            ? eq(notificationRecipients.userId, query.recipientUserId)
            : undefined,
          query.deliveryStatus
            ? eq(notificationRecipients.deliveryStatus, query.deliveryStatus)
            : undefined,
          query.readStatus === "read"
            ? isNotNull(notificationRecipients.readAt)
            : query.readStatus === "unread"
              ? isNull(notificationRecipients.readAt)
              : undefined,
          query.acknowledgementStatus === "acknowledged"
            ? isNotNull(notificationRecipients.acknowledgedAt)
            : query.acknowledgementStatus === "pending"
              ? isNull(notificationRecipients.acknowledgedAt)
              : undefined,
        ),
      );
    matchingNotificationIds = [
      ...new Set(matches.map((match) => match.notificationId)),
    ];
    if (matchingNotificationIds.length === 0) {
      return {
        items: [],
        meta: paginationMeta(pagination.page, pagination.limit, 0),
      };
    }
  }
  const where = and(
    query.type ? eq(notifications.type, query.type) : undefined,
    query.priority ? eq(notifications.priority, query.priority) : undefined,
    matchingNotificationIds
      ? inArray(notifications.id, matchingNotificationIds)
      : undefined,
  );

  const [notificationRows, total] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(notifications).where(where),
  ]);
  const recipientRows =
    notificationRows.length === 0
      ? []
      : await db
          .select({
            recipient: getTableColumns(notificationRecipients),
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
            },
          })
          .from(notificationRecipients)
          .innerJoin(users, eq(users.id, notificationRecipients.userId))
          .where(
            inArray(
              notificationRecipients.notificationId,
              notificationRows.map((notification) => notification.id),
            ),
          )
          .orderBy(asc(users.name));
  const recipientsByNotification = new Map<
    string,
    typeof recipientRows
  >();
  for (const row of recipientRows) {
    const current =
      recipientsByNotification.get(row.recipient.notificationId) ?? [];
    current.push(row);
    recipientsByNotification.set(row.recipient.notificationId, current);
  }
  const items = notificationRows.map((notification) => {
    const recipients = recipientsByNotification.get(notification.id) ?? [];
    return {
      notification,
      recipients,
      summary: {
        total: recipients.length,
        delivered: recipients.filter(
          (row) => row.recipient.deliveryStatus === "delivered",
        ).length,
        failed: recipients.filter(
          (row) => row.recipient.deliveryStatus === "failed",
        ).length,
        read: recipients.filter((row) => row.recipient.readAt).length,
        acknowledged: recipients.filter(
          (row) => row.recipient.acknowledgedAt,
        ).length,
      },
    };
  });

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function resolveProcedureRecipients(versionId: string) {
  const targets = await db
    .select()
    .from(procedureVersionTargets)
    .where(eq(procedureVersionTargets.procedureVersionId, versionId));

  if (targets.some((target) => target.targetType === "all_inspectors")) {
    const inspectors = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "inspector"), eq(users.status, "active")));
    return inspectors.map((inspector) => inspector.id);
  }

  const recipientIds = new Set<string>();
  const areaIds = targets
    .filter((target) => target.targetType === "area" && target.targetId)
    .map((target) => target.targetId as string);
  const shiftIds = targets
    .filter((target) => target.targetType === "shift" && target.targetId)
    .map((target) => target.targetId as string);
  const levelTargets = targets
    .filter((target) => target.targetType === "skill_level" && target.targetId)
    .map((target) => target.targetId as SkillLevel)
    .filter((level): level is SkillLevel => skillLevelValues.includes(level));

  if (areaIds.length > 0) {
    const areaSkills = await db
      .select({ userId: skillMatrix.userId })
      .from(skillMatrix)
      .where(inArray(skillMatrix.areaId, areaIds));
    areaSkills.forEach((skill) => recipientIds.add(skill.userId));
  }

  if (shiftIds.length > 0) {
    const shiftUsers = await db
      .select({ userId: shiftAssignments.userId })
      .from(shiftAssignments)
      .where(inArray(shiftAssignments.shiftId, shiftIds));
    shiftUsers.forEach((assignment) => recipientIds.add(assignment.userId));
  }

  if (levelTargets.length > 0) {
    const levelUsers = await db
      .select({ userId: skillMatrix.userId })
      .from(skillMatrix)
      .where(inArray(skillMatrix.skillLevel, levelTargets));
    levelUsers.forEach((skill) => recipientIds.add(skill.userId));
  }

  return [...recipientIds];
}
