import { describe, expect, it } from "vitest";

import {
  assertNoSensitiveMetadata,
  auditMetadataSchema,
} from "@/platform/audit/events";
import { AuthorizationError, SeparationOfDutiesError } from "@/platform/authz/errors";
import { BusinessRuleError } from "@/platform/mutations/errors";

import { describeDecisions, planDecision } from "@/modules/refunds/decisions";
import { availableDecisions, isTerminal } from "@/modules/refunds/transitions";

const operator = { id: "operator", role: "operator" as const };
const approver = { id: "approver", role: "approver" as const };
const administrator = { id: "administrator", role: "administrator" as const };
const auditor = { id: "auditor", role: "auditor" as const };
const policy = { thresholdMinor: 50000, currency: "EUR" };

function refund(overrides: Partial<{
  status: "pending_approval" | "escalated" | "approved" | "rejected";
  amountMinor: number;
  requestedById: string;
  escalatedById: string | null;
}> = {}) {
  return {
    id: "refund",
    reference: "RFD-5001",
    status: "pending_approval" as const,
    amountMinor: 12500,
    currency: "EUR",
    requestedById: "operator",
    escalatedById: null,
    ...overrides,
  };
}

describe("refund decision planning", () => {
  it("plans an approval with safe audit metadata", () => {
    const plan = planDecision({
      decision: "approve",
      actor: approver,
      refund: refund(),
      policy,
    });
    expect(plan).toEqual({
      toStatus: "approved",
      action: "refund.approved",
      summary: "Approved refund RFD-5001.",
      metadata: {
        amountMinor: 12500,
        currency: "EUR",
        thresholdMinor: 50000,
        fromStatus: "pending_approval",
        toStatus: "approved",
      },
    });
    assertNoSensitiveMetadata(plan.metadata);
    auditMetadataSchema.parse(plan.metadata);
  });

  it("requires escalation above the configured threshold", () => {
    expect(() =>
      planDecision({
        decision: "approve",
        actor: approver,
        refund: refund({ amountMinor: 61000 }),
        policy,
      }),
    ).toThrowError(/€500\.00.*escalated/);
    expect(() =>
      planDecision({
        decision: "approve",
        actor: approver,
        refund: refund({ amountMinor: 61000 }),
        policy,
      }),
    ).toThrow(BusinessRuleError);
  });

  it("checks authorization before separation of duties", () => {
    expect(() =>
      planDecision({ decision: "approve", actor: operator, refund: refund(), policy }),
    ).toThrow(AuthorizationError);
    expect(() =>
      planDecision({ decision: "approve", actor: approver, refund: refund({ requestedById: "approver" }), policy }),
    ).toThrow(SeparationOfDutiesError);
    expect(() =>
      planDecision({
        decision: "approve",
        actor: administrator,
        refund: refund({ status: "escalated", escalatedById: "administrator", amountMinor: 61000 }),
        policy,
      }),
    ).toThrowError(/escalated/);
  });

  it("denies every decision to an auditor", () => {
    for (const decision of ["approve", "reject", "escalate"] as const) {
      expect(() =>
        planDecision({ decision, actor: auditor, refund: refund(), policy }),
      ).toThrow(AuthorizationError);
    }
  });

  it("allows an approver to approve an escalated refund above threshold", () => {
    const plan = planDecision({
      decision: "approve",
      actor: approver,
      refund: refund({ status: "escalated", amountMinor: 61000, escalatedById: "administrator" }),
      policy,
    });
    expect(plan.toStatus).toBe("approved");
    expect(
      planDecision({
        decision: "reject",
        actor: approver,
        refund: refund({ status: "escalated", amountMinor: 61000, escalatedById: "administrator" }),
        policy,
      }).toStatus,
    ).toBe("rejected");
    expect(() =>
      planDecision({
        decision: "approve",
        actor: approver,
        refund: refund({ status: "approved" }),
        policy,
      }),
    ).toThrow(BusinessRuleError);
  });

  it("keeps decision metadata free of reasons and customer values", () => {
    for (const decision of ["approve", "reject", "escalate"] as const) {
      const plan = planDecision({
        decision,
        actor: decision === "escalate" ? operator : approver,
        refund: refund(),
        policy,
      });
      expect(Object.keys(plan.metadata).sort()).toEqual([
        "amountMinor",
        "currency",
        "fromStatus",
        "thresholdMinor",
        "toStatus",
      ]);
      expect(plan.metadata).not.toHaveProperty("reason");
      expect(plan.metadata).not.toHaveProperty("decisionNote");
      expect(plan.metadata).not.toHaveProperty("customerAlias");
      expect(plan.metadata).not.toHaveProperty("paymentReference");
    }
  });

  it("exposes the locked transition matrix", () => {
    expect(availableDecisions("pending_approval")).toEqual(["approve", "reject", "escalate"]);
    expect(availableDecisions("escalated")).toEqual(["approve", "reject"]);
    expect(availableDecisions("approved")).toEqual([]);
    expect(isTerminal("draft")).toBe(true);
    expect(isTerminal("settled")).toBe(true);
    expect(isTerminal("pending_approval")).toBe(false);
  });
});

describe("describeDecisions", () => {
  it("explains blocked decisions before the user clicks", () => {
    const options = describeDecisions({
      actor: approver,
      refund: refund({ amountMinor: 61000 }),
      policy,
    });
    expect(options.map((option) => option.decision)).toEqual(["approve", "reject", "escalate"]);
    expect(options[0]?.blockedBy).toMatch(/€500\.00/);
    expect(options[1]?.blockedBy).toBeNull();
    expect(options[2]?.blockedBy).toMatch(/cannot escalate/);
  });

  it("marks self-escalated refunds as blocked for the escalator", () => {
    const options = describeDecisions({
      actor: administrator,
      refund: refund({ status: "escalated", escalatedById: "administrator" }),
      policy,
    });
    expect(options.find((option) => option.decision === "approve")?.blockedBy).toMatch(/escalated/);
    expect(options.find((option) => option.decision === "reject")?.blockedBy).toBeNull();
  });

  it("returns nothing for terminal refunds", () => {
    expect(describeDecisions({ actor: approver, refund: refund({ status: "approved" }), policy })).toEqual([]);
  });
});
