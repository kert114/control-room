import Link from "next/link";

import { ActivityChart } from "@/app/(app)/overview/activity-chart";
import { MODULES } from "@/modules/registry";
import { requirePermission } from "@/platform/auth/session";
import { can } from "@/platform/authz/policy";
import {
  loadActivityByDay,
  loadAuditEntries,
  loadOverviewCounts,
} from "@/platform/reporting/overview";
import { ActivityTimeline } from "@/platform/ui/activity-timeline";
import { Panel } from "@/platform/ui/panel";
import { StatusBadge } from "@/platform/ui/status-badge";

export const dynamic = "force-dynamic";

function formatMinor(amountMinor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amountMinor / 100);
}

export default async function OverviewPage(): Promise<React.ReactElement> {
  const actor = await requirePermission("overview.read");
  const [counts, activity, audit] = await Promise.all([
    loadOverviewCounts(),
    loadActivityByDay(),
    loadAuditEntries(8),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">Overview</h1>
        <p className="text-body text-muted">
          Current workload across the internal tools you can access.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[65fr_35fr]">
        <Panel
          title="Operational workload"
          description="Counts come straight from the operational tables."
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Open KYC cases" value={String(counts.kycOpen)} />
            <Metric
              label="KYC past SLA"
              value={String(counts.kycBreachingSla)}
            />
            <Metric
              label="Refunds awaiting approval"
              value={String(counts.refundsPendingApproval)}
            />
            <Metric
              label="Refund value approved"
              value={formatMinor(counts.refundsApprovedMinor)}
            />
            <Metric
              label="Production flags on"
              value={String(counts.flagsProductionEnabled)}
            />
            <Metric
              label="Change requests pending"
              value={String(counts.changeRequestsPending)}
            />
          </dl>

          <div className="mt-4">
            <h3 className="mb-2 text-section font-medium text-ink">
              Audit events per day
            </h3>
            <ActivityChart data={activity} />
          </div>
        </Panel>

        <Panel
          title="Latest activity"
          description="Every business mutation writes one audit event."
          action={
            can(actor.role, "audit.read") ? (
              <Link
                href="/audit"
                className="text-body font-medium text-primary underline"
              >
                Open the full audit trail
              </Link>
            ) : null
          }
        >
          <ActivityTimeline
            entries={audit.map((entry) => ({
              id: entry.id,
              summary: entry.summary,
              actor: entry.actor,
              action: entry.action,
              occurredAt: entry.occurredAt,
            }))}
          />
        </Panel>
      </div>

      <Panel
        title="Internal tools"
        description="Each tool is an independent module on the shared platform."
      >
        <ul className="flex flex-col gap-2">
          {MODULES.map((module) => {
            const allowed = can(actor.role, module.readPermission);
            return (
              <li
                key={module.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-b-0"
              >
                <div>
                  <p className="text-body font-medium text-ink">
                    {allowed ? (
                      <Link href={module.route} className="underline">
                        {module.title}
                      </Link>
                    ) : (
                      module.title
                    )}
                  </p>
                  <p className="text-meta text-muted">{module.summary}</p>
                </div>
                <StatusBadge
                  tone={module.status === "live" ? "success" : "info"}
                  label={
                    module.status === "live"
                      ? "Live"
                      : "Foundation ready, module in build"
                  }
                />
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="border-b border-line pb-2">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="text-title font-medium text-ink">{value}</dd>
    </div>
  );
}
