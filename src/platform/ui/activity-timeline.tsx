import * as React from "react";

export interface TimelineEntry {
  id: string;
  summary: string;
  actor: string;
  action: string;
  occurredAt: Date;
}

export interface ActivityTimelineProps {
  entries: readonly TimelineEntry[];
  emptyLabel?: string;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function ActivityTimeline({
  entries,
  emptyLabel = "No activity recorded yet.",
}: ActivityTimelineProps): React.ReactElement {
  if (entries.length === 0) {
    return <p className="text-body text-muted">{emptyLabel}</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="border-l-2 border-line pl-3">
          <p className="text-body text-ink">{entry.summary}</p>
          <p className="text-meta text-muted">
            {entry.actor} · {entry.action} ·{" "}
            <time dateTime={entry.occurredAt.toISOString()}>
              {formatter.format(entry.occurredAt)} UTC
            </time>
          </p>
        </li>
      ))}
    </ol>
  );
}
