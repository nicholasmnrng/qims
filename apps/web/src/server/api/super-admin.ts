import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
} from "drizzle-orm";

import { writeAuditLog } from "@/server/audit/log";
import { requireSessionPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  areas,
  auditLogs,
  departments,
  permissions,
  rolePermissions,
  roles,
  shifts,
  sites,
  systemSettings,
  userProfiles,
  users,
  type MasterStatus,
  type UserRole,
  type UserStatus,
} from "@/server/db/schema";
import { HttpError } from "./http-error";
import { paginationMeta, parsePagination } from "./pagination";

export async function requireSuperAdmin(request: Request) {
  return requireSessionPermission(request, "roles:manage");
}

export function toAuditValue(value: unknown) {
  if (!value) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

export function actorAuditFields(actor: Awaited<ReturnType<typeof requireSuperAdmin>>) {
  return {
    actorId: actor.id,
    actorRole: actor.role,
  };
}

export async function listUsers(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { userListQuerySchema } = await import("@/server/validation/super-admin");
  const query = userListQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  const where = and(
    query.role ? eq(users.role, query.role) : undefined,
    query.status ? eq(users.status, query.status) : undefined,
    query.q
      ? or(
          ilike(users.name, `%${query.q}%`),
          ilike(users.email, `%${query.q}%`),
          ilike(users.employeeId, `%${query.q}%`),
        )
      : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select({
        user: getTableColumns(users),
        profile: getTableColumns(userProfiles),
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(users).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getUserById(id: string) {
  const [item] = await db
    .select({
      user: getTableColumns(users),
      profile: getTableColumns(userProfiles),
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, id))
    .limit(1);

  if (!item) {
    throw new HttpError(404, "NOT_FOUND", "User tidak ditemukan.");
  }

  return item;
}

export async function upsertUserProfile(
  userId: string,
  profile:
    | {
        departmentId?: string | null;
        position?: string | null;
        phone?: string | null;
        avatarUrl?: string | null;
        joinDate?: string | null;
        activeSiteId?: string | null;
      }
    | undefined,
) {
  if (!profile) {
    return;
  }

  const [existing] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  const values = {
    departmentId: profile.departmentId ?? null,
    position: profile.position ?? null,
    phone: profile.phone ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    joinDate: profile.joinDate ?? null,
    activeSiteId: profile.activeSiteId ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(userProfiles).set(values).where(eq(userProfiles.id, existing.id));
    return;
  }

  await db.insert(userProfiles).values({
    id: randomUUID(),
    userId,
    ...values,
  });
}

export async function createMasterRecord<T extends "sites" | "departments" | "areas" | "shifts">(
  tableName: T,
  values: Record<string, unknown>,
  actor: Awaited<ReturnType<typeof requireSuperAdmin>>,
  request: Request,
  reason: string,
) {
  const tableMap = { sites, departments, areas, shifts } as const;
  const table = tableMap[tableName];
  const id = randomUUID();
  const insertValues = { id, ...values };

  const [created] = await db.insert(table).values(insertValues as never).returning();

  await writeAuditLog({
    ...actorAuditFields(actor),
    action: `${tableName}.create`,
    entityType: tableName,
    entityId: id,
    afterValue: toAuditValue(created),
    reason,
    request,
  });

  return created;
}

export async function listSimpleMasterData(
  tableName: "sites" | "departments" | "areas" | "shifts",
  request: Request,
) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { masterListQuerySchema } = await import("@/server/validation/super-admin");
  const query = masterListQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  if (tableName === "sites") {
    const where = and(
      query.status ? eq(sites.status, query.status) : undefined,
      query.q
        ? or(ilike(sites.name, `%${query.q}%`), ilike(sites.code, `%${query.q}%`))
        : undefined,
    );
    const [items, total] = await Promise.all([
      db.select().from(sites).where(where).orderBy(asc(sites.name)).limit(pagination.limit).offset(pagination.offset),
      db.select({ value: count() }).from(sites).where(where),
    ]);

    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
    };
  }

  if (tableName === "departments") {
    const where = and(
      query.status ? eq(departments.status, query.status) : undefined,
      query.q
        ? or(
            ilike(departments.name, `%${query.q}%`),
            ilike(departments.code, `%${query.q}%`),
          )
        : undefined,
    );
    const [items, total] = await Promise.all([
      db
        .select()
        .from(departments)
        .where(where)
        .orderBy(asc(departments.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ value: count() }).from(departments).where(where),
    ]);

    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
    };
  }

  if (tableName === "areas") {
    const where = and(
      query.status ? eq(areas.status, query.status) : undefined,
      query.q
        ? or(ilike(areas.name, `%${query.q}%`), ilike(areas.code, `%${query.q}%`))
        : undefined,
    );
    const [items, total] = await Promise.all([
      db.select().from(areas).where(where).orderBy(asc(areas.name)).limit(pagination.limit).offset(pagination.offset),
      db.select({ value: count() }).from(areas).where(where),
    ]);

    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
    };
  }

  const where = and(
    query.status ? eq(shifts.status, query.status) : undefined,
    query.q ? ilike(shifts.name, `%${query.q}%`) : undefined,
  );

  const [items, total] = await Promise.all([
    db.select().from(shifts).where(where).orderBy(asc(shifts.name)).limit(pagination.limit).offset(pagination.offset),
    db.select({ value: count() }).from(shifts).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function getMasterRecord(
  tableName: "sites" | "departments" | "areas" | "shifts",
  id: string,
) {
  const tableMap = { sites, departments, areas, shifts } as const;
  const table = tableMap[tableName];
  const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1);

  if (!record) {
    throw new HttpError(404, "NOT_FOUND", "Master data tidak ditemukan.");
  }

  return record;
}

export async function updateMasterRecord(
  tableName: "sites" | "departments" | "areas" | "shifts",
  id: string,
  values: Record<string, unknown>,
  reason: string,
  actor: Awaited<ReturnType<typeof requireSuperAdmin>>,
  request: Request,
) {
  const tableMap = { sites, departments, areas, shifts } as const;
  const table = tableMap[tableName];
  const before = await getMasterRecord(tableName, id);
  const [updated] = await db
    .update(table)
    .set({ ...values, updatedAt: new Date() } as never)
    .where(eq(table.id, id))
    .returning();

  await writeAuditLog({
    ...actorAuditFields(actor),
    action: `${tableName}.update`,
    entityType: tableName,
    entityId: id,
    beforeValue: toAuditValue(before),
    afterValue: toAuditValue(updated),
    reason,
    request,
  });

  return updated;
}

export async function listRoles() {
  const rows = await db
    .select({
      role: getTableColumns(roles),
      permissionId: rolePermissions.permissionId,
    })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .orderBy(asc(roles.name), asc(rolePermissions.permissionId));

  const grouped = new Map<UserRole, { role: typeof rows[number]["role"]; permissions: string[] }>();

  for (const row of rows) {
    const current =
      grouped.get(row.role.id) ??
      {
        role: row.role,
        permissions: [],
      };

    if (row.permissionId) {
      current.permissions.push(row.permissionId);
    }

    grouped.set(row.role.id, current);
  }

  return [...grouped.values()];
}

export async function listPermissions() {
  return db.select().from(permissions).orderBy(asc(permissions.id));
}

export async function updateRolePermissions(
  roleId: UserRole,
  permissionIds: string[],
  reason: string,
  actor: Awaited<ReturnType<typeof requireSuperAdmin>>,
  request: Request,
) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);

  if (!role) {
    throw new HttpError(404, "NOT_FOUND", "Role tidak ditemukan.");
  }

  const before = await db
    .select()
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId))
    .orderBy(asc(rolePermissions.permissionId));

  const after = await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await tx.insert(rolePermissions).values(
      permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    );

    return tx
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId))
      .orderBy(asc(rolePermissions.permissionId));
  });

  await writeAuditLog({
    ...actorAuditFields(actor),
    action: "roles.permissions_update",
    entityType: "roles",
    entityId: roleId,
    beforeValue: toAuditValue({ permissions: before }),
    afterValue: toAuditValue({ permissions: after }),
    reason,
    request,
  });

  return {
    role,
    permissions: after.map((item) => item.permissionId),
  };
}

