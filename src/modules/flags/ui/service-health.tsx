import * as React from "react";

import { StatusBadge, type StatusTone } from "@/platform/ui/status-badge";

import type { HealthStatus, ServiceHealthSnapshot } from "@/modules/flags/health/provider";
import { dateTime } from "@/modules/flags/ui/format";

const STATUS_TONE: Record<HealthStatus, StatusTone> = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
  unknown: "neutral",
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

/**
 * Monitoring signals for the services behind the flags. When a flag is
 * selected, that owner's services are listed first so the operator sees the
 * relevant health before changing a rollout.
 */
export function ServiceHealthPanel({
  snapshot,
  highlightOwner,
}: {
  snapshot: ServiceHealthSnapshot;
  highlightOwner?: string;
}): React.ReactElement {
  const rows = snapshot.reports
    .flatMap((report) =>
      report.signals.map((signal) => ({ ...signal, source: report.providerName })),
    )
    .sort((a, b) => {
      const aOwned = a.owner === highlightOwner ? 0 : 1;
      const bOwned = b.owner === highlightOwner ? 0 : 1;
      return aOwned - bOwned || a.service.localeCompare(b.service);
    });
  const unavailable = snapshot.reports.filter((report) => report.status === "unavailable");

  return (
    <div data-testid="service-health" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-meta font-medium text-muted">Overall</span>
        <StatusBadge
          tone={STATUS_TONE[snapshot.overall]}
          label={STATUS_LABEL[snapshot.overall]}
        />
        <span className="text-meta text-muted">
          Sources: {snapshot.reports.map((report) => report.providerName).join(", ")}
        </span>
      </div>
      {unavailable.length > 0 ? (
        <p role="status" className="text-meta text-warning">
          Unavailable: {unavailable.map((report) => report.providerName).join(", ")}
        </p>
      ) : null}
      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => (
          <li
            key={`${row.source}-${row.service}`}
            className="flex flex-col gap-1 py-2"
            data-owner={row.owner}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-body font-medium text-ink">{row.service}</span>
              <StatusBadge tone={STATUS_TONE[row.status]} label={STATUS_LABEL[row.status]} />
            </div>
            <p className="text-meta text-muted">
              {row.detail} · {row.source} · {row.owner} ·{" "}
              <time dateTime={row.observedAt.toISOString()}>{dateTime.format(row.observedAt)}</time>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
