import type { StatusTone } from "@/platform/ui/status-badge";

import type { RefundStatus } from "@/modules/refunds/params";

export const STATUS_LABEL: Record<RefundStatus, string> = {
  pending_approval: "Pending approval",
  escalated: "Escalated",
  approved: "Approved",
  rejected: "Rejected",
  settled: "Settled",
  draft: "Draft",
};

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function statusTone(status: RefundStatus): StatusTone {
  switch (status) {
    case "pending_approval":
      return "info";
    case "escalated":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}
