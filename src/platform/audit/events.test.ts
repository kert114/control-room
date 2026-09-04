import { describe, expect, it } from "vitest";

import {
  assertNoSensitiveMetadata,
  auditMetadataSchema,
} from "@/platform/audit/events";

describe("audit metadata", () => {
  it("accepts identifiers, states, numbers, and booleans", () => {
    const parsed = auditMetadataSchema.parse({
      decision: "approve",
      amountMinor: 12500,
      requiresSecondApprover: true,
      previousApprover: null,
    });
    expect(parsed.decision).toBe("approve");
    expect(() => assertNoSensitiveMetadata(parsed)).not.toThrow();
  });

  it("rejects sensitive keys", () => {
    for (const key of ["password", "card_number", "IBAN", "email", "reason"]) {
      expect(() => assertNoSensitiveMetadata({ [key]: "x" })).toThrow(
        /must not contain/,
      );
    }
  });

  it("rejects nested objects that could smuggle a record copy", () => {
    const result = auditMetadataSchema.safeParse({
      customer: { alias: "Northwind" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects long free text", () => {
    const result = auditMetadataSchema.safeParse({ note: "x".repeat(65) });
    expect(result.success).toBe(false);
  });
});
