import "../src/server/load-env";

import { eq } from "drizzle-orm";

import { auth } from "../src/server/auth";
import { db } from "../src/server/db";
import {
  permissions as permissionsTable,
  rolePermissions,
  roles,
  shifts,
  systemSettings,
  users,
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

const demoPassword = process.env.QIMS_DEMO_PASSWORD ?? "QimsDemo123!";
const seedDemoUsers = process.argv.includes("--demo-users");

const demoUsers: Array<{
  name: string;
  email: string;
  employeeId: string;
  role: UserRole;
}> = [
  {
    name: "Cladtek Super Admin",
    email: "superadmin@qims.local",
    employeeId: "CLADTEK-SA-001",
    role: "super_admin",
  },
  {
    name: "Cladtek QA Manager",
    email: "qamanager@qims.local",
    employeeId: "CLADTEK-QA-001",
    role: "qa_manager",
  },
  {
    name: "Cladtek Supervisor",
    email: "supervisor@qims.local",
    employeeId: "CLADTEK-SPV-001",
    role: "supervisor",
  },
  {
    name: "Cladtek Inspector",
    email: "inspector@qims.local",
    employeeId: "CLADTEK-INS-001",
    role: "inspector",
  },
  {
    name: "Cladtek Auditor",
    email: "auditor@qims.local",
    employeeId: "CLADTEK-AUD-001",
    role: "auditor",
  },
];

async function seedDemoUser(user: (typeof demoUsers)[number]) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, user.email))
    .limit(1);

  const userId =
    existing?.id ??
    (
      await auth.api.signUpEmail({
        body: {
          name: user.name,
          email: user.email,
          password: demoPassword,
        },
        headers: new Headers(),
      })
    ).user.id;

  await db
    .update(users)
    .set({
      name: user.name,
      employeeId: user.employeeId,
      role: user.role,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

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

  if (seedDemoUsers) {
    for (const user of demoUsers) {
      await seedDemoUser(user);
    }
  }
}

seed()
  .then(() => {
    console.log(
      seedDemoUsers
        ? "Cladtek Quality Inspector seed completed with demo users."
        : "Cladtek Quality Inspector backend foundation seed completed.",
    );
    if (seedDemoUsers) {
      console.log(`Demo password: ${demoPassword}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("Cladtek Quality Inspector backend foundation seed failed.");
    console.error(error);
    process.exit(1);
  });