export async function listAuditLogs(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { auditLogListQuerySchema } = await import("@/server/validation/super-admin");
  const query = auditLogListQuerySchema.parse({
    actorId: url.searchParams.get("actorId") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
  });
  const where = and(
    query.actorId ? eq(auditLogs.actorId, query.actorId) : undefined,
    query.action ? eq(auditLogs.action, query.action) : undefined,
    query.entityType ? eq(auditLogs.entityType, query.entityType) : undefined,
    query.entityId ? eq(auditLogs.entityId, query.entityId) : undefined,
  );

  const [items, total] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset),
    db.select({ value: count() }).from(auditLogs).where(where),
  ]);

  return {
    items,
    meta: paginationMeta(pagination.page, pagination.limit, total[0]?.value ?? 0),
  };
}

export async function listSystemSettings() {
  return db.select().from(systemSettings).orderBy(asc(systemSettings.key));
}

export async function upsertSystemSetting(
  key: string,
  value: Record<string, unknown>,
  reason: string,
  actor: Awaited<ReturnType<typeof requireSuperAdmin>>,
  request: Request,
) {
  const [before] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  const [updated] = await db
    .insert(systemSettings)
    .values({
      key,
      value,
      updatedBy: actor.id,
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value,
        updatedBy: actor.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  await writeAuditLog({
    ...actorAuditFields(actor),
    action: "system_settings.upsert",
    entityType: "system_settings",
    entityId: key,
    beforeValue: toAuditValue(before),
    afterValue: toAuditValue(updated),
    reason,
    request,
  });

  return updated;
}

export type UpdateUserValues = {
  name?: string;
  employeeId?: string | null;
  role?: UserRole;
  status?: UserStatus;
};

export type MasterStatusInput = MasterStatus;
