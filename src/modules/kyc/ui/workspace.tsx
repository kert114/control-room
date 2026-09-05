import Link from "next/link";
import * as React from "react";

import { kycModule } from "@/modules/kyc/module";
import {
  loadCaseDetail,
  loadCountries,
  loadQueue,
  loadReviewers,
} from "@/modules/kyc/queries";
import { caseCapabilities } from "@/modules/kyc/rules";
import type { QueueParams } from "@/modules/kyc/schemas";
import { CaseDetail } from "@/modules/kyc/ui/case-detail";
import { KYC_ROUTE, queueHref } from "@/modules/kyc/ui/presentation";
import { QueueFilters, hasActiveFilters } from "@/modules/kyc/ui/queue-filters";
import { QueueTable } from "@/modules/kyc/ui/queue-table";
import { WorkflowSteps, currentStep } from "@/modules/kyc/ui/workflow-steps";
import type { Actor } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/empty-state";
import { Panel } from "@/platform/ui/panel";

export interface KycWorkspaceProps {
  actor: Actor;
  params: QueueParams;
}

/**
 * Server component that owns every read for the KYC route. Queue state comes
 * from the parsed URL, so reloads and deep links restore filters, sort, and the
 * selected case.
 */
export async function KycWorkspace({
  actor,
  params,
}: KycWorkspaceProps): Promise<React.ReactElement> {
  const now = new Date();
  const [rows, reviewers, countries, detail] = await Promise.all([
    loadQueue(actor, params, now),
    loadReviewers(actor),
    loadCountries(actor),
    params.case ? loadCaseDetail(actor, params.case) : Promise.resolve(null),
  ]);

  const capabilities = detail ? caseCapabilities(actor, detail) : null;
  const canDecide = Boolean(capabilities?.decide.allowed);
  const step = currentStep(params, canDecide);
  const deciding = step === 2;
  const filtered = hasActiveFilters(params);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">{kycModule.title}</h1>
        <p className="text-body text-muted">
          Review identity evidence and risk signals, then approve, escalate, or
          reject each case.
        </p>
      </div>

      <WorkflowSteps
        params={params}
        step={step}
        canDecide={canDecide}
        decideBlockedReason={
          detail && !capabilities?.decide.allowed
            ? capabilities?.decide.reason
            : undefined
        }
      />

      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] lg:items-start">
        <Panel
          className="min-w-0"
          title="Queue"
          description={`${rows.length} ${rows.length === 1 ? "case" : "cases"}${filtered ? " match the current filters" : ""}.`}
        >
          <div className="flex flex-col gap-3">
            <QueueFilters params={params} reviewers={reviewers} countries={countries} />
            {rows.length === 0 ? (
              filtered ? (
                <EmptyState
                  title="No cases match these filters"
                  description="Widen the search or clear the filters to see the full queue."
                  action={
                    <Link prefetch={false}
                      href={params.case ? queueHref(params, {
                        q: undefined,
                        risk: undefined,
                        status: undefined,
                        country: undefined,
                        assignee: undefined,
                        sla: undefined,
                      }) : KYC_ROUTE}
                      className="inline-flex h-11 items-center rounded-control border border-line bg-panel px-3 text-body text-ink hover:bg-primary-soft md:h-9"
                    >
                      Clear filters
                    </Link>
                  }
                />
              ) : (
                <EmptyState
                  title="The KYC queue is empty"
                  description="New cases appear here as onboarding checks are raised. Nothing needs review right now."
                />
              )
            ) : (
              <QueueTable rows={rows} params={params} now={now} />
            )}
          </div>
        </Panel>

        <Panel
          title={detail ? "Selected case" : "No case selected"}
          description={
            detail
              ? undefined
              : "Choose a row in the queue to review its evidence and available actions."
          }
        >
          {detail && capabilities ? (
            <CaseDetail
              detail={detail}
              actor={actor}
              capabilities={capabilities}
              reviewers={reviewers}
              params={params}
              deciding={deciding}
              now={now}
            />
          ) : params.case ? (
            <p className="text-body text-muted" role="status">
              That case could not be found. It may have been removed or the link
              is out of date.
            </p>
          ) : (
            <p className="text-body text-muted">
              Use Enter or Space on a focused row, or click it, to open a case.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}
