import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  createSopTargets,
  getProcedureOrThrow,
  nextProcedureVersionNumber,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { procedureVersions } from "@/server/db/schema";
import { createProcedureVersionSchema } from "@/server/validation/supervisor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireOperationalPermission(request, "sop:manage");
    const { id: procedureId } = await context.params;
    await getProcedureOrThrow(procedureId);
    const input = createProcedureVersionSchema.parse(await request.json());
    const versionId = randomUUID();
    const versionNumber = await nextProcedureVersionNumber(procedureId);
    const version = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(procedureVersions)
        .values({
          id: versionId,
          procedureId,
          versionNumber,
          content: input.content ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
          effectiveDate: input.effectiveDate ?? null,
          isCritical: input.isCritical,
        })
        .returning();

      await createSopTargets({
        procedureVersionId: versionId,
        targets: input.targets,
      }, tx);

      await auditOperationalWrite({
        actor,
        action: "procedure_versions.create",
        entityType: "procedure_versions",
        entityId: versionId,
        afterValue: { version: created, targets: input.targets },
        reason: input.reason,
        request,
      }, tx);

      return created;
    });

    return ok(version, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
