import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  actorAuditFields,
  getUserById,
  requireSuperAdmin,
  toAuditValue,
  upsertUserProfile,
  type UpdateUserValues,
} from "@/server/api/super-admin";
import { writeAuditLog } from "@/server/audit/log";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { updateUserSchema } from "@/server/validation/super-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireSuperAdmin(request);
    const { id } = await context.params;
    return ok(await getUserById(id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireSuperAdmin(request);
    const { id } = await context.params;
    const input = updateUserSchema.parse(await request.json());
    const before = await getUserById(id);

    const values: UpdateUserValues & { updatedAt?: Date } = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.employeeId !== undefined) values.employeeId = input.employeeId;
    if (input.role !== undefined) values.role = input.role;
    if (input.status !== undefined) values.status = input.status;

    if (Object.keys(values).length > 0) {
      values.updatedAt = new Date();
      await db.update(users).set(values).where(eq(users.id, id));
    }

    await upsertUserProfile(id, input.profile);
    const after = await getUserById(id);

    await writeAuditLog({
      ...actorAuditFields(actor),
      action: "users.update",
      entityType: "users",
      entityId: id,
      beforeValue: toAuditValue(before),
      afterValue: toAuditValue(after),
      reason: input.reason,
      request,
    });

    if (
      before.user.role !== after.user.role ||
      before.user.status !== after.user.status
    ) {
      await writeAuditLog({
        ...actorAuditFields(actor),
        action: "users.role_status_change",
        entityType: "users",
        entityId: id,
        beforeValue: toAuditValue({
          role: before.user.role,
          status: before.user.status,
        }),
        afterValue: toAuditValue({
          role: after.user.role,
          status: after.user.status,
        }),
        reason: input.reason,
        request,
      });
    }

    return ok(after);
  } catch (error) {
    return handleApiError(error);
  }
}
