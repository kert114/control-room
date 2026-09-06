import { describe, expect, it } from "vitest";

import { matchingCountryCodes, selectedStatuses } from "@/modules/kyc/queries";
import { decideInputSchema, parseQueueParams } from "@/modules/kyc/schemas";
import {
  countryName,
  describeNextStep,
  describeSla,
  queueHref,
} from "@/modules/kyc/ui/presentation";
import type { Actor } from "@/platform/auth/session";

const CASE_ID = "11111111-1111-4111-8111-111111111111";

describe("queue params", () => {
  it("accepts repeated status and risk values and drops unknown ones", () => {
    const params = parseQueueParams({
      status: ["in_review", "escalated", "bogus", "in_review"],
      risk: "high",
    });
    expect(params.status).toEqual(["in_review", "escalated"]);
    expect(params.risk).toEqual(["high"]);
  });

  it("defaults to empty lists", () => {
    const params = parseQueueParams({});
    expect(params.status).toEqual([]);
    expect(params.risk).toEqual([]);
  });

  it("round-trips lists through the queue URL", () => {
    const params = parseQueueParams({ status: ["open", "rejected"], risk: ["low", "high"] });
    const href = queueHref(params, { case: CASE_ID });
    const url = new URL(href, "http://localhost");
    expect(url.searchParams.getAll("status")).toEqual(["open", "rejected"]);
    expect(url.searchParams.getAll("risk")).toEqual(["low", "high"]);
    expect(parseQueueParams(Object.fromEntries(
      [...new Set(url.searchParams.keys())].map((key) => [key, url.searchParams.getAll(key)]),
    ))).toMatchObject({ status: ["open", "rejected"], risk: ["low", "high"], case: CASE_ID });
  });

  it("expands the open filter to every open status once", () => {
    expect(selectedStatuses(["open", "in_review"]).sort()).toEqual([
      "escalated",
      "in_review",
      "information_requested",
      "pending_review",
    ]);
    expect(selectedStatuses([])).toEqual([]);
  });
});

describe("countries", () => {
  it("maps codes to names", () => {
    expect(countryName("EE")).toBe("Estonia");
    expect(countryName("SE")).toBe("Sweden");
  });

  it("matches search text against country names and codes", () => {
    const codes = ["EE", "SE", "DE", "NL", "FI"];
    expect(matchingCountryCodes("eston", codes)).toEqual(["EE"]);
    expect(matchingCountryCodes("de", codes)).toEqual(["SE", "DE"]);
    expect(matchingCountryCodes("KYC-24", codes)).toEqual([]);
  });
});

describe("decision input", () => {
  const base = {
    caseId: CASE_ID,
    expectedVersion: "1",
    decision: "reject",
    checklist: { identityVerified: false, sanctionsScreened: false, sourceOfFundsReviewed: false },
  };

  it("treats a missing rationale as empty", () => {
    expect(decideInputSchema.parse(base).rationale).toBe("");
    expect(decideInputSchema.parse({ ...base, rationale: "  " }).rationale).toBe("");
  });

  it("still caps rationale length", () => {
    expect(decideInputSchema.safeParse({ ...base, rationale: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("presentation", () => {
  const operator: Actor = {
    id: "op",
    name: "Ola",
    email: "op@example.invalid",
    role: "operator",
  };
  const approver: Actor = { ...operator, id: "ap", role: "approver" };
  const auditor: Actor = { ...operator, id: "au", role: "auditor" };
  const now = new Date("2026-01-01T00:00:00Z");

  it("distinguishes closed from open SLA states without colour", () => {
    expect(describeSla(now, "approved", now)).toMatchObject({ label: "Closed", tone: "neutral" });
    expect(describeSla(new Date(now.getTime() + 72 * 3_600_000), "in_review", now)).toMatchObject({
      label: "Due in 3d",
      tone: "success",
    });
    expect(describeSla(new Date(now.getTime() - 3_600_000), "in_review", now).breached).toBe(true);
  });

  it("names who a case is waiting on", () => {
    const pending = { status: "pending_review" as const, assignedToId: null, assignedToName: null };
    expect(describeNextStep(pending, operator)).toMatchObject({ owner: "Any reviewer", mine: true });
    expect(describeNextStep(pending, auditor).mine).toBe(false);

    const theirs = { status: "in_review" as const, assignedToId: "ap", assignedToName: "Ava" };
    expect(describeNextStep(theirs, operator)).toMatchObject({ owner: "Ava", mine: false });
    expect(describeNextStep(theirs, approver)).toMatchObject({ owner: "You", mine: true });

    const escalated = { ...theirs, status: "escalated" as const };
    expect(describeNextStep(escalated, operator).mine).toBe(false);
    expect(describeNextStep(escalated, approver).mine).toBe(true);
    expect(describeNextStep({ ...theirs, status: "approved" as const }, approver).mine).toBe(false);
  });
});
