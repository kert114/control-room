import { Panel } from "@/platform/ui/panel";

import { RefundDetailPanel } from "@/modules/refunds/ui/refund-detail";
import { RefundsFilters } from "@/modules/refunds/ui/refunds-filters";
import { RefundsTable } from "@/modules/refunds/ui/refunds-table";
import { RefundSummaryRow } from "@/modules/refunds/ui/refund-summary";
import { StepControl } from "@/modules/refunds/ui/step-control";
import { VolumeChart } from "@/modules/refunds/ui/volume-chart";
import type { Decision, ListParams } from "@/modules/refunds/params";
import type {
  RefundDetail,
  RefundListItem,
  RefundSummary,
  VolumePoint,
} from "@/modules/refunds/queries";
import type { Actor } from "@/platform/auth/session";

export function RefundsWorkspace({
  actor,
  params,
  list,
  summary,
  volume,
  detail,
  policy,
  missing,
  allowedDecisions,
}: {
  actor: Actor;
  params: ListParams;
  list: RefundListItem[];
  summary: RefundSummary;
  volume: VolumePoint[];
  detail: RefundDetail | null;
  policy: { thresholdMinor: number; currency: string } | null;
  missing: boolean;
  allowedDecisions: Decision[];
}): React.ReactElement {
  const thresholdMinor = policy?.thresholdMinor ?? 0;
  const currency = policy?.currency ?? "EUR";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">Refunds</h1>
        <p className="text-body text-muted">
          Review refund requests and decide them under the four-eyes rule.
        </p>
      </div>
      <StepControl params={params} hasSelection={Boolean(detail)} />
      <div className="grid gap-3 lg:grid-cols-[65fr_35fr]">
        <Panel
          title="Refund queue"
          description="Open refund requests appear first. Search and filter without losing your selection."
          className="min-w-0"
        >
          <div className="flex min-w-0 flex-col gap-3">
            <RefundSummaryRow summary={summary} thresholdMinor={thresholdMinor} />
            <RefundsFilters params={params} />
            <RefundsTable rows={list} params={params} currency={currency} />
            <div>
              <h3 className="mb-1 text-section font-medium text-ink">Volume by status</h3>
              <VolumeChart data={volume} currency={currency} />
            </div>
          </div>
        </Panel>
        <RefundDetailPanel
          detail={detail}
          params={params}
          actor={actor}
          missing={missing}
          allowedDecisions={allowedDecisions}
        />
      </div>
    </div>
  );
}
