import { describe, expect, it, vi } from "vitest";

import { recordAuditEvent } from "@/platform/audit/record";
import { auditEvents } from "@/platform/db/schema";
import type { Transaction } from "@/platform/db/client";

function fakeTransaction() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  return { tx: { insert } as unknown as Transaction, insert, values };
}

const input = {
  action: "refund.approved",
  actorId: "11111111-1111-1111-1111-111111111111",
  actorRole: "approver",
  entityType: "refund",
  entityId: "22222222-2222-2222-2222-222222222222",
  entityVersion: 2,
  summary: "Approved refund RFD-5003.",
} as const;

describe("recordAuditEvent", () => {
  it("writes through the supplied transaction handle", async () => {
    const { tx, insert, values } = fakeTransaction();
    await recordAuditEvent(tx, { ...input, metadata: { amountMinor: 29900 } });

    expect(insert).toHaveBeenCalledWith(auditEvents);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "refund.approved",
        entityVersion: 2,
        metadata: { amountMinor: 29900 },
      }),
    );
  });

  it("refuses metadata that copies sensitive values", async () => {
    const { tx, values } = fakeTransaction();
    await expect(
      recordAuditEvent(tx, { ...input, metadata: { iban: "EE00" } }),
    ).rejects.toThrow(/must not contain/);
    expect(values).not.toHaveBeenCalled();
  });

  it("defaults metadata to an empty object", async () => {
    const { tx, values } = fakeTransaction();
    await recordAuditEvent(tx, input);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    );
  });
});
