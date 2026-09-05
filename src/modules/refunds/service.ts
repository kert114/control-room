import { eq } from "drizzle-orm";

import type { Actor } from "@/platform/auth/session";
import type { RefundRow } from "@/platform/db/schema";
import { refunds } from "@/platform/db/schema";
import {
  assertRowUpdated,
  bumpVersion,
  versionedWhere,
  withBusinessTransaction,
} from "@/platform/mutations/transaction";
import {
  BusinessRuleError,
  OptimisticConcurrencyError,
  type MutationResult,
} from "@/platform/mutations/errors";

import {
  approveInputSchema,
  escalateInputSchema,
  rejectInputSchema,
} from "@/modules/refunds/params";
import { planDecision } from "@/modules/refunds/decisions";
import { readPolicy } from "@/modules/refunds/policy";

export type RefundActionResult =
  | MutationResult<{
      id: string;
      reference: string;
      version: number;
      status: RefundRow["status"];
      decidedAt: string;
    }>
  | {
      ok: false;
      code: "validation";
      fieldErrors: Record<string, string>;
      message: string;
    };

function validationResult(
  error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } },
): RefundActionResult {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : [],
    ),
  );
  return {
    ok: false,
    code: "validation",
    fieldErrors,
    message: "Review the highlighted fields.",
  };
}

function actionResult(
  actor: Actor,
  decision: "approve" | "reject" | "escalate",
  input: unknown,
): Promise<RefundActionResult> {
  const schema =
    decision === "approve"
      ? approveInputSchema
      : decision === "reject"
        ? rejectInputSchema
        : escalateInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return Promise.resolve(validationResult(parsed.error));
  }

  const decisionNote =
    "decisionNote" in parsed.data ? parsed.data.decisionNote : undefined;
  return withBusinessTransaction(async ({ tx, audit }) => {
    const [refund] = await tx
      .select()
      .from(refunds)
      .where(eq(refunds.id, parsed.data.id))
      .for("update")
      .limit(1);
    if (!refund) {
      throw new BusinessRuleError("This refund no longer exists.");
    }
    if (refund.version !== parsed.data.version) {
      throw new OptimisticConcurrencyError(
        "refund",
        parsed.data.id,
        parsed.data.version,
      );
    }

    const policy = await readPolicy(tx, refund.currency);
    const plan = planDecision({
      decision,
      actor,
      refund,
      policy,
    });
    const now = new Date();
    const [row] = await tx
      .update(refunds)
      .set({
        status: plan.toStatus,
        version: bumpVersion(refunds),
        updatedAt: now,
        ...(decision === "reject"
          ? { decisionNote: decisionNote as string }
          : {}),
        ...(decision === "escalate"
          ? { escalatedById: actor.id, escalatedAt: now }
          : {}),
        ...(decision === "approve" || decision === "reject"
          ? { approvedById: actor.id, decidedAt: now }
          : {}),
      })
      .where(versionedWhere(refunds, parsed.data.id, parsed.data.version))
      .returning();
    const updated = assertRowUpdated(
      [row].filter((value): value is RefundRow => Boolean(value)),
      "refund",
      parsed.data.id,
      parsed.data.version,
    );
    await audit({
      action: plan.action,
      actorId: actor.id,
      actorRole: actor.role,
      entityType: "refund",
      entityId: updated.id,
      entityVersion: updated.version,
      summary: plan.summary,
      metadata: plan.metadata,
    });

    return {
      id: updated.id,
      reference: updated.reference,
      version: updated.version,
      status: updated.status,
      decidedAt:
        updated.decidedAt?.toISOString() ??
        updated.escalatedAt?.toISOString() ??
        now.toISOString(),
    };
  });
}

export function approveRefund(
  actor: Actor,
  input: unknown,
): Promise<RefundActionResult> {
  return actionResult(actor, "approve", input);
}

export function rejectRefund(
  actor: Actor,
  input: unknown,
): Promise<RefundActionResult> {
  return actionResult(actor, "reject", input);
}

export function escalateRefund(
  actor: Actor,
  input: unknown,
): Promise<RefundActionResult> {
  return actionResult(actor, "escalate", input);
}
