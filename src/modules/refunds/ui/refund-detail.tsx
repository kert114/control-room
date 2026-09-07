import { ActivityTimeline } from "@/platform/ui/activity-timeline";
import { EmptyState } from "@/platform/ui/empty-state";
import { Panel } from "@/platform/ui/panel";
import { StatusBadge } from "@/platform/ui/status-badge";
import type { Role } from "@/platform/authz/policy";

import { DecisionForm } from "@/modules/refunds/ui/decision-form";
import { formatDateTime, formatMoney, STATUS_LABEL, statusTone } from "@/modules/refunds/format";
import type { Decision, ListParams } from "@/modules/refunds/params";
import type { RefundDetail } from "@/modules/refunds/queries";

export function RefundDetailPanel({
  detail,
  params,
  actor,
  missing,
  allowedDecisions,
}: {
  detail: RefundDetail | null;
  params: ListParams;
  actor: { id: string; name: string; role: Role };
  missing: boolean;
  allowedDecisions: Decision[];
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
          <StatusBadge label={STATUS_LABEL[detail.status]} tone={statusTone(detail.status)} />
          <dl className="flex flex-col gap-2 text-body">
            <Field label="Reference" value={detail.reference} />
            <Field label="Status" value={STATUS_LABEL[detail.status]} />
            <Field label="Amount" value={formatMoney(detail.amountMinor, detail.currency)} />
            <Field label="Customer" value={detail.customerAlias} />
            <Field label="Payment reference" value={detail.paymentReference} />
            <Field label="Reason" value={detail.reason} />
            <Field label="Requested by" value={`${detail.requesterName} · ${formatDateTime(detail.createdAt)} UTC`} />
            {detail.escalatorName && detail.escalatedAt ? (
              <Field label="Escalated by" value={`${detail.escalatorName} · ${formatDateTime(detail.escalatedAt)} UTC`} />
            ) : null}
            {detail.approverName && detail.decidedAt ? (
              <Field label="Decided by" value={`${detail.approverName} · ${formatDateTime(detail.decidedAt)} UTC`} />
            ) : null}
            {detail.decisionNote ? <Field label="Decision note" value={detail.decisionNote} /> : null}
            <Field label="Version" value={`Record version ${detail.version}`} />
          </dl>
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
          </div>
          <div>
            <h3 className="mb-1 text-section font-medium text-ink">
              {params.step >= 3 ? "Decide" : "Review request"}
            </h3>
            <DecisionForm
              key={`${detail.id}:${params.decision ?? "choose"}`}
              detail={detail}
              actor={actor}
              params={params}
              allowedDecisions={allowedDecisions}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
