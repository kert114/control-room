import { isSeniorReviewer } from "@/modules/kyc/rules";
import type { QueueParams, RiskLevel } from "@/modules/kyc/schemas";
import { STATUS_LABELS, isTerminal, type KycStatus } from "@/modules/kyc/transitions";
import type { Actor } from "@/platform/auth/session";
import type { StatusTone } from "@/platform/ui/status-badge";

export const KYC_ROUTE = "/kyc";

const DEFAULTS: Partial<Record<keyof QueueParams, string>> = {
  sort: "sla",
  dir: "asc",
};

/** Serialises queue state to a deep-linkable URL, dropping defaults. */
export function queueHref(
  params: QueueParams,
  overrides: Partial<
    Record<keyof QueueParams, string | readonly string[] | undefined>
  > = {},
): string {
  const merged: Record<string, string | readonly string[] | undefined> = {
    ...params,
    ...overrides,
  };
  const search = new URLSearchParams();
  for (const key of Object.keys(merged).sort()) {
    const value = merged[key];
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item);
    } else if (
      typeof value === "string" &&
      value &&
      DEFAULTS[key as keyof QueueParams] !== value
    ) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `${KYC_ROUTE}?${query}` : KYC_ROUTE;
}

export function hasActiveFilters(params: QueueParams): boolean {
  return Boolean(
    params.q ||
      params.risk.length > 0 ||
      params.status.length > 0 ||
      params.country ||
      params.assignee ||
      params.sla,
  );
}

export const CLEARED_FILTERS = {
  q: undefined,
  risk: undefined,
  status: undefined,
  country: undefined,
  assignee: undefined,
  sla: undefined,
} as const;

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

/**
 * Relative SLA text that never relies on colour alone. Closed cases read
 * "Closed" in the neutral tone; open cases always carry a due/breached label.
 */
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
  return { label: `Due in ${span}`, tone: "success", breached: false };
}

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

/** Country name for an ISO 3166-1 alpha-2 code; falls back to the code. */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface NextStep {
  /** Who the case is waiting on. */
  owner: string;
  /** What they need to do. */
  action: string;
  /** True when the signed-in actor is the one expected to act. */
  mine: boolean;
}

/**
 * Explains who the case is waiting on and what for, so the queue makes review
 * ownership explicit instead of implying it through status alone.
 */
export function describeNextStep(
  row: {
    status: KycStatus;
    assignedToId: string | null;
    assignedToName: string | null;
  },
  actor: Actor,
): NextStep {
  const senior = isSeniorReviewer(actor);
  const canWork = actor.role !== "auditor";
  const assignedToMe = row.assignedToId === actor.id;
  const reviewer = assignedToMe ? "You" : row.assignedToName;
  switch (row.status) {
    case "pending_review":
      return { owner: reviewer ?? "Any reviewer", action: "claim and review", mine: canWork && (assignedToMe || !row.assignedToId) };
    case "in_review":
      return { owner: reviewer ?? "Unassigned", action: "review and decide", mine: assignedToMe };
    case "information_requested":
      return { owner: "Customer", action: assignedToMe ? "you resume once received" : `${row.assignedToName ?? "a reviewer"} resumes once received`, mine: assignedToMe };
    case "escalated":
      return { owner: senior ? "You" : "Approver or administrator", action: "final decision", mine: senior };
    case "approved":
    case "rejected":
      return { owner: "Nobody", action: STATUS_LABELS[row.status].toLowerCase(), mine: false };
  }
}

export function humanise(value: string): string {
  const spaced = value.toLowerCase().replace(/[._]/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
