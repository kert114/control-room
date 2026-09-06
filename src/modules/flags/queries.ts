import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { db, type Executor } from "@/platform/db/client";
import {
  approvals,
  auditEvents,
  changeRequests,
  featureFlags,
  users,
  type ApprovalRow,
  type ChangeRequestRow,
  type FeatureFlagRow,
} from "@/platform/db/schema";

import type { FlagEnvironment } from "@/modules/flags/rules";
import type { FlagsQuery, SortKey } from "@/modules/flags/url-state";
import { parseTargeting, type TargetingRule } from "@/modules/flags/targeting";
import { isOpen } from "@/modules/flags/transitions";

export {
  buildFlagsHref,
  parseFlagsQuery,
  SORT_KEYS,
  type FlagsQuery,
  type RawSearchParams,
  type SortKey,
} from "@/modules/flags/url-state";

export interface FlagListItem {
  id: string;
  key: string;
  description: string;
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercentage: number;
  owner: string;
  killedAt: Date | null;
  updatedAt: Date;
  version: number;
  openRequest: { id: string; reference: string; kind: ChangeRequestRow["kind"] } | null;
}

const SORT_COLUMN: Record<SortKey, SQL | PgColumn> = {
  key: featureFlags.key,
  environment: sql`array_position(array['development','staging','production']::text[], ${featureFlags.environment}::text)`,
  rollout: featureFlags.rolloutPercentage,
  owner: featureFlags.owner,
};

export async function listFlags(
  query: FlagsQuery,
  executor: Executor = db,
): Promise<FlagListItem[]> {
  const conditions: SQL[] = [];
  if (query.q) {
    const pattern = `%${query.q}%`;
    const match = or(
      ilike(featureFlags.key, pattern),
      ilike(featureFlags.description, pattern),
    );
    if (match) {
      conditions.push(match);
    }
  }
  if (query.key) {
    conditions.push(eq(featureFlags.key, query.key));
  }

  if (query.env) {
    conditions.push(eq(featureFlags.environment, query.env));
  }
  if (query.owner) {
    conditions.push(eq(featureFlags.owner, query.owner));
  }

  const direction = query.dir === "desc" ? desc : asc;
  const rows = await executor
    .select()
    .from(featureFlags)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(direction(SORT_COLUMN[query.sort]), asc(featureFlags.key), asc(featureFlags.environment));

  const openRequests =
    rows.length === 0
      ? []
      : await executor
          .select({
            id: changeRequests.id,
            flagId: changeRequests.flagId,
            reference: changeRequests.reference,
            kind: changeRequests.kind,
          })
          .from(changeRequests)
          .where(
            and(
              inArray(changeRequests.flagId, rows.map((row) => row.id)),
              eq(changeRequests.status, "pending_approval"),
            ),
          );
  const openByFlag = new Map(openRequests.map((request) => [request.flagId, request]));

  return rows.map((row) => {
    const open = openByFlag.get(row.id);
    return {
      id: row.id,
      key: row.key,
      description: row.description,
      environment: row.environment,
      enabled: row.enabled,
      rolloutPercentage: row.rolloutPercentage,
      owner: row.owner,
      killedAt: row.killedAt,
      updatedAt: row.updatedAt,
      version: row.version,
      openRequest: open ? { id: open.id, reference: open.reference, kind: open.kind } : null,
    };
  });
}

export async function countFlags(executor: Executor = db): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(featureFlags);
  return row?.count ?? 0;
}

export async function listFlagKeys(executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ key: featureFlags.key })
    .from(featureFlags)
    .orderBy(asc(featureFlags.key));
  return rows.map((row) => row.key);
}

export async function listOwners(executor: Executor = db): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ owner: featureFlags.owner })
    .from(featureFlags)
    .orderBy(asc(featureFlags.owner));
  return rows.map((row) => row.owner);
}

export interface FlagDetail extends Omit<FeatureFlagRow, "targeting"> {
  targeting: TargetingRule[];
  updatedByName: string | null;
  openRequest: ChangeRequestSummary | null;
  requests: ChangeRequestSummary[];
  history: HistoryEntry[];
}

export interface ChangeRequestSummary {
  id: string;
  reference: string;
  kind: ChangeRequestRow["kind"];
  status: ChangeRequestRow["status"];
  flagId: string;
  flagKey: string;
  environment: FlagEnvironment;
  requestedById: string;
  requestedByName: string;
  previousEnabled: boolean;
  previousRollout: number;
  proposedEnabled: boolean;
  proposedRollout: number;
  ticket: string | null;
  createdAt: Date;
  version: number;
}

