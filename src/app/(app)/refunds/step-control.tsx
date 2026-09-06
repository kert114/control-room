import Link from "next/link";

import { buildRefundsHref, type ListParams } from "@/modules/refunds/params";

export function StepControl({
  params,
  hasSelection,
}: {
  params: ListParams;
  hasSelection: boolean;
}): React.ReactElement {
  const steps = ["Find refund", "Review request", "Decide"] as const;
  const stepHref = (step: 1 | 2 | 3): string => {
    if (step === 1) {
      return buildRefundsHref({ ...params, refund: undefined, decision: undefined, step: 1 });
    }
    if (step === 2) {
      return buildRefundsHref({ ...params, step: 2, decision: undefined });
    }
    return buildRefundsHref({ ...params, step: 3 });
  };
  const canReach = (step: number): boolean =>
    step === 1 || (step === 2 && hasSelection) || (step === 3 && hasSelection && Boolean(params.decision));

  return (
    <div className="flex flex-col gap-2">
      <ol
        aria-label="Workflow steps"
        className="grid grid-cols-3 gap-1 rounded-panel border border-line bg-panel p-1"
      >
        {steps.map((name, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const current = params.step === step;
          return (
            <li key={name}>
              {canReach(step) ? (
                <Link
                  href={stepHref(step)}
                  aria-current={current ? "step" : undefined}
                  className={`flex min-h-11 flex-col justify-center rounded-control px-2 text-center ${
                    current ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft"
                  }`}
                >
                  <span className="text-meta">Step {step}</span>
                  <span className="text-body font-medium">{name}</span>
                </Link>
              ) : (
                <span
                  aria-current={current ? "step" : undefined}
                  className="flex min-h-11 flex-col justify-center rounded-control px-2 text-center text-muted"
                >
                  <span className="text-meta">Step {step}</span>
                  <span className="text-body font-medium">{name}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between gap-2 text-body">
        {params.step > 1 ? (
          <Link
            href={stepHref((params.step - 1) as 1 | 2 | 3)}
            className="text-primary underline"
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        {params.step === 1 && !hasSelection ? (
          <span className="text-muted" aria-disabled="true">
            Next <span className="text-meta">(Select a refund to continue)</span>
          </span>
        ) : params.step === 1 ? (
          <Link href={stepHref(2)} className="text-primary underline">
            Next
          </Link>
        ) : params.step === 2 && !params.decision ? (
          <span className="text-muted" aria-disabled="true">
            Next <span className="text-meta">(Choose a decision to continue)</span>
          </span>
        ) : params.step === 2 ? (
          <Link href={stepHref(3)} className="text-primary underline">
            Next
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
