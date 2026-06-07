import { ok } from "@/server/api/response";

export async function GET() {
  return ok({
    service: "qims-api",
    status: "ok",
  });
}
