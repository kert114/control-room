import type { AuditAction, AuditMetadata } from "@/platform/audit/events";
import {
  can,
  canApproveOwnRecord,
  type Permission,
  type Role,
} from "@/platform/authz/policy";
import {
  AuthorizationError,
  SeparationOfDutiesError,
} from "@/platform/authz/errors";
import { BusinessRuleError } from "@/platform/mutations/errors";
import type {
  RefundApprovalPolicyRow,
  RefundRow,
} from "@/platform/db/schema";

import { thresholdMessage, requiresEscalation } from "@/modules/refunds/policy";
import { assertTransition, availableDecisions } from "@/modules/refunds/transitions";
import type { Decision } from "@/modules/refunds/params";
import type { RefundStatus } from "@/modules/refunds/params";

export interface DecisionPlan {
  toStatus: RefundStatus;
  action: AuditAction;
  summary: string;
  metadata: AuditMetadata;
}

interface DecisionInput {
  decision: Decision;
  actor: { id: string; role: Role };
  refund: Pick<
    RefundRow,
    | "id"
    | "reference"
    | "status"
    | "amountMinor"
    | "currency"
    | "requestedById"
    | "escalatedById"
  >;
  policy: Pick<RefundApprovalPolicyRow, "thresholdMinor" | "currency">;
}

const PERMISSION_BY_DECISION = {
  approve: "refunds.approve",
  reject: "refunds.approve",
  escalate: "refunds.escalate",
} as const;

const SUMMARY_VERB = {
  approve: "Approved",
  reject: "Rejected",
  escalate: "Escalated",
} as const;

const STATUS_BY_DECISION = {
  approve: "approved",
  reject: "rejected",
  escalate: "escalated",
} as const;

const ACTION_BY_DECISION = {
  approve: "refund.approved",
  reject: "refund.rejected",
  escalate: "refund.escalated",
} as const;

export function permissionForDecision(decision: Decision): Permission {
  return PERMISSION_BY_DECISION[decision];
}

export interface DecisionOption {
  decision: Decision;
  blockedBy: string | null;
}

/** Non-throwing preview of `planDecision` so the UI can explain a block before the click. */
export function describeDecisions(input: Omit<DecisionInput, "decision">): DecisionOption[] {
  return availableDecisions(input.refund.status).map((decision) => {
    try {
      planDecision({ ...input, decision });
      return { decision, blockedBy: null };
    } catch (error: unknown) {
      if (error instanceof SeparationOfDutiesError || error instanceof BusinessRuleError) {
        return { decision, blockedBy: error.message };
      }
      if (error instanceof AuthorizationError) {
        return {
          decision,
          blockedBy: `The ${input.actor.role} role cannot ${decision} refunds.`,
        };
      }
      throw error;
    }
  });
}

export function planDecision(input: DecisionInput): DecisionPlan {
  const { actor, decision, refund, policy } = input;
  if (!can(actor.role, permissionForDecision(decision))) {
    throw new AuthorizationError(
      `Role ${actor.role} is not allowed to ${permissionForDecision(decision)}.`,
    );
  }

  const toStatus = STATUS_BY_DECISION[decision];
  assertTransition(refund.status, toStatus);

  if (
    decision === "approve" &&
    refund.status === "pending_approval" &&
    requiresEscalation(refund.amountMinor, policy)
  ) {
    throw new BusinessRuleError(thresholdMessage(policy));
  }

  if (
    (decision === "approve" || decision === "reject") &&
    !canApproveOwnRecord(actor.id, refund.requestedById)
  ) {
    throw new SeparationOfDutiesError();
  }
  if (
    decision === "approve" &&
    refund.status === "escalated" &&
    refund.escalatedById &&
    !canApproveOwnRecord(actor.id, refund.escalatedById)
  ) {
    throw new SeparationOfDutiesError("You cannot approve a refund you escalated.");
  }

  return {
    toStatus,
    action: ACTION_BY_DECISION[decision],
    summary: `${SUMMARY_VERB[decision]} refund ${refund.reference}.`,
    metadata: {
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      thresholdMinor: policy.thresholdMinor,
      fromStatus: refund.status,
      toStatus,
    },
  };
}
