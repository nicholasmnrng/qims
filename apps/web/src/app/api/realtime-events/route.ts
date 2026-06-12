import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { requireSessionPermission } from "@/server/auth/session";
import { areaChannel, roleChannel, userChannel } from "@/server/contracts/realtime";
import { db } from "@/server/db";
import { shiftAssignments } from "@/server/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { listRealtimeEvents } from "@/server/runtime/realtime-events";

export async function GET(request: Request) {
  try {
    const actor = await requireSessionPermission(request, "notifications:read");
    const channels = [userChannel(actor.id), roleChannel(actor.role)];
    if (actor.role === "inspector") {
      const assignments = await db
        .select({ areaId: shiftAssignments.areaId })
        .from(shiftAssignments)
        .where(
          and(
            eq(shiftAssignments.userId, actor.id),
            ne(shiftAssignments.assignmentStatus, "cancelled"),
          ),
        );
      channels.push(
        ...assignments.map((assignment) => areaChannel(assignment.areaId)),
      );
    }
    return ok(await listRealtimeEvents(request, channels));
  } catch (error) {
    return handleApiError(error);
  }
}
