import { and, eq, inArray } from "drizzle-orm";

import {
  assertMayTakeReview,
  assertMayDecide,
  assertMayWorkCase,
  assertPermission,
  type CaseSnapshot,
} from "@/modules/kyc/rules";
import type {
  ClaimInput,
  DecideInput,
  ReassignInput,
  RequestInformationInput,
  ResumeInput,
  UnmaskInput,
} from "@/modules/kyc/schemas";
import {
  assertReassignable,
  assertTransition,
  type KycStatus,
} from "@/modules/kyc/transitions";
import type { Actor } from "@/platform/auth/session";
import {
  kycCaseIdentity,
  kycCaseNotes,
  kycCases,
  kycDecisions,
  users,
} from "@/platform/db/schema";
import {
  BusinessRuleError,
  OptimisticConcurrencyError,
  type MutationResult,
} from "@/platform/mutations/errors";
import {
  assertRowUpdated,
  bumpVersion,
  versionedWhere,
  withBusinessTransaction,
  type MutationContext,
  type Transaction,
} from "@/platform/mutations/transaction";

interface LockedCase extends CaseSnapshot {
  reference: string;
  riskLevel: "low" | "medium" | "high";
  version: number;
}

export interface CaseOutcome {
  caseId: string;
  reference: string;
  status: KycStatus;
  version: number;
}

/**
 * Reads and row-locks the case, refusing early when the caller's copy is
 * stale so business rules always run against the version the user saw.
 */
async function lockCase(
  tx: Transaction,
  caseId: string,
  expectedVersion: number,
): Promise<LockedCase> {
  const [row] = await tx
    .select({
      id: kycCases.id,
      reference: kycCases.reference,
      riskLevel: kycCases.riskLevel,
      status: kycCases.status,
      assignedToId: kycCases.assignedToId,
      createdById: kycCases.createdById,
      version: kycCases.version,
    })
    .from(kycCases)
    .where(eq(kycCases.id, caseId))
    .for("update");

  if (!row) {
    throw new BusinessRuleError("This case no longer exists.");
  }
  if (row.version !== expectedVersion) {
    throw new OptimisticConcurrencyError("kyc_case", caseId, expectedVersion);
  }
  return row;
}

type CaseUpdate = Partial<
  Pick<typeof kycCases.$inferInsert, "status" | "assignedToId" | "assignedAt">
>;

async function updateCase(
  tx: Transaction,
  locked: LockedCase,
  changes: CaseUpdate,
  now: Date,
): Promise<CaseOutcome> {
  const rows = await tx
    .update(kycCases)
    .set({
      ...changes,
      lastActivityAt: now,
      updatedAt: now,
      version: bumpVersion(kycCases),
    })
    .where(versionedWhere(kycCases, locked.id, locked.version))
    .returning({ status: kycCases.status, version: kycCases.version });

  const updated = assertRowUpdated(rows, "kyc_case", locked.id, locked.version);
  return {
    caseId: locked.id,
    reference: locked.reference,
    status: updated.status,
    version: updated.version,
  };
}

function auditBase(actor: Actor, outcome: CaseOutcome) {
  return {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "kyc_case" as const,
    entityId: outcome.caseId,
    entityVersion: outcome.version,
  };
}

async function takeReview(
  context: MutationContext,
  actor: Actor,
  input: ClaimInput | ResumeInput,
  verb: "Claimed" | "Resumed review of",
): Promise<CaseOutcome> {
  assertPermission(actor, "kyc.claim");
  const locked = await lockCase(context.tx, input.caseId, input.expectedVersion);
  assertTransition(locked.status, "in_review");
  assertMayTakeReview(actor, locked);

  const now = new Date();
  const keepsReviewer =
    locked.status === "information_requested" && locked.assignedToId !== null;
  const outcome = await updateCase(
    context.tx,
    locked,
    keepsReviewer
      ? { status: "in_review" }
      : { status: "in_review", assignedToId: actor.id, assignedAt: now },
    now,
  );
  await context.audit({
    ...auditBase(actor, outcome),
    action: "kyc_case.claimed",
    summary: `${verb} case ${locked.reference}.`,
    metadata: {
      from: locked.status,
      to: outcome.status,
      riskLevel: locked.riskLevel,
    },
  });
  return outcome;
}

/** pending_review → in_review, assigning the case to the actor. */
export function claimCase(
  actor: Actor,
  input: ClaimInput,
): Promise<MutationResult<CaseOutcome>> {
  return withBusinessTransaction((context) =>
    takeReview(context, actor, input, "Claimed"),
  );
}

/** information_requested → in_review once the customer has responded. */
export function resumeReview(
  actor: Actor,
  input: ResumeInput,
): Promise<MutationResult<CaseOutcome>> {
  return withBusinessTransaction((context) =>
    takeReview(context, actor, input, "Resumed review of"),
  );
}

