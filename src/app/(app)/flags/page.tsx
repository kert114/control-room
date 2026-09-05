import * as React from "react";

import { flagsModule } from "@/modules/flags/module";
import {
  countFlags,
  getChangeRequestDetail,
  getFlagDetail,
  listFlags,
  listOwners,
  parseFlagsQuery,
  type RawSearchParams,
} from "@/modules/flags/queries";
import { FlagDetailPanel } from "@/modules/flags/ui/flag-detail";
import { FlagFilters } from "@/modules/flags/ui/flag-filters";
import { FlagTable } from "@/modules/flags/ui/flag-table";
import { WorkflowSteps, type WorkflowStep } from "@/modules/flags/ui/workflow-steps";
import { requirePermission } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/empty-state";
import { Panel } from "@/platform/ui/panel";

export const dynamic = "force-dynamic";

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<React.ReactElement> {
  const actor = await requirePermission("flags.read");
  const query = parseFlagsQuery(await searchParams);

  const [flags, owners, totalCount, flag] = await Promise.all([
    listFlags(query),
    listOwners(),
    countFlags(),
    query.flag ? getFlagDetail(query.flag) : Promise.resolve(null),
  ]);

  const requestId = flag ? (query.request ?? flag.openRequest?.id) : undefined;
  const request = requestId ? await getChangeRequestDetail(requestId) : null;
  const selectedRequest = request && request.flagId === flag?.id ? request : null;

  const step: WorkflowStep = !flag
    ? 1
    : flag.environment === "production" && flag.openRequest
      ? 3
      : 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-medium text-ink">{flagsModule.title}</h1>
        <p className="text-body text-muted">{flagsModule.summary}</p>
        <WorkflowSteps steps={flagsModule.steps} current={step} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[65fr_35fr]">
        <Panel
          title="Flags"
          description="Search, filters, sort, and selection are kept in the address bar so any view can be shared or reloaded."
        >
          <div className="flex flex-col gap-3">
            <FlagFilters query={query} owners={owners} />
            <FlagTable
              query={query}
              totalCount={totalCount}
              rows={flags.map((row) => ({
                id: row.id,
                key: row.key,
                description: row.description,
                environment: row.environment,
                enabled: row.enabled,
                rolloutPercentage: row.rolloutPercentage,
                owner: row.owner,
                killed: row.killedAt !== null,
                openRequest: row.openRequest,
              }))}
            />
          </div>
        </Panel>

        <Panel
          title="Selected flag"
          description={
            flag
              ? undefined
              : "Choose a row to see its rollout, targeting, change requests, and audit history."
          }
        >
          {flag ? (
            <FlagDetailPanel actor={actor} flag={flag} request={selectedRequest} query={query} />
          ) : query.flag ? (
            <EmptyState
              title="Flag not found"
              description="The selected flag no longer exists or the link is out of date."
            />
          ) : (
            <EmptyState
              title="No flag selected"
              description="Select a flag in the table with a click, Enter, or Space."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
