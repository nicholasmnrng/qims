import { z } from "zod";

import {
  permissions,
} from "@/server/auth/permissions";
import {
  masterStatusValues,
  skillLevelValues,
  userRoleValues,
  userStatusValues,
} from "@/server/db/schema";

const authUserIdSchema = z.string().trim().min(1).max(160);

export const userListQuerySchema = z.object({
  q: z.string().trim().optional(),
  role: z.enum(userRoleValues).optional(),
  status: z.enum(userStatusValues).optional(),
});

export const userProfileInputSchema = z.object({
  departmentId: z.string().uuid().nullable().optional(),
  position: z.string().trim().min(1).max(120).nullable().optional(),
  phone: z.string().trim().min(1).max(40).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  joinDate: z.string().date().nullable().optional(),
  activeSiteId: z.string().uuid().nullable().optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  employeeId: z.string().trim().min(1).max(80).nullable().optional(),
  role: z.enum(userRoleValues).default("inspector"),
  status: z.enum(userStatusValues).default("active"),
  profile: userProfileInputSchema.optional(),
  reason: z.string().trim().min(1).max(500),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    employeeId: z.string().trim().min(1).max(80).nullable().optional(),
    role: z.enum(userRoleValues).optional(),
    status: z.enum(userStatusValues).optional(),
    profile: userProfileInputSchema.optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.employeeId !== undefined ||
      value.role !== undefined ||
      value.status !== undefined ||
      value.profile !== undefined,
    "Minimal satu field user harus diubah.",
  );

export const masterListQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(masterStatusValues).optional(),
});

export const createSiteSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(masterStatusValues).default("active"),
  reason: z.string().trim().min(1).max(500),
});

export const updateSiteSchema = createSiteSchema
  .partial({ code: true, name: true, description: true, status: true })
  .required({ reason: true })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.status !== undefined,
    "Minimal satu field site harus diubah.",
  );

export const createDepartmentSchema = createSiteSchema;
export const updateDepartmentSchema = updateSiteSchema;

export const createAreaSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  siteId: z.string().uuid().nullable().optional(),
  minimumSkillLevel: z.enum(skillLevelValues).default("not_trained"),
  status: z.enum(masterStatusValues).default("active"),
  reason: z.string().trim().min(1).max(500),
});

export const updateAreaSchema = createAreaSchema
  .partial({
    code: true,
    name: true,
    description: true,
    siteId: true,
    minimumSkillLevel: true,
    status: true,
  })
  .required({ reason: true })
  .refine(
    (value) =>
      value.code !== undefined ||
      value.name !== undefined ||
      value.description !== undefined ||
      value.siteId !== undefined ||
      value.minimumSkillLevel !== undefined ||
      value.status !== undefined,
    "Minimal satu field area harus diubah.",
  );

export const archiveAreaSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format waktu harus HH:mm.");

export const createShiftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startTime: timeSchema,
  endTime: timeSchema,
  timezone: z.string().trim().min(1).max(80),
  status: z.enum(masterStatusValues).default("active"),
  reason: z.string().trim().min(1).max(500),
});

export const updateShiftSchema = createShiftSchema
  .partial({
    name: true,
    startTime: true,
    endTime: true,
    timezone: true,
    status: true,
  })
  .required({ reason: true })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.startTime !== undefined ||
      value.endTime !== undefined ||
      value.timezone !== undefined ||
      value.status !== undefined,
    "Minimal satu field shift harus diubah.",
  );

export const auditLogListQuerySchema = z.object({
  actorId: authUserIdSchema.optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(120).optional(),
  entityId: z.string().trim().min(1).max(160).optional(),
});

export const updateRolePermissionsSchema = z.object({
  permissionIds: z.array(z.enum(permissions)).min(1),
  reason: z.string().trim().min(1).max(500),
});

export const updateSystemSettingsSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(1).max(500),
});
