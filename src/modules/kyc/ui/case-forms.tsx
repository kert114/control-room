"use client";

import * as React from "react";

import {
  claimCaseAction,
  reassignCaseAction,
  requestInformationAction,
  resumeReviewAction,
} from "@/modules/kyc/actions";
import type { Reviewer } from "@/modules/kyc/queries";
import {
  CaseActionForm,
  FieldError,
  selectClass,
  textareaClass,
} from "@/modules/kyc/ui/case-action-form";

interface FormProps {
  caseId: string;
  version: number;
  actorName: string;
}

export function ClaimForm({
  resuming,
  ...props
}: FormProps & { resuming: boolean }): React.ReactElement {
  return (
    <CaseActionForm
      {...props}
      action={resuming ? resumeReviewAction : claimCaseAction}
      submitLabel={resuming ? "Resume review" : "Claim case"}
    />
  );
}

export function RequestInformationForm(props: FormProps): React.ReactElement {
  return (
    <CaseActionForm
      {...props}
      action={requestInformationAction}
      submitLabel="Request information"
      variant="secondary"
    >
      {({ fieldErrors }) => (
        <div className="flex flex-col gap-1">
          <label htmlFor="kyc-reason" className="text-body font-medium text-ink">
            What the customer must provide
          </label>
          <textarea
            id="kyc-reason"
            name="reason"
            maxLength={500}
            aria-invalid={fieldErrors.reason ? true : undefined}
            aria-describedby={fieldErrors.reason ? "kyc-reason-error" : undefined}
            className={textareaClass}
          />
          <FieldError id="kyc-reason-error" message={fieldErrors.reason} />
        </div>
      )}
    </CaseActionForm>
  );
}

export function ReassignForm({
  candidates,
  ...props
}: FormProps & { candidates: readonly Reviewer[] }): React.ReactElement {
  return (
    <CaseActionForm
      {...props}
      action={reassignCaseAction}
      submitLabel="Reassign case"
      variant="secondary"
    >
      {({ fieldErrors }) => (
        <div className="flex flex-col gap-1">
          <label htmlFor="kyc-assignee-select" className="text-body font-medium text-ink">
            New reviewer
          </label>
          <select
            id="kyc-assignee-select"
            name="assigneeId"
            defaultValue=""
            aria-invalid={fieldErrors.assigneeId ? true : undefined}
            aria-describedby={fieldErrors.assigneeId ? "kyc-assignee-error" : undefined}
            className={selectClass}
          >
            <option value="">Choose a reviewer</option>
            {candidates.map((reviewer) => (
              <option key={reviewer.id} value={reviewer.id}>
                {reviewer.name} · {reviewer.role}
              </option>
            ))}
          </select>
          <FieldError id="kyc-assignee-error" message={fieldErrors.assigneeId} />
        </div>
      )}
    </CaseActionForm>
  );
}
