"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/platform/ui/button";
import { StatusBadge } from "@/platform/ui/status-badge";

import type { FormState } from "@/modules/flags/form-state";

export const inputClass =
  "h-9 w-full rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-[invalid=true]:border-danger";

export const textareaClass =
  "min-h-20 w-full rounded-control border border-line bg-panel px-2 py-1 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-[invalid=true]:border-danger";

export function FieldError({ id, message }: { id: string; message?: string }): React.ReactElement | null {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-meta text-danger">
      <span aria-hidden="true">✕ </span>
      {message}
    </p>
  );
}

/** Outcome of the last submission; failures stay inline, never toast-only. */
export function FormFeedback({ state }: { state: FormState }): React.ReactElement | null {
  const router = useRouter();

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "invalid") {
    const count = Object.keys(state.fieldErrors).length;
    return (
      <div role="alert" data-testid="form-invalid" className="rounded-control border border-danger bg-page p-3">
        <StatusBadge tone="danger" label="Check the form" />
        <p className="mt-1 text-body text-ink">
          {count === 1 ? "One field needs attention." : `${count} fields need attention.`}
          {state.fieldErrors.form ? ` ${state.fieldErrors.form}` : ""}
        </p>
      </div>
    );
  }

  if (state.status === "version_conflict") {
    return (
      <div role="alert" data-testid="form-conflict" className="rounded-control border border-warning bg-page p-3">
        <StatusBadge tone="warning" label="Record changed" />
        <p className="mt-1 text-body text-ink">
          Someone else changed this record while you were working. Nothing was saved.
        </p>
        <Button type="button" variant="secondary" size="small" className="mt-2" onClick={() => router.refresh()}>
          Load the latest version
        </Button>
      </div>
    );
  }

  return (
    <div role="alert" data-testid="form-failure" className="rounded-control border border-danger bg-page p-3">
      <StatusBadge tone="danger" label={state.status === "forbidden" ? "Not allowed" : "Not applied"} />
      <p className="mt-1 text-body text-ink">{state.message}</p>
    </div>
  );
}
