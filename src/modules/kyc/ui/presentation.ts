import type { QueueParams, RiskLevel } from "@/modules/kyc/schemas";
import { isTerminal, type KycStatus } from "@/modules/kyc/transitions";
import type { StatusTone } from "@/platform/ui/status-badge";

export const KYC_ROUTE = "/kyc";

const DEFAULTS: Partial<Record<keyof QueueParams, string>> = {
  sort: "sla",
  dir: "asc",
};

/** Serialises queue state to a deep-linkable URL, dropping defaults. */
export function queueHref(
  params: QueueParams,
  overrides: Partial<Record<keyof QueueParams, string | undefined>> = {},
): string {
  const merged: Record<string, string | undefined> = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const key of Object.keys(merged).sort()) {
    const value = merged[key];
    if (value && DEFAULTS[key as keyof QueueParams] !== value) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `${KYC_ROUTE}?${query}` : KYC_ROUTE;
}

export const STATUS_TONE: Readonly<Record<KycStatus, StatusTone>> = {
  pending_review: "neutral",
  in_review: "info",
  information_requested: "warning",
  escalated: "warning",
  approved: "success",
  rejected: "danger",
};

export const RISK_TONE: Readonly<Record<RiskLevel, StatusTone>> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export const RISK_LABELS: Readonly<Record<RiskLevel, string>> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function formatDateTime(value: Date): string {
  return `${dateTime.format(value)} UTC`;
}

export function formatDate(value: Date): string {
  return dateOnly.format(value);
}

export interface SlaPresentation {
  label: string;
  tone: StatusTone;
  breached: boolean;
}

/** Relative SLA text that never relies on colour alone. */
export function describeSla(
  dueAt: Date,
  status: KycStatus,
  now: Date,
): SlaPresentation {
  if (isTerminal(status)) {
    return { label: "Closed", tone: "neutral", breached: false };
  }
  const diffMs = dueAt.getTime() - now.getTime();
  const hours = Math.round(Math.abs(diffMs) / 3_600_000);
  const span =
    hours < 1
      ? "under an hour"
      : hours < 48
        ? `${hours}h`
        : `${Math.round(hours / 24)}d`;
  if (diffMs < 0) {
    return { label: `Breached by ${span}`, tone: "danger", breached: true };
  }
  if (hours <= 24) {
    return { label: `Due in ${span}`, tone: "warning", breached: false };
  }
  return { label: `Due in ${span}`, tone: "neutral", breached: false };
}

export function humanise(value: string): string {
  const spaced = value.toLowerCase().replace(/[._]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
