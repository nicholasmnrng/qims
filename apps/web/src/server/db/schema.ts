import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleValues = [
  "super_admin",
  "qa_manager",
  "supervisor",
  "inspector",
  "auditor",
] as const;

export const userStatusValues = ["active", "inactive", "suspended"] as const;
export const masterStatusValues = ["active", "inactive", "archived"] as const;
export const skillLevelValues = [
  "not_trained",
  "beginner",
  "intermediate",
  "competent",
  "expert",
  "trainer",
] as const;
export const assignmentStatusValues = ["draft", "published", "cancelled"] as const;
export const taskStatusValues = [
  "draft",
  "assigned",
  "acknowledged",
  "in_progress",
  "blocked",
  "done",
  "verified",
  "closed",
  "cancelled",
] as const;
export const taskPriorityValues = ["critical", "high", "medium", "low"] as const;
export const procedureStatusValues = ["draft", "in_review", "published", "archived"] as const;
export const procedureCategoryValues = [
  "safety",
  "inspection_method",
  "production_update",
  "emergency_instruction",
  "general_announcement",
] as const;
export const procedureTargetTypeValues = [
  "all_inspectors",
  "area",
  "shift",
  "skill_level",
] as const;
export const handoverStatusValues = [
  "draft",
  "submitted",
  "read_by_next_shift",
  "acknowledged",
  "closed",
] as const;
export const handoverItemCategoryValues = [
  "area_condition",
  "completed_work",
  "pending_work",
  "blocker",
  "safety_concern",
  "special_note",
] as const;
export const issueCategoryValues = [
  "quality_issue",
  "safety_concern",
  "manpower_shortage",
  "equipment_issue",
  "sop_deviation",
  "production_constraint",
  "other",
] as const;
export const issueSeverityValues = ["critical", "high", "medium", "low"] as const;
export const issueStatusValues = [
  "open",
  "under_review",
  "action_required",
  "resolved",
  "closed",
  "rejected",
] as const;
export const notificationTypeValues = [
  "schedule_update",
  "priority_change",
  "new_sop",
  "sop_reminder",
  "handover_reminder",
  "issue_alert",
  "assignment_change",
  "system_alert",
] as const;
export const notificationPriorityValues = ["critical", "high", "normal", "low"] as const;
export const notificationDeliveryStatusValues = [
  "pending",
  "sent",
  "delivered",
  "failed",
] as const;
export const offlineDraftTypeValues = ["handover", "issue", "task_note"] as const;
export const offlineDraftStatusValues = [
  "pending",
  "synced",
  "conflict",
  "failed",
] as const;

export const userRoleEnum = pgEnum("user_role", userRoleValues);
export const userStatusEnum = pgEnum("user_status", userStatusValues);
export const masterStatusEnum = pgEnum("master_status", masterStatusValues);
export const skillLevelEnum = pgEnum("skill_level", skillLevelValues);
export const assignmentStatusEnum = pgEnum("assignment_status", assignmentStatusValues);
export const taskStatusEnum = pgEnum("task_status", taskStatusValues);
export const taskPriorityEnum = pgEnum("task_priority", taskPriorityValues);
export const procedureStatusEnum = pgEnum("procedure_status", procedureStatusValues);
export const procedureCategoryEnum = pgEnum("procedure_category", procedureCategoryValues);
export const procedureTargetTypeEnum = pgEnum(
  "procedure_target_type",
  procedureTargetTypeValues,
);
export const handoverStatusEnum = pgEnum("handover_status", handoverStatusValues);
export const handoverItemCategoryEnum = pgEnum(
  "handover_item_category",
  handoverItemCategoryValues,
);
export const issueCategoryEnum = pgEnum("issue_category", issueCategoryValues);
export const issueSeverityEnum = pgEnum("issue_severity", issueSeverityValues);
export const issueStatusEnum = pgEnum("issue_status", issueStatusValues);
export const notificationTypeEnum = pgEnum("notification_type", notificationTypeValues);
export const notificationPriorityEnum = pgEnum(
  "notification_priority",
  notificationPriorityValues,
);
export const notificationDeliveryStatusEnum = pgEnum(
  "notification_delivery_status",
  notificationDeliveryStatusValues,
);
export const offlineDraftTypeEnum = pgEnum("offline_draft_type", offlineDraftTypeValues);
export const offlineDraftStatusEnum = pgEnum(
  "offline_draft_status",
  offlineDraftStatusValues,
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    employeeId: text("employee_id"),
    role: userRoleEnum("role").notNull().default("inspector"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_employee_id_idx").on(table.employeeId),
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
    index("users_created_at_idx").on(table.createdAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    index("accounts_provider_idx").on(table.providerId, table.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    index("verifications_expires_at_idx").on(table.expiresAt),
  ],
);

export const sites = pgTable(
  "sites",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sites_code_idx").on(table.code),
    index("sites_status_idx").on(table.status),
    index("sites_created_at_idx").on(table.createdAt),
  ],
);

export const departments = pgTable(
  "departments",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("departments_code_idx").on(table.code),
    index("departments_status_idx").on(table.status),
    index("departments_created_at_idx").on(table.createdAt),
  ],
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: text("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    position: text("position"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    joinDate: date("join_date"),
    activeSiteId: text("active_site_id").references(() => sites.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_profiles_user_id_idx").on(table.userId),
    index("user_profiles_department_id_idx").on(table.departmentId),
    index("user_profiles_active_site_id_idx").on(table.activeSiteId),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    siteId: text("site_id").references(() => sites.id, { onDelete: "set null" }),
    minimumSkillLevel: skillLevelEnum("minimum_skill_level")
      .notNull()
      .default("not_trained"),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("areas_code_idx").on(table.code),
    index("areas_site_id_idx").on(table.siteId),
    index("areas_status_idx").on(table.status),
    index("areas_created_at_idx").on(table.createdAt),
  ],
);

export const shifts = pgTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    timezone: text("timezone").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shifts_name_idx").on(table.name),
    index("shifts_status_idx").on(table.status),
  ],
);

