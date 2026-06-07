import { z } from "zod";

export const sopAcknowledgementStatusValues = [
  "pending",
  "read",
  "understood",
  "critical_confirmed",
] as const;

const authUserIdSchema = z.string().trim().min(1).max(160);

export const sopAcknowledgementListQuerySchema = z.object({
  procedureId: z.string().uuid().optional(),
  procedureVersionId: z.string().uuid().optional(),
  userId: authUserIdSchema.optional(),
  status: z.enum(sopAcknowledgementStatusValues).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

export function toSopAcknowledgementFilters(searchParams: URLSearchParams) {
  return {
    procedureId: searchParams.get("procedureId") ?? undefined,
    procedureVersionId: searchParams.get("procedureVersionId") ?? undefined,
    userId: searchParams.get("userId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };
}
