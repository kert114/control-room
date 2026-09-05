"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { decideRefundAction } from "@/modules/refunds/actions";
import {
  buildRefundsHref,
  type Decision,
  type ListParams,
} from "@/modules/refunds/params";
import { formatDateTime, formatMoney, STATUS_LABEL } from "@/modules/refunds/format";
import { availableDecisions } from "@/modules/refunds/transitions";
import type { RefundActionResult } from "@/modules/refunds/service";
import type { RefundDetail } from "@/modules/refunds/queries";
import type { Role } from "@/platform/authz/policy";
import { Button } from "@/platform/ui/button";

const DECISION_LABEL: Record<Decision, string> = {
  approve: "Approve",
  reject: "Reject",
  escalate: "Escalate",
};

function SubmitButton({ decision }: { decision: Decision }): React.ReactElement {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="narrow"
      className="w-full md:w-auto"
      disabled={pending}
    >
      {pending ? "Working…" : `${DECISION_LABEL[decision]} refund`}
    </Button>
  );
}

export function DecisionForm({
  detail,
  actor,
  params,
  allowedDecisions,
}: {
  detail: RefundDetail;
  actor: { id: string; name: string; role: Role };
  params: ListParams;
  allowedDecisions: Decision[];
}): React.ReactElement {
  const [state, formAction, pending] = useActionState<RefundActionResult | null, FormData>(
    decideRefundAction,
    null,
  );
  const [decisionNote, setDecisionNote] = useState("");
  const pathname = usePathname();
  const decision = params.decision;
  const available = availableDecisions(detail.status);
  const currentDecision =
    decision && available.includes(decision) && allowedDecisions.includes(decision)
      ? decision
      : undefined;
  const dirty = currentDecision === "reject" && decisionNote.length > 0 && !state?.ok;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    setDecisionNote("");
  }, [detail.id, detail.version, decision]);

  if (params.step < 3 || !currentDecision) {
    if (available.length === 0) {
      return (
        <p className="text-body text-muted">
          This refund is {STATUS_LABEL[detail.status].toLowerCase()}. No further action is available.
        </p>
      );
    }
    if (allowedDecisions.length === 0) {
      return (
        <p className="text-body text-muted">
          {actor.role === "auditor"
            ? "Read only: the auditor role can view refunds but cannot decide them."
            : "Only approvers and administrators can approve or reject. You can escalate this refund."}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        <fieldset>
          <legend className="text-section font-medium text-ink">Decision</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {allowedDecisions.map((choice) => (
              <Link
                key={choice}
                href={buildRefundsHref({ ...params, decision: choice, step: 3 })}
                aria-current={decision === choice ? "true" : undefined}
                className={`rounded-control border px-3 py-2 text-body ${
                  decision === choice
                    ? "border-primary bg-primary-soft font-medium text-primary"
                    : "border-line text-ink hover:bg-primary-soft"
                }`}
              >
                {DECISION_LABEL[choice]}
                {decision === choice ? (
                  <span className="ml-1 text-meta">(Selected)</span>
                ) : null}
              </Link>
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  const result = state;
  const conflict = result && !result.ok && result.code === "version_conflict";
  const success = result?.ok ? result.data : null;
  const fieldError =
    result && !result.ok && result.code === "validation"
      ? result.fieldErrors.decisionNote
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <p className="text-body text-ink">
        You are about to {currentDecision} {detail.reference} for{" "}
        {formatMoney(detail.amountMinor, detail.currency)} requested by{" "}
        {detail.requesterName}.
      </p>
      {currentDecision === "reject" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="decisionNote" className="text-meta font-medium text-muted">
            Rejection reason
          </label>
          <textarea
            id="decisionNote"
            name="decisionNote"
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            aria-describedby="decision-note-help decision-note-error"
            className="min-h-24 rounded-control border border-line bg-panel p-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <p id="decision-note-help" className="text-meta text-muted">
            Stored on the record. Not copied to the audit trail.
          </p>
          {fieldError ? (
            <p id="decision-note-error" role="alert" className="text-body text-danger">
              {fieldError}
            </p>
          ) : null}
        </div>
      ) : null}
      <input type="hidden" name="id" value={detail.id} />
      <input type="hidden" name="version" value={detail.version} />
      <input type="hidden" name="decision" value={currentDecision} />
      {!conflict && !success ? <SubmitButton decision={currentDecision} /> : null}
      {pending ? <span className="sr-only" role="status">Working…</span> : null}
      {result && !result.ok && result.code === "version_conflict" ? (
        <div role="alert" className="flex flex-col gap-1 border border-danger p-3">
          <p className="text-body font-medium text-ink">This refund changed</p>
          <p className="text-body text-muted">{result.message}</p>
          <Link
            href={buildRefundsHref({ ...params, step: 2, decision: undefined })}
            className="text-body text-primary underline"
          >
            Review latest version
          </Link>
        </div>
      ) : null}
      {result && !result.ok && (result.code === "business_rule" || result.code === "forbidden") ? (
        <p role="alert" className="text-body text-danger">
          {result.message}
        </p>
      ) : null}
      {success ? (
        <div role="status" className="flex flex-col gap-1 border border-success p-3">
          <p className="text-body font-medium text-ink">
            Refund {success.reference} {success.status}
          </p>
          <p className="text-body text-muted">
            By {actor.name} at {formatDateTime(success.decidedAt)} UTC · record version{" "}
            {success.version}
          </p>
          <Link
            href={buildRefundsHref({ ...params, refund: undefined, step: 1, decision: undefined })}
            className="text-body text-primary underline"
          >
            Back to queue
          </Link>
        </div>
      ) : null}
      {result && !result.ok && result.code === "validation" && !fieldError ? (
        <p role="alert" className="text-body text-danger">{result.message}</p>
      ) : null}
      <span className="sr-only">{pathname}</span>
    </form>
  );
}
