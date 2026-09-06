import { and, eq, sql } from "drizzle-orm";

import type { Actor } from "@/platform/auth/session";
import {
  approvals,
  changeRequests,
  featureFlags,
  type ChangeRequestRow,
  type FeatureFlagRow,
} from "@/platform/db/schema";
import {
  BusinessRuleError,
  OptimisticConcurrencyError,
  type MutationResult,
} from "@/platform/mutations/errors";
import {
  assertRowUpdated,
  bumpVersion,
  versionedWhere,
  withBusinessTransaction,
  type MutationContext,
  type Transaction,
} from "@/platform/mutations/transaction";

import {
  assertCanApplyDirectly,
  assertCanCancel,
  assertCanDecide,
  assertCanKill,
  assertCanRequestRollout,
  assertFlagNotKilled,
  assertKillSwitchConfirmation,
  assertNoOpenRequest,
  changeRequestMetadata,
  ENVIRONMENT_LABEL,
  flagMetadata,
  requiresChangeRequest,
} from "@/modules/flags/rules";
import type { NoticeCode } from "@/modules/flags/url-state";
import type {
  CancelInput,
  DecisionInput,
  DirectChangeInput,
  KillSwitchInput,
  RolloutChangeInput,
} from "@/modules/flags/schemas";
import {
  parseTargeting,
  regionsFromTargeting,
  sameRegions,
  withRegions,
  type TargetingRule,
} from "@/modules/flags/targeting";

export interface ActionOutcome {
  notice: NoticeCode;
  entityType: "feature_flag" | "change_request";
  entityId: string;
  reference: string;
  version: number;
  summary: string;
  actorName: string;
  occurredAt: Date;
}

export type FlagsActionResult = MutationResult<ActionOutcome>;

async function lockFlag(tx: Transaction, id: string): Promise<FeatureFlagRow> {
  const [flag] = await tx
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.id, id))
    .for("update")
    .limit(1);
  if (!flag) {
    throw new BusinessRuleError("This flag no longer exists.");
  }
  return flag;
}

async function lockRequest(tx: Transaction, id: string): Promise<ChangeRequestRow> {
  const [request] = await tx
    .select()
    .from(changeRequests)
    .where(eq(changeRequests.id, id))
    .for("update")
    .limit(1);
  if (!request) {
    throw new BusinessRuleError("This change request no longer exists.");
  }
  return request;
}

function assertFreshVersion(
  entityType: string,
  row: { id: string; version: number },
  expectedVersion: number,
): void {
  if (row.version !== expectedVersion) {
    throw new OptimisticConcurrencyError(entityType, row.id, expectedVersion);
  }
}

async function openRequestFor(
  tx: Transaction,
  flagId: string,
): Promise<ChangeRequestRow | undefined> {
  const [request] = await tx
    .select()
    .from(changeRequests)
    .where(
      and(
        eq(changeRequests.flagId, flagId),
        eq(changeRequests.status, "pending_approval"),
      ),
    )
    .limit(1);
  return request;
}

async function nextReference(tx: Transaction): Promise<string> {
  const [row] = await tx
    .select({
      max: sql<number>`coalesce(max(nullif(substring(${changeRequests.reference} from 4), '')::int), 9000)`,
    })
    .from(changeRequests);
  return `CR-${(row?.max ?? 9000) + 1}`;
}

function assertIsAChange(
  flag: Pick<FeatureFlagRow, "enabled" | "rolloutPercentage">,
  proposed: Pick<RolloutChangeInput, "enabled" | "rolloutPercentage">,
  targetingChanged = false,
): void {
  if (
    !targetingChanged &&
    flag.enabled === proposed.enabled &&
    flag.rolloutPercentage === proposed.rolloutPercentage
  ) {
    throw new BusinessRuleError(
      "The proposed state matches the current state. Change the switch, the rollout percentage, or the regions.",
    );
  }
}

interface FlagUpdate {
  enabled: boolean;
  rolloutPercentage: number;
  killedAt: Date | null;
  targeting?: TargetingRule[];
}

