import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  hasUserPermission,
  requireSessionPermission,
} from "@/server/auth/session";
import { AuthError } from "@/server/auth/rbac";
import {
  actorAuditFields,
  getUserById,
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
    const actor = await requireSessionPermission(request, "users:read");
    const { id } = await context.params;
    const item = await getUserById(id);
    if (
      !(await hasUserPermission(actor, "users:write")) &&
      item.user.role !== "inspector"
    ) {
      throw new AuthError(
        "FORBIDDEN",
        "Role ini hanya dapat membaca data Inspector.",
      );
    }
    return ok(item);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const actor = await requireSessionPermission(request, "users:write");
    const { id } = await context.params;
    const input = updateUserSchema.parse(await request.json());
    const before = await getUserById(id);

    const values: UpdateUserValues & { updatedAt?: Date } = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.employeeId !== undefined) values.employeeId = input.employeeId;
    if (input.role !== undefined) values.role = input.role;
    if (input.status !== undefined) values.status = input.status;

    const after = await db.transaction(async (tx) => {
      if (Object.keys(values).length > 0) {
        values.updatedAt = new Date();
        await tx.update(users).set(values).where(eq(users.id, id));
      }

      await upsertUserProfile(id, input.profile, tx);
      const updated = await getUserById(id, tx);

      await writeAuditLog({
        ...actorAuditFields(actor),
        action: "users.update",
        entityType: "users",
        entityId: id,
        beforeValue: toAuditValue(before),
        afterValue: toAuditValue(updated),
        reason: input.reason,
        request,
      }, tx);

      if (
        before.user.role !== updated.user.role ||
        before.user.status !== updated.user.status
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
            role: updated.user.role,
            status: updated.user.status,
          }),
          reason: input.reason,
          request,
        }, tx);
      }

      return updated;
    });

    return ok(after);
  } catch (error) {
    return handleApiError(error);
  }
}
