import { formatDateTime, formatMoney } from "@/modules/refunds/format";
import type { TransactionContext } from "@/modules/refunds/transactions";

/**
 * Collapsed by default so the decision stays above the fold; the summary line
 * carries the one number a reviewer needs before deciding whether to open it.
 */
export function TransactionHistory({
  context,
  currency,
  refundAmountMinor,
}: {
  context: TransactionContext;
  currency: string;
  refundAmountMinor: number;
}): React.ReactElement {
  const outliers = context.transactions.filter((entry) => entry.outlier);
  const refundIsOutlier = outliers.some((entry) => entry.refunded);
  const ratio = context.refundToMedian.toFixed(1);

  return (
    <details className="rounded-panel border border-line bg-page" data-testid="transaction-history">
      <summary className="cursor-pointer px-3 py-2 text-body">
        <span className="font-medium text-ink">Customer transactions</span>
        <span className="text-muted">
          {" "}
          · {context.transactions.length} in 90 days · median{" "}
          {formatMoney(context.medianMinor, currency)}
          {refundIsOutlier ? (
            <span className="ml-1 font-medium text-warning" data-testid="refund-outlier">
              ! refund is {ratio}× the median
            </span>
          ) : (
            <span className="ml-1">· refund is {ratio}× the median</span>
          )}
        </span>
      </summary>
      <div className="border-t border-line px-3 py-2">
        <p className="mb-2 text-meta text-muted">
          Simulated data for review context only. Rows marked “Outlier” are at least 3× the
          customer’s median transaction ({outliers.length} of {context.transactions.length}).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-table">
            <caption className="sr-only">Simulated customer transactions</caption>
            <thead>
              <tr className="border-b border-line text-left text-meta uppercase tracking-wide text-muted">
                <th scope="col" className="py-1 pr-2">When</th>
                <th scope="col" className="py-1 pr-2">Description</th>
                <th scope="col" className="py-1 pr-2 text-right">Amount</th>
                <th scope="col" className="py-1">Note</th>
              </tr>
            </thead>
            <tbody>
              {context.transactions.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-b border-line last:border-b-0 ${entry.refunded ? "font-medium text-ink" : ""}`}
                >
                  <td className="py-1 pr-2 whitespace-nowrap">{formatDateTime(entry.occurredAt)}</td>
                  <td className="py-1 pr-2">
                    {entry.description}
                    <span className="block text-meta text-muted">{entry.id}</span>
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {formatMoney(entry.amountMinor, currency)}
                  </td>
                  <td className="py-1 text-meta">
                    {entry.refunded ? (
                      <span className="text-primary">
                        Refund requested · {formatMoney(refundAmountMinor, currency)}
                      </span>
                    ) : null}
                    {entry.outlier ? (
                      <span className={`text-warning ${entry.refunded ? "ml-1" : ""}`}>! Outlier</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
