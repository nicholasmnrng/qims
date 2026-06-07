import {
  boolean,
  date,
  index,
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

export const userRoleEnum = pgEnum("user_role", userRoleValues);
export const userStatusEnum = pgEnum("user_status", userStatusValues);
export const masterStatusEnum = pgEnum("master_status", masterStatusValues);
export const skillLevelEnum = pgEnum("skill_level", skillLevelValues);

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
};

export type UserRole = (typeof userRoleValues)[number];
export type UserStatus = (typeof userStatusValues)[number];
export type MasterStatus = (typeof masterStatusValues)[number];
export type SkillLevel = (typeof skillLevelValues)[number];
