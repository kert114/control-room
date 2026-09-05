"use client";

import * as React from "react";

import { Button } from "@/platform/ui/button";

import { submitCancellation, submitDecision } from "@/modules/flags/form-actions";
import { IDLE } from "@/modules/flags/form-state";
import { FieldError, FormFeedback, textareaClass } from "@/modules/flags/ui/form-feedback";

export interface DecisionTarget {
  requestId: string;
  requestVersion: number;
  flagVersion: number;
  reference: string;
  kind: "rollout" | "kill_switch";
}

/** Second-person decision on an open production request. */
export function DecisionForm({
  request,
  returnTo,
}: {
  request: DecisionTarget;
  returnTo: string;
}): React.ReactElement {
  const [state, action, pending] = React.useActionState(submitDecision, IDLE);
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const id = React.useId();
  const [note, setNote] = React.useState("");
  const approveLabel = request.kind === "kill_switch" ? "Approve kill switch" : "Approve change";
  const rejectLabel = request.kind === "kill_switch" ? "Reject kill switch" : "Reject change";

  return (
    <form action={action} noValidate className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-section font-medium text-ink">
        Decide {request.reference}
      </h3>
      <input type="hidden" name="requestId" value={request.requestId} />
      <input type="hidden" name="requestVersion" value={request.requestVersion} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="flagVersion" value={request.flagVersion} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-note`} className="text-meta font-medium text-muted">
          Decision note <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id={`${id}-note`}
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? `${id}-note-error` : undefined}
          className={textareaClass}
        />
        <FieldError id={`${id}-note-error`} message={errors.note} />
      </div>
      <FormFeedback state={state} />
      <div className="flex flex-col gap-2 md:flex-row">
          <Button type="submit" name="decision" value="approve" disabled={pending} className="w-full md:w-auto">
            {pending ? "Working…" : approveLabel}
          </Button>
          <Button
            type="submit"
            name="decision"
            value="reject"
            variant="secondary"
            disabled={pending}
            className="w-full md:w-auto"
          >
            {rejectLabel}
          </Button>
      </div>
    </form>
  );
}

export function CancelRequestForm({
  request,
  returnTo,
}: {
  request: Pick<DecisionTarget, "requestId" | "requestVersion" | "reference">;
  returnTo: string;
}): React.ReactElement {
  const [state, action, pending] = React.useActionState(submitCancellation, IDLE);
  return (
    <form action={action} noValidate className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={request.requestId} />
      <input type="hidden" name="requestVersion" value={request.requestVersion} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormFeedback state={state} />
      <div>
        <Button type="submit" variant="secondary" disabled={pending} className="w-full md:w-auto">
          {pending ? "Working…" : `Cancel request ${request.reference}`}
        </Button>
      </div>
    </form>
  );
}