export const roles = pgTable("roles", {
  id: userRoleEnum("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isSystem: boolean("is_system").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: userRoleEnum("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionId],
      name: "role_permissions_pk",
    }),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorRole: userRoleEnum("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    beforeValue: jsonb("before_value").$type<Record<string, unknown> | null>(),
    afterValue: jsonb("after_value").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_id_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const systemSettings = pgTable(
  "system_settings",
  {
    key: text("key").primaryKey(),
    value: jsonb("value").$type<Record<string, unknown>>().notNull(),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("system_settings_updated_by_idx").on(table.updatedBy),
    index("system_settings_updated_at_idx").on(table.updatedAt),
  ],
);

export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    shiftId: text("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    areaId: text("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "restrict" }),
    workDate: date("work_date").notNull(),
    assignmentStatus: assignmentStatusEnum("assignment_status")
      .notNull()
      .default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("shift_assignments_user_id_idx").on(table.userId),
    index("shift_assignments_shift_id_idx").on(table.shiftId),
    index("shift_assignments_area_id_idx").on(table.areaId),
    index("shift_assignments_work_date_idx").on(table.workDate),
    index("shift_assignments_status_idx").on(table.assignmentStatus),
    index("shift_assignments_created_at_idx").on(table.createdAt),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    areaId: text("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "restrict" }),
    assignedUserId: text("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    shiftAssignmentId: text("shift_assignment_id").references(
      () => shiftAssignments.id,
      { onDelete: "set null" },
    ),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    status: taskStatusEnum("status").notNull().default("draft"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    attachmentUrl: text("attachment_url"),
    checklist: jsonb("checklist").$type<Array<{ label: string; done?: boolean }>>(),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_area_id_idx").on(table.areaId),
    index("tasks_assigned_user_id_idx").on(table.assignedUserId),
    index("tasks_shift_assignment_id_idx").on(table.shiftAssignmentId),
    index("tasks_status_idx").on(table.status),
    index("tasks_priority_idx").on(table.priority),
    index("tasks_created_at_idx").on(table.createdAt),
  ],
);

export const taskEvents = pgTable(
  "task_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    oldValue: jsonb("old_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    reason: text("reason"),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_events_task_id_idx").on(table.taskId),
    index("task_events_actor_id_idx").on(table.actorId),
    index("task_events_created_at_idx").on(table.createdAt),
  ],
);

