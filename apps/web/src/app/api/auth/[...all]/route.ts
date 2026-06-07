import { toNextJsHandler } from "better-auth/next-js";

import { handleApiError } from "@/server/api/errors";
import { assertRateLimit } from "@/server/api/rate-limit";
import { auth } from "@/server/auth";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request) {
  try {
    assertRateLimit(request, {
      namespace: "auth.native-post",
      limit: 30,
      windowMs: 60_000,
    });
    return handlers.POST(request);
  } catch (error) {
    return handleApiError(error);
  }
}
