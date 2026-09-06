import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { assertPermission } from "@/modules/kyc/rules";
import type { IdentityField, QueueParams, RiskLevel } from "@/modules/kyc/schemas";
import { OPEN_STATUSES, type KycStatus } from "@/modules/kyc/transitions";
import type { Actor } from "@/platform/auth/session";
import { db } from "@/platform/db/client";
import {
  auditEvents,
  kycCaseDocuments,
  kycCaseIdentity,
  kycCaseNotes,
  kycCases,
  kycCaseSignals,
  kycDecisions,
  users,
} from "@/platform/db/schema";

export interface QueueRow {
  id: string;
  reference: string;
  customerAlias: string;
  customerCountry: string;
  riskLevel: RiskLevel;
  riskScore: number;
  status: KycStatus;
  openedAt: Date;
  slaDueAt: Date;
  assignedToId: string | null;
  assignedToName: string | null;
  version: number;
}

const RISK_RANK = sql<number>`case ${kycCases.riskLevel} when 'high' then 3 when 'medium' then 2 else 1 end`;

/** Open cases carry SLA pressure; closed ones sort after them. */
const CLOSED_LAST = sql<number>`case when ${kycCases.status} in ('approved', 'rejected') then 1 else 0 end`;

const STATUS_RANK = sql<number>`case ${kycCases.status}
  when 'pending_review' then 1
  when 'in_review' then 2
  when 'information_requested' then 3
  when 'escalated' then 4
  when 'approved' then 5
  else 6 end`;

function queueFilters(actor: Actor, params: QueueParams, now: Date): SQL[] {
  const filters: SQL[] = [];

  if (params.q) {
    const needle = `%${params.q.replace(/[%_]/g, "\\$&")}%`;
    const match = or(
      ilike(kycCases.reference, needle),
      ilike(kycCases.customerAlias, needle),
    );
    if (match) {
      filters.push(match);
    }
  }
  if (params.risk) {
    filters.push(eq(kycCases.riskLevel, params.risk));
  }
  if (params.status === "open") {
    filters.push(inArray(kycCases.status, [...OPEN_STATUSES]));
  } else if (params.status) {
    filters.push(eq(kycCases.status, params.status));
  }
  if (params.country) {
    filters.push(eq(kycCases.customerCountry, params.country));
  }
  if (params.assignee === "me") {
    filters.push(eq(kycCases.assignedToId, actor.id));
  } else if (params.assignee === "unassigned") {
    filters.push(isNull(kycCases.assignedToId));
  } else if (params.assignee) {
    filters.push(eq(kycCases.assignedToId, params.assignee));
  }

  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (params.sla === "breached") {
    filters.push(
      lt(kycCases.slaDueAt, now),
      inArray(kycCases.status, [...OPEN_STATUSES]),
    );
  } else if (params.sla === "due_24h") {
    filters.push(gte(kycCases.slaDueAt, now), lt(kycCases.slaDueAt, in24h));
  } else if (params.sla === "on_track") {
    filters.push(gte(kycCases.slaDueAt, in24h));
  }

  return filters;
}

function queueOrder(params: QueueParams): SQL[] {
  const direction = params.dir === "desc" ? desc : asc;
  switch (params.sort) {
    case "risk":
      return [direction(RISK_RANK), direction(kycCases.riskScore), asc(kycCases.reference)];
    case "opened":
      return [direction(kycCases.openedAt), asc(kycCases.reference)];
    case "reference":
      return [direction(kycCases.reference)];
    case "status":
      return [direction(STATUS_RANK), asc(kycCases.slaDueAt), asc(kycCases.reference)];
    case "sla":
      return [asc(CLOSED_LAST), direction(kycCases.slaDueAt), asc(kycCases.reference)];
  }
}

export async function loadQueue(
  actor: Actor,
  params: QueueParams,
  now: Date = new Date(),
): Promise<QueueRow[]> {
  assertPermission(actor, "kyc.read");
  const filters = queueFilters(actor, params, now);

  return db
    .select({
      id: kycCases.id,
      reference: kycCases.reference,
      customerAlias: kycCases.customerAlias,
      customerCountry: kycCases.customerCountry,
      riskLevel: kycCases.riskLevel,
      riskScore: kycCases.riskScore,
      status: kycCases.status,
      openedAt: kycCases.openedAt,
      slaDueAt: kycCases.slaDueAt,
      assignedToId: kycCases.assignedToId,
      assignedToName: users.name,
      version: kycCases.version,
    })
    .from(kycCases)
    .leftJoin(users, eq(users.id, kycCases.assignedToId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(...queueOrder(params));
}

export interface Reviewer {
  id: string;
  name: string;
  role: string;
}

/** Active users who may hold a case. Auditors are read-only and excluded. */
export async function loadReviewers(actor: Actor): Promise<Reviewer[]> {
  assertPermission(actor, "kyc.read");
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.role, ["operator", "approver", "administrator"]),
      ),
    )
    .orderBy(asc(users.name));
}

export interface IdentityEvidence {
  field: IdentityField;
  maskedValue: string;
}

export interface CaseDocument {
  id: string;
  documentType: string;
  status: "received" | "verified" | "rejected" | "expired";
  receivedAt: Date;
}

export interface CaseSignal {
  id: string;
  code: string;
  severity: "low" | "medium" | "high";
  detail: string;
  raisedAt: Date;
}

