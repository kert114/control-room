/**
 * Simulated customer transaction history.
 *
 * Control Room does not yet hold a payments ledger, so the reviewer context is
 * generated deterministically from the refund's synthetic customer alias and
 * payment reference. The same refund always shows the same history, the
 * refunded payment is always present, and the view is labelled as simulated.
 * Replace with a ledger query once the platform exposes one.
 */

export interface SimulatedTransaction {
  id: string;
  occurredAt: Date;
  description: string;
  amountMinor: number;
  /** The payment this refund request is against. */
  refunded: boolean;
  /** Well outside the customer's usual spend. */
  outlier: boolean;
}

export interface TransactionContext {
  transactions: SimulatedTransaction[];
  medianMinor: number;
  totalMinor: number;
  /** Refund amount as a multiple of the customer's median transaction. */
  refundToMedian: number;
}

const MERCHANT_LINES = [
  "Card payment · online order",
  "Card payment · in store",
  "Subscription renewal",
  "Card payment · marketplace",
  "Top-up",
  "Card payment · travel",
];

function hash(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function simulateTransactions(refund: {
  customerAlias: string;
  paymentReference: string;
  amountMinor: number;
  createdAt: Date;
}): TransactionContext {
  const random = hash(`${refund.customerAlias}|${refund.paymentReference}`);
  const count = 8 + Math.floor(random() * 6);
  const typicalMinor = 1500 + Math.floor(random() * 12000);
  const base = refund.createdAt.getTime();

  const transactions: SimulatedTransaction[] = [];
  for (let index = 0; index < count; index += 1) {
    const daysAgo = 2 + Math.floor(random() * 88);
    const spread = 0.4 + random() * 1.4;
    transactions.push({
      id: `TXN-${refund.paymentReference.replace(/\D/g, "").slice(-5)}${String(index).padStart(2, "0")}`,
      occurredAt: new Date(base - daysAgo * 86_400_000 - Math.floor(random() * 86_400_000)),
      description: MERCHANT_LINES[Math.floor(random() * MERCHANT_LINES.length)] ?? "Card payment",
      amountMinor: Math.round(typicalMinor * spread),
      refunded: false,
      outlier: false,
    });
  }
  transactions.push({
    id: refund.paymentReference,
    occurredAt: new Date(base - (1 + Math.floor(random() * 3)) * 86_400_000),
    description: "Card payment · online order",
    amountMinor: refund.amountMinor,
    refunded: true,
    outlier: false,
  });
  transactions.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const sorted = transactions.map((entry) => entry.amountMinor).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianMinor =
    sorted.length % 2 === 0
      ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
      : (sorted[middle] ?? 0);
  for (const entry of transactions) {
    entry.outlier = medianMinor > 0 && entry.amountMinor >= medianMinor * 3;
  }

  return {
    transactions,
    medianMinor,
    totalMinor: transactions.reduce((sum, entry) => sum + entry.amountMinor, 0),
    refundToMedian: medianMinor > 0 ? refund.amountMinor / medianMinor : 0,
  };
}
