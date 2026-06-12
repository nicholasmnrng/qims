import { handleApiError } from "@/server/api/errors";
import { ok } from "@/server/api/response";
import { listHandovers } from "@/server/api/supervisor";
import {
  listOwnHandovers,
  requireOwnHandoverPermission,
} from "@/server/api/inspector";
import {
  createInspectorHandover,
  publishInspectorHandoverSignals,
} from "@/server/api/inspector-writes";
import { requireSession } from "@/server/auth/session";
import { requireUserPermission } from "@/server/auth/session";
import { createHandoverSchema } from "@/server/validation/inspector";

export async function GET(request: Request) {
  try {
    const actor = await requireSession(request);
    if (actor.role === "inspector") {
      await requireUserPermission(actor, "handover:create-own");
      return ok(await listOwnHandovers(request, actor.id));
    }

    await requireUserPermission(actor, "handover:manage");
    return ok(await listHandovers(request));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOwnHandoverPermission(request);
    const input = createHandoverSchema.parse(await request.json());
    const { handover, assignment } = await createInspectorHandover({
      actor,
      payload: input,
      request,
    });
    await publishInspectorHandoverSignals({
      actor,
      handover,
      assignmentWorkDate: assignment.workDate,
    });

    return ok(handover, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
