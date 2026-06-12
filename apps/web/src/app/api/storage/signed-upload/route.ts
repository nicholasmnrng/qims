import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { ok } from "@/server/api/response";
import {
  hasUserPermission,
  requireSession,
  requireUserPermission,
} from "@/server/auth/session";
import type { SessionUser } from "@/server/auth/rbac";
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

    await assertUploadPermission(actor, input.bucket);
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

async function assertUploadPermission(actor: SessionUser, bucket: StorageBucket) {
  if (bucket === "sop-files") {
    await requireUserPermission(actor, "sop:manage");
    return;
  }

  if (bucket === "issue-photos") {
    if (
      (await hasUserPermission(actor, "issues:create-own")) ||
      (await hasUserPermission(actor, "issues:manage"))
    ) {
      return;
    }
    await requireUserPermission(actor, "issues:create-own");
    return;
  }

  if (
    (await hasUserPermission(actor, "handover:create-own")) ||
    (await hasUserPermission(actor, "handover:manage"))
  ) {
    return;
  }
  await requireUserPermission(actor, "handover:create-own");
}
