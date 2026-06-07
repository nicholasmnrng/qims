import { ZodError } from "zod";

import { AuthError } from "@/server/auth/rbac";
import { fail } from "./response";

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return fail(
      "VALIDATION_ERROR",
      "Input tidak valid.",
      422,
      error.flatten(),
    );
  }

  if (error instanceof AuthError) {
    if (error.code === "UNAUTHENTICATED") {
      return fail("UNAUTHENTICATED", error.message, 401);
    }

    if (error.code === "USER_INACTIVE") {
      return fail("FORBIDDEN", error.message, 403);
    }

    return fail("FORBIDDEN", error.message, 403);
  }

  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return fail("UNAUTHENTICATED", "Session tidak valid atau sudah berakhir.", 401);
  }

  return fail("INTERNAL_ERROR", "Terjadi kesalahan pada server.", 500);
}

export function withApiHandler<T extends Response>(
  handler: () => Promise<T>,
): Promise<T | Response> {
  return handler().catch(handleApiError);
}
