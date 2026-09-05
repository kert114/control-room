import * as React from "react";

import { cn } from "@/platform/ui/cn";

export type WorkflowStep = 1 | 2 | 3;

export function WorkflowSteps({
  steps,
  current,
}: {
  steps: readonly [string, string, string];
  current: WorkflowStep;
}): React.ReactElement {
  return (
    <ol aria-label="Workflow" className="flex flex-wrap gap-x-4 gap-y-1">
      {steps.map((step, index) => {
        const number = (index + 1) as WorkflowStep;
        const state =
          number === current ? "current" : number < current ? "done" : "upcoming";
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 text-body",
              state === "current" ? "font-medium text-ink" : "text-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-full border text-meta",
                state === "current" && "border-primary bg-primary text-white",
                state === "done" && "border-primary text-primary",
                state === "upcoming" && "border-line",
              )}
            >
              {state === "done" ? "✓" : number}
            </span>
            <span>
              <span className="sr-only">Step {number}{state === "done" ? ", complete" : ""}: </span>
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
