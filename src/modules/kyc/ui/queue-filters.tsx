import Link from "next/link";
import * as React from "react";

import type { Reviewer } from "@/modules/kyc/queries";
import {
  RISK_LEVELS,
  SLA_FILTERS,
  STATUS_FILTERS,
  type QueueParams,
} from "@/modules/kyc/schemas";
import { STATUS_LABELS, type KycStatus } from "@/modules/kyc/transitions";
import { KYC_ROUTE, RISK_LABELS, queueHref } from "@/modules/kyc/ui/presentation";
import { Button } from "@/platform/ui/button";

const SLA_LABELS: Readonly<Record<(typeof SLA_FILTERS)[number], string>> = {
  breached: "Breached",
  due_24h: "Due within 24h",
  on_track: "On track",
};

const fieldClass =
  "h-11 w-full rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9";

export interface QueueFiltersProps {
  params: QueueParams;
  reviewers: readonly Reviewer[];
  countries: readonly string[];
}

export function hasActiveFilters(params: QueueParams): boolean {
  return Boolean(
    params.q ||
      params.risk ||
      params.status ||
      params.country ||
      params.assignee ||
      params.sla,
  );
}

/**
 * Plain GET form: the URL is the single source of truth for queue state, so
 * filters survive reload, deep links, and work without client JavaScript.
 */
export function QueueFilters({
  params,
  reviewers,
  countries,
}: QueueFiltersProps): React.ReactElement {
  const filterKey = [
    params.q,
    params.status,
    params.risk,
    params.country,
    params.assignee,
    params.sla,
  ]
    .map((value) => value ?? "")
    .join("|");
  return (
    <form
      key={filterKey}
      method="get"
      action={KYC_ROUTE}
      className="grid grid-cols-2 gap-2 md:grid-cols-4"
      aria-label="Queue filters"
    >
      {params.case ? <input type="hidden" name="case" value={params.case} /> : null}
      {params.sort !== "sla" ? (
        <input type="hidden" name="sort" value={params.sort} />
      ) : null}
      {params.dir !== "asc" ? (
        <input type="hidden" name="dir" value={params.dir} />
      ) : null}

      <div className="col-span-2 flex flex-col gap-1">
        <label htmlFor="kyc-q" className="text-meta font-medium text-muted">
          Search case or customer
        </label>
        <input
          id="kyc-q"
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder="KYC-2401 or alias"
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kyc-status" className="text-meta font-medium text-muted">
          Status
        </label>
        <select
          id="kyc-status"
          name="status"
          defaultValue={params.status ?? ""}
          className={fieldClass}
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "open" ? "Open cases" : STATUS_LABELS[status as KycStatus]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kyc-risk" className="text-meta font-medium text-muted">
          Risk
        </label>
        <select
          id="kyc-risk"
          name="risk"
          defaultValue={params.risk ?? ""}
          className={fieldClass}
        >
          <option value="">Any risk</option>
          {RISK_LEVELS.map((risk) => (
            <option key={risk} value={risk}>
              {RISK_LABELS[risk]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kyc-country" className="text-meta font-medium text-muted">
          Country
        </label>
        <select
          id="kyc-country"
          name="country"
          defaultValue={params.country ?? ""}
          className={fieldClass}
        >
          <option value="">Any country</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kyc-assignee" className="text-meta font-medium text-muted">
          Reviewer
        </label>
        <select
          id="kyc-assignee"
          name="assignee"
          defaultValue={params.assignee ?? ""}
          className={fieldClass}
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {reviewers.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.id}>
              {reviewer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="kyc-sla" className="text-meta font-medium text-muted">
          SLA
        </label>
        <select
          id="kyc-sla"
          name="sla"
          defaultValue={params.sla ?? ""}
          className={fieldClass}
        >
          <option value="">Any SLA</option>
          {SLA_FILTERS.map((sla) => (
            <option key={sla} value={sla}>
              {SLA_LABELS[sla]}
            </option>
          ))}
        </select>
      </div>

      <div className="col-span-2 flex items-end gap-2 md:col-span-4">
        <Button type="submit" variant="secondary" className="h-11 md:h-9">
          Apply filters
        </Button>
        {hasActiveFilters(params) ? (
          <Link prefetch={false}
            href={queueHref(params, {
              q: undefined,
              risk: undefined,
              status: undefined,
              country: undefined,
              assignee: undefined,
              sla: undefined,
            })}
            className="inline-flex h-11 items-center rounded-control px-3 text-body text-primary underline-offset-2 hover:underline md:h-9"
          >
            Clear filters
          </Link>
        ) : null}
      </div>
    </form>
  );
}
