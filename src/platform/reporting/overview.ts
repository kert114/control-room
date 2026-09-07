import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/platform/db/client";
import {
  auditEvents,
  changeRequests,
  featureFlags,
  kycCases,
  refunds,
  users,
} from "@/platform/db/schema";

export interface OverviewCounts {
  kycOpen: number;
  kycBreachingSla: number;
  refundsPendingApproval: number;
  refundsApprovedMinor: number;
  flagsProductionEnabled: number;
  changeRequestsPending: number;
}

export async function loadOverviewCounts(): Promise<OverviewCounts> {
  const now = new Date();
  const openKyc = sql`${kycCases.status} in ('pending_review', 'in_review', 'escalated', 'information_requested')`;

  const [
    [kycOpen],
    [kycBreaching],
    [refundsPending],
    [refundsApproved],
    [flagsProduction],
    [pendingChanges],
  ] = await Promise.all([
    db.select({ value: count() }).from(kycCases).where(openKyc),
    db
      .select({ value: count() })
      .from(kycCases)
      .where(and(openKyc, sql`${kycCases.slaDueAt} < ${now.toISOString()}`)),
    db
      .select({ value: count() })
      .from(refunds)
      .where(sql`${refunds.status} in ('pending_approval', 'escalated')`),
    db
      .select({
        value: sql<number>`coalesce(sum(${refunds.amountMinor}), 0)::int`,
      })
      .from(refunds)
      .where(sql`${refunds.status} in ('approved', 'settled')`),
    db
      .select({ value: count() })
      .from(featureFlags)
      .where(
        and(eq(featureFlags.environment, "production"), eq(featureFlags.enabled, true)),
      ),
    db
      .select({ value: count() })
      .from(changeRequests)
      .where(eq(changeRequests.status, "pending_approval")),
  ]);

  return {
    kycOpen: kycOpen?.value ?? 0,
    kycBreachingSla: kycBreaching?.value ?? 0,
    refundsPendingApproval: refundsPending?.value ?? 0,
    refundsApprovedMinor: refundsApproved?.value ?? 0,
    flagsProductionEnabled: flagsProduction?.value ?? 0,
    changeRequestsPending: pendingChanges?.value ?? 0,
  };
}

export interface ActivityPoint {
  day: string;
  events: number;
}

export async function loadActivityByDay(days = 14): Promise<ActivityPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${auditEvents.occurredAt}), 'YYYY-MM-DD')`,
      events: count(),
    })
    .from(auditEvents)
    .where(gte(auditEvents.occurredAt, since))
    .groupBy(sql`date_trunc('day', ${auditEvents.occurredAt})`)
    .orderBy(sql`date_trunc('day', ${auditEvents.occurredAt})`);

  return rows.map((row) => ({ day: row.day, events: row.events }));
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  entityVersion: number;
  summary: string;
  occurredAt: Date;
  metadata: Record<string, string | number | boolean | null>;
}

export const AUDIT_LIST_LIMIT = 200;

export async function countAuditEntries(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(auditEvents);
  return row?.value ?? 0;
}

export async function loadAuditEntries(
  limit = AUDIT_LIST_LIMIT,
): Promise<AuditEntry[]> {
  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      actorName: users.name,
      actorRole: auditEvents.actorRole,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      entityVersion: auditEvents.entityVersion,
      summary: auditEvents.summary,
      occurredAt: auditEvents.occurredAt,
      metadata: auditEvents.metadata,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .orderBy(desc(auditEvents.occurredAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actor: row.actorName ?? "System",
    actorRole: row.actorRole,
    entityType: row.entityType,
    entityId: row.entityId,
    entityVersion: row.entityVersion,
    summary: row.summary,
    occurredAt: row.occurredAt,
    metadata: (row.metadata ?? {}) as Record<
      string,
      string | number | boolean | null
    >,
  }));
}
