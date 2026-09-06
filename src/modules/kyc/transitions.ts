import { kycCaseStatusEnum } from "@/platform/db/schema";
import { BusinessRuleError } from "@/platform/mutations/errors";

export const KYC_STATUSES = kycCaseStatusEnum.enumValues;

export type KycStatus = (typeof KYC_STATUSES)[number];

export const TERMINAL_STATUSES: readonly KycStatus[] = ["approved", "rejected"];

export const OPEN_STATUSES: readonly KycStatus[] = KYC_STATUSES.filter(
  (status) => !TERMINAL_STATUSES.includes(status),
);

/**
 * Every status change a case may make. Anything not listed here is rejected
 * server-side with a BusinessRuleError before any row is touched.
 */
export const TRANSITIONS: Readonly<Record<KycStatus, readonly KycStatus[]>> = {
  pending_review: ["in_review"],
  in_review: ["information_requested", "escalated", "approved", "rejected"],
  information_requested: ["in_review"],
  escalated: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

/** Statuses in which a case may be handed to a different reviewer. */
export const REASSIGNABLE_STATUSES: readonly KycStatus[] = [
  "pending_review",
  "in_review",
  "information_requested",
  "escalated",
];

export const STATUS_LABELS: Readonly<Record<KycStatus, string>> = {
  pending_review: "Pending review",
  in_review: "In review",
  information_requested: "Information requested",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
};

export function canTransition(from: KycStatus, to: KycStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: KycStatus, to: KycStatus): void {
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(
      `A case that is ${STATUS_LABELS[from].toLowerCase()} cannot move to ${STATUS_LABELS[to].toLowerCase()}.`,
    );
  }
}

export function isTerminal(status: KycStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function assertReassignable(status: KycStatus): void {
  if (!REASSIGNABLE_STATUSES.includes(status)) {
    throw new BusinessRuleError(
      `A case that is ${STATUS_LABELS[status].toLowerCase()} can no longer be reassigned.`,
    );
  }
}
