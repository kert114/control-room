"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { decideRefundAction } from "@/modules/refunds/actions";
import type { DecisionOption } from "@/modules/refunds/decisions";
import { formatDateTime, formatMoney, STATUS_LABEL } from "@/modules/refunds/format";
import type { Decision } from "@/modules/refunds/params";
import type { RefundDetail } from "@/modules/refunds/queries";
import type { RefundActionResult } from "@/modules/refunds/service";
import type { Role } from "@/platform/authz/policy";
import { Button } from "@/platform/ui/button";

const LABEL: Record<Decision, string> = {
  approve: "Approve refund",
  reject: "Reject refund",
  escalate: "Escalate refund",
};

const VARIANT: Record<Decision, "primary" | "secondary" | "danger"> = {
  approve: "primary",
  escalate: "secondary",
  reject: "danger",
};

function Submit({
  decision,
  disabled,
  submit,
}: {
  decision: Decision;
  disabled: boolean;
  submit: (decision: Decision, formData: FormData) => void;
}): React.ReactElement {
  const { pending, data } = useFormStatus();
  const active = pending && data?.get("decision") === decision;
  return (
    <Button
      type="submit"
      formAction={(formData: FormData) => submit(decision, formData)}
      variant={VARIANT[decision]}
      size="narrow"
      className="w-full md:w-auto"
      disabled={disabled || pending}
    >
      {active ? "Working…" : LABEL[decision]}
    </Button>
  );
}

export function DecideB({
  detail,
  actor,
  options,
  nextHref,
  nextReference,
  queueHref,
}: {
  detail: RefundDetail;
  actor: { id: string; name: string; role: Role };
  options: DecisionOption[];
  nextHref: string | null;
  nextReference: string | null;
  queueHref: string;
}): React.ReactElement {
  const [state, formAction] = useActionState<RefundActionResult | null, FormData>(
    decideRefundAction,
    null,
  );
  const router = useRouter();
  const submit = (decision: Decision, formData: FormData): void => {
    formData.set("decision", decision);
    formAction(formData);
  };
  const [rejecting, setRejecting] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [dismissed, setDismissed] = useState<RefundActionResult | null>(null);

  const allowed = options.filter((option) => option.blockedBy === null);
  const blocked = options.filter((option) => option.blockedBy !== null);
  const dirty = rejecting && decisionNote.length > 0 && !state?.ok;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const success = state?.ok ? state.data : null;
  const conflict =
    state && state !== dismissed && !state.ok && state.code === "version_conflict";
  const fieldError =
    state && !state.ok && state.code === "validation"
      ? state.fieldErrors.decisionNote
      : undefined;
  const ruleError =
    state && !state.ok && state.code !== "version_conflict" && !fieldError
      ? state.message
      : undefined;

  if (success) {
    return (
      <div role="status" className="flex flex-col gap-2 border border-success p-3">
        <p className="text-body font-medium text-ink">
          Refund {success.reference} {success.status}
        </p>
        <p className="text-body text-muted">
          By {actor.name} at {formatDateTime(success.decidedAt)} UTC
        </p>
        <div className="flex flex-wrap gap-3">
          {nextHref && nextReference ? (
            <Link href={nextHref} className="text-body text-primary underline">
              Next open refund: {nextReference} →
            </Link>
          ) : null}
          <Link href={queueHref} className="text-body text-primary underline">
            Back to queue
          </Link>
        </div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="text-body text-muted">
        This refund is {STATUS_LABEL[detail.status].toLowerCase()}. No further action is available.
      </p>
    );
  }

  if (conflict) {
    return (
      <div role="alert" className="flex flex-col gap-1 border border-danger p-3">
        <p className="text-body font-medium text-ink">This refund changed</p>
        <p className="text-body text-muted">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setDismissed(state);
            router.refresh();
          }}
          className="self-start text-body text-primary underline"
        >
          Review latest version
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={detail.id} />
      <input type="hidden" name="version" value={detail.version} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-section font-medium text-ink">Decision</legend>
        {allowed.length === 0 ? (
          <p className="text-body text-muted">
            {actor.role === "auditor"
              ? "Read only: the auditor role can view refunds but cannot decide them."
              : "You cannot decide this refund."}
          </p>
        ) : (
          <p className="text-body text-muted">
            {formatMoney(detail.amountMinor, detail.currency)} requested by {detail.requesterName}.
            Decisions apply immediately and are recorded in the audit trail.
          </p>
        )}
        {blocked.map((option) => (
          <p key={option.decision} className="text-body text-muted">
            <span className="font-medium text-ink">{LABEL[option.decision]}</span> unavailable:{" "}
            {option.blockedBy}
          </p>
        ))}
        {allowed.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowed.map((option) =>
              option.decision === "reject" ? (
                rejecting ? null : (
                  <Button
                    key="reject-open"
                    type="button"
                    variant="danger"
                    size="narrow"
                    className="w-full md:w-auto"
                    onClick={() => setRejecting(true)}
                    aria-expanded={false}
                    aria-controls="decisionNote"
                  >
                    Reject…
                  </Button>
                )
              ) : (
                <Submit
                  key={option.decision}
                  decision={option.decision}
                  disabled={rejecting}
                  submit={submit}
                />
              ),
            )}
          </div>
        ) : null}
        {rejecting ? (
          <div className="flex flex-col gap-2 border border-line p-3">
            <label htmlFor="decisionNote" className="text-meta font-medium text-muted">
              Rejection reason
            </label>
            <textarea
              id="decisionNote"
              name="decisionNote"
              value={decisionNote}
              autoFocus
              onChange={(event) => setDecisionNote(event.target.value)}
              aria-describedby="decision-note-help decision-note-error"
              aria-invalid={fieldError ? true : undefined}
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
            <div className="flex flex-wrap gap-2">
              <Submit decision="reject" disabled={false} submit={submit} />
              <Button
                type="button"
                variant="ghost"
                size="narrow"
                className="w-full md:w-auto"
                onClick={() => {
                  setRejecting(false);
                  setDecisionNote("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {ruleError ? (
          <p role="alert" className="text-body text-danger">
            {ruleError}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
