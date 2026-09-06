import Link from "next/link";

import { cn } from "@/platform/ui/cn";

import { STATUS_LABEL, statusTone } from "@/modules/refunds/format";
import {
  buildRefundsHref,
  CLOSED_STATUSES,
  effectiveStatuses,
  hasQueueFilters,
  OPEN_STATUSES,
  REFUNDS_PATH,
  type ListParams,
  type RefundStatus,
} from "@/modules/refunds/params";

const TONE_CHIP: Record<ReturnType<typeof statusTone>, string> = {
  neutral: "border-line text-muted",
  info: "border-primary text-primary",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  danger: "border-danger text-danger",
};

const TONE_SELECTED: Record<ReturnType<typeof statusTone>, string> = {
  neutral: "bg-line text-ink",
  info: "bg-primary-soft",
  success: "bg-page ring-1 ring-success",
  warning: "bg-page ring-1 ring-warning",
  danger: "bg-page ring-1 ring-danger",
};

const inputClass =
  "h-11 rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9";

/**
 * Status chips and the chart range are links, so a click applies immediately
 * and the URL stays the single source of truth. Search and amount bounds need
 * typing, so they submit on Enter from the same GET form.
 */
export function RefundsFilters({ params }: { params: ListParams }): React.ReactElement {
  const selected = effectiveStatuses(params.status);
  const withStatuses = (statuses: RefundStatus[]): string => {
    const isDefault =
      statuses.length === OPEN_STATUSES.length &&
      OPEN_STATUSES.every((status) => statuses.includes(status));
    return buildRefundsHref({ ...params, status: isDefault ? [] : statuses });
  };
  const toggle = (status: RefundStatus): string =>
    withStatuses(
      selected.includes(status)
        ? selected.filter((entry) => entry !== status)
        : [...selected, status],
    );
  const group = (statuses: readonly RefundStatus[]): string =>
    withStatuses(
      statuses.every((status) => selected.includes(status))
        ? selected.filter((status) => !statuses.includes(status))
        : Array.from(new Set([...selected, ...statuses])),
    );
  const groupActive = (statuses: readonly RefundStatus[]): boolean =>
    statuses.every((status) => selected.includes(status));

  return (
    <div className="flex flex-col gap-3">
      <form
        key={`${params.q}|${params.min ?? ""}|${params.max ?? ""}`}
        method="get"
        action={REFUNDS_PATH}
        role="search"
        className="grid gap-2 md:grid-cols-[1fr_8rem_8rem]"
      >
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Search
          <input
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="Reference, payment or customer — press Enter"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Min (EUR)
          <input
            name="min"
            inputMode="decimal"
            defaultValue={params.min === undefined ? "" : String(params.min / 100)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Max (EUR)
          <input
            name="max"
            inputMode="decimal"
            defaultValue={params.max === undefined ? "" : String(params.max / 100)}
            className={inputClass}
          />
        </label>
        {params.status.length > 0 ? (
          <input type="hidden" name="status" value={params.status.join(",")} />
        ) : null}
        <input type="hidden" name="sort" value={params.sort} />
        <input type="hidden" name="dir" value={params.dir} />
        <input type="hidden" name="range" value={params.range} />
        {params.refund ? <input type="hidden" name="refund" value={params.refund} /> : null}
        <button type="submit" className="sr-only">
          Apply search
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StatusGroup
          label="Open"
          active={groupActive(OPEN_STATUSES)}
          href={group(OPEN_STATUSES)}
          statuses={OPEN_STATUSES}
          selected={selected}
          toggle={toggle}
        />
        <StatusGroup
          label="Closed"
          active={groupActive(CLOSED_STATUSES)}
          href={group(CLOSED_STATUSES)}
          statuses={CLOSED_STATUSES}
          selected={selected}
          toggle={toggle}
        />
        {hasQueueFilters(params) ? (
          <Link
            href={buildRefundsHref({
              sort: params.sort,
              dir: params.dir,
              range: params.range,
              refund: params.refund,
              step: params.step,
            })}
            className="text-body text-primary underline"
          >
            Clear all filters
          </Link>
        ) : (
          <span className="text-meta text-muted">Showing open requests</span>
        )}
      </div>
    </div>
  );
}

function StatusGroup({
  label,
  active,
  href,
  statuses,
  selected,
  toggle,
}: {
  label: string;
  active: boolean;
  href: string;
  statuses: readonly RefundStatus[];
  selected: readonly RefundStatus[];
  toggle: (status: RefundStatus) => string;
}): React.ReactElement {
  return (
    <fieldset className="flex flex-wrap items-center gap-1">
      <legend className="sr-only">{label} statuses</legend>
      <Link
        href={href}
        aria-pressed={active}
        className={cn(
          "inline-flex h-8 items-center rounded-control border px-2 text-meta font-semibold uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          active ? "border-ink bg-ink text-panel" : "border-line text-muted hover:bg-primary-soft",
        )}
      >
        {label}
      </Link>
      {statuses.map((status) => {
        const tone = statusTone(status);
        const on = selected.includes(status);
        return (
          <Link
            key={status}
            href={toggle(status)}
            aria-pressed={on}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-control border px-2 text-meta font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              TONE_CHIP[tone],
              on ? TONE_SELECTED[tone] : "bg-panel hover:bg-primary-soft",
            )}
          >
            <span aria-hidden="true">{on ? "✓" : "+"}</span>
            {STATUS_LABEL[status]}
          </Link>
        );
      })}
    </fieldset>
  );
}
