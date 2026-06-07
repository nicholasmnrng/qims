import "../src/server/load-env";

import { db } from "../src/server/db";
import {
  permissions as permissionsTable,
  rolePermissions,
  roles,
  shifts,
  systemSettings,
  type UserRole,
} from "../src/server/db/schema";
import {
  permissions,
  rolePermissionMap,
  type Permission,
} from "../src/server/auth/permissions";

const roleRows: Array<{
  id: UserRole;
  name: string;
  description: string;
}> = [
  {
    id: "super_admin",
    name: "Super Admin",
    description: "Konfigurasi sistem, role, permission, master data, dan audit log.",
  },
  {
    id: "qa_manager",
    name: "QA Manager",
    description: "Monitoring operation, compliance SOP, laporan, tren, dan export.",
  },
  {
    id: "supervisor",
    name: "Supervisor / Leader",
    description: "Operasional harian inspector, schedule, task, SOP, handover, dan issue.",
  },
  {
    id: "inspector",
    name: "Inspector",
    description: "Pengguna lapangan untuk task, SOP acknowledgement, handover, dan issue.",
  },
  {
    id: "auditor",
    name: "Auditor / Viewer",
    description: "Read-only report, audit trail, dan SOP acknowledgement.",
  },
];

const defaultShiftRows = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    name: "Shift Pagi",
    startTime: "07:00",
    endTime: "19:00",
    timezone: "Asia/Makassar",
    status: "active" as const,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Shift Malam",
    startTime: "19:00",
    endTime: "07:00",
    timezone: "Asia/Makassar",
    status: "active" as const,
  },
];

async function seed() {
  await db
    .insert(roles)
    .values(roleRows)
    .onConflictDoNothing();

  await db
    .insert(permissionsTable)
    .values(
      permissions.map((permission) => ({
        id: permission,
        description: `QIMS permission: ${permission}`,
      })),
    )
    .onConflictDoNothing();

  const mappings = Object.entries(rolePermissionMap).flatMap(
    ([roleId, rolePermissionsForRole]) =>
      rolePermissionsForRole.map((permissionId: Permission) => ({
        roleId: roleId as UserRole,
        permissionId,
      })),
  );

  await db.insert(rolePermissions).values(mappings).onConflictDoNothing();

  await db.insert(shifts).values(defaultShiftRows).onConflictDoNothing();

  await db
    .insert(systemSettings)
    .values({
      key: "system.defaults",
      value: {
        timezone: "Asia/Makassar",
        language: "id",
        ecoModeDefault: true,
      },
    })
    .onConflictDoNothing();
}

seed()
  .then(() => {
    console.log("QIMS backend foundation seed completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("QIMS backend foundation seed failed.");
    console.error(error);
    process.exit(1);
  });
