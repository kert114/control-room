"use client";

import * as React from "react";

import { Button } from "@/platform/ui/button";

import { submitKillSwitch } from "@/modules/flags/form-actions";
import { IDLE } from "@/modules/flags/form-state";
import { FieldError, FormFeedback, inputClass, textareaClass } from "@/modules/flags/ui/form-feedback";

export function KillSwitchForm({
  flag,
  production,
  returnTo,
}: {
  flag: { id: string; key: string; version: number };
  production: boolean;
  returnTo: string;
}): React.ReactElement {
  const [state, action, pending] = React.useActionState(submitKillSwitch, IDLE);
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const id = React.useId();
  const [confirmation, setConfirmation] = React.useState("");
  const [reason, setReason] = React.useState("");

  return (
    <form action={action} noValidate className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-section font-medium text-danger">
        Kill switch
      </h3>
      <p className="text-body text-ink">
        Turns <span className="font-medium">{flag.key}</span> off and sets rollout to 0%.{" "}
        {production
          ? "In production this raises a kill request that a second person must approve before it takes effect."
          : "This takes effect immediately."}
      </p>
      <input type="hidden" name="flagId" value={flag.id} />
      <input type="hidden" name="flagVersion" value={flag.version} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-confirmation`} className="text-meta font-medium text-muted">
          Type the flag key <span className="font-mono text-ink">{flag.key}</span> to confirm
        </label>
        <input
          id={`${id}-confirmation`}
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          aria-invalid={errors.confirmation ? true : undefined}
          aria-describedby={errors.confirmation ? `${id}-confirmation-error` : undefined}
          className={inputClass}
        />
        <FieldError id={`${id}-confirmation-error`} message={errors.confirmation} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-reason`} className="text-meta font-medium text-muted">
          Reason
        </label>
        <textarea
          id={`${id}-reason`}
          name="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          minLength={10}
          maxLength={500}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? `${id}-reason-error` : undefined}
          className={textareaClass}
        />
        <FieldError id={`${id}-reason-error`} message={errors.reason} />
      </div>

      <FormFeedback state={state} />

      <div>
        <Button type="submit" variant="danger" disabled={pending} className="w-full md:w-auto">
          {pending ? "Working…" : production ? "Request kill switch" : "Kill flag now"}
        </Button>
      </div>
    </form>
  );
}
