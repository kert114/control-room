import { eq } from "drizzle-orm";

import type { RefundApprovalPolicyRow } from "@/platform/db/schema";
import { refundApprovalPolicy } from "@/platform/db/schema";
import type { Transaction } from "@/platform/db/client";
import { BusinessRuleError } from "@/platform/mutations/errors";

export function requiresEscalation(
  amountMinor: number,
  policy: Pick<RefundApprovalPolicyRow, "thresholdMinor">,
): boolean {
  return amountMinor > policy.thresholdMinor;
}

export async function readPolicy(
  tx: Transaction,
  currency: string,
): Promise<RefundApprovalPolicyRow> {
  const [policy] = await tx
    .select()
    .from(refundApprovalPolicy)
    .where(eq(refundApprovalPolicy.currency, currency))
    .limit(1);
  if (!policy) {
    throw new BusinessRuleError(
      `No approval policy is configured for ${currency}.`,
    );
  }
  return policy;
}

export function thresholdMessage(
  policy: Pick<RefundApprovalPolicyRow, "thresholdMinor" | "currency">,
): string {
  const threshold = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: policy.currency,
  }).format(policy.thresholdMinor / 100);
  return `Refunds above ${threshold} must be escalated before approval.`;
}
