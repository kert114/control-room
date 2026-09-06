"use client";

import * as React from "react";

import { decideCaseAction } from "@/modules/kyc/actions";
import {
  CHECKLIST_ITEMS,
  DECISION_LABELS,
  DECISIONS,
  type Decision,
} from "@/modules/kyc/schemas";
import {
  CaseActionForm,
  FieldError,
  textareaClass,
} from "@/modules/kyc/ui/case-action-form";

const DECISION_HELP: Readonly<Record<Decision, string>> = {
  approve: "Closes the case as approved. Every checklist item must be complete.",
  escalate: "Hands the case to an approver or administrator for the final decision.",
  reject: "Closes the case as rejected.",
};

export interface DecisionFormProps {
  caseId: string;
  version: number;
  reference: string;
  actorName: string;
  /** Approval is blocked for the case creator; the reason is shown inline. */
  approveBlockedReason?: string;
  /** Escalated cases cannot be escalated again. */
  allowEscalate: boolean;
}

export function DecisionForm({
  caseId,
  version,
  reference,
  actorName,
  approveBlockedReason,
  allowEscalate,
}: DecisionFormProps): React.ReactElement {
  const [decision, setDecision] = React.useState<Decision>(
    approveBlockedReason ? "reject" : "approve",
  );
  const options = DECISIONS.filter(
    (option) => option !== "escalate" || allowEscalate,
  );

  return (
    <CaseActionForm
      action={decideCaseAction}
      caseId={caseId}
      version={version}
      actorName={actorName}
      submitLabel={DECISION_LABELS[decision]}
      variant={decision === "reject" ? "danger" : "primary"}
      review={{
        title: `${DECISION_LABELS[decision]} ${reference}?`,
        description: DECISION_HELP[decision],
      }}
    >
      {({ fieldErrors }) => (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-body font-medium text-ink">
              Review checklist
            </legend>
            {CHECKLIST_ITEMS.map((item) => (
              <label
                key={item.key}
                className="flex min-h-11 items-center gap-2 text-body text-ink md:min-h-8"
              >
                <input
                  type="checkbox"
                  name={item.key}
                  className="h-4 w-4 accent-primary"
                  aria-describedby={
                    fieldErrors.checklist ? "kyc-checklist-error" : undefined
                  }
                />
                {item.label}
              </label>
            ))}
            <FieldError id="kyc-checklist-error" message={fieldErrors.checklist} />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-body font-medium text-ink">Decision</legend>
            {options.map((option) => {
              const blocked = option === "approve" ? approveBlockedReason : undefined;
              return (
                <label
                  key={option}
                  className="flex min-h-11 items-start gap-2 text-body text-ink md:min-h-8"
                >
                  <input
                    type="radio"
                    name="decision"
                    value={option}
                    checked={decision === option}
                    disabled={Boolean(blocked)}
                    onChange={() => setDecision(option)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span>{DECISION_LABELS[option]}</span>
                    <span className="text-meta text-muted">
                      {blocked ?? DECISION_HELP[option]}
                    </span>
                  </span>
                </label>
              );
            })}
            <FieldError id="kyc-decision-error" message={fieldErrors.decision} />
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor="kyc-rationale" className="text-body font-medium text-ink">
              Rationale <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="kyc-rationale"
              name="rationale"
              maxLength={1000}
              aria-invalid={fieldErrors.rationale ? true : undefined}
              aria-describedby={fieldErrors.rationale ? "kyc-rationale-error" : undefined}
              className={textareaClass}
              placeholder="Why this outcome is correct, referencing the evidence reviewed."
            />
            <FieldError id="kyc-rationale-error" message={fieldErrors.rationale} />
          </div>
        </>
      )}
    </CaseActionForm>
  );
}
