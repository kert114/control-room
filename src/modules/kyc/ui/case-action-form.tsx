"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { idleState, type ActionState } from "@/modules/kyc/action-state";
import { formatDateTime } from "@/modules/kyc/ui/presentation";
import { ActionDialog } from "@/platform/ui/action-dialog";
import { Button, type ButtonProps } from "@/platform/ui/button";

export interface ActionOutcome {
  caseId: string;
  message: string;
  actorName: string;
  completedAt: Date;
}

const OutcomeContext = React.createContext<{
  outcome: ActionOutcome | null;
  announce: (outcome: ActionOutcome) => void;
} | null>(null);

/**
 * Keeps the last successful outcome alive across the server re-render that
 * follows a mutation, since the form that produced it usually unmounts.
 */
export function ActionOutcomeProvider({
  caseId,
  children,
}: {
  caseId: string;
  children: React.ReactNode;
}): React.ReactElement {
  const [outcome, setOutcome] = React.useState<ActionOutcome | null>(null);
  const value = React.useMemo(
    () => ({
      outcome: outcome?.caseId === caseId ? outcome : null,
      announce: setOutcome,
    }),
    [outcome, caseId],
  );
  return <OutcomeContext.Provider value={value}>{children}</OutcomeContext.Provider>;
}

export function ActionOutcomeBanner(): React.ReactElement {
  const context = React.useContext(OutcomeContext);
  const outcome = context?.outcome ?? null;
  return (
    <div role="status" aria-live="polite">
      {outcome ? (
        <p
          className="rounded-control border border-success bg-page px-3 py-2 text-body text-ink"
          data-testid="kyc-action-success"
        >
          <span className="font-medium text-success">Done.</span> {outcome.message}{" "}
          <span className="text-muted">
            By {outcome.actorName} · {formatDateTime(outcome.completedAt)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export interface ReviewStep {
  title: string;
  description: string;
}

export interface CaseActionFormProps {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  caseId: string;
  version: number;
  actorName: string;
  submitLabel: string;
  variant?: ButtonProps["variant"];
  /** Consequential actions show a review state before the request is sent. */
  review?: ReviewStep;
  className?: string;
  children?: (state: {
    fieldErrors: Record<string, string>;
    pending: boolean;
  }) => React.ReactNode;
}

/**
 * Wraps a server action with the required validation, changed-record,
 * failure, and success states. Entered values are kept on failure because the
 * form is never reset by the action.
 */
export function CaseActionForm({
  action,
  caseId,
  version,
  actorName,
  submitLabel,
  variant = "primary",
  review,
  className,
  children,
}: CaseActionFormProps): React.ReactElement {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const announce = React.useContext(OutcomeContext)?.announce;
  const [state, dispatch, pending] = React.useActionState(
    async (previous: ActionState, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.status === "success") {
        announce?.({
          caseId: next.caseId,
          message: next.message,
          actorName,
          completedAt: new Date(),
        });
      }
      return next;
    },
    idleState,
  );
  const [reviewOpen, setReviewOpen] = React.useState(false);

  React.useEffect(() => {
    if (state.status !== "idle") setReviewOpen(false);
  }, [state]);

  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const conflict = state.status === "version_conflict";
  const done = state.status === "success";

  const submitButton = (
    <Button
      type={review ? "button" : "submit"}
      variant={variant}
      className="h-11 w-full md:h-9 md:w-auto"
      disabled={pending || conflict || done}
    >
      {pending ? "Working…" : submitLabel}
    </Button>
  );

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        React.startTransition(() => dispatch(formData));
      }}
      className={className ?? "flex flex-col gap-3"}
      aria-busy={pending}
      noValidate
    >
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="expectedVersion" value={version} />
      {children?.({ fieldErrors, pending })}

      <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
        {state.status === "invalid" ? (
          <p data-testid="kyc-action-error" className="rounded-control border border-danger bg-page px-3 py-2 text-body text-danger">
            {state.message}
          </p>
        ) : null}
        {state.status === "forbidden" || state.status === "business_rule" ? (
          <p data-testid="kyc-action-error" className="rounded-control border border-danger bg-page px-3 py-2 text-body text-danger">
            {submitLabel} failed: {state.message}
          </p>
        ) : null}
        {conflict ? (
          <div data-testid="kyc-action-conflict" className="flex flex-col gap-2 rounded-control border border-warning bg-page px-3 py-2 text-body text-ink">
            <p className="font-medium">This record changed</p>
            <p className="text-muted">{state.message}</p>
            <Button
              type="button"
              variant="secondary"
              className="h-11 md:h-9"
              onClick={() => router.refresh()}
            >
              Review latest version
            </Button>
          </div>
        ) : null}
      </div>

      {review ? (
        <ActionDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          trigger={submitButton}
          title={review.title}
          description={review.description}
          confirmLabel={submitLabel}
          pending={pending}
          onConfirm={() => {
            formRef.current?.requestSubmit();
          }}
        />
      ) : (
        submitButton
      )}
    </form>
  );
}

export interface FieldErrorProps {
  id: string;
  message?: string;
}

export function FieldError({ id, message }: FieldErrorProps): React.ReactElement | null {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-meta text-danger">
      {message}
    </p>
  );
}

export const textareaClass =
  "min-h-24 w-full rounded-control border border-line bg-panel px-2 py-1 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-[invalid=true]:border-danger";

export const selectClass =
  "h-11 w-full rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9 aria-[invalid=true]:border-danger";
