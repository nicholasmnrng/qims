import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  listProcedures,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { procedures } from "@/server/db/schema";
import { createProcedureSchema } from "@/server/validation/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "sop:manage");
    return ok(await listProcedures(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOperationalPermission(request, "sop:manage");
    const input = createProcedureSchema.parse(await request.json());
    const id = randomUUID();
    const [procedure] = await db
      .insert(procedures)
      .values({
        id,
        title: input.title,
        category: input.category,
        status: input.status,
        ownerId: actor.id,
      })
      .returning();

    await auditOperationalWrite({
      actor,
      action: "procedures.create",
      entityType: "procedures",
      entityId: id,
      afterValue: procedure,
      reason: input.reason,
      request,
    });

    return ok(procedure, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
