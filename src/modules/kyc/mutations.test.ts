import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuditEventInput } from "@/platform/audit/events";
import { assertNoSensitiveMetadata } from "@/platform/audit/events";
import type { Actor } from "@/platform/auth/session";
import type { KycStatus } from "@/modules/kyc/transitions";

interface FakeCase {
  id: string;
  reference: string;
  riskLevel: "low" | "medium" | "high";
  status: KycStatus;
  assignedToId: string | null;
  createdById: string;
  version: number;
}

const store: {
  kycCase: FakeCase;
  identityValue: string;
  reviewers: string[];
  audits: AuditEventInput[];
  inserts: Record<string, unknown>[];
} = {
  kycCase: {
    id: "case-1",
    reference: "KYC-9001",
    riskLevel: "high",
    status: "pending_review",
    assignedToId: null,
    createdById: "user-creator",
    version: 1,
  },
  identityValue: "SYNTHETIC-DOC-4010",
  reviewers: ["user-approver"],
  audits: [],
  inserts: [],
};

/**
 * Minimal stand-in for the drizzle transaction handle. Each query resolves
 * against the in-memory case so the business rules and audit writes can be
 * exercised without Postgres.
 */
function fakeTx() {
  let updateSet: Record<string, unknown> = {};
  let selectFields: Record<string, unknown> = {};
  return {
    select(fields: Record<string, unknown>) {
      selectFields = fields;
      const chain = {
        from: () => chain,
        where: () => chain,
        for: () => chain,
        then(resolve: (rows: unknown[]) => void) {
          resolve(resolveSelect(selectFields));
        },
      };
      return chain;
    },
    update() {
      return {
        set(values: Record<string, unknown>) {
          updateSet = values;
          return {
            where: () => ({
              returning: async () => {
                if (
                  typeof updateSet.status === "string" &&
                  updateSet.status !== store.kycCase.status
                ) {
                  store.kycCase.status = updateSet.status as KycStatus;
                }
                if ("assignedToId" in updateSet) {
                  store.kycCase.assignedToId = updateSet.assignedToId as string;
                }
                store.kycCase.version += 1;
                return [
                  { status: store.kycCase.status, version: store.kycCase.version },
                ];
              },
            }),
          };
        },
      };
    },
    insert() {
      return {
        values: async (row: Record<string, unknown>) => {
          store.inserts.push(row);
        },
      };
    },
  };
}

function resolveSelect(fields: Record<string, unknown>): unknown[] {
  if ("value" in fields && Object.keys(fields).length === 1) {
    return [{ value: store.identityValue }];
  }
  if ("reference" in fields) {
    return [{ ...store.kycCase }];
  }
  if ("id" in fields && Object.keys(fields).length === 1) {
    // reviewer lookup
    return store.reviewers.map((id) => ({ id }));
  }
  throw new Error(`Unexpected select ${Object.keys(fields).join(",")}`);
}

vi.mock("@/platform/db/client", () => ({
  db: {
    transaction: async (handler: (tx: unknown) => Promise<unknown>) =>
      handler(fakeTx()),
  },
}));

vi.mock("@/platform/audit/record", () => ({
  recordAuditEvent: async (_tx: unknown, input: AuditEventInput) => {
    if (input.metadata) {
      assertNoSensitiveMetadata(input.metadata);
    }
    store.audits.push(input);
  },
}));

const {
  claimCase,
  decideCase,
  reassignCase,
  requestInformation,
  resumeReview,
  unmaskIdentity,
} = await import("@/modules/kyc/mutations");

const operator: Actor = {
  id: "user-operator",
  name: "Ola Operator",
  email: "operator@example.invalid",
  role: "operator",
};
const approver: Actor = { ...operator, id: "user-approver", role: "approver" };
const auditor: Actor = { ...operator, id: "user-auditor", role: "auditor" };

const fullChecklist = {
  identityVerified: true,
  sanctionsScreened: true,
  sourceOfFundsReviewed: true,
};

function reset(overrides: Partial<FakeCase> = {}): void {
  store.kycCase = {
    id: "case-1",
    reference: "KYC-9001",
    riskLevel: "high",
    status: "pending_review",
    assignedToId: null,
    createdById: "user-creator",
    version: 1,
    ...overrides,
  };
  store.audits = [];
  store.inserts = [];
}

beforeEach(() => reset());

