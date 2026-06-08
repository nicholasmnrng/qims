import { NextRequest } from "next/server";
import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { AuthError } from "@/server/auth/rbac";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { backgroundJobs } from "@/server/db/schema";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const actor = await requireSession(req);
    const { id } = await context.params;
    const [job] = await db.select().from(backgroundJobs).where(eq(backgroundJobs.id, id));

    if (!job) {
      throw new HttpError(404, "NOT_FOUND", "Export job tidak ditemukan.");
    }

    if (job.createdBy !== actor.id && actor.role !== "super_admin") {
      throw new AuthError("FORBIDDEN", "Anda tidak memiliki akses ke job ini.");
    }

    return ok({ job });
  } catch (error) {
    return handleApiError(error);
  }
}
