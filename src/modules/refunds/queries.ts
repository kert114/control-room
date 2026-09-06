import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/platform/db/client";
import {
  auditEvents,
  refundApprovalPolicy,
  refunds,
  users,
  type RefundApprovalPolicyRow,
} from "@/platform/db/schema";
import type { Role } from "@/platform/authz/policy";

import { STATUS_LABEL, formatMoney } from "@/modules/refunds/format";
import {
  effectiveStatuses,
  type ListParams,
  type RefundStatus,
  type VolumeRange,
} from "@/modules/refunds/params";

const requester = alias(users, "refund_requester");
const approver = alias(users, "refund_approver");
const escalator = alias(users, "refund_escalator");

export interface RefundListItem {
  id: string;
  reference: string;
  paymentReference: string;
  customerAlias: string;
  amountMinor: number;
  currency: string;
  status: RefundStatus;
  requesterName: string;
  createdAt: Date;
  version: number;
}

export async function listRefunds(
  params: ListParams,
): Promise<RefundListItem[]> {
  const filters = [];
  if (params.q) {
    filters.push(
      or(
        ilike(refunds.reference, `%${params.q}%`),
        ilike(refunds.paymentReference, `%${params.q}%`),
        ilike(refunds.customerAlias, `%${params.q}%`),
      ),
    );
  }
  filters.push(inArray(refunds.status, [...effectiveStatuses(params.status)]));
  if (params.min !== undefined) filters.push(gte(refunds.amountMinor, params.min));
  if (params.max !== undefined) filters.push(lte(refunds.amountMinor, params.max));

  const primary =
    params.sort === "amount"
      ? refunds.amountMinor
      : params.sort === "reference"
        ? refunds.reference
        : params.sort === "status"
          ? refunds.status
          : refunds.createdAt;
  const direction = params.dir === "asc" ? asc : desc;
  return db
    .select({
      id: refunds.id,
      reference: refunds.reference,
      paymentReference: refunds.paymentReference,
      customerAlias: refunds.customerAlias,
      amountMinor: refunds.amountMinor,
      currency: refunds.currency,
      status: refunds.status,
      requesterName: requester.name,
      createdAt: refunds.createdAt,
      version: refunds.version,
    })
    .from(refunds)
    .innerJoin(requester, eq(requester.id, refunds.requestedById))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(direction(primary), desc(refunds.createdAt), desc(refunds.id))
    .limit(200);
}

export interface RefundHistoryEntry {
  id: string;
  action: string;
  summary: string;
  actorName: string;
  actorRole: Role;
  occurredAt: Date;
}

export interface RefundDetail extends RefundListItem {
  requestedById: string;
  escalatedById: string | null;
  reason: string;
  decisionNote: string | null;
  approverName: string | null;
  escalatorName: string | null;
  decidedAt: Date | null;
  escalatedAt: Date | null;
  history: RefundHistoryEntry[];
}

export async function getRefundDetail(id: string): Promise<RefundDetail | null> {
  const [row] = await db
    .select({
      id: refunds.id,
      reference: refunds.reference,
      paymentReference: refunds.paymentReference,
      customerAlias: refunds.customerAlias,
      amountMinor: refunds.amountMinor,
      currency: refunds.currency,
      status: refunds.status,
      requesterName: requester.name,
      createdAt: refunds.createdAt,
      version: refunds.version,
      requestedById: refunds.requestedById,
      escalatedById: refunds.escalatedById,
      reason: refunds.reason,
      decisionNote: refunds.decisionNote,
      approverName: approver.name,
      escalatorName: escalator.name,
      decidedAt: refunds.decidedAt,
      escalatedAt: refunds.escalatedAt,
    })
    .from(refunds)
    .innerJoin(requester, eq(requester.id, refunds.requestedById))
    .leftJoin(approver, eq(approver.id, refunds.approvedById))
    .leftJoin(escalator, eq(escalator.id, refunds.escalatedById))
    .where(eq(refunds.id, id))
    .limit(1);
  if (!row) return null;

  const history = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      summary: auditEvents.summary,
      actorName: users.name,
      actorRole: auditEvents.actorRole,
      occurredAt: auditEvents.occurredAt,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(and(eq(auditEvents.entityType, "refund"), eq(auditEvents.entityId, id)))
    .orderBy(desc(auditEvents.occurredAt));

  return {
    ...row,
    history: history.map((entry) => ({
      ...entry,
      actorName: entry.actorName ?? "System",
    })),
  };
}

export interface RefundSummary {
  awaitingCount: number;
  awaitingAmountMinor: number;
  escalatedCount: number;
  decidedLast30dCount: number;
}

export async function summarizeRefunds(): Promise<RefundSummary> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [summary] = await db
    .select({
      awaitingCount: sql<number>`count(*) filter (where ${refunds.status} in ('pending_approval', 'escalated'))::int`,
      awaitingAmountMinor: sql<number>`coalesce(sum(${refunds.amountMinor}) filter (where ${refunds.status} in ('pending_approval', 'escalated')), 0)::int`,
      escalatedCount: sql<number>`count(*) filter (where ${refunds.status} = 'escalated')::int`,
      decidedLast30dCount: sql<number>`count(*) filter (where ${refunds.status} in ('approved', 'rejected', 'settled') and ${refunds.decidedAt} >= ${since})::int`,
    })
    .from(refunds);
  return {
    awaitingCount: Number(summary?.awaitingCount ?? 0),
    awaitingAmountMinor: Number(summary?.awaitingAmountMinor ?? 0),
    escalatedCount: Number(summary?.escalatedCount ?? 0),
    decidedLast30dCount: Number(summary?.decidedLast30dCount ?? 0),
  };
}

export interface VolumePoint {
  status: RefundStatus;
  label: string;
  count: number;
  amountMinor: number;
}

const VOLUME_STATUSES: RefundStatus[] = [
  "pending_approval",
  "escalated",
  "approved",
  "rejected",
  "settled",
];

const RANGE_DAYS: Record<Exclude<VolumeRange, "all">, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export async function volumeByStatus(range: VolumeRange = "all"): Promise<VolumePoint[]> {
  const since =
    range === "all" ? undefined : new Date(Date.now() - RANGE_DAYS[range] * 86_400_000);
  const rows = await db
    .select({
      status: refunds.status,
      count: sql<number>`count(*)::int`,
      amountMinor: sql<number>`coalesce(sum(${refunds.amountMinor}), 0)::int`,
    })
    .from(refunds)
    .where(since ? gte(refunds.createdAt, since) : undefined)
    .groupBy(refunds.status);
  const byStatus = new Map(rows.map((row) => [row.status, row]));
  return VOLUME_STATUSES.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    count: Number(byStatus.get(status)?.count ?? 0),
    amountMinor: Number(byStatus.get(status)?.amountMinor ?? 0),
  }));
}

export async function getPolicy(
  currency = "EUR",
): Promise<RefundApprovalPolicyRow | null> {
  const [policy] = await db
    .select()
    .from(refundApprovalPolicy)
    .where(eq(refundApprovalPolicy.currency, currency))
    .limit(1);
  return policy ?? null;
}

export { formatMoney };
