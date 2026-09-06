import { describe, expect, it } from "vitest";

import {
  assertMayDecide,
  assertPermission,
  caseCapabilities,
  type CaseSnapshot,
} from "@/modules/kyc/rules";
import type { Actor } from "@/platform/auth/session";
import {
  AuthorizationError,
  SeparationOfDutiesError,
} from "@/platform/authz/errors";
import { PERMISSION_MATRIX } from "@/platform/authz/policy";
import { kycModule } from "@/modules/kyc/module";

const operator: Actor = {
  id: "user-operator",
  name: "Ola Operator",
  email: "operator@example.invalid",
  role: "operator",
};
const approver: Actor = { ...operator, id: "user-approver", role: "approver" };
const admin: Actor = { ...operator, id: "user-admin", role: "administrator" };
const auditor: Actor = { ...operator, id: "user-auditor", role: "auditor" };

function snapshot(overrides: Partial<CaseSnapshot> = {}): CaseSnapshot {
  return {
    id: "case-1",
    status: "in_review",
    assignedToId: operator.id,
    createdById: "user-creator",
    ...overrides,
  };
}

describe("decision rules", () => {
  it("allows the assigned operator to approve a case they did not open", () => {
    expect(() => assertMayDecide(operator, snapshot(), "approve")).not.toThrow();
    expect(() => assertMayDecide(operator, snapshot(), "reject")).not.toThrow();
  });

  it("allows approvers and administrators to decide unassigned cases", () => {
    const unassigned = snapshot({ assignedToId: null });
    expect(() => assertMayDecide(approver, unassigned, "approve")).not.toThrow();
    expect(() => assertMayDecide(admin, unassigned, "reject")).not.toThrow();
  });

  it("denies approval by the case creator (maker-checker)", () => {
    const own = snapshot({ createdById: operator.id });
    expect(() => assertMayDecide(operator, own, "approve")).toThrow(
      SeparationOfDutiesError,
    );
    expect(() => assertMayDecide(operator, own, "reject")).not.toThrow();
    expect(caseCapabilities(operator, own).approve.allowed).toBe(false);
  });

  it("denies an operator deciding an escalated case", () => {
    const escalated = snapshot({ status: "escalated" });
    expect(() => assertMayDecide(operator, escalated, "approve")).toThrow(
      AuthorizationError,
    );
    expect(() => assertMayDecide(operator, escalated, "reject")).toThrow(
      AuthorizationError,
    );
    expect(() => assertMayDecide(approver, escalated, "approve")).not.toThrow();
    expect(() => assertMayDecide(admin, escalated, "reject")).not.toThrow();
  });

  it("denies an operator acting on a case assigned to someone else", () => {
    const other = snapshot({ assignedToId: approver.id });
    expect(() => assertMayDecide(operator, other, "reject")).toThrow();
    expect(caseCapabilities(operator, other).unmask.allowed).toBe(false);
  });
});

describe("auditor", () => {
  it("holds no KYC write permission", () => {
    for (const permission of kycModule.writePermissions) {
      expect(PERMISSION_MATRIX.auditor).not.toContain(permission);
      expect(() => assertPermission(auditor, permission)).toThrow(
        AuthorizationError,
      );
    }
  });

  it("is refused every capability with a human-readable reason", () => {
    const capabilities = caseCapabilities(auditor, snapshot());
    for (const capability of Object.values(capabilities)) {
      expect(capability.allowed).toBe(false);
      expect(capability.reason).toMatch(/auditor role cannot/);
    }
  });
});