describe("claimCase", () => {
  it("moves a pending case into review, assigns it, and audits the new version", async () => {
    const result = await claimCase(operator, { caseId: "case-1", expectedVersion: 1 });
    expect(result).toEqual({
      ok: true,
      data: { caseId: "case-1", reference: "KYC-9001", status: "in_review", version: 2 },
    });
    expect(store.kycCase.assignedToId).toBe(operator.id);
    expect(store.audits).toHaveLength(1);
    expect(store.audits[0]).toMatchObject({
      action: "kyc_case.claimed",
      entityVersion: 2,
      metadata: { from: "pending_review", to: "in_review", riskLevel: "high" },
    });
  });

  it("returns version_conflict for a stale version without writing anything", async () => {
    const result = await claimCase(operator, { caseId: "case-1", expectedVersion: 7 });
    expect(result).toMatchObject({ ok: false, code: "version_conflict" });
    expect(store.kycCase.version).toBe(1);
    expect(store.audits).toHaveLength(0);
  });

  it("refuses to claim a case held by another reviewer", async () => {
    reset({ assignedToId: "user-someone-else" });
    const result = await claimCase(operator, { caseId: "case-1", expectedVersion: 1 });
    expect(result).toMatchObject({ ok: false, code: "business_rule" });
  });

  it("rejects an invalid transition", async () => {
    reset({ status: "approved" });
    const result = await claimCase(operator, { caseId: "case-1", expectedVersion: 1 });
    expect(result).toMatchObject({ ok: false, code: "business_rule" });
    expect(store.audits).toHaveLength(0);
  });
});

describe("resumeReview", () => {
  it("returns an information-requested case to review", async () => {
    reset({ status: "information_requested", assignedToId: operator.id });
    const result = await resumeReview(operator, { caseId: "case-1", expectedVersion: 1 });
    expect(result).toMatchObject({ ok: true, data: { status: "in_review", version: 2 } });
  });

  it("lets a senior reviewer resume without taking the case from its reviewer", async () => {
    reset({ status: "information_requested", assignedToId: operator.id });
    const result = await resumeReview(approver, { caseId: "case-1", expectedVersion: 1 });
    expect(result).toMatchObject({ ok: true, data: { status: "in_review" } });
    expect(store.kycCase.assignedToId).toBe(operator.id);
  });

  it("refuses an operator resuming another reviewer's case", async () => {
    reset({ status: "information_requested", assignedToId: approver.id });
    const result = await resumeReview(operator, { caseId: "case-1", expectedVersion: 1 });
    expect(result).toMatchObject({ ok: false, code: "business_rule" });
    expect(store.audits).toHaveLength(0);
  });
});

describe("requestInformation", () => {
  it("records the reason as a case note but keeps it out of audit metadata", async () => {
    reset({ status: "in_review", assignedToId: operator.id });
    const result = await requestInformation(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      reason: "Need a certified copy of the passport.",
    });
    expect(result).toMatchObject({ ok: true, data: { status: "information_requested" } });
    expect(store.inserts[0]).toMatchObject({ body: expect.stringContaining("passport") });
    const audit = store.audits[0];
    expect(audit?.action).toBe("kyc_case.information_requested");
    expect(JSON.stringify(audit?.metadata)).not.toContain("passport");
  });
});

describe("decideCase", () => {
  it("accepts a decision without a rationale", async () => {
    reset({ status: "in_review", assignedToId: operator.id });
    const result = await decideCase(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      decision: "reject",
      rationale: "",
      checklist: fullChecklist,
    });
    expect(result).toMatchObject({ ok: true, data: { status: "rejected" } });
    expect(store.inserts[0]).toMatchObject({ rationale: "" });
  });

  it("approves a reviewed case for an eligible reviewer", async () => {
    reset({ status: "in_review", assignedToId: operator.id });
    const result = await decideCase(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      decision: "approve",
      rationale: "All evidence verified against synthetic records.",
      checklist: fullChecklist,
    });
    expect(result).toMatchObject({ ok: true, data: { status: "approved", version: 2 } });
    expect(store.audits[0]).toMatchObject({
      action: "kyc_case.decided",
      entityVersion: 2,
      metadata: { decision: "approve", from: "in_review", riskLevel: "high" },
    });
    expect(JSON.stringify(store.audits[0]?.metadata)).not.toContain("synthetic records");
  });

  it("denies approval by the case creator", async () => {
    reset({ status: "in_review", assignedToId: operator.id, createdById: operator.id });
    const result = await decideCase(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      decision: "approve",
      rationale: "Trying to approve my own case.",
      checklist: fullChecklist,
    });
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(store.kycCase.status).toBe("in_review");
    expect(store.audits).toHaveLength(0);
  });

  it("denies an operator deciding an escalated case but lets an approver", async () => {
    reset({ status: "escalated", assignedToId: operator.id });
    const denied = await decideCase(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      decision: "reject",
      rationale: "Operator should not be able to do this.",
      checklist: fullChecklist,
    });
    expect(denied).toMatchObject({ ok: false, code: "forbidden" });

    const allowed = await decideCase(approver, {
      caseId: "case-1",
      expectedVersion: 1,
      decision: "reject",
      rationale: "Adverse media confirmed.",
      checklist: fullChecklist,
    });
    expect(allowed).toMatchObject({ ok: true, data: { status: "rejected" } });
  });

  it("escalates from review with a reason", async () => {
    reset({ status: "in_review", assignedToId: operator.id });
    const result = await decideCase(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      decision: "escalate",
      rationale: "Needs senior review.",
      checklist: { ...fullChecklist, sourceOfFundsReviewed: false },
    });
    expect(result).toMatchObject({ ok: true, data: { status: "escalated" } });
  });

  it("returns version_conflict on a stale decision", async () => {
    reset({ status: "in_review", assignedToId: operator.id });
    const result = await decideCase(operator, {
      caseId: "case-1",
      expectedVersion: 99,
      decision: "reject",
      rationale: "Stale.",
      checklist: fullChecklist,
    });
    expect(result).toMatchObject({ ok: false, code: "version_conflict" });
    expect(store.inserts).toHaveLength(0);
    expect(store.audits).toHaveLength(0);
  });
});