export interface HistoryEntry {
  id: string;
  action: string;
  summary: string;
  actor: string;
  occurredAt: Date;
}

async function loadHistory(
  entityIds: string[],
  executor: Executor,
): Promise<HistoryEntry[]> {
  if (entityIds.length === 0) {
    return [];
  }
  const rows = await executor
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      summary: auditEvents.summary,
      actor: users.name,
      occurredAt: auditEvents.occurredAt,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(inArray(auditEvents.entityId, entityIds))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(30);
  return rows.map((row) => ({ ...row, actor: row.actor ?? "System" }));
}

function requestSummarySelection() {
  return {
    id: changeRequests.id,
    reference: changeRequests.reference,
    kind: changeRequests.kind,
    status: changeRequests.status,
    flagId: changeRequests.flagId,
    flagKey: featureFlags.key,
    environment: featureFlags.environment,
    requestedById: changeRequests.requestedById,
    requestedByName: users.name,
    previousEnabled: changeRequests.previousEnabled,
    previousRollout: changeRequests.previousRollout,
    proposedEnabled: changeRequests.proposedEnabled,
    proposedRollout: changeRequests.proposedRollout,
    ticket: changeRequests.ticket,
    createdAt: changeRequests.createdAt,
    version: changeRequests.version,
  };
}

export async function getFlagDetail(
  id: string,
  executor: Executor = db,
): Promise<FlagDetail | null> {
  const [row] = await executor
    .select({ flag: featureFlags, updatedByName: users.name })
    .from(featureFlags)
    .leftJoin(users, eq(users.id, featureFlags.updatedById))
    .where(eq(featureFlags.id, id))
    .limit(1);
  if (!row) {
    return null;
  }

  const requests = await executor
    .select(requestSummarySelection())
    .from(changeRequests)
    .innerJoin(featureFlags, eq(featureFlags.id, changeRequests.flagId))
    .innerJoin(users, eq(users.id, changeRequests.requestedById))
    .where(eq(changeRequests.flagId, id))
    .orderBy(desc(changeRequests.createdAt))
    .limit(20);

  const history = await loadHistory(
    [id, ...requests.map((request) => request.id)],
    executor,
  );

  return {
    ...row.flag,
    targeting: parseTargeting(row.flag.targeting),
    updatedByName: row.updatedByName,
    openRequest: requests.find((request) => isOpen(request.status)) ?? null,
    requests,
    history,
  };
}

export interface ChangeRequestDetail extends ChangeRequestSummary {
  reason: string;
  appliedAt: Date | null;
  appliedById: string | null;
  appliedByName: string | null;
  flagVersion: number;
  flagEnabled: boolean;
  flagRollout: number;
  flagKilledAt: Date | null;
  approvals: Array<
    Pick<ApprovalRow, "id" | "decision" | "note" | "decidedAt"> & { approver: string }
  >;
  history: HistoryEntry[];
}

export async function getChangeRequestDetail(
  id: string,
  executor: Executor = db,
): Promise<ChangeRequestDetail | null> {
  const [row] = await executor
    .select({
      ...requestSummarySelection(),
      reason: changeRequests.reason,
      appliedAt: changeRequests.appliedAt,
      appliedById: changeRequests.appliedById,
      flagVersion: featureFlags.version,
      flagEnabled: featureFlags.enabled,
      flagRollout: featureFlags.rolloutPercentage,
      flagKilledAt: featureFlags.killedAt,
    })
    .from(changeRequests)
    .innerJoin(featureFlags, eq(featureFlags.id, changeRequests.flagId))
    .innerJoin(users, eq(users.id, changeRequests.requestedById))
    .where(eq(changeRequests.id, id))
    .limit(1);
  if (!row) {
    return null;
  }

  const [appliedBy] = row.appliedById
    ? await executor
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.appliedById))
        .limit(1)
    : [];

  const decisionRows = await executor
    .select({
      id: approvals.id,
      decision: approvals.decision,
      note: approvals.note,
      decidedAt: approvals.decidedAt,
      approver: users.name,
    })
    .from(approvals)
    .innerJoin(users, eq(users.id, approvals.approvedById))
    .where(eq(approvals.changeRequestId, id))
    .orderBy(asc(approvals.decidedAt));

  const history = await loadHistory([id, row.flagId], executor);

  return {
    ...row,
    appliedByName: appliedBy?.name ?? null,
    approvals: decisionRows,
    history,
  };
}
