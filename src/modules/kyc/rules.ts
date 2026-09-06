import {
  assertReassignable,
  assertTransition,
  canTransition,
  isTerminal,
  type KycStatus,
} from "@/modules/kyc/transitions";
import type { Actor } from "@/platform/auth/session";
import {
  AuthorizationError,
  SeparationOfDutiesError,
} from "@/platform/authz/errors";
import { can, canApproveOwnRecord, type Permission } from "@/platform/authz/policy";
import { BusinessRuleError } from "@/platform/mutations/errors";

/** The subset of a case the business rules need. */
export interface CaseSnapshot {
  id: string;
  status: KycStatus;
  assignedToId: string | null;
  createdById: string;
}

const PERMISSION_VERBS: Readonly<Partial<Record<Permission, string>>> = {
  "kyc.read": "view KYC cases",
  "kyc.claim": "claim cases",
  "kyc.assign": "reassign cases",
  "kyc.request_info": "request information",
  "kyc.decide": "decide cases",
  "kyc.unmask": "reveal identity values",
};

export function assertPermission(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) {
    const verb = PERMISSION_VERBS[permission] ?? permission;
    throw new AuthorizationError(
      `The ${actor.role} role cannot ${verb}.`,
    );
  }
}

/** Approvers and administrators may work any case; operators only their own. */
export function isSeniorReviewer(actor: Actor): boolean {
  return actor.role === "approver" || actor.role === "administrator";
}

export function assertClaimable(actor: Actor, snapshot: CaseSnapshot): void {
  if (snapshot.assignedToId && snapshot.assignedToId !== actor.id) {
    throw new BusinessRuleError(
      "This case is assigned to another reviewer. Ask an approver to reassign it.",
    );
  }
}

/**
 * Pending cases may be claimed by anyone they are not already assigned to
 * someone else; a case waiting on the customer is resumed by its reviewer or a
 * senior reviewer, and stays with its reviewer.
 */
export function assertMayTakeReview(actor: Actor, snapshot: CaseSnapshot): void {
  if (snapshot.status === "information_requested") {
    assertMayWorkCase(actor, snapshot);
  } else {
    assertClaimable(actor, snapshot);
  }
}

/** The assigned reviewer, or a senior reviewer, may act on an open case. */
export function assertMayWorkCase(actor: Actor, snapshot: CaseSnapshot): void {
  if (snapshot.assignedToId === actor.id || isSeniorReviewer(actor)) {
    return;
  }
  throw new BusinessRuleError(
    "Only the assigned reviewer can act on this case.",
  );
}

export function assertMayDecide(
  actor: Actor,
  snapshot: CaseSnapshot,
  decision: "approve" | "reject",
): void {
  assertPermission(actor, "kyc.decide");
  if (snapshot.status === "escalated" && !isSeniorReviewer(actor)) {
    throw new AuthorizationError(
      "Escalated cases are decided by an approver or administrator.",
    );
  }
  assertMayWorkCase(actor, snapshot);
  if (
    decision === "approve" &&
    !canApproveOwnRecord(actor.id, snapshot.createdById)
  ) {
    throw new SeparationOfDutiesError(
      "You opened this case, so a different reviewer must approve it.",
    );
  }
}

export interface Capability {
  allowed: boolean;
  /** Why the action is unavailable, shown in the read-only state. */
  reason?: string;
}

export interface CaseCapabilities {
  /** Claim (pending) or resume (information requested); both land in review. */
  claim: Capability;
  requestInformation: Capability;
  decide: Capability;
  approve: Capability;
  reassign: Capability;
  unmask: Capability;
}

function evaluate(check: () => void): Capability {
  try {
    check();
    return { allowed: true };
  } catch (error: unknown) {
    if (
      error instanceof BusinessRuleError ||
      error instanceof AuthorizationError
    ) {
      return { allowed: false, reason: error.message };
    }
    throw error;
  }
}

/**
 * Evaluates the same server rules the mutations enforce so the UI can explain
 * why an action is unavailable. This is presentation only; the mutations
 * re-run every check inside the transaction.
 */
export function caseCapabilities(
  actor: Actor,
  snapshot: CaseSnapshot,
): CaseCapabilities {
  return {
    claim: evaluate(() => {
      assertPermission(actor, "kyc.claim");
      assertTransition(snapshot.status, "in_review");
      assertMayTakeReview(actor, snapshot);
    }),
    requestInformation: evaluate(() => {
      assertPermission(actor, "kyc.request_info");
      assertTransition(snapshot.status, "information_requested");
      assertMayWorkCase(actor, snapshot);
    }),
    decide: evaluate(() => {
      assertPermission(actor, "kyc.decide");
      if (isTerminal(snapshot.status)) {
        throw new BusinessRuleError("This case is closed.");
      }
      if (!canTransition(snapshot.status, "rejected")) {
        throw new BusinessRuleError(
          "Claim the case and review it before choosing a decision.",
        );
      }
      assertMayDecide(actor, snapshot, "reject");
    }),
    approve: evaluate(() => assertMayDecide(actor, snapshot, "approve")),
    reassign: evaluate(() => {
      assertPermission(actor, "kyc.assign");
      assertReassignable(snapshot.status);
    }),
    unmask: evaluate(() => {
      assertPermission(actor, "kyc.unmask");
      assertMayWorkCase(actor, snapshot);
    }),
  };
}
