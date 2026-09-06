"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import type { Reviewer } from "@/modules/kyc/queries";
import {
  RISK_LEVELS,
  SLA_FILTERS,
  STATUS_FILTERS,
  type QueueParams,
  type RiskLevel,
  type StatusFilter,
} from "@/modules/kyc/schemas";
import { STATUS_LABELS, type KycStatus } from "@/modules/kyc/transitions";
import {
  RISK_LABELS,
  CLEARED_FILTERS,
  RISK_TONE,
  STATUS_TONE,
  countryName,
  hasActiveFilters,
  queueHref,
} from "@/modules/kyc/ui/presentation";
import { StatusBadge, type StatusTone } from "@/platform/ui/status-badge";
import { cn } from "@/platform/ui/cn";

const SLA_LABELS: Readonly<Record<(typeof SLA_FILTERS)[number], string>> = {
  breached: "Breached",
  due_24h: "Due within 24h",
  on_track: "On track",
};

const fieldClass =
  "h-11 w-full rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9";

const labelClass = "text-meta font-medium text-muted";

export interface QueueFiltersProps {
  params: QueueParams;
  reviewers: readonly Reviewer[];
  countries: readonly string[];
}

function toggle<T extends string>(list: readonly T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

interface ToggleChipProps {
  label: string;
  tone: StatusTone;
  pressed: boolean;
  onToggle: () => void;
}

/** Multi-select filter option; state is announced via aria-pressed and a tick. */
function ToggleChip({ label, tone, pressed, onToggle }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-control border px-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:min-h-8",
        pressed
          ? "border-primary bg-primary-soft text-ink"
          : "border-line bg-panel text-muted hover:text-ink",
      )}
    >
      <span aria-hidden="true" className="w-3 text-meta">
        {pressed ? "\u2713" : ""}
      </span>
      <StatusBadge tone={tone} label={label} />
    </button>
  );
}

/**
 * Filters apply as soon as they change by navigating to the new queue URL, so
 * the URL stays the single source of truth for reloads and deep links.
 */
export function QueueFilters({
  params,
  reviewers,
  countries,
}: QueueFiltersProps): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState(params.q ?? "");
  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setSearch(params.q ?? "");
  }, [params.q]);

  const navigate = React.useCallback(
    (overrides: Parameters<typeof queueHref>[1]) => {
      startTransition(() => {
        router.replace(queueHref(params, overrides), { scroll: false });
      });
    },
    [params, router],
  );

  const applySearch = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    navigate({ q: value.trim() || undefined });
  };

  const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value.trim() || undefined }), 400);
  };

  const active = hasActiveFilters(params);

  return (
    <div
      role="group"
      aria-label="Queue filters"
      aria-busy={pending || undefined}
      className="flex flex-col gap-3 rounded-control border border-line bg-page p-3"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="flex flex-col gap-1">
          <label htmlFor="kyc-q" className={labelClass}>
            Search case, customer, or country
          </label>
          <input
            id="kyc-q"
            name="q"
            type="search"
            value={search}
            onChange={onSearchChange}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applySearch(search);
              }
            }}
            placeholder="KYC-2401, alias, or Estonia"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="kyc-country" className={labelClass}>
            Country
          </label>
          <select
            id="kyc-country"
            name="country"
            value={params.country ?? ""}
            onChange={(event) => navigate({ country: event.target.value || undefined })}
            className={fieldClass}
          >
            <option value="">Any country</option>
            {countries.map((code) => (
              <option key={code} value={code}>
                {countryName(code)} ({code})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="kyc-assignee" className={labelClass}>
            Reviewer
          </label>
          <select
            id="kyc-assignee"
            name="assignee"
            value={params.assignee ?? ""}
            onChange={(event) => navigate({ assignee: event.target.value || undefined })}
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
          <label htmlFor="kyc-sla" className={labelClass}>
            SLA
          </label>
          <select
            id="kyc-sla"
            name="sla"
            value={params.sla ?? ""}
            onChange={(event) => navigate({ sla: event.target.value || undefined })}
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
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:gap-6">
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className={labelClass}>Status (select any)</legend>
          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((status) => (
              <ToggleChip
                key={status}
                label={status === "open" ? "All open" : STATUS_LABELS[status as KycStatus]}
                tone={status === "open" ? "info" : STATUS_TONE[status as KycStatus]}
                pressed={params.status.includes(status)}
                onToggle={() =>
                  navigate({ status: toggle<StatusFilter>(params.status, status) })
                }
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className={labelClass}>Risk (select any)</legend>
          <div className="flex flex-wrap gap-1">
            {RISK_LEVELS.map((risk) => (
              <ToggleChip
                key={risk}
                label={RISK_LABELS[risk]}
                tone={RISK_TONE[risk]}
                pressed={params.risk.includes(risk)}
                onToggle={() => navigate({ risk: toggle<RiskLevel>(params.risk, risk) })}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2 text-meta text-muted">
        <span role="status">
          {pending ? "Updating queue\u2026" : active ? "Filters apply as you change them." : "Showing every case."}
        </span>
        {active ? (
          <button
            type="button"
            onClick={() => navigate(CLEARED_FILTERS)}
            className="inline-flex min-h-11 items-center rounded-control px-2 text-body text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:min-h-8"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
