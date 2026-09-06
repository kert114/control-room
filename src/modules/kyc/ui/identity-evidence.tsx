"use client";

import * as React from "react";

import { idleUnmaskState } from "@/modules/kyc/action-state";
import { unmaskIdentityAction } from "@/modules/kyc/actions";
import type { IdentityEvidence } from "@/modules/kyc/queries";
import { humanise } from "@/modules/kyc/ui/presentation";
import { Button } from "@/platform/ui/button";

interface IdentityRowProps {
  caseId: string;
  version: number;
  evidence: IdentityEvidence;
  canUnmask: boolean;
}

/**
 * Renders the masked value from the server. The raw value is only fetched by
 * the audited unmask action and lives in client state until hidden again; it
 * is never part of the initial page payload.
 */
function IdentityRow({
  caseId,
  version,
  evidence,
  canUnmask,
}: IdentityRowProps): React.ReactElement {
  const [state, dispatch, pending] = React.useActionState(
    unmaskIdentityAction,
    idleUnmaskState,
  );
  const [hidden, setHidden] = React.useState(false);
  const revealed = state.status === "revealed" && !hidden;
  const label = humanise(evidence.field);

  return (
    <li
      className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0"
      data-testid={`identity-${evidence.field}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-meta text-muted">{label}</span>
          <span
            className="font-mono text-body text-ink"
            data-revealed={revealed ? "true" : "false"}
          >
            {revealed ? state.value : evidence.maskedValue}
          </span>
        </div>
        {canUnmask ? (
          revealed ? (
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => setHidden(true)}
            >
              Hide {label.toLowerCase()}
            </Button>
          ) : (
            <form
              action={(formData) => {
                setHidden(false);
                dispatch(formData);
              }}
            >
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="expectedVersion" value={version} />
              <input type="hidden" name="field" value={evidence.field} />
              <Button
                type="submit"
                variant="secondary"
                size="small"
                disabled={pending}
              >
                {pending ? "Revealing…" : `Reveal ${label.toLowerCase()}`}
              </Button>
            </form>
          )
        ) : null}
      </div>
      {state.status !== "idle" && state.status !== "revealed" ? (
        <p role="alert" className="text-meta text-danger">
          {state.message}
        </p>
      ) : null}
      {revealed ? (
        <p className="text-meta text-muted">
          This disclosure was recorded in the audit trail.
        </p>
      ) : null}
    </li>
  );
}

export interface IdentityEvidenceListProps {
  caseId: string;
  version: number;
  identity: readonly IdentityEvidence[];
  canUnmask: boolean;
}

export function IdentityEvidenceList({
  caseId,
  version,
  identity,
  canUnmask,
}: IdentityEvidenceListProps): React.ReactElement {
  if (identity.length === 0) {
    return <p className="text-body text-muted">No identity evidence on file.</p>;
  }
  return (
    <ul className="flex flex-col">
      {identity.map((evidence) => (
        <IdentityRow
          key={evidence.field}
          caseId={caseId}
          version={version}
          evidence={evidence}
          canUnmask={canUnmask}
        />
      ))}
    </ul>
  );
}
