import { z } from "zod";
import { procedureCategoryValues } from "@/server/db/schema";

export const sopAcknowledgementStatusValues = [
  "pending",
  "read",
  "understood",
  "critical_confirmed",
] as const;

const authUserIdSchema = z.string().trim().min(1).max(160);

export const sopAcknowledgementListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(180).optional(),
    category: z.enum(procedureCategoryValues).optional(),
    isCritical: z.coerce.boolean().optional(),
    procedureId: z.string().uuid().optional(),
    procedureVersionId: z.string().uuid().optional(),
    userId: authUserIdSchema.optional(),
    status: z.enum(sopAcknowledgementStatusValues).optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  })
  .refine(
    (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    {
      message: "dateFrom tidak boleh melewati dateTo.",
      path: ["dateTo"],
    },
  );

export function toSopAcknowledgementFilters(searchParams: URLSearchParams) {
  return {
    q: searchParams.get("q") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    isCritical: searchParams.get("isCritical") ?? undefined,
    procedureId: searchParams.get("procedureId") ?? undefined,
    procedureVersionId: searchParams.get("procedureVersionId") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };
}
