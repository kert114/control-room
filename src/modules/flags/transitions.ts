import type { ChangeRequestRow } from "@/platform/db/schema";
import { BusinessRuleError } from "@/platform/mutations/errors";

export type ChangeRequestStatus = ChangeRequestRow["status"];

/**
 * Lifecycle of a change request. `approved` is a legacy status that new
 * requests never enter: approval applies the change in the same transaction,
 * so a request moves straight from `pending_approval` to `applied`.
 */
export const CHANGE_REQUEST_TRANSITIONS: Record<
  ChangeRequestStatus,
  readonly ChangeRequestStatus[]
> = {
  pending_approval: ["applied", "rejected", "cancelled"],
  approved: [],
  applied: [],
  rejected: [],
  cancelled: [],
};

export function isOpen(status: ChangeRequestStatus): boolean {
  return CHANGE_REQUEST_TRANSITIONS[status].length > 0;
}

export function canTransition(
  from: ChangeRequestStatus,
  to: ChangeRequestStatus,
): boolean {
  return CHANGE_REQUEST_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  reference: string,
  from: ChangeRequestStatus,
  to: ChangeRequestStatus,
): void {
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(
      `Change request ${reference} is ${STATUS_LABEL[from].toLowerCase()} and cannot move to ${STATUS_LABEL[to].toLowerCase()}.`,
    );
  }
}

export const STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  applied: "Applied",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
