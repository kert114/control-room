import { BusinessRuleError } from "@/platform/mutations/errors";

import type { Decision } from "@/modules/refunds/params";
import type { RefundStatus } from "@/modules/refunds/params";

export const REFUND_TRANSITIONS: Record<
  RefundStatus,
  readonly RefundStatus[]
> = {
  draft: [],
  pending_approval: ["approved", "rejected", "escalated"],
  escalated: ["approved", "rejected"],
  approved: [],
  rejected: [],
  settled: [],
};

export function isTerminal(status: RefundStatus): boolean {
  return REFUND_TRANSITIONS[status].length === 0;
}

export function assertTransition(
  from: RefundStatus,
  to: RefundStatus,
): void {
  if (!REFUND_TRANSITIONS[from].includes(to)) {
    const action = to === "approved" ? "approve" : to === "rejected" ? "reject" : "escalate";
    throw new BusinessRuleError(
      `A ${from.replace("_", " ")} refund cannot be ${action}d.`,
    );
  }
}

export function availableDecisions(status: RefundStatus): Decision[] {
  if (status === "pending_approval") return ["approve", "reject", "escalate"];
  if (status === "escalated") return ["approve", "reject"];
  return [];
}