async function updateFlag(
  tx: Transaction,
  flag: FeatureFlagRow,
  update: FlagUpdate,
  actor: Actor,
): Promise<FeatureFlagRow> {
  const rows = await tx
    .update(featureFlags)
    .set({
      enabled: update.enabled,
      rolloutPercentage: update.rolloutPercentage,
      killedAt: update.killedAt,
      ...(update.targeting ? { targeting: update.targeting } : {}),
      updatedById: actor.id,
      updatedAt: new Date(),
      version: bumpVersion(featureFlags),
    })
    .where(versionedWhere(featureFlags, flag.id, flag.version))
    .returning();
  return assertRowUpdated(rows, "feature_flag", flag.id, flag.version);
}

async function updateRequest(
  tx: Transaction,
  request: ChangeRequestRow,
  set: Partial<Pick<ChangeRequestRow, "status" | "appliedAt" | "appliedById">>,
): Promise<ChangeRequestRow> {
  const rows = await tx
    .update(changeRequests)
    .set({ ...set, updatedAt: new Date(), version: bumpVersion(changeRequests) })
    .where(versionedWhere(changeRequests, request.id, request.version))
    .returning();
  return assertRowUpdated(rows, "change_request", request.id, request.version);
}

function outcome(
  actor: Actor,
  notice: NoticeCode,
  entityType: ActionOutcome["entityType"],
  row: { id: string; version: number },
  reference: string,
  summary: string,
): ActionOutcome {
  return {
    notice,
    entityType,
    entityId: row.id,
    reference,
    version: row.version,
    summary,
    actorName: actor.name,
    occurredAt: new Date(),
  };
}

/** Production rollout change: raises a request that a second person must approve. */
export async function createChangeRequest(
  actor: Actor,
  input: RolloutChangeInput,
): Promise<FlagsActionResult> {
  return withBusinessTransaction(async ({ tx, audit }) => {
    const flag = await lockFlag(tx, input.flagId);
    assertCanRequestRollout(actor, flag);
    assertFreshVersion("feature_flag", flag, input.flagVersion);
    assertNoOpenRequest(flag, await openRequestFor(tx, flag.id));
    assertIsAChange(flag, input);

    const reference = await nextReference(tx);
    const [request] = await tx
      .insert(changeRequests)
      .values({
        reference,
        flagId: flag.id,
        requestedById: actor.id,
        previousEnabled: flag.enabled,
        previousRollout: flag.rolloutPercentage,
        proposedEnabled: input.enabled,
        proposedRollout: input.rolloutPercentage,
        reason: input.reason,
        ticket: input.ticket ?? null,
        kind: "rollout",
        status: "pending_approval",
        requiresApproval: true,
      })
      .returning();
    if (!request) {
      throw new Error("Change request insert returned no row.");
    }

    await audit({
      action: "flag_change_request.created",
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "change_request",
      entityId: request.id,
      entityVersion: request.version,
      summary: `Raised change request ${reference} for ${flag.key} in production.`,
      metadata: changeRequestMetadata(request, flag),
    });

    return outcome(
      actor,
      "request_created",
      "change_request",
      request,
      reference,
      `Change request ${reference} submitted for a second-person approval.`,
    );
  });
}

/** Development and staging: an administrator applies the change immediately. */
export async function applyDirectChange(
  actor: Actor,
  input: DirectChangeInput,
): Promise<FlagsActionResult> {
  return withBusinessTransaction(async ({ tx, audit }) => {
    const flag = await lockFlag(tx, input.flagId);
    assertCanApplyDirectly(actor, flag);
    assertFreshVersion("feature_flag", flag, input.flagVersion);
    assertNoOpenRequest(flag, await openRequestFor(tx, flag.id));
    const targeting = parseTargeting(flag.targeting);
    const regionsChanged = !sameRegions(regionsFromTargeting(targeting), input.regions);
    assertIsAChange(flag, input, regionsChanged);

    const reference = await nextReference(tx);
    const now = new Date();
    await tx.insert(changeRequests).values({
      reference,
      flagId: flag.id,
      requestedById: actor.id,
      previousEnabled: flag.enabled,
      previousRollout: flag.rolloutPercentage,
      proposedEnabled: input.enabled,
      proposedRollout: input.rolloutPercentage,
      reason: input.reason,
      ticket: input.ticket ?? null,
      kind: "rollout",
      status: "applied",
      requiresApproval: false,
      appliedAt: now,
      appliedById: actor.id,
    });

    const updated = await updateFlag(
      tx,
      flag,
      {
        enabled: input.enabled,
        rolloutPercentage: input.rolloutPercentage,
        killedAt: input.enabled ? null : flag.killedAt,
        targeting: withRegions(targeting, input.regions),
      },
      actor,
    );

    await audit({
      action: "flag.updated",
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "feature_flag",
      entityId: updated.id,
      entityVersion: updated.version,
      summary: `Updated ${flag.key} in ${ENVIRONMENT_LABEL[flag.environment].toLowerCase()} (${reference}).`,
      metadata: { ...flagMetadata(updated, flag), reference },
    });

    return outcome(
      actor,
      "flag_updated",
      "feature_flag",
      updated,
      reference,
      `${flag.key} updated in ${ENVIRONMENT_LABEL[flag.environment].toLowerCase()}.`,
    );
  });
}

