"use client";

import * as React from "react";

import { Button } from "@/platform/ui/button";

import { submitChangeRequest, submitDirectChange } from "@/modules/flags/form-actions";
import { IDLE } from "@/modules/flags/form-state";
import { REGIONS, type RegionCode } from "@/modules/flags/targeting";
import { BeforeAfter } from "@/modules/flags/ui/before-after";
import { FieldError, FormFeedback, inputClass, textareaClass } from "@/modules/flags/ui/form-feedback";

export interface RolloutFormFlag {
  id: string;
  key: string;
  version: number;
  enabled: boolean;
  rolloutPercentage: number;
  killed: boolean;
  /** Countries the rollout is currently restricted to; empty means everywhere. */
  regions: RegionCode[];
}

export function RolloutForm({
  flag,
  mode,
  returnTo,
}: {
  flag: RolloutFormFlag;
  /** `request` raises a production change request; `direct` applies now. */
  mode: "request" | "direct";
  returnTo: string;
}): React.ReactElement {
  const [state, action, pending] = React.useActionState(
    mode === "request" ? submitChangeRequest : submitDirectChange,
    IDLE,
  );
  const [enabled, setEnabled] = React.useState<"on" | "off">(flag.enabled ? "on" : "off");
  const [rollout, setRollout] = React.useState(String(flag.rolloutPercentage));
  const [reason, setReason] = React.useState("");
  const [ticket, setTicket] = React.useState("");
  const [regions, setRegions] = React.useState<RegionCode[]>(flag.regions);
  const errors = state.status === "invalid" ? state.fieldErrors : {};
  const id = React.useId();

  const proposedRollout = Number.parseInt(rollout, 10);
  const proposedEnabled = enabled === "on";
  const preview = Number.isFinite(proposedRollout)
    ? { enabled: proposedEnabled, rolloutPercentage: proposedRollout, killedAt: null }
    : null;

  return (
    <form action={action} noValidate className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-section font-medium text-ink">
        {mode === "request" ? "Propose a production change" : "Set rollout"}
      </h3>
      <input type="hidden" name="flagId" value={flag.id} />
      <input type="hidden" name="flagVersion" value={flag.version} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <fieldset className="flex flex-col gap-1">
        <legend className="text-meta font-medium text-muted">Switch</legend>
        <div className="flex gap-4">
          {(["on", "off"] as const).map((value) => (
            <label key={value} className="inline-flex min-h-9 items-center gap-2 text-body text-ink">
              <input
                type="radio"
                name="enabled"
                value={value}
                checked={enabled === value}
                // Form actions reset the form; keep the reset target in step with the controlled value.
                ref={(element) => {
                  if (element) element.defaultChecked = enabled === value;
                }}
                onChange={() => setEnabled(value)}
                className="h-4 w-4 accent-primary"
              />
              {value === "on" ? "On" : "Off"}
            </label>
          ))}
        </div>
        <FieldError id={`${id}-enabled-error`} message={errors.enabled} />
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-rollout`} className="text-meta font-medium text-muted">
          Rollout percentage
        </label>
        <input
          id={`${id}-rollout`}
          name="rolloutPercentage"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={rollout}
          onChange={(event) => setRollout(event.target.value)}
          aria-invalid={errors.rolloutPercentage ? true : undefined}
          aria-describedby={errors.rolloutPercentage ? `${id}-rollout-error` : undefined}
          className={`${inputClass} md:w-32`}
        />
        <FieldError id={`${id}-rollout-error`} message={errors.rolloutPercentage} />
      </div>

      {mode === "direct" ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-meta font-medium text-muted">
            Regions <span className="font-normal">(none selected = every region)</span>
          </legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-4">
            {REGIONS.map((region) => {
              const selected = regions.includes(region.code);
              return (
                <label
                  key={region.code}
                  className="inline-flex min-h-9 items-center gap-2 text-body text-ink"
                >
                  <input
                    type="checkbox"
                    name="regions"
                    value={region.code}
                    checked={selected}
                    ref={(element) => {
                      if (element) element.defaultChecked = selected;
                    }}
                    onChange={(event) =>
                      setRegions((current) =>
                        event.target.checked
                          ? [...current, region.code]
                          : current.filter((code) => code !== region.code),
                      )
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {region.label} ({region.code})
                </label>
              );
            })}
          </div>
          <FieldError id={`${id}-regions-error`} message={errors.regions} />
        </fieldset>
      ) : null}

      {preview ? (
        <BeforeAfter
          before={{ enabled: flag.enabled, rolloutPercentage: flag.rolloutPercentage, killedAt: flag.killed ? new Date(0) : null }}
          after={preview}
        />
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-reason`} className="text-meta font-medium text-muted">
          Reason
        </label>
        <textarea
          id={`${id}-reason`}
          name="reason"
          required
          minLength={10}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? `${id}-reason-error` : `${id}-reason-hint`}
          className={textareaClass}
        />
        <FieldError id={`${id}-reason-error`} message={errors.reason} />
        <p id={`${id}-reason-hint`} className="text-meta text-muted">
          Stored with the change request. The reason never enters the audit metadata.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-ticket`} className="text-meta font-medium text-muted">
          Ticket <span className="font-normal">(optional, e.g. PLAT-412)</span>
        </label>
        <input
          id={`${id}-ticket`}
          name="ticket"
          type="text"
          autoComplete="off"
          value={ticket}
          onChange={(event) => setTicket(event.target.value)}
          aria-invalid={errors.ticket ? true : undefined}
          aria-describedby={errors.ticket ? `${id}-ticket-error` : undefined}
          className={`${inputClass} md:w-48`}
        />
        <FieldError id={`${id}-ticket-error`} message={errors.ticket} />
      </div>

      <FormFeedback state={state} />

      <div>
        <Button type="submit" disabled={pending} className="w-full md:w-auto">
          {pending
            ? "Working…"
            : mode === "request"
              ? "Submit change request"
              : "Apply flag change"}
        </Button>
      </div>
    </form>
  );
}
