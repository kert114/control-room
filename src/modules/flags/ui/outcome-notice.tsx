import * as React from "react";

import { StatusBadge } from "@/platform/ui/status-badge";

import type { NoticeCode } from "@/modules/flags/url-state";

const NOTICE_TEXT: Record<NoticeCode, { title: string; body: (ref: string) => string }> = {
  request_created: {
    title: "Change request submitted",
    body: (ref) => `${ref} is waiting for a second person with approval rights.`,
  },
  kill_requested: {
    title: "Kill switch requested",
    body: (ref) => `${ref} is waiting for a second person; the flag stays live until it is approved.`,
  },
  flag_updated: {
    title: "Flag updated",
    body: (ref) => `The change is live and recorded in the audit trail as ${ref}.`,
  },
  flag_killed: {
    title: "Flag killed",
    body: (ref) => `The flag is off with 0% rollout, recorded as ${ref}.`,
  },
  request_applied: {
    title: "Approved and applied",
    body: (ref) => `${ref} is applied; the production flag now matches the proposal.`,
  },
  request_rejected: {
    title: "Request rejected",
    body: (ref) => `${ref} is closed and the flag is unchanged.`,
  },
  request_cancelled: {
    title: "Request cancelled",
    body: (ref) => `${ref} is closed and the flag is unchanged.`,
  },
};

/** Success state for the last completed action, carried in the URL so it survives the refresh. */
export function OutcomeNotice({
  notice,
  reference,
}: {
  notice: NoticeCode;
  reference: string;
}): React.ReactElement {
  const text = NOTICE_TEXT[notice];
  return (
    <div role="status" data-testid="outcome-notice" className="rounded-control border border-success bg-page p-3">
      <StatusBadge tone="success" label={text.title} />
      <p className="mt-1 text-body text-ink">{text.body(reference)}</p>
    </div>
  );
}
