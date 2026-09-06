import Link from "next/link";
import * as React from "react";

import { documentHref } from "@/modules/kyc/documents";
import type { CaseDetail as CaseDetailData, Reviewer } from "@/modules/kyc/queries";
import { kycModule } from "@/modules/kyc/module";
import type { CaseCapabilities } from "@/modules/kyc/rules";
import { DECISION_LABELS, type QueueParams } from "@/modules/kyc/schemas";
import { STATUS_LABELS, isTerminal } from "@/modules/kyc/transitions";
import {
  ActionOutcomeBanner,
  ActionOutcomeProvider,
} from "@/modules/kyc/ui/case-action-form";
import {
  ClaimForm,
  ReassignForm,
  RequestInformationForm,
} from "@/modules/kyc/ui/case-forms";
import { DecisionForm } from "@/modules/kyc/ui/decision-form";
import { IdentityEvidenceList } from "@/modules/kyc/ui/identity-evidence";
import {
  RISK_LABELS,
  RISK_TONE,
  STATUS_TONE,
  countryName,
  describeNextStep,
  describeSla,
  formatDateTime,
  humanise,
  queueHref,
} from "@/modules/kyc/ui/presentation";
import type { Actor } from "@/platform/auth/session";
import { can } from "@/platform/authz/policy";
import { ActivityTimeline } from "@/platform/ui/activity-timeline";
import { Button } from "@/platform/ui/button";
import { StatusBadge } from "@/platform/ui/status-badge";

export interface CaseDetailProps {
  detail: CaseDetailData;
  actor: Actor;
  capabilities: CaseCapabilities;
  reviewers: readonly Reviewer[];
  params: QueueParams;
  deciding: boolean;
  now: Date;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-3">
      <h3 className="text-body font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  );
}

const DOCUMENT_TONE = {
  received: "neutral",
  verified: "success",
  rejected: "danger",
  expired: "warning",
} as const;

