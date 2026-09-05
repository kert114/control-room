import type { AuditAction, AuditMetadata } from "@/platform/audit/events";
import { can, canApproveOwnRecord, type Role } from "@/platform/authz/policy";
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
import { assertTransition } from "@/modules/refunds/transitions";
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

export function planDecision(input: DecisionInput): DecisionPlan {
  const { actor, decision, refund, policy } = input;
  if (!can(actor.role, PERMISSION_BY_DECISION[decision])) {
    throw new AuthorizationError(
      `Role ${actor.role} is not allowed to ${PERMISSION_BY_DECISION[decision]}.`,
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
    summary: `${decision.charAt(0).toUpperCase()}${decision.slice(1)} refund ${refund.reference}.`,
    metadata: {
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      thresholdMinor: policy.thresholdMinor,
      fromStatus: refund.status,
      toStatus,
    },
  };
}
