import Link from "next/link";
import * as React from "react";

import type { Actor } from "@/platform/auth/session";
import { can } from "@/platform/authz/policy";
import { ActivityTimeline } from "@/platform/ui/activity-timeline";
import { Button } from "@/platform/ui/button";
import { StatusBadge } from "@/platform/ui/status-badge";

import type { ChangeRequestDetail, ChangeRequestSummary, FlagDetail } from "@/modules/flags/queries";
import { ENVIRONMENT_LABEL, requiresChangeRequest } from "@/modules/flags/rules";
import { describeTargetingRule } from "@/modules/flags/targeting";
import { isOpen, STATUS_LABEL } from "@/modules/flags/transitions";
import { buildFlagsHref, type FlagsQuery } from "@/modules/flags/url-state";
import { BeforeAfter } from "@/modules/flags/ui/before-after";
import { CancelRequestForm, DecisionForm } from "@/modules/flags/ui/decision-form";
import {
  dateTime,
  describeState,
  ENVIRONMENT_TONE,
  KIND_LABEL,
  STATUS_TONE,
  stateTone,
} from "@/modules/flags/ui/format";
import { KillSwitchForm } from "@/modules/flags/ui/kill-switch-form";
import { OutcomeNotice } from "@/modules/flags/ui/outcome-notice";
import { RolloutForm } from "@/modules/flags/ui/rollout-form";

