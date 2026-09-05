import Link from "next/link";
import * as React from "react";

import { kycModule } from "@/modules/kyc/module";
import type { QueueParams } from "@/modules/kyc/schemas";
import { queueHref } from "@/modules/kyc/ui/presentation";
import { cn } from "@/platform/ui/cn";

export type StepIndex = 0 | 1 | 2;

export function currentStep(params: QueueParams, canDecide: boolean): StepIndex {
  if (!params.case) {
    return 0;
  }
  return params.step === "decide" && canDecide ? 2 : 1;
}

export interface WorkflowStepsProps {
  params: QueueParams;
  step: StepIndex;
  /** Whether the selected case can move to the decision step right now. */
  canDecide: boolean;
  decideBlockedReason?: string;
}

function stepHref(params: QueueParams, target: StepIndex): string {
  switch (target) {
    case 0:
      return queueHref(params, { case: undefined, step: undefined });
    case 1:
      return queueHref(params, { step: undefined });
    case 2:
      return queueHref(params, { step: "decide" });
  }
}

const linkClass =
  "inline-flex min-h-11 items-center rounded-control border border-line bg-panel px-3 text-body text-ink hover:bg-primary-soft md:min-h-9";

export function WorkflowSteps({
  params,
  step,
  canDecide,
  decideBlockedReason,
}: WorkflowStepsProps): React.ReactElement {
  const steps = kycModule.steps;
  const reachable = (index: StepIndex): boolean =>
    index === 0 || (index === 1 && Boolean(params.case)) || (index === 2 && canDecide);
  const nextIndex = step < 2 ? ((step + 1) as StepIndex) : null;
  const nextBlocked =
    nextIndex === null
      ? "You are on the last step."
      : nextIndex === 1 && !params.case
        ? "Select a case in the queue to continue."
        : nextIndex === 2 && !canDecide
          ? decideBlockedReason ?? "This case is not ready for a decision."
          : null;

  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Workflow steps">
        <ol className="grid grid-cols-3 gap-1">
          {steps.map((label, index) => {
            const stepIndex = index as StepIndex;
            const isCurrent = stepIndex === step;
            const isDone = stepIndex < step;
            const content = (
              <>
                <span className="text-meta text-muted">
                  Step {index + 1}
                  {isDone ? " · done" : isCurrent ? " · current" : ""}
                </span>
                <span
                  className={cn(
                    "text-body",
                    isCurrent ? "font-medium text-primary" : "text-ink",
                  )}
                >
                  {label}
                </span>
              </>
            );
            const cellClass = cn(
              "flex min-h-11 flex-col justify-center rounded-control border px-2 py-1",
              isCurrent
                ? "border-primary bg-primary-soft"
                : "border-line bg-panel",
            );
            return (
              <li key={label}>
                {reachable(stepIndex) && !isCurrent ? (
                  <Link prefetch={false}
                    href={stepHref(params, stepIndex)}
                    scroll={false}
                    className={cn(cellClass, "hover:bg-primary-soft")}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(cellClass, !isCurrent && "text-muted")}
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 ? (
          <Link prefetch={false}
            href={stepHref(params, (step - 1) as StepIndex)}
            scroll={false}
            className={linkClass}
          >
            Previous
          </Link>
        ) : (
          <span className={cn(linkClass, "text-muted")} aria-disabled="true">
            Previous
          </span>
        )}
        {nextIndex !== null && nextBlocked === null ? (
          <Link prefetch={false} href={stepHref(params, nextIndex)} scroll={false} className={linkClass}>
            Next
          </Link>
        ) : (
          <>
            <span className={cn(linkClass, "text-muted")} aria-disabled="true">
              Next
            </span>
            <span className="text-meta text-muted">{nextBlocked}</span>
          </>
        )}
      </div>
    </div>
  );
}