export function CaseDetail({
  detail,
  actor,
  capabilities,
  reviewers,
  params,
  deciding,
  now,
}: CaseDetailProps): React.ReactElement {
  const sla = describeSla(detail.slaDueAt, detail.status, now);
  const closed = isTerminal(detail.status);
  const next = describeNextStep(detail, actor);

  return (
    <ActionOutcomeProvider caseId={detail.id}>
    <div className="flex flex-col gap-3" data-testid="kyc-case-detail">
      <ActionOutcomeBanner />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-section font-medium text-ink">Case {detail.reference}</h2>
          <p className="text-body text-muted">
            {detail.customerAlias} · {countryName(detail.customerCountry)} (
            {detail.customerCountry}) · opened{" "}
            {formatDateTime(detail.openedAt)}
          </p>
        </div>
        <StatusBadge tone={STATUS_TONE[detail.status]} label={STATUS_LABELS[detail.status]} />
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Fact label="Risk">
          <StatusBadge
            tone={RISK_TONE[detail.riskLevel]}
            label={`${RISK_LABELS[detail.riskLevel]} · score ${detail.riskScore}`}
          />
        </Fact>
        <Fact label="SLA">
          <StatusBadge
            tone={sla.tone}
            label={closed ? "Closed" : `Open · ${sla.label}`}
          />
          <span className="block text-meta text-muted">
            {closed ? "Was due" : "Due"} {formatDateTime(detail.slaDueAt)}
          </span>
        </Fact>
        <Fact label="Reviewer">
          {detail.assignedToName ?? "Unassigned"}
          {detail.assignedToId === actor.id ? (
            <span className="text-meta text-muted"> (you)</span>
          ) : null}
        </Fact>
        <Fact label="Waiting on">
          <span className={next.mine ? "font-medium text-primary" : undefined}>
            {next.mine ? "Your action" : next.owner}
          </span>
          <span className="block text-meta text-muted">
            {next.mine && next.owner !== "You" ? `${next.owner} · ` : ""}
            {next.action}
          </span>
        </Fact>
        <Fact label="Opened by">{detail.createdByName}</Fact>
      </dl>

      {deciding ? (
        <Section title="Choose decision">
          {closed ? (
            <p className="text-body text-muted">This case is already closed.</p>
          ) : (
            <DecisionForm
              caseId={detail.id}
              version={detail.version}
              reference={detail.reference}
              actorName={actor.name}
              approveBlockedReason={capabilities.approve.reason}
              allowEscalate={detail.status !== "escalated"}
            />
          )}
        </Section>
      ) : (
        <>
          <Section title="Identity evidence">
            <IdentityEvidenceList
              caseId={detail.id}
              version={detail.version}
              identity={detail.identity}
              canUnmask={capabilities.unmask.allowed}
            />
            {!capabilities.unmask.allowed ? (
              <p className="text-meta text-muted">
                Values stay masked: {capabilities.unmask.reason}
              </p>
            ) : null}
          </Section>

          <Section title="Documents">
            {detail.documents.length === 0 ? (
              <p className="text-body text-muted">No documents received.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {detail.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-body"
                  >
                    <span>
                      <a
                        href={documentHref(document.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        data-testid="kyc-document-link"
                      >
                        {humanise(document.documentType)}
                        <span className="sr-only"> (opens PDF in a new tab)</span>
                      </a>
                      <span className="block text-meta text-muted">
                        PDF · received {formatDateTime(document.receivedAt)}
                      </span>
                    </span>
                    <StatusBadge
                      tone={DOCUMENT_TONE[document.status]}
                      label={humanise(document.status)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Risk signals">
            {detail.signals.length === 0 ? (
              <p className="text-body text-muted">No risk signals raised.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.signals.map((signal) => (
                  <li key={signal.id} className="flex flex-col gap-1 text-body">
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        tone={RISK_TONE[signal.severity]}
                        label={`${RISK_LABELS[signal.severity]} severity`}
                      />
                      <span className="font-medium">{humanise(signal.code)}</span>
                    </span>
                    <span className="text-muted">{signal.detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {detail.notes.length > 0 ? (
            <Section title="Notes">
              <ul className="flex flex-col gap-2">
                {detail.notes.map((note) => (
                  <li key={note.id} className="text-body">
                    <p className="text-ink">{note.body}</p>
                    <p className="text-meta text-muted">
                      {note.authorName} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {detail.decisions.length > 0 ? (
            <Section title="Decisions">
              <ul className="flex flex-col gap-2">
                {detail.decisions.map((decision) => (
                  <li key={decision.id} className="text-body">
                    <p className="font-medium text-ink">
                      {DECISION_LABELS[decision.decision]} · {decision.decidedByName}
                    </p>
                    <p className={decision.rationale ? "text-ink" : "text-muted"}>
                      {decision.rationale || "No rationale recorded."}
                    </p>
                    <p className="text-meta text-muted">
                      {formatDateTime(decision.decidedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Activity">
            <ActivityTimeline
              entries={detail.activity.map((entry) => ({
                id: entry.id,
                summary: entry.summary,
                actor: entry.actorName,
                action: humanise(entry.action.replace("kyc_case.", "")),
                occurredAt: entry.occurredAt,
              }))}
            />
          </Section>
        </>
      )}

      {!deciding ? (
        <Section title="Actions">
          <CaseActions
            detail={detail}
            actor={actor}
            capabilities={capabilities}
            reviewers={reviewers}
            params={params}
          />
        </Section>
      ) : null}
    </div>
    </ActionOutcomeProvider>
  );
}

interface CaseActionsProps {
  detail: CaseDetailData;
  actor: Actor;
  capabilities: CaseCapabilities;
  reviewers: readonly Reviewer[];
  params: QueueParams;
}

/**
 * One filled primary action per state; secondary actions are plain forms so
 * nothing consequential hides behind a modal. Unavailable actions explain why.
 */
function CaseActions({
  detail,
  actor,
  capabilities,
  reviewers,
  params,
}: CaseActionsProps): React.ReactElement {
  const readOnlyReasons: string[] = [];
  const blocks: React.ReactNode[] = [];
  const readOnlyRole = !kycModule.writePermissions.some((permission) =>
    can(actor.role, permission),
  );

  if (readOnlyRole) {
    return (
      <p className="text-body text-muted" data-testid="kyc-read-only">
        Your role is read only. You can review evidence and history, but
        claiming, requesting information, and deciding require a reviewer role.
      </p>
    );
  }

  if (isTerminal(detail.status)) {
    return (
      <p className="text-body text-muted" data-testid="kyc-read-only">
        This case is closed as {STATUS_LABELS[detail.status].toLowerCase()}. No
        further actions are available.
      </p>
    );
  }

  if (detail.status === "pending_review" || detail.status === "information_requested") {
    const resuming = detail.status === "information_requested";
    if (capabilities.claim.allowed) {
      blocks.push(
        <ClaimForm
          key="claim"
          caseId={detail.id}
          version={detail.version}
          actorName={actor.name}
          resuming={resuming}
        />,
      );
    } else if (capabilities.claim.reason) {
      readOnlyReasons.push(capabilities.claim.reason);
    }
  }

  if (detail.status === "in_review" || detail.status === "escalated") {
    if (capabilities.decide.allowed) {
      blocks.push(
        <Button key="decide" asChild className="h-11 w-full md:h-9 md:w-auto">
          <Link prefetch={false} href={queueHref(params, { step: "decide" })} scroll={false}>
            Continue to decision
          </Link>
        </Button>,
      );
    } else if (capabilities.decide.reason) {
      readOnlyReasons.push(capabilities.decide.reason);
    }
  }

  if (detail.status === "in_review" && capabilities.requestInformation.allowed) {
    blocks.push(
      <RequestInformationForm
        key="request-info"
        caseId={detail.id}
        version={detail.version}
        actorName={actor.name}
      />,
    );
  }

  if (capabilities.reassign.allowed) {
    const candidates = reviewers.filter((reviewer) => reviewer.id !== detail.assignedToId);
    blocks.push(
      <ReassignForm
        key="reassign"
        caseId={detail.id}
        version={detail.version}
        actorName={actor.name}
        candidates={candidates}
      />,
    );
  }

  if (blocks.length === 0) {
    return (
      <p className="text-body text-muted" data-testid="kyc-read-only">
        {readOnlyReasons[0] ?? "Your role can view this case but cannot change it."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {readOnlyReasons.length > 0 ? (
        <p className="text-body text-muted">{readOnlyReasons[0]}</p>
      ) : null}
      {blocks}
    </div>
  );
}
