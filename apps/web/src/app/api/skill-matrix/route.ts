import { randomUUID } from "node:crypto";

import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import {
  auditOperationalWrite,
  listSkillMatrix,
  requireOperationalPermission,
} from "@/server/api/supervisor";
import { db } from "@/server/db";
import { skillMatrix } from "@/server/db/schema";
import { upsertSkillMatrixSchema } from "@/server/validation/supervisor";

export async function GET(request: Request) {
  try {
    await requireOperationalPermission(request, "skill-matrix:manage");
    return ok(await listSkillMatrix(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOperationalPermission(request, "skill-matrix:manage");
    const input = upsertSkillMatrixSchema.parse(await request.json());
    const skill = await db.transaction(async (tx) => {
      const [updated] = await tx
        .insert(skillMatrix)
        .values({
          id: randomUUID(),
          userId: input.userId,
          areaId: input.areaId,
          skillLevel: input.skillLevel,
          assessedBy: actor.id,
          assessedAt: input.assessedAt ? new Date(input.assessedAt) : new Date(),
          validUntil: input.validUntil ?? null,
          notes: input.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [skillMatrix.userId, skillMatrix.areaId],
          set: {
            skillLevel: input.skillLevel,
            assessedBy: actor.id,
            assessedAt: input.assessedAt ? new Date(input.assessedAt) : new Date(),
            validUntil: input.validUntil ?? null,
            notes: input.notes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      await auditOperationalWrite({
        actor,
        action: "skill_matrix.upsert",
        entityType: "skill_matrix",
        entityId: updated.id,
        afterValue: updated,
        reason: input.reason,
        request,
      }, tx);

      return updated;
    });

    return ok(skill);
  } catch (error) {
    return handleApiError(error);
  }
}
