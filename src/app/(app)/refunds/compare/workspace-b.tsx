import Link from "next/link";

import { Panel } from "@/platform/ui/panel";
import type { Actor } from "@/platform/auth/session";

import { RefundDetailPanelB } from "@/app/(app)/refunds/compare/detail-b";
import { RefundsFilters } from "@/app/(app)/refunds/refunds-filters";
import { RefundsTable } from "@/app/(app)/refunds/refunds-table";
import { VolumeChart } from "@/app/(app)/refunds/volume-chart";
import type { DecisionOption } from "@/modules/refunds/decisions";
import { formatMoney } from "@/modules/refunds/format";
import {
  buildRefundsHref,
  REFUNDS_COMPARE_PATH,
  type ListParams,
} from "@/modules/refunds/params";
import type {
  RefundDetail,
  RefundListItem,
  RefundSummary,
  VolumePoint,
} from "@/modules/refunds/queries";

const STEPS = ["Find refund", "Review and decide", "Outcome"] as const;

export function RefundsWorkspaceB({
  actor,
  params,
  list,
  summary,
  volume,
  detail,
  policy,
  missing,
  options,
  nextOpen,
}: {
  actor: Actor;
  params: ListParams;
  list: RefundListItem[];
  summary: RefundSummary;
  volume: VolumePoint[];
  detail: RefundDetail | null;
  policy: { thresholdMinor: number; currency: string } | null;
  missing: boolean;
  options: DecisionOption[];
  nextOpen: RefundListItem | null;
}): React.ReactElement {
  const currency = policy?.currency ?? "EUR";
  const thresholdMinor = policy?.thresholdMinor ?? 0;
  const oldest = list
    .filter((row) => row.status === "pending_approval" || row.status === "escalated")
    .reduce<Date | null>((acc, row) => (!acc || row.createdAt < acc ? row.createdAt : acc), null);
  const waitingDays = oldest
    ? Math.floor((Date.now() - oldest.getTime()) / 86_400_000)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">Refunds</h1>
        <p className="text-body text-muted">
          Review refund requests and decide them under the four-eyes rule.
        </p>
      </div>
      <ol
        aria-label="Workflow steps"
        className="grid grid-cols-3 gap-1 rounded-panel border border-line bg-panel p-1"
      >
        {STEPS.map((name, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const current = params.step === step;
          const reachable = step === 1 || (step === 2 && Boolean(detail));
          const href =
            step === 1
              ? buildRefundsHref({ ...params, refund: undefined, step: 1 }, REFUNDS_COMPARE_PATH)
              : buildRefundsHref({ ...params, step: 2 }, REFUNDS_COMPARE_PATH);
          const body = (
            <>
              <span className="text-meta">Step {step}</span>
              <span className="text-body font-medium">{name}</span>
            </>
          );
          return (
            <li key={name}>
              {reachable ? (
                <Link
                  href={href}
                  aria-current={current ? "step" : undefined}
                  className={`flex min-h-11 flex-col justify-center rounded-control px-2 text-center ${
                    current ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft"
                  }`}
                >
                  {body}
                </Link>
              ) : (
                <span
                  aria-current={current ? "step" : undefined}
                  className={`flex min-h-11 flex-col justify-center rounded-control px-2 text-center ${
                    current ? "bg-primary-soft text-primary" : "text-muted"
                  }`}
                >
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="grid gap-3 lg:grid-cols-[65fr_35fr]">
        <Panel
          title="Refund queue"
          description="Oldest open requests first. Rows tagged “Needs escalation” cannot be approved directly."
          className="min-w-0"
        >
          <div className="flex min-w-0 flex-col gap-3">
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted">
              <div>
                <dt className="inline">Awaiting decision: </dt>
                <dd className="inline font-medium text-ink">
                  {summary.awaitingCount} · {formatMoney(summary.awaitingAmountMinor, currency)}
                </dd>
              </div>
              <div>
                <dt className="inline">Escalated: </dt>
                <dd className="inline font-medium text-ink">{summary.escalatedCount}</dd>
              </div>
              <div>
                <dt className="inline">Oldest waiting: </dt>
                <dd className="inline font-medium text-ink">
                  {waitingDays === null ? "—" : waitingDays === 0 ? "today" : `${waitingDays} d`}
                </dd>
              </div>
              <div>
                <dt className="inline">Approval rule: </dt>
                <dd className="inline font-medium text-ink">
                  above {formatMoney(thresholdMinor, currency)} escalate first
                </dd>
              </div>
            </dl>
            <RefundsFilters params={params} basePath={REFUNDS_COMPARE_PATH} />
            <RefundsTable
              rows={list}
              params={params}
              currency={currency}
              basePath={REFUNDS_COMPARE_PATH}
              thresholdMinor={thresholdMinor}
            />
            <details open>
              <summary className="cursor-pointer text-section font-medium text-ink">
                Volume by status
              </summary>
              <VolumeChart data={volume} currency={currency} />
            </details>
          </div>
        </Panel>
        <RefundDetailPanelB
          detail={detail}
          params={params}
          actor={actor}
          missing={missing}
          options={options}
          nextOpen={nextOpen}
        />
      </div>
    </div>
  );
}
