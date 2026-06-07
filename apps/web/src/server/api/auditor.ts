import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { requireSessionPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  procedureAcknowledgements,
  procedureVersions,
  procedures,
  users,
} from "@/server/db/schema";
import { paginationMeta, parsePagination } from "./pagination";
import { resolveProcedureRecipients } from "./supervisor";

type SopAcknowledgementStatus =
  | "pending"
  | "read"
  | "understood"
  | "critical_confirmed";

type AckRow = typeof procedureAcknowledgements.$inferSelect;

export async function requireAuditRead(request: Request) {
  return requireSessionPermission(request, "audit:read");
}

function endOfDate(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999Z`);
}

function startOfDate(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

function acknowledgementStatus(acknowledgement?: AckRow): SopAcknowledgementStatus {
  if (!acknowledgement) return "pending";
  if (acknowledgement.criticalConfirmedAt) return "critical_confirmed";
  if (acknowledgement.understoodAt) return "understood";
  if (acknowledgement.readAt) return "read";
  return "pending";
}

function acknowledgementDate(acknowledgement?: AckRow) {
  return (
    acknowledgement?.criticalConfirmedAt ??
    acknowledgement?.understoodAt ??
    acknowledgement?.readAt ??
    undefined
  );
}

function matchesAcknowledgementDate(
  acknowledgement: AckRow | undefined,
  dateFrom?: string,
  dateTo?: string,
) {
  if (!dateFrom && !dateTo) return true;
  const value = acknowledgementDate(acknowledgement);
  if (!value) return false;
  const from = startOfDate(dateFrom);
  const to = endOfDate(dateTo);
  return (!from || value >= from) && (!to || value <= to);
}

export async function listSopAcknowledgements(request: Request) {
  await requireAuditRead(request);
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  const { sopAcknowledgementListQuerySchema, toSopAcknowledgementFilters } =
    await import("@/server/validation/auditor");
  const filters = sopAcknowledgementListQuerySchema.parse(
    toSopAcknowledgementFilters(url.searchParams),
  );

  const versions = await db
    .select({
      procedure: procedures,
      version: procedureVersions,
    })
    .from(procedureVersions)
    .innerJoin(procedures, eq(procedures.id, procedureVersions.procedureId))
    .where(
      and(
        filters.procedureId ? eq(procedures.id, filters.procedureId) : undefined,
        filters.procedureVersionId
          ? eq(procedureVersions.id, filters.procedureVersionId)
          : undefined,
        isNotNull(procedureVersions.publishedAt),
      ),
    )
    .orderBy(desc(procedureVersions.publishedAt), desc(procedureVersions.createdAt));

  const items = [];

  for (const item of versions) {
    const recipientIds = await resolveProcedureRecipients(item.version.id);
    const scopedRecipientIds = filters.userId
      ? recipientIds.filter((recipientId) => recipientId === filters.userId)
      : recipientIds;

    if (scopedRecipientIds.length === 0) {
      continue;
    }

    const [acknowledgements, recipientUsers] = await Promise.all([
      db
        .select()
        .from(procedureAcknowledgements)
        .where(
          and(
            eq(procedureAcknowledgements.procedureVersionId, item.version.id),
            inArray(procedureAcknowledgements.userId, scopedRecipientIds),
          ),
        ),
      db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          employeeId: users.employeeId,
          status: users.status,
        })
        .from(users)
        .where(inArray(users.id, scopedRecipientIds)),
    ]);

    const acknowledgementsByUser = new Map(
      acknowledgements.map((acknowledgement) => [
        acknowledgement.userId,
        acknowledgement,
      ]),
    );
    const usersById = new Map(recipientUsers.map((user) => [user.id, user]));

    for (const userId of scopedRecipientIds) {
      const acknowledgement = acknowledgementsByUser.get(userId);
      const status = acknowledgementStatus(acknowledgement);

      if (filters.status && status !== filters.status) {
        continue;
      }

      if (!matchesAcknowledgementDate(acknowledgement, filters.dateFrom, filters.dateTo)) {
        continue;
      }

      items.push({
        procedure: item.procedure,
        version: item.version,
        user: usersById.get(userId) ?? {
          id: userId,
          name: null,
          email: null,
          employeeId: null,
          status: null,
        },
        acknowledgement,
        status,
        acknowledgedAt: acknowledgementDate(acknowledgement) ?? null,
      });
    }
  }

  items.sort((first, second) => {
    const firstTime = first.acknowledgedAt?.getTime() ?? 0;
    const secondTime = second.acknowledgedAt?.getTime() ?? 0;
    if (firstTime !== secondTime) return secondTime - firstTime;
    return first.procedure.title.localeCompare(second.procedure.title);
  });

  return {
    items: items.slice(pagination.offset, pagination.offset + pagination.limit),
    meta: paginationMeta(pagination.page, pagination.limit, items.length),
  };
}