/**
 * Kill switch. Production raises a kill request for a second person; other
 * environments are killed immediately. Both require the typed flag key.
 */
export async function requestKillSwitch(
  actor: Actor,
  input: KillSwitchInput,
): Promise<FlagsActionResult> {
  return withBusinessTransaction(async ({ tx, audit }) => {
    const flag = await lockFlag(tx, input.flagId);
    assertCanKill(actor);
    assertKillSwitchConfirmation(flag, input.confirmation);
    assertFreshVersion("feature_flag", flag, input.flagVersion);
    assertFlagNotKilled(flag);
    assertNoOpenRequest(flag, await openRequestFor(tx, flag.id));

    const reference = await nextReference(tx);
    const production = requiresChangeRequest(flag.environment);
    const now = new Date();
    const [request] = await tx
      .insert(changeRequests)
      .values({
        reference,
        flagId: flag.id,
        requestedById: actor.id,
        previousEnabled: flag.enabled,
        previousRollout: flag.rolloutPercentage,
        proposedEnabled: false,
        proposedRollout: 0,
        reason: input.reason,
        kind: "kill_switch",
        status: production ? "pending_approval" : "applied",
        requiresApproval: production,
        appliedAt: production ? null : now,
        appliedById: production ? null : actor.id,
      })
      .returning();
    if (!request) {
      throw new Error("Change request insert returned no row.");
    }

    if (production) {
      await audit({
        action: "flag.kill_switch_requested",
        actorId: actor.id,
        actorRole: actor.role,
        entityType: "change_request",
        entityId: request.id,
        entityVersion: request.version,
        summary: `Requested kill switch ${reference} for ${flag.key} in production.`,
        metadata: changeRequestMetadata(request, flag),
      });
      return outcome(
        actor,
        "kill_requested",
        "change_request",
        request,
        reference,
        `Kill switch ${reference} submitted; production needs a second-person approval.`,
      );
    }

    const updated = await updateFlag(
      tx,
      flag,
      { enabled: false, rolloutPercentage: 0, killedAt: now },
      actor,
    );
    await audit({
      action: "flag.kill_switch_applied",
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "feature_flag",
      entityId: updated.id,
      entityVersion: updated.version,
      summary: `Killed ${flag.key} in ${ENVIRONMENT_LABEL[flag.environment].toLowerCase()} (${reference}).`,
      metadata: { ...flagMetadata(updated, flag), reference },
    });
    return outcome(
      actor,
      "flag_killed",
      "feature_flag",
      updated,
      reference,
      `${flag.key} killed in ${ENVIRONMENT_LABEL[flag.environment].toLowerCase()}.`,
    );
  });
}

async function recordDecision(
  { tx, audit }: MutationContext,
  actor: Actor,
  request: ChangeRequestRow,
  flag: FeatureFlagRow,
  decision: "approved" | "rejected",
  status: "applied" | "rejected",
  note: string | undefined,
  applied: { at: Date; by: string } | null,
): Promise<ChangeRequestRow> {
  const updated = await updateRequest(tx, request, {
    status,
    appliedAt: applied?.at ?? null,
    appliedById: applied?.by ?? null,
  });
  await tx.insert(approvals).values({
    changeRequestId: request.id,
    approvedById: actor.id,
    decision,
    note: note ?? null,
  });
  const base = {
    actorId: actor.id,
    actorRole: actor.role,
    entityType: "change_request",
    entityId: updated.id,
    entityVersion: updated.version,
    metadata: changeRequestMetadata(updated, flag),
  } as const;
  await audit({
    ...base,
    action:
      decision === "approved"
        ? "flag_change_request.approved"
        : "flag_change_request.rejected",
    summary: `${decision === "approved" ? "Approved" : "Rejected"} change request ${request.reference}.`,
  });
  if (status === "applied") {
    await audit({
      ...base,
      action: "flag_change_request.applied",
      summary: `Applied change request ${request.reference} to ${flag.key}.`,
    });
  }
  return updated;
}

