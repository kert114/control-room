import { formatMoney } from "@/modules/refunds/format";
import type { RefundSummary } from "@/modules/refunds/queries";

export function RefundSummaryRow({
  summary,
  thresholdMinor,
}: {
  summary: RefundSummary;
  thresholdMinor: number;
}): React.ReactElement {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
      <div>
        <dt className="inline">Awaiting decision: </dt>
        <dd className="inline font-medium text-ink">
          {summary.awaitingCount} · {formatMoney(summary.awaitingAmountMinor, "EUR")}
        </dd>
      </div>
      <div>
        <dt className="inline">Escalated: </dt>
        <dd className="inline font-medium text-ink">{summary.escalatedCount}</dd>
      </div>
      <div>
        <dt className="inline">Decided in 30 days: </dt>
        <dd className="inline font-medium text-ink">{summary.decidedLast30dCount}</dd>
      </div>
      <div>
        <dt className="inline">Approval rule: </dt>
        <dd className="inline font-medium text-ink">
          above {formatMoney(thresholdMinor, "EUR")} escalate first
        </dd>
      </div>
    </dl>
  );
}
