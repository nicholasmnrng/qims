import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { handleApiError } from "@/server/api/errors";
import { HttpError } from "@/server/api/http-error";
import { ok } from "@/server/api/response";
import { requireSession } from "@/server/auth/session";
import { localUploadQuerySchema } from "@/server/validation/runtime";

export const runtime = "nodejs";

const storageRoot = resolve(process.cwd(), ".qims-storage");

export async function PUT(request: Request) {
  try {
    await requireSession(request);
    const { objectKey } = localUploadQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const filePath = storagePath(objectKey);
    const bytes = Buffer.from(await request.arrayBuffer());
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);

    return ok({
      objectKey,
      sizeBytes: bytes.byteLength,
      storedAt: new Date().toISOString(),
      provider: "local-dev",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const { objectKey } = localUploadQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const file = await readFile(storagePath(objectKey));
    return new Response(file);
  } catch (error) {
    return handleApiError(error);
  }
}

function storagePath(objectKey: string) {
  if (
    objectKey.includes("..") ||
    objectKey.startsWith("/") ||
    !/^[a-z0-9._/-]+$/.test(objectKey)
  ) {
    throw new HttpError(400, "BAD_REQUEST", "Object key tidak valid.");
  }

  const resolved = resolve(storageRoot, objectKey);
  if (!resolved.startsWith(storageRoot)) {
    throw new HttpError(400, "BAD_REQUEST", "Object key di luar storage root.");
  }
  return resolved;
}
