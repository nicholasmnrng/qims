import { eq } from "drizzle-orm";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createNotification,
  getProcedureVersionOrThrow,
  publishOperationalRealtime,
  requireOperationalPermission,
  resolveProcedureRecipients,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { procedureVersions, procedures } from "@/server/db/schema";
import { publishProcedureVersionSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "sop:manage");
    const { id } = await context.params;
    const input = publishProcedureVersionSchema.parse(await request.json());
    const before = await getProcedureVersionOrThrow(id);
    const version = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(procedureVersions)
        .set({
          publishedAt: new Date(),
          publishedBy: actor.id,
        })
        .where(eq(procedureVersions.id, id))
        .returning();

      await tx
        .update(procedures)
        .set({
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(procedures.id, updated.procedureId));

      await auditOperationalWrite({
        actor,
        action: "procedure_versions.publish",
        entityType: "procedure_versions",
        entityId: id,
        beforeValue: before,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });
    const recipientIds = await resolveProcedureRecipients(id);

    await createNotification({
      title: "SOP baru dipublish",
      message: "Ada SOP baru yang perlu dibaca dan dipahami.",
      type: "new_sop",
      priority: version.isCritical ? "critical" : "normal",
      entityType: "procedure_versions",
      entityId: id,
      createdBy: actor.id,
      recipientIds,
    });

    await publishOperationalRealtime({
      type: "sop.published",
      actorId: actor.id,
      userIds: recipientIds,
      roles: ["supervisor"],
      payload: {
        procedureVersionId: version.id,
        isCritical: version.isCritical,
      },
    });

    return ok({ version, recipientCount: recipientIds.length });
  } catch (error) {
    return handleApiError(error);
  }
}
