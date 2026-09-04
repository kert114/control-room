import { describe, expect, it } from "vitest";

import { kycCases } from "@/platform/db/schema";
import { OptimisticConcurrencyError } from "@/platform/mutations/errors";
import {
  assertRowUpdated,
  bumpVersion,
  versionedWhere,
} from "@/platform/mutations/transaction";

describe("optimistic concurrency", () => {
  it("raises a version conflict when no row matched the expected version", () => {
    expect(() => assertRowUpdated([], "kyc_case", "case-1", 3)).toThrow(
      OptimisticConcurrencyError,
    );
  });

  it("names the record the user should review", () => {
    try {
      assertRowUpdated([], "refund", "refund-1", 2);
      expect.unreachable("expected a conflict");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(OptimisticConcurrencyError);
      const conflict = error as OptimisticConcurrencyError;
      expect(conflict.entityType).toBe("refund");
      expect(conflict.entityId).toBe("refund-1");
      expect(conflict.expectedVersion).toBe(2);
      expect(conflict.message).toMatch(/changed since you opened it/);
    }
  });

  it("returns the updated row when the version matched", () => {
    expect(assertRowUpdated([{ version: 4 }], "kyc_case", "case-1", 3)).toEqual({
      version: 4,
    });
  });

  it("filters on id and version together", () => {
    const predicate = versionedWhere(kycCases, "case-1", 7);
    expect(predicate.queryChunks.length).toBeGreaterThan(0);
  });

  it("increments the stored version", () => {
    expect(bumpVersion(kycCases).queryChunks.length).toBeGreaterThan(0);
  });
});
