import * as React from "react";

import { StatusBadge } from "@/platform/ui/status-badge";

import { describeState, stateTone, type FlagStateLike } from "@/modules/flags/ui/format";

/** Side-by-side current and proposed state; the core of every review. */
export function BeforeAfter({
  before,
  after,
  beforeLabel = "Current",
  afterLabel = "Proposed",
}: {
  before: FlagStateLike;
  after: FlagStateLike;
  beforeLabel?: string;
  afterLabel?: string;
}): React.ReactElement {
  const unchanged =
    before.enabled === after.enabled &&
    before.rolloutPercentage === after.rolloutPercentage &&
    Boolean(before.killedAt) === Boolean(after.killedAt);
  return (
    <dl
      data-testid="before-after"
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-control border border-line bg-page p-3"
    >
      <div className="flex flex-col gap-1">
        <dt className="text-meta text-muted">{beforeLabel}</dt>
        <dd>
          <StatusBadge tone={stateTone(before)} label={describeState(before)} />
        </dd>
      </div>
      <span aria-hidden="true" className="text-section text-muted">
        →
      </span>
      <div className="flex flex-col gap-1">
        <dt className="text-meta text-muted">{afterLabel}</dt>
        <dd>
          <StatusBadge tone={stateTone(after)} label={describeState(after)} />
          {unchanged ? (
            <span className="ml-2 text-meta text-muted">No change</span>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}