export function FlagDetailPanel({
  actor,
  flag,
  request,
  query,
}: {
  actor: Actor;
  flag: FlagDetail;
  request: ChangeRequestDetail | null;
  query: FlagsQuery;
}): React.ReactElement {
  const production = requiresChangeRequest(flag.environment);
  const canRequest = can(actor.role, "flags.request_change");
  const canApprove = can(actor.role, "flags.approve_change");
  const canEditDirectly = can(actor.role, "flags.edit_nonproduction");
  const canKill = can(actor.role, "flags.kill");
  const hasOpenRequest = flag.openRequest !== null;
  const showKill = query.action === "kill" && canKill && !hasOpenRequest;
  const returnTo = buildFlagsHref(query);

  return (
    <div className="flex flex-col gap-4" data-testid="flag-detail">
      {query.notice && query.ref ? <OutcomeNotice notice={query.notice} reference={query.ref} /> : null}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-all text-section font-medium text-ink">{flag.key}</h3>
          <StatusBadge tone={ENVIRONMENT_TONE[flag.environment]} label={ENVIRONMENT_LABEL[flag.environment]} />
          <StatusBadge tone={stateTone(flag)} label={describeState(flag)} />
        </div>
        <p className="text-body text-muted">{flag.description}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-body">
          <Field label="Owner" value={flag.owner} />
          <Field label="Version" value={String(flag.version)} />
          <Field
            label="Last updated"
            value={`${dateTime.format(flag.updatedAt)} UTC${flag.updatedByName ? ` · ${flag.updatedByName}` : ""}`}
          />
          <Field
            label="Targeting"
            value={
              flag.targeting.length === 0
                ? "Everyone in the rollout"
                : flag.targeting.map(describeTargetingRule).join("; ")
            }
          />
        </dl>
      </header>

      {flag.requests.length > 0 ? (
        <section aria-labelledby="flag-requests-title" className="flex flex-col gap-2">
          <h4 id="flag-requests-title" className="text-meta font-medium uppercase tracking-wide text-muted">
            Change requests
          </h4>
          <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
            {flag.requests.map((summary) => (
              <RequestListItem
                key={summary.id}
                summary={summary}
                selected={request?.id === summary.id}
                href={buildFlagsHref(query, { request: summary.id, action: undefined })}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {request ? (
        <RequestDetail
          actor={actor}
          request={request}
          canApprove={canApprove}
          canRequest={canRequest}
          returnTo={returnTo}
        />
      ) : null}

      {hasOpenRequest ? null : (
        <section aria-label="Actions" className="flex flex-col gap-3 border-t border-line pt-3">
          {showKill ? (
            <>
              <KillSwitchForm
                flag={{ id: flag.id, key: flag.key, version: flag.version }}
                production={production}
                returnTo={returnTo}
              />
              <Link prefetch={false}
                href={buildFlagsHref(query, { action: undefined })}
                className="text-body font-medium text-primary underline-offset-2 hover:underline"
              >
                Back to rollout
              </Link>
            </>
          ) : (
            <>
              {production && canRequest ? (
                <RolloutForm
                  mode="request"
                  returnTo={returnTo}
                  flag={{
                    id: flag.id,
                    key: flag.key,
                    version: flag.version,
                    enabled: flag.enabled,
                    rolloutPercentage: flag.rolloutPercentage,
                    killed: flag.killedAt !== null,
                  }}
                />
              ) : null}
              {!production && canEditDirectly ? (
                <RolloutForm
                  mode="direct"
                  returnTo={returnTo}
                  flag={{
                    id: flag.id,
                    key: flag.key,
                    version: flag.version,
                    enabled: flag.enabled,
                    rolloutPercentage: flag.rolloutPercentage,
                    killed: flag.killedAt !== null,
                  }}
                />
              ) : null}
              {production && !canRequest ? (
                <ReadOnlyNotice
                  title={canApprove ? "Nothing to approve" : "Read-only"}
                  body={
                    canApprove
                      ? "Approvers decide requests raised by others. This flag has no open request."
                      : `Your ${actor.role} role can view flags but cannot propose changes.`
                  }
                />
              ) : null}
              {!production && !canEditDirectly ? (
                <ReadOnlyNotice
                  title="Read-only"
                  body={`${ENVIRONMENT_LABEL[flag.environment]} flags are changed directly by an administrator. Your ${actor.role} role can view this flag but not change it.`}
                />
              ) : null}
              {canKill && !flag.killedAt ? (
                <div>
                  <Button asChild variant="ghost" className="text-danger">
                    <Link prefetch={false} href={buildFlagsHref(query, { action: "kill" })}>
                      {production ? "Request kill switch…" : "Kill this flag…"}
                    </Link>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}

      <section aria-labelledby="flag-history-title" className="flex flex-col gap-2 border-t border-line pt-3">
        <h4 id="flag-history-title" className="text-meta font-medium uppercase tracking-wide text-muted">
          Audit history
        </h4>
        <ActivityTimeline entries={flag.history} emptyLabel="No audit events for this flag yet." />
      </section>
    </div>
  );
}

function RequestListItem({
  summary,
  selected,
  href,
}: {
  summary: ChangeRequestSummary;
  selected: boolean;
  href: string;
}): React.ReactElement {
  return (
    <li className={selected ? "bg-selection" : undefined}>
      <Link prefetch={false}
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-3 py-2 text-body text-ink hover:bg-primary-soft"
      >
        <span className="flex items-center gap-2">
          {selected ? <span aria-hidden="true">▸</span> : null}
          <span className="font-medium">{summary.reference}</span>
          <span className="text-muted">{KIND_LABEL[summary.kind]}</span>
        </span>
        <StatusBadge tone={STATUS_TONE[summary.status]} label={STATUS_LABEL[summary.status]} />
      </Link>
    </li>
  );
}

function RequestDetail({
  actor,
  request,
  canApprove,
  canRequest,
  returnTo,
}: {
  actor: Actor;
  request: ChangeRequestDetail;
  canApprove: boolean;
  canRequest: boolean;
  returnTo: string;
}): React.ReactElement {
  const open = isOpen(request.status);
  const isRequester = request.requestedById === actor.id;
  const kill = request.kind === "kill_switch";

  return (
    <section
      aria-labelledby="request-detail-title"
      data-testid="request-detail"
      className="flex flex-col gap-3 rounded-control border border-line p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="request-detail-title" className="text-section font-medium text-ink">
          {KIND_LABEL[request.kind]} {request.reference}
        </h4>
        <StatusBadge tone={STATUS_TONE[request.status]} label={STATUS_LABEL[request.status]} />
      </div>
      <BeforeAfter
        before={{
          enabled: request.previousEnabled,
          rolloutPercentage: request.previousRollout,
          killedAt: null,
        }}
        after={{
          enabled: request.proposedEnabled,
          rolloutPercentage: request.proposedRollout,
          killedAt: kill ? new Date(0) : null,
        }}
        beforeLabel="Before"
        afterLabel={open ? "After approval" : "After"}
      />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-body">
        <Field label="Requested by" value={`${request.requestedByName} · ${dateTime.format(request.createdAt)} UTC`} />
        <Field label="Ticket" value={request.ticket ?? "None"} />
        <Field label="Reason" value={request.reason} className="col-span-2" />
        {request.appliedAt ? (
          <Field
            label="Applied"
            value={`${dateTime.format(request.appliedAt)} UTC${request.appliedByName ? ` · ${request.appliedByName}` : ""}`}
            className="col-span-2"
          />
        ) : null}
        {request.approvals.map((approval) => (
          <Field
            key={approval.id}
            label={approval.decision === "approved" ? "Approved by" : "Rejected by"}
            value={`${approval.approver} · ${dateTime.format(approval.decidedAt)} UTC${approval.note ? ` — ${approval.note}` : ""}`}
            className="col-span-2"
          />
        ))}
      </dl>

      {open ? (
        isRequester ? (
          <>
            <ReadOnlyNotice
              title="Awaiting a second person"
              body="You raised this request, so a different user with approval rights must decide it."
            />
            {canRequest ? (
              <CancelRequestForm
                returnTo={returnTo}
                request={{
                  requestId: request.id,
                  requestVersion: request.version,
                  reference: request.reference,
                }}
              />
            ) : null}
          </>
        ) : canApprove ? (
          <DecisionForm
            returnTo={returnTo}
            request={{
              requestId: request.id,
              requestVersion: request.version,
              flagVersion: request.flagVersion,
              reference: request.reference,
              kind: request.kind,
            }}
          />
        ) : (
          <ReadOnlyNotice
            title="Awaiting approval"
            body={`A user with approval rights other than ${request.requestedByName} must decide this request.`}
          />
        )
      ) : null}
    </section>
  );
}

function ReadOnlyNotice({ title, body }: { title: string; body: string }): React.ReactElement {
  return (
    <div data-testid="read-only-notice" className="rounded-control border border-dashed border-line p-3">
      <StatusBadge tone="neutral" label={title} />
      <p className="mt-1 text-body text-muted">{body}</p>
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
