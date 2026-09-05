import { describe, expect, it } from "vitest";

import {
  can,
  canApproveOwnRecord,
  isReadOnly,
  PERMISSION_MATRIX,
  ROLES,
  type Permission,
} from "@/platform/authz/policy";

const WRITE_PERMISSIONS: Permission[] = [
  "kyc.decide",
  "refunds.request",
  "refunds.approve",
  "flags.request_change",
  "flags.approve_change",
  "flags.edit_nonproduction",
];

describe("authorization matrix", () => {
  it("gives every role read access to the tools it can see", () => {
    for (const role of ROLES) {
      expect(can(role, "overview.read")).toBe(true);
      expect(can(role, "audit.read")).toBe(true);
    }
  });

  it("keeps the auditor read-only", () => {
    expect(isReadOnly("auditor")).toBe(true);
    for (const permission of WRITE_PERMISSIONS) {
      expect(can("auditor", permission)).toBe(false);
    }
  });

  it("does not let an operator approve refunds or flag changes", () => {
    expect(can("operator", "refunds.request")).toBe(true);
    expect(can("operator", "refunds.approve")).toBe(false);
    expect(can("operator", "flags.approve_change")).toBe(false);
  });

  it("does not let an approver raise the requests they approve", () => {
    expect(can("approver", "refunds.approve")).toBe(true);
    expect(can("approver", "refunds.request")).toBe(false);
    expect(can("approver", "flags.request_change")).toBe(false);
  });

  it("lets an administrator edit non-production flags directly", () => {
    expect(can("administrator", "flags.edit_nonproduction")).toBe(true);
    expect(can("operator", "flags.edit_nonproduction")).toBe(false);
  });

  it("never grants a permission outside the declared matrix", () => {
    for (const role of ROLES) {
      for (const permission of PERMISSION_MATRIX[role]) {
        expect(can(role, permission)).toBe(true);
      }
    }
  });
});

describe("separation of duties", () => {
  it("blocks approving your own record", () => {
    expect(canApproveOwnRecord("user-1", "user-1")).toBe(false);
  });

  it("allows approving another user's record", () => {
    expect(canApproveOwnRecord("user-2", "user-1")).toBe(true);
  });
});