export interface CaseNote {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

export interface CaseDecision {
  id: string;
  decidedByName: string;
  decision: "approve" | "escalate" | "reject";
  rationale: string;
  checklist: Record<string, boolean>;
  decidedAt: Date;
}

export interface CaseActivity {
  id: string;
  action: string;
  actorName: string;
  summary: string;
  occurredAt: Date;
}

export interface CaseDetail extends QueueRow {
  createdById: string;
  createdByName: string;
  assignedAt: Date | null;
  lastActivityAt: Date;
  identity: IdentityEvidence[];
  documents: CaseDocument[];
  signals: CaseSignal[];
  notes: CaseNote[];
  decisions: CaseDecision[];
  activity: CaseActivity[];
}

function parseChecklist(value: unknown): Record<string, boolean> {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

/**
 * Loads one case with its evidence. Identity rows are read as masked values
 * only; the raw value column is never part of this query.
 */
export async function loadCaseDetail(
  actor: Actor,
  caseId: string,
): Promise<CaseDetail | null> {
  assertPermission(actor, "kyc.read");

  const assignee = alias(users, "assignee");
  const creator = alias(users, "creator");

  const [row] = await db
    .select({
      id: kycCases.id,
      reference: kycCases.reference,
      customerAlias: kycCases.customerAlias,
      customerCountry: kycCases.customerCountry,
      riskLevel: kycCases.riskLevel,
      riskScore: kycCases.riskScore,
      status: kycCases.status,
      openedAt: kycCases.openedAt,
      slaDueAt: kycCases.slaDueAt,
      assignedToId: kycCases.assignedToId,
      assignedToName: assignee.name,
      assignedAt: kycCases.assignedAt,
      lastActivityAt: kycCases.lastActivityAt,
      createdById: kycCases.createdById,
      createdByName: creator.name,
      version: kycCases.version,
    })
    .from(kycCases)
    .leftJoin(assignee, eq(assignee.id, kycCases.assignedToId))
    .innerJoin(creator, eq(creator.id, kycCases.createdById))
    .where(eq(kycCases.id, caseId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [identity, documents, signals, notes, decisions, activity] =
    await Promise.all([
      db
        .select({
          field: kycCaseIdentity.field,
          maskedValue: kycCaseIdentity.maskedValue,
        })
        .from(kycCaseIdentity)
        .where(eq(kycCaseIdentity.caseId, caseId))
        .orderBy(asc(kycCaseIdentity.field)),
      db
        .select({
          id: kycCaseDocuments.id,
          documentType: kycCaseDocuments.documentType,
          status: kycCaseDocuments.status,
          receivedAt: kycCaseDocuments.receivedAt,
        })
        .from(kycCaseDocuments)
        .where(eq(kycCaseDocuments.caseId, caseId))
        .orderBy(asc(kycCaseDocuments.receivedAt)),
      db
        .select({
          id: kycCaseSignals.id,
          code: kycCaseSignals.code,
          severity: kycCaseSignals.severity,
          detail: kycCaseSignals.detail,
          raisedAt: kycCaseSignals.raisedAt,
        })
        .from(kycCaseSignals)
        .where(eq(kycCaseSignals.caseId, caseId))
        .orderBy(desc(kycCaseSignals.raisedAt)),
      db
        .select({
          id: kycCaseNotes.id,
          authorName: users.name,
          body: kycCaseNotes.body,
          createdAt: kycCaseNotes.createdAt,
        })
        .from(kycCaseNotes)
        .innerJoin(users, eq(users.id, kycCaseNotes.authorId))
        .where(eq(kycCaseNotes.caseId, caseId))
        .orderBy(desc(kycCaseNotes.createdAt)),
      db
        .select({
          id: kycDecisions.id,
          decidedByName: users.name,
          decision: kycDecisions.decision,
          rationale: kycDecisions.rationale,
          checklist: kycDecisions.checklist,
          decidedAt: kycDecisions.decidedAt,
        })
        .from(kycDecisions)
        .innerJoin(users, eq(users.id, kycDecisions.decidedById))
        .where(eq(kycDecisions.caseId, caseId))
        .orderBy(desc(kycDecisions.decidedAt)),
      db
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          actorName: users.name,
          summary: auditEvents.summary,
          occurredAt: auditEvents.occurredAt,
        })
        .from(auditEvents)
        .leftJoin(users, eq(users.id, auditEvents.actorId))
        .where(
          and(
            eq(auditEvents.entityType, "kyc_case"),
            eq(auditEvents.entityId, caseId),
          ),
        )
        .orderBy(desc(auditEvents.occurredAt)),
    ]);

  return {
    ...row,
    identity,
    documents,
    signals,
    notes,
    decisions: decisions.map((decision) => ({
      ...decision,
      checklist: parseChecklist(decision.checklist),
    })),
    activity: activity.map((entry) => ({
      ...entry,
      actorName: entry.actorName ?? "System",
    })),
  };
}

/** Distinct customer countries across all cases, for the country filter. */
export async function loadCountries(actor: Actor): Promise<string[]> {
  assertPermission(actor, "kyc.read");
  const rows = await db
    .selectDistinct({ country: kycCases.customerCountry })
    .from(kycCases)
    .orderBy(asc(kycCases.customerCountry));
  return rows.map((row) => row.country);
}