/** Second-person approval; the flag update lands in the same transaction. */
export async function approveChangeRequest(
  actor: Actor,
  input: DecisionInput,
): Promise<FlagsActionResult> {
  return withBusinessTransaction(async (context) => {
    const { tx, audit } = context;
    const request = await lockRequest(tx, input.requestId);
    const flag = await lockFlag(tx, request.flagId);
    assertCanDecide(actor, request, "applied");
    assertFreshVersion("change_request", request, input.requestVersion);
    if (input.flagVersion !== undefined) {
      assertFreshVersion("feature_flag", flag, input.flagVersion);
    }
    if (
      flag.enabled !== request.previousEnabled ||
      flag.rolloutPercentage !== request.previousRollout
    ) {
      throw new BusinessRuleError(
        `${flag.key} changed after ${request.reference} was raised. Reject this request and raise a new one from the current state.`,
      );
    }

    const now = new Date();
    const kill = request.kind === "kill_switch";
    const updatedFlag = await updateFlag(
      tx,
      flag,
      {
        enabled: request.proposedEnabled,
        rolloutPercentage: request.proposedRollout,
        killedAt: kill ? now : request.proposedEnabled ? null : flag.killedAt,
      },
      actor,
    );
    const updatedRequest = await recordDecision(
      context,
      actor,
      request,
      flag,
      "approved",
      "applied",
      input.note,
      { at: now, by: actor.id },
    );
    await audit({
      action: kill ? "flag.kill_switch_applied" : "flag.updated",
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "feature_flag",
      entityId: updatedFlag.id,
      entityVersion: updatedFlag.version,
      summary: `${kill ? "Killed" : "Updated"} ${flag.key} in production (${request.reference}).`,
      metadata: { ...flagMetadata(updatedFlag, flag), reference: request.reference },
    });

    return outcome(
      actor,
      "request_applied",
      "change_request",
      updatedRequest,
      request.reference,
      `${request.reference} approved and applied to ${flag.key} in production.`,
    );
  });
}

export async function rejectChangeRequest(
  actor: Actor,
  input: DecisionInput,
): Promise<FlagsActionResult> {
  return withBusinessTransaction(async (context) => {
    const request = await lockRequest(context.tx, input.requestId);
    const flag = await lockFlag(context.tx, request.flagId);
    assertCanDecide(actor, request, "rejected");
    assertFreshVersion("change_request", request, input.requestVersion);
    const updated = await recordDecision(
      context,
      actor,
      request,
      flag,
      "rejected",
      "rejected",
      input.note,
      null,
    );
    return outcome(
      actor,
      "request_rejected",
      "change_request",
      updated,
      request.reference,
      `${request.reference} rejected; ${flag.key} is unchanged.`,
    );
  });
}

export async function cancelChangeRequest(
  actor: Actor,
  input: CancelInput,
): Promise<FlagsActionResult> {
  return withBusinessTransaction(async ({ tx, audit }) => {
    const request = await lockRequest(tx, input.requestId);
    const flag = await lockFlag(tx, request.flagId);
    assertCanCancel(actor, request);
    assertFreshVersion("change_request", request, input.requestVersion);
    const updated = await updateRequest(tx, request, { status: "cancelled" });
    await audit({
      action: "flag_change_request.cancelled",
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "change_request",
      entityId: updated.id,
      entityVersion: updated.version,
      summary: `Cancelled change request ${request.reference}.`,
      metadata: changeRequestMetadata(updated, flag),
    });
    return outcome(
      actor,
      "request_cancelled",
      "change_request",
      updated,
      request.reference,
      `${request.reference} cancelled; ${flag.key} is unchanged.`,
    );
  });
}
