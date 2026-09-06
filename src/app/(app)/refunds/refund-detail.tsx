import Link from "next/link";

import { ActivityTimeline } from "@/platform/ui/activity-timeline";
import { EmptyState } from "@/platform/ui/empty-state";
import { Panel } from "@/platform/ui/panel";
import { StatusBadge } from "@/platform/ui/status-badge";
import type { Actor } from "@/platform/auth/session";

import { DecisionForm } from "@/app/(app)/refunds/decision-form";
import { OpenClosedBadge } from "@/app/(app)/refunds/open-closed-badge";
import { TransactionHistory } from "@/app/(app)/refunds/transaction-history";
import type { DecisionOption } from "@/modules/refunds/decisions";
import { formatDateTime, formatMoney, STATUS_LABEL, statusTone } from "@/modules/refunds/format";
import { buildRefundsHref, type ListParams } from "@/modules/refunds/params";
import type { RefundDetail, RefundListItem } from "@/modules/refunds/queries";
import { simulateTransactions } from "@/modules/refunds/transactions";

export function RefundDetailPanel({
  detail,
  params,
  actor,
  missing,
  options,
  nextOpen,
}: {
  detail: RefundDetail | null;
  params: ListParams;
  actor: Actor;
  missing: boolean;
  options: DecisionOption[];
  nextOpen: RefundListItem | null;
}): React.ReactElement {
  return (
    <Panel title="Selected refund">
      {missing ? (
        <p role="status" className="mb-3 text-body text-muted">
          That refund is no longer available.
        </p>
      ) : null}
      {!detail ? (
        <EmptyState
          title="No refund selected"
          description="Choose a row to review the request."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-section font-medium text-ink">{detail.reference}</span>
            <span className="inline-flex flex-wrap items-center gap-1">
              <OpenClosedBadge status={detail.status} />
              <StatusBadge label={STATUS_LABEL[detail.status]} tone={statusTone(detail.status)} />
            </span>
          </div>
          <dl className="flex flex-col gap-2 text-body">
            <Field label="Amount" value={formatMoney(detail.amountMinor, detail.currency)} />
            <Field label="Customer" value={detail.customerAlias} />
            <Field label="Payment reference" value={detail.paymentReference} />
            <Field label="Reason" value={detail.reason} />
            <Field
              label="Requested by"
              value={`${detail.requesterName} · ${formatDateTime(detail.createdAt)} UTC`}
            />
            {detail.escalatorName && detail.escalatedAt ? (
              <Field
                label="Escalated by"
                value={`${detail.escalatorName} · ${formatDateTime(detail.escalatedAt)} UTC`}
              />
            ) : null}
            {detail.approverName && detail.decidedAt ? (
              <Field
                label="Decided by"
                value={`${detail.approverName} · ${formatDateTime(detail.decidedAt)} UTC`}
              />
            ) : null}
            {detail.decisionNote ? <Field label="Decision note" value={detail.decisionNote} /> : null}
          </dl>
          <TransactionHistory
            context={simulateTransactions(detail)}
            currency={detail.currency}
            refundAmountMinor={detail.amountMinor}
          />
          <DecisionForm
            key={detail.id}
            detail={detail}
            actor={{ id: actor.id, name: actor.name, role: actor.role }}
            options={options}
            nextHref={
              nextOpen ? buildRefundsHref({ ...params, refund: nextOpen.id, step: 2 }) : null
            }
            nextReference={nextOpen?.reference ?? null}
            queueHref={buildRefundsHref({ ...params, refund: undefined, step: 1 })}
          />
          <div>
            <h3 className="mb-1 text-section font-medium text-ink">Record history</h3>
            <ActivityTimeline
              entries={detail.history.map((entry) => ({
                id: entry.id,
                summary: entry.summary,
                actor: entry.actorName,
                action: entry.action,
                occurredAt: entry.occurredAt,
              }))}
            />
            {actor.role === "auditor" ? (
              <Link
                href="/audit"
                className="mt-2 inline-block text-body text-primary underline"
              >
                Open in audit trail
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-meta font-medium text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
