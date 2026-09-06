import { describe, expect, it } from "vitest";

import {
  KYC_STATUSES,
  REASSIGNABLE_STATUSES,
  TRANSITIONS,
  assertReassignable,
  assertTransition,
  canTransition,
  isTerminal,
  type KycStatus,
} from "@/modules/kyc/transitions";
import { BusinessRuleError } from "@/platform/mutations/errors";

const ALLOWED: ReadonlyArray<[KycStatus, KycStatus]> = [
  ["pending_review", "in_review"],
  ["in_review", "information_requested"],
  ["information_requested", "in_review"],
  ["in_review", "escalated"],
  ["in_review", "approved"],
  ["in_review", "rejected"],
  ["escalated", "approved"],
  ["escalated", "rejected"],
];

describe("KYC transition matrix", () => {
  it.each(ALLOWED)("allows %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  const invalid = KYC_STATUSES.flatMap((from) =>
    KYC_STATUSES.filter(
      (to) => !ALLOWED.some(([f, t]) => f === from && t === to),
    ).map((to): [KycStatus, KycStatus] => [from, to]),
  );

  it.each(invalid)("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(BusinessRuleError);
  });

  it("matches the brief exactly", () => {
    expect(TRANSITIONS).toEqual({
      pending_review: ["in_review"],
      in_review: ["information_requested", "escalated", "approved", "rejected"],
      information_requested: ["in_review"],
      escalated: ["approved", "rejected"],
      approved: [],
      rejected: [],
    });
  });

  it("has no way out of terminal states", () => {
    for (const status of ["approved", "rejected"] as const) {
      expect(isTerminal(status)).toBe(true);
      expect(TRANSITIONS[status]).toEqual([]);
      expect(() => assertReassignable(status)).toThrow(BusinessRuleError);
    }
  });

  it("allows reassignment only while the case is open", () => {
    expect([...REASSIGNABLE_STATUSES].sort()).toEqual(
      ["pending_review", "in_review", "information_requested", "escalated"].sort(),
    );
    for (const status of REASSIGNABLE_STATUSES) {
      expect(() => assertReassignable(status)).not.toThrow();
    }
  });
});
