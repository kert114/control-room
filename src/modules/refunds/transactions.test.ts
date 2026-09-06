import { describe, expect, it } from "vitest";

import { simulateTransactions } from "@/modules/refunds/transactions";

const refund = {
  customerAlias: "Customer 0421",
  paymentReference: "PAY-88123",
  amountMinor: 480000,
  createdAt: new Date("2026-08-01T10:00:00Z"),
};

describe("simulated customer transactions", () => {
  it("is deterministic for the same refund", () => {
    expect(simulateTransactions(refund)).toEqual(simulateTransactions({ ...refund }));
    expect(simulateTransactions(refund).transactions[0]?.id).not.toBe(
      simulateTransactions({ ...refund, paymentReference: "PAY-99999" }).transactions[0]?.id,
    );
  });

  it("always includes the refunded payment and dates it before the request", () => {
    const { transactions } = simulateTransactions(refund);
    const refunded = transactions.filter((entry) => entry.refunded);
    expect(refunded).toHaveLength(1);
    expect(refunded[0]?.id).toBe(refund.paymentReference);
    expect(refunded[0]?.amountMinor).toBe(refund.amountMinor);
    expect(transactions.every((entry) => entry.occurredAt < refund.createdAt)).toBe(true);
    expect(transactions.map((entry) => entry.occurredAt.getTime())).toEqual(
      [...transactions].map((entry) => entry.occurredAt.getTime()).sort((a, b) => b - a),
    );
  });

  it("flags amounts at least 3x the median as outliers", () => {
    const context = simulateTransactions(refund);
    for (const entry of context.transactions) {
      expect(entry.outlier).toBe(entry.amountMinor >= context.medianMinor * 3);
    }
    expect(context.transactions.find((entry) => entry.refunded)?.outlier).toBe(true);
    expect(context.refundToMedian).toBeGreaterThan(3);
  });

  it("does not flag a refund that matches usual spend", () => {
    const small = simulateTransactions({ ...refund, amountMinor: 1200 });
    expect(small.transactions.find((entry) => entry.refunded)?.outlier).toBe(false);
  });
});
