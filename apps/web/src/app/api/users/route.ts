import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { ok } from "@/server/api/response";
import {
  hasUserPermission,
  requireSessionPermission,
} from "@/server/auth/session";
import {
  actorAuditFields,
  getUserById,
  listUsers,
  toAuditValue,
  upsertUserProfile,
} from "@/server/api/super-admin";
import { writeAuditLog } from "@/server/audit/log";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createUserSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    const actor = await requireSessionPermission(request, "users:read");
    return ok(
      await listUsers(request, {
        canManageAllUsers: await hasUserPermission(actor, "users:write"),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSessionPermission(request, "users:write");
    const input = createUserSchema.parse(await request.json());

    const created = await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
      },
      headers: request.headers,
    });

    let item;
    try {
      item = await db.transaction(async (tx) => {
        const [updatedUser] = await tx
          .update(users)
          .set({
            employeeId: input.employeeId ?? null,
            role: input.role,
            status: input.status,
            updatedAt: new Date(),
          })
          .where(eq(users.id, created.user.id))
          .returning();

        await upsertUserProfile(created.user.id, input.profile, tx);
        const createdItem = await getUserById(created.user.id, tx);

        await writeAuditLog({
          ...actorAuditFields(actor),
          action: "users.create",
          entityType: "users",
          entityId: created.user.id,
          afterValue: toAuditValue(createdItem),
          reason: input.reason,
          request,
        }, tx);

        if (input.role !== "inspector" || input.status !== "active") {
          await writeAuditLog({
            ...actorAuditFields(actor),
            action: "users.role_status_change",
            entityType: "users",
            entityId: created.user.id,
            beforeValue: toAuditValue({ role: "inspector", status: "active" }),
            afterValue: toAuditValue({
              role: updatedUser.role,
              status: updatedUser.status,
            }),
            reason: input.reason,
            request,
          }, tx);
        }

        return createdItem;
      });
    } catch (error) {
      // Better Auth creates the base account before QIMS profile enrichment.
      await db.delete(users).where(eq(users.id, created.user.id));
      throw error;
    }

    return ok(item, { status: 201 });
  } catch (error) {
    if (isAPIError(error)) {
      return handleApiError(
        new HttpError(error.statusCode ?? 400, "BAD_REQUEST", error.message),
      );
    }

    return handleApiError(error);
  }
}
