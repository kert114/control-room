import type { Actor } from "@/platform/auth/session";
import {
  AuthorizationError,
  SeparationOfDutiesError,
} from "@/platform/authz/errors";
import {
  can,
  canApproveOwnRecord,
  type Permission,
} from "@/platform/authz/policy";
import type { AuditMetadata } from "@/platform/audit/events";
import type { ChangeRequestRow, FeatureFlagRow } from "@/platform/db/schema";
import { BusinessRuleError } from "@/platform/mutations/errors";

import { assertTransition, isOpen } from "@/modules/flags/transitions";

export type FlagEnvironment = FeatureFlagRow["environment"];

export const ENVIRONMENTS: readonly FlagEnvironment[] = [
  "development",
  "staging",
  "production",
];

export const ENVIRONMENT_LABEL: Record<FlagEnvironment, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};

/**
 * Staging rule A: development and staging are edited directly by an
 * administrator; production always goes through a two-person change request.
 */
export function requiresChangeRequest(environment: FlagEnvironment): boolean {
  return environment === "production";
}

export function assertPermission(actor: Actor, permission: Permission): void {
  if (!can(actor.role, permission)) {
    throw new AuthorizationError(
      `Role ${actor.role} is not allowed to ${permission}.`,
    );
  }
}

export function assertNoOpenRequest(
  flag: Pick<FeatureFlagRow, "key" | "environment">,
  openRequest: Pick<ChangeRequestRow, "reference" | "status"> | undefined,
): void {
  if (openRequest && isOpen(openRequest.status)) {
    throw new BusinessRuleError(
      `${flag.key} in ${ENVIRONMENT_LABEL[flag.environment].toLowerCase()} already has open change request ${openRequest.reference}. Wait for a decision or cancel it first.`,
    );
  }
}

export function assertFlagNotKilled(flag: Pick<FeatureFlagRow, "key" | "killedAt">): void {
  if (flag.killedAt) {
    throw new BusinessRuleError(
      `${flag.key} has already been killed. Raise a rollout change to bring it back.`,
    );
  }
}

export function assertCanRequestRollout(
  actor: Actor,
  flag: Pick<FeatureFlagRow, "key" | "environment">,
): void {
  assertPermission(actor, "flags.request_change");
  if (!requiresChangeRequest(flag.environment)) {
    throw new BusinessRuleError(
      `${ENVIRONMENT_LABEL[flag.environment]} flags are changed directly by an administrator, not through a change request.`,
    );
  }
}

export function assertCanApplyDirectly(
  actor: Actor,
  flag: Pick<FeatureFlagRow, "key" | "environment">,
): void {
  assertPermission(actor, "flags.edit_nonproduction");
  if (requiresChangeRequest(flag.environment)) {
    throw new BusinessRuleError(
      `Production changes to ${flag.key} need a change request approved by a second person.`,
    );
  }
}

export function assertKillSwitchConfirmation(
  flag: Pick<FeatureFlagRow, "key">,
  confirmation: string,
): void {
  if (confirmation !== flag.key) {
    throw new BusinessRuleError(
      `Type the flag key exactly (${flag.key}) to confirm the kill switch.`,
    );
  }
}

export function assertCanKill(actor: Actor): void {
  assertPermission(actor, "flags.kill");
}

export function assertCanDecide(
  actor: Actor,
  request: Pick<ChangeRequestRow, "reference" | "status" | "requestedById">,
  decision: "applied" | "rejected",
): void {
  assertPermission(actor, "flags.approve_change");
  assertTransition(request.reference, request.status, decision);
  if (!canApproveOwnRecord(actor.id, request.requestedById)) {
    throw new SeparationOfDutiesError(
      `You raised change request ${request.reference}; a different user must decide it.`,
    );
  }
}

export function assertCanCancel(
  actor: Actor,
  request: Pick<ChangeRequestRow, "reference" | "status" | "requestedById">,
): void {
  assertPermission(actor, "flags.request_change");
  assertTransition(request.reference, request.status, "cancelled");
  if (request.requestedById !== actor.id) {
    throw new AuthorizationError(
      `Only the requester can cancel change request ${request.reference}.`,
    );
  }
}

export function flagMetadata(
  flag: Pick<
    FeatureFlagRow,
    "key" | "environment" | "enabled" | "rolloutPercentage"
  >,
  previous: Pick<FeatureFlagRow, "enabled" | "rolloutPercentage">,
): AuditMetadata {
  return {
    flagKey: flag.key,
    environment: flag.environment,
    previousEnabled: previous.enabled,
    previousRollout: previous.rolloutPercentage,
    enabled: flag.enabled,
    rolloutPercentage: flag.rolloutPercentage,
  };
}

export function changeRequestMetadata(
  request: Pick<
    ChangeRequestRow,
    | "reference"
    | "kind"
    | "status"
    | "previousEnabled"
    | "previousRollout"
    | "proposedEnabled"
    | "proposedRollout"
    | "ticket"
  >,
  flag: Pick<FeatureFlagRow, "key" | "environment">,
): AuditMetadata {
  return {
    reference: request.reference,
    kind: request.kind,
    status: request.status,
    flagKey: flag.key,
    environment: flag.environment,
    previousEnabled: request.previousEnabled,
    previousRollout: request.previousRollout,
    proposedEnabled: request.proposedEnabled,
    proposedRollout: request.proposedRollout,
    ticket: request.ticket,
  };
}
