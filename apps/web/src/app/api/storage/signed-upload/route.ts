import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { hasPermission, requirePermission, type SessionUser } from "@/server/auth/rbac";
import {
  isAllowedUpload,
  storageObjectKey,
  type StorageBucket,
} from "@/server/contracts/storage";
import { signedUploadRequestSchema } from "@/server/validation/runtime";

export async function POST(request: Request) {
  try {
    const actor = await requireSession(request);
    const input = signedUploadRequestSchema.parse(await request.json());

    assertUploadPermission(actor, input.bucket);
    if (!isAllowedUpload(input)) {
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        "File type atau ukuran tidak sesuai bucket upload.",
      );
    }

    const objectKey = storageObjectKey(input);
    const origin = process.env.STORAGE_PUBLIC_BASE_URL ?? new URL(request.url).origin;
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    return ok({
      provider: process.env.STORAGE_PROVIDER ?? "local-dev",
      method: "PUT",
      url: `${origin}/api/storage/local-upload?objectKey=${encodeURIComponent(objectKey)}`,
      objectKey,
      publicUrl: `${origin}/api/storage/local-upload?objectKey=${encodeURIComponent(objectKey)}`,
      expiresAt,
      maxBytes: input.sizeBytes,
      requiredHeaders: {
        "content-type": input.contentType,
      },
      blockedByExternalCredential: !process.env.STORAGE_PROVIDER,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function assertUploadPermission(actor: SessionUser, bucket: StorageBucket) {
  if (bucket === "sop-files") {
    requirePermission(actor, "sop:manage");
    return;
  }

  if (bucket === "issue-photos") {
    if (hasPermission(actor.role, "issues:create-own") || hasPermission(actor.role, "issues:manage")) {
      return;
    }
    requirePermission(actor, "issues:create-own");
    return;
  }

  if (hasPermission(actor.role, "handover:create-own") || hasPermission(actor.role, "handover:manage")) {
    return;
  }
  requirePermission(actor, "handover:create-own");
}