export function reassignCase(
  actor: Actor,
  input: ReassignInput,
): Promise<MutationResult<CaseOutcome>> {
  return withBusinessTransaction(async (context) => {
    assertPermission(actor, "kyc.assign");
    const locked = await lockCase(context.tx, input.caseId, input.expectedVersion);
    assertReassignable(locked.status);
    if (locked.assignedToId === input.assigneeId) {
      throw new BusinessRuleError("The case is already assigned to that reviewer.");
    }

    const [reviewer] = await context.tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, input.assigneeId),
          eq(users.isActive, true),
          inArray(users.role, ["operator", "approver", "administrator"]),
        ),
      );
    if (!reviewer) {
      throw new BusinessRuleError("Choose an active reviewer who can hold KYC cases.");
    }

    const now = new Date();
    const outcome = await updateCase(
      context.tx,
      locked,
      { assignedToId: reviewer.id, assignedAt: now },
      now,
    );
    await context.audit({
      ...auditBase(actor, outcome),
      action: "kyc_case.reassigned",
      summary: `Reassigned case ${locked.reference}.`,
      metadata: {
        status: outcome.status,
        riskLevel: locked.riskLevel,
        previousAssigneeId: locked.assignedToId,
        assigneeId: reviewer.id,
      },
    });
    return outcome;
  });
}

export function requestInformation(
  actor: Actor,
  input: RequestInformationInput,
): Promise<MutationResult<CaseOutcome>> {
  return withBusinessTransaction(async (context) => {
    assertPermission(actor, "kyc.request_info");
    const locked = await lockCase(context.tx, input.caseId, input.expectedVersion);
    assertTransition(locked.status, "information_requested");
    assertMayWorkCase(actor, locked);

    const now = new Date();
    await context.tx.insert(kycCaseNotes).values({
      caseId: locked.id,
      authorId: actor.id,
      body: `Information requested: ${input.reason}`,
      createdAt: now,
    });
    const outcome = await updateCase(
      context.tx,
      locked,
      { status: "information_requested" },
      now,
    );
    await context.audit({
      ...auditBase(actor, outcome),
      action: "kyc_case.information_requested",
      summary: `Requested more information for case ${locked.reference}.`,
      metadata: { from: locked.status, riskLevel: locked.riskLevel },
    });
    return outcome;
  });
}

const DECISION_TARGET: Readonly<Record<DecideInput["decision"], KycStatus>> = {
  approve: "approved",
  escalate: "escalated",
  reject: "rejected",
};

const DECISION_SUMMARY: Readonly<Record<DecideInput["decision"], string>> = {
  approve: "Approved",
  escalate: "Escalated",
  reject: "Rejected",
};

/**
 * Records approve, escalate, or reject. Approvals and rejections are subject
 * to maker-checker; escalated cases can only be closed by a senior reviewer.
 */
export function decideCase(
  actor: Actor,
  input: DecideInput,
): Promise<MutationResult<CaseOutcome>> {
  return withBusinessTransaction(async (context) => {
    assertPermission(actor, "kyc.decide");
    const locked = await lockCase(context.tx, input.caseId, input.expectedVersion);
    const target = DECISION_TARGET[input.decision];
    assertTransition(locked.status, target);
    if (input.decision === "escalate") {
      assertMayWorkCase(actor, locked);
    } else {
      assertMayDecide(actor, locked, input.decision);
    }

    const now = new Date();
    await context.tx.insert(kycDecisions).values({
      caseId: locked.id,
      decidedById: actor.id,
      decision: input.decision,
      rationale: input.rationale,
      checklist: input.checklist,
      decidedAt: now,
    });
    const outcome = await updateCase(context.tx, locked, { status: target }, now);
    await context.audit({
      ...auditBase(actor, outcome),
      action: "kyc_case.decided",
      summary: `${DECISION_SUMMARY[input.decision]} case ${locked.reference}.`,
      metadata: {
        decision: input.decision,
        from: locked.status,
        riskLevel: locked.riskLevel,
      },
    });
    return outcome;
  });
}

export interface UnmaskedIdentity {
  field: UnmaskInput["field"];
  value: string;
}

/**
 * Reads one raw identity value for an authorised reviewer and audits the
 * disclosure. The value is returned to the caller once and never stored in
 * the audit trail.
 */
export function unmaskIdentity(
  actor: Actor,
  input: UnmaskInput,
): Promise<MutationResult<UnmaskedIdentity>> {
  return withBusinessTransaction(async (context) => {
    assertPermission(actor, "kyc.unmask");
    const locked = await lockCase(context.tx, input.caseId, input.expectedVersion);
    assertMayWorkCase(actor, locked);

    const [identity] = await context.tx
      .select({ value: kycCaseIdentity.value })
      .from(kycCaseIdentity)
      .where(
        and(
          eq(kycCaseIdentity.caseId, locked.id),
          eq(kycCaseIdentity.field, input.field),
        ),
      );
    if (!identity) {
      throw new BusinessRuleError("No identity evidence of that kind is on file.");
    }

    await context.audit({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "kyc_case",
      entityId: locked.id,
      entityVersion: locked.version,
      action: "kyc_case.identity_unmasked",
      summary: `Unmasked identity evidence on case ${locked.reference}.`,
      metadata: { field: input.field, caseVersion: locked.version },
    });
    return { field: input.field, value: identity.value };
  });
}
