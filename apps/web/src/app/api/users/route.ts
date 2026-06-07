import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import { auth } from "@/server/auth";
import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { ok } from "@/server/api/response";
import {
  actorAuditFields,
  getUserById,
  listUsers,
  requireSuperAdmin,
  toAuditValue,
  upsertUserProfile,
} from "@/server/api/super-admin";
import { writeAuditLog } from "@/server/audit/log";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createUserSchema } from "@/server/validation/super-admin";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    return ok(await listUsers(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdmin(request);
    const input = createUserSchema.parse(await request.json());

    const created = await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
      },
      headers: request.headers,
    });

    const [updatedUser] = await db
      .update(users)
      .set({
        employeeId: input.employeeId ?? null,
        role: input.role,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, created.user.id))
      .returning();

    await upsertUserProfile(created.user.id, input.profile);

    const item = await getUserById(created.user.id);

    await writeAuditLog({
      ...actorAuditFields(actor),
      action: "users.create",
      entityType: "users",
      entityId: created.user.id,
      afterValue: toAuditValue(item),
      reason: input.reason,
      request,
    });

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
      });
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