describe("reassignCase", () => {
  it("moves an open case to another reviewer", async () => {
    reset({ status: "in_review", assignedToId: operator.id });
    const result = await reassignCase(approver, {
      caseId: "case-1",
      expectedVersion: 1,
      assigneeId: "user-approver",
    });
    expect(result).toMatchObject({ ok: true, data: { status: "in_review", version: 2 } });
    expect(store.audits[0]).toMatchObject({ action: "kyc_case.reassigned" });
  });

  it("refuses to reassign a closed case", async () => {
    reset({ status: "rejected" });
    const result = await reassignCase(approver, {
      caseId: "case-1",
      expectedVersion: 1,
      assigneeId: "user-approver",
    });
    expect(result).toMatchObject({ ok: false, code: "business_rule" });
  });
});

describe("unmaskIdentity", () => {
  it("returns the value once and audits only the field kind and case version", async () => {
    reset({ status: "in_review", assignedToId: operator.id, version: 3 });
    const result = await unmaskIdentity(operator, {
      caseId: "case-1",
      expectedVersion: 3,
      field: "document_number",
    });
    expect(result).toEqual({
      ok: true,
      data: { field: "document_number", value: "SYNTHETIC-DOC-4010" },
    });
    const audit = store.audits[0];
    expect(audit?.action).toBe("kyc_case.identity_unmasked");
    expect(audit?.metadata).toEqual({ field: "document_number", caseVersion: 3 });
    expect(() => assertNoSensitiveMetadata(audit?.metadata ?? {})).not.toThrow();
    expect(JSON.stringify(audit)).not.toContain("SYNTHETIC-DOC-4010");
    expect(store.kycCase.version).toBe(3);
  });

  it("is denied for an operator not assigned to the case", async () => {
    reset({ status: "in_review", assignedToId: "user-other" });
    const result = await unmaskIdentity(operator, {
      caseId: "case-1",
      expectedVersion: 1,
      field: "address",
    });
    expect(result).toMatchObject({ ok: false, code: "business_rule" });
    expect(store.audits).toHaveLength(0);
  });
});

describe("auditor", () => {
  const input = { caseId: "case-1", expectedVersion: 1 };

  it.each([
    ["claimCase", () => claimCase(auditor, input)],
    ["resumeReview", () => resumeReview(auditor, input)],
    ["reassignCase", () => reassignCase(auditor, { ...input, assigneeId: "user-approver" })],
    ["requestInformation", () => requestInformation(auditor, { ...input, reason: "x" })],
    [
      "decideCase",
      () =>
        decideCase(auditor, {
          ...input,
          decision: "reject",
          rationale: "x",
          checklist: fullChecklist,
        }),
    ],
    ["unmaskIdentity", () => unmaskIdentity(auditor, { ...input, field: "address" })],
  ])("is forbidden from %s and leaves no trace", async (_name, run) => {
    reset({ status: "in_review", assignedToId: auditor.id });
    const result = await run();
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(store.audits).toHaveLength(0);
    expect(store.inserts).toHaveLength(0);
    expect(store.kycCase.version).toBe(1);
  });
});
