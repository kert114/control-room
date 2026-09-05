import type { ChangeRequestRow } from "@/platform/db/schema";
import type { StatusTone } from "@/platform/ui/status-badge";

import type { FlagEnvironment } from "@/modules/flags/rules";
import type { ChangeRequestStatus } from "@/modules/flags/transitions";

export const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export interface FlagStateLike {
  enabled: boolean;
  rolloutPercentage: number;
  killedAt: Date | null;
}

export function describeState(state: FlagStateLike): string {
  if (state.killedAt) {
    return "Killed";
  }
  return state.enabled ? `On · ${state.rolloutPercentage}%` : "Off";
}

export function describeProposal(enabled: boolean, rollout: number): string {
  return enabled ? `On · ${rollout}%` : "Off";
}

export function stateTone(state: FlagStateLike): StatusTone {
  if (state.killedAt) {
    return "danger";
  }
  return state.enabled ? "success" : "neutral";
}

export const ENVIRONMENT_TONE: Record<FlagEnvironment, StatusTone> = {
  development: "neutral",
  staging: "info",
  production: "warning",
};

export const STATUS_TONE: Record<ChangeRequestStatus, StatusTone> = {
  pending_approval: "warning",
  approved: "info",
  applied: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export const KIND_LABEL: Record<ChangeRequestRow["kind"], string> = {
  rollout: "Rollout change",
  kill_switch: "Kill switch",
};