export const skillMatrix = pgTable(
  "skill_matrix",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    areaId: text("area_id")
      .notNull()
      .references(() => areas.id, { onDelete: "cascade" }),
    skillLevel: skillLevelEnum("skill_level").notNull().default("not_trained"),
    assessedBy: text("assessed_by").references(() => users.id, { onDelete: "set null" }),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    validUntil: date("valid_until"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("skill_matrix_user_area_idx").on(table.userId, table.areaId),
    index("skill_matrix_user_id_idx").on(table.userId),
    index("skill_matrix_area_id_idx").on(table.areaId),
    index("skill_matrix_skill_level_idx").on(table.skillLevel),
  ],
);

export const procedures = pgTable(
  "procedures",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    category: procedureCategoryEnum("category").notNull(),
    status: procedureStatusEnum("status").notNull().default("draft"),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("procedures_status_idx").on(table.status),
    index("procedures_category_idx").on(table.category),
    index("procedures_owner_id_idx").on(table.ownerId),
    index("procedures_created_at_idx").on(table.createdAt),
  ],
);

export const procedureVersions = pgTable(
  "procedure_versions",
  {
    id: text("id").primaryKey(),
    procedureId: text("procedure_id")
      .notNull()
      .references(() => procedures.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content"),
    attachmentUrl: text("attachment_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    effectiveDate: date("effective_date"),
    isCritical: boolean("is_critical").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("procedure_versions_procedure_id_idx").on(table.procedureId),
    index("procedure_versions_published_at_idx").on(table.publishedAt),
  ],
);

export const procedureVersionTargets = pgTable(
  "procedure_version_targets",
  {
    id: text("id").primaryKey(),
    procedureVersionId: text("procedure_version_id")
      .notNull()
      .references(() => procedureVersions.id, { onDelete: "cascade" }),
    targetType: procedureTargetTypeEnum("target_type").notNull(),
    targetId: text("target_id"),
  },
  (table) => [
    index("procedure_version_targets_version_id_idx").on(table.procedureVersionId),
    index("procedure_version_targets_target_idx").on(table.targetType, table.targetId),
  ],
);

export const procedureAcknowledgements = pgTable(
  "procedure_acknowledgements",
  {
    id: text("id").primaryKey(),
    procedureVersionId: text("procedure_version_id")
      .notNull()
      .references(() => procedureVersions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    understoodAt: timestamp("understood_at", { withTimezone: true }),
    criticalConfirmedAt: timestamp("critical_confirmed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("procedure_ack_user_version_idx").on(
      table.userId,
      table.procedureVersionId,
    ),
    index("procedure_ack_version_id_idx").on(table.procedureVersionId),
    index("procedure_ack_user_id_idx").on(table.userId),
    index("procedure_ack_read_at_idx").on(table.readAt),
  ],
);

export const handovers = pgTable(
  "handovers",
  {
    id: text("id").primaryKey(),
    fromShiftAssignmentId: text("from_shift_assignment_id").references(
      () => shiftAssignments.id,
      { onDelete: "set null" },
    ),
    toShiftId: text("to_shift_id").references(() => shifts.id, { onDelete: "set null" }),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    submittedBy: text("submitted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    status: handoverStatusEnum("status").notNull().default("draft"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by").references(() => users.id, {
      onDelete: "set null",
    }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("handovers_from_shift_assignment_id_idx").on(table.fromShiftAssignmentId),
    index("handovers_to_shift_id_idx").on(table.toShiftId),
    index("handovers_area_id_idx").on(table.areaId),
    index("handovers_status_idx").on(table.status),
  ],
);

export const issueReports = pgTable(
  "issue_reports",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    category: issueCategoryEnum("category").notNull(),
    severity: issueSeverityEnum("severity").notNull().default("medium"),
    status: issueStatusEnum("status").notNull().default("open"),
    areaId: text("area_id").references(() => areas.id, { onDelete: "set null" }),
    taskId: text("task_id").references(() => tasks.id, { onDelete: "set null" }),
    shiftAssignmentId: text("shift_assignment_id").references(
      () => shiftAssignments.id,
      { onDelete: "set null" },
    ),
    reportedBy: text("reported_by").references(() => users.id, { onDelete: "set null" }),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    attachmentUrl: text("attachment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("issue_reports_area_id_idx").on(table.areaId),
    index("issue_reports_task_id_idx").on(table.taskId),
    index("issue_reports_shift_assignment_id_idx").on(table.shiftAssignmentId),
    index("issue_reports_reported_by_idx").on(table.reportedBy),
    index("issue_reports_status_idx").on(table.status),
    index("issue_reports_severity_idx").on(table.severity),
    index("issue_reports_created_at_idx").on(table.createdAt),
  ],
);

export const handoverItems = pgTable(
  "handover_items",
  {
    id: text("id").primaryKey(),
    handoverId: text("handover_id")
      .notNull()
      .references(() => handovers.id, { onDelete: "cascade" }),
    category: handoverItemCategoryEnum("category").notNull(),
    note: text("note").notNull(),
    severity: issueSeverityEnum("severity").default("low"),
    attachmentUrl: text("attachment_url"),
    relatedTaskId: text("related_task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    relatedIssueId: text("related_issue_id").references(() => issueReports.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("handover_items_handover_id_idx").on(table.handoverId),
    index("handover_items_related_task_id_idx").on(table.relatedTaskId),
    index("handover_items_related_issue_id_idx").on(table.relatedIssueId),
  ],
);

export const issueEvents = pgTable(
  "issue_events",
  {
    id: text("id").primaryKey(),
    issueId: text("issue_id")
      .notNull()
      .references(() => issueReports.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    oldValue: jsonb("old_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    note: text("note"),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("issue_events_issue_id_idx").on(table.issueId),
    index("issue_events_actor_id_idx").on(table.actorId),
    index("issue_events_created_at_idx").on(table.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").notNull(),
    priority: notificationPriorityEnum("priority").notNull().default("normal"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_type_idx").on(table.type),
    index("notifications_priority_idx").on(table.priority),
    index("notifications_entity_idx").on(table.entityType, table.entityId),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
);

export const notificationRecipients = pgTable(
  "notification_recipients",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deliveryStatus: notificationDeliveryStatusEnum("delivery_status")
      .notNull()
      .default("pending"),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("notification_recipients_notification_id_idx").on(table.notificationId),
    index("notification_recipients_user_id_idx").on(table.userId),
    index("notification_recipients_delivery_status_idx").on(table.deliveryStatus),
  ],
);

export const offlineDrafts = pgTable(
  "offline_drafts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDraftId: text("local_draft_id").notNull(),
    draftType: offlineDraftTypeEnum("draft_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: offlineDraftStatusEnum("status").notNull().default("pending"),
    syncedEntityType: text("synced_entity_type"),
    syncedEntityId: text("synced_entity_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    clientUpdatedAt: timestamp("client_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("offline_drafts_user_local_idx").on(table.userId, table.localDraftId),
    index("offline_drafts_user_id_idx").on(table.userId),
    index("offline_drafts_status_idx").on(table.status),
    index("offline_drafts_type_idx").on(table.draftType),
    index("offline_drafts_updated_at_idx").on(table.updatedAt),
  ],
);

export const inspectorSettings = pgTable(
  "inspector_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    ecoModeEnabled: boolean("eco_mode_enabled").notNull().default(true),
    lowDataModeEnabled: boolean("low_data_mode_enabled").notNull().default(true),
    compactModeEnabled: boolean("compact_mode_enabled").notNull().default(true),
    darkModePreferred: boolean("dark_mode_preferred").notNull().default(true),
    backgroundSyncEnabled: boolean("background_sync_enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("inspector_settings_updated_at_idx").on(table.updatedAt)],
);

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
  sites,
  departments,
  userProfiles,
  areas,
  shifts,
  roles,
  permissions,
  rolePermissions,
  auditLogs,
  systemSettings,
  shiftAssignments,
  tasks,
  taskEvents,
  skillMatrix,
  procedures,
  procedureVersions,
  procedureVersionTargets,
  procedureAcknowledgements,
  handovers,
  handoverItems,
  issueReports,
  issueEvents,
  notifications,
  notificationRecipients,
  offlineDrafts,
  inspectorSettings,
};

export type UserRole = (typeof userRoleValues)[number];
export type UserStatus = (typeof userStatusValues)[number];
export type MasterStatus = (typeof masterStatusValues)[number];
export type SkillLevel = (typeof skillLevelValues)[number];
export type TaskStatus = (typeof taskStatusValues)[number];
export type TaskPriority = (typeof taskPriorityValues)[number];
export type IssueStatus = (typeof issueStatusValues)[number];
export type OfflineDraftType = (typeof offlineDraftTypeValues)[number];
export type OfflineDraftStatus = (typeof offlineDraftStatusValues)[number];
