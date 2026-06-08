import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { backgroundJobs } from "@/server/db/schema";
import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireReportsExport, exportReport } from "@/server/api/reports";
import { eq } from "drizzle-orm";
import { z } from "zod";

const createJobSchema = z.object({
  reportType: z.enum(["shift-completion", "task-completion", "sop-compliance", "skill-gap", "issues"]),
  format: z.enum(["csv", "json"]).default("csv"),
  filters: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: NextRequest) {
  try {
    const actor = await requireReportsExport(req);
    const input = createJobSchema.parse(await req.json());
    const startedAt = new Date();
    const id = randomUUID();

    const [job] = await db.insert(backgroundJobs).values({
      id,
      jobType: "export_report",
      payload: input,
      status: "running",
      startedAt,
      createdBy: actor.id,
    }).returning();

    try {
      const reportRequest = new Request(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(input),
      });
      const report = await exportReport(reportRequest);
      const [completedJob] = await db.update(backgroundJobs).set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
        result: {
          downloadUrl: `/api/reports/export-jobs/${job.id}/download`,
          reportType: report.reportType,
          format: report.format,
          rowCount: report.rowCount,
          content: report.content,
        },
      }).where(eq(backgroundJobs.id, job.id)).returning();

      return ok({ job: completedJob });
    } catch (error) {
      await db.update(backgroundJobs).set({
        status: "failed",
        completedAt: new Date(),
        updatedAt: new Date(),
        error: error instanceof Error ? error.message : "Export job failed.",
      }).where(eq(backgroundJobs.id, job.id));
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
