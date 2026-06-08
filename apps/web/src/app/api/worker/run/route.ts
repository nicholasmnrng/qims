import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/server/audit/log";
import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { requireRole } from "@/server/auth/rbac";
import { db } from "@/server/db";
import { backgroundJobs, backgroundJobTypeValues } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const runJobSchema = z.object({
  jobType: z.enum(backgroundJobTypeValues),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireSession(req);
    requireRole(actor, ["super_admin"]);
    const input = runJobSchema.parse(await req.json());
    const now = new Date();

    const [job] = await db.insert(backgroundJobs).values({
      id: randomUUID(),
      jobType: input.jobType,
      payload: input.payload,
      status: "running",
      startedAt: now,
      createdBy: actor.id,
    }).returning();

    const result = {
      success: true,
      mode: "local-dev",
      message: `Local worker executed ${input.jobType}.`,
      processedAt: new Date().toISOString(),
      payload: input.payload,
    };

    const [completedJob] = await db
      .update(backgroundJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
        result,
      })
      .where(eq(backgroundJobs.id, job.id))
      .returning();

    await writeAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      action: "background_jobs.run",
      entityType: "background_jobs",
      entityId: job.id,
      afterValue: {
        jobType: input.jobType,
        status: completedJob.status,
        mode: "local-dev",
      },
      reason: "Manual local worker trigger",
      request: req,
    });

    return ok({ job: completedJob });
  } catch (error) {
    return handleApiError(error);
  }
}
