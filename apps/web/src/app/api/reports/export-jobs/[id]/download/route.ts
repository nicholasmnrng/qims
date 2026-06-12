import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { AuthError } from "@/server/auth/rbac";
import { requireSessionPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { backgroundJobs } from "@/server/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const actor = await requireSessionPermission(req, "reports:export");
    const { id } = await context.params;
    const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, id));

    if (!job) {
      throw new HttpError(404, "NOT_FOUND", "Export job tidak ditemukan.");
    }

    if (job.createdBy !== actor.id && actor.role !== "super_admin") {
      throw new AuthError("FORBIDDEN", "Anda tidak memiliki akses ke job ini.");
    }

    if (job.status !== "completed" || !job.result) {
      throw new HttpError(400, "BAD_REQUEST", "Export job belum selesai.");
    }

    const result = job.result as { content?: string; format?: "csv" | "json"; reportType?: string };
    const content = result.content ?? "";
    const format = result.format ?? "csv";
    
    return new NextResponse(content, {
      headers: {
        "Content-Type": format === "json" ? "application/json" : "text/csv",
        "Content-Disposition": `attachment; filename="${result.reportType ?? "export"}_${job.id}.${format}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
