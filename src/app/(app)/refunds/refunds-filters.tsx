import Link from "next/link";

import { buildRefundsHref, type ListParams } from "@/modules/refunds/params";

export function RefundsFilters({ params }: { params: ListParams }): React.ReactElement {
  return (
    <form method="get" action="/refunds" className="flex flex-col gap-2">
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Search refunds
          <input
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="Reference, payment, or customer"
            className="h-11 rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9"
          />
        </label>
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Status
          <select
            name="status"
            defaultValue={params.status}
            className="h-11 rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9"
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="pending_approval">Pending approval</option>
            <option value="escalated">Escalated</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="settled">Settled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Min amount (EUR)
          <input
            name="min"
            inputMode="decimal"
            defaultValue={params.min === undefined ? "" : String(params.min / 100)}
            className="h-11 rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9"
          />
        </label>
        <label className="flex flex-col gap-1 text-meta font-medium text-muted">
          Max amount (EUR)
          <input
            name="max"
            inputMode="decimal"
            defaultValue={params.max === undefined ? "" : String(params.max / 100)}
            className="h-11 rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9"
          />
        </label>
      </div>
      <input type="hidden" name="sort" value={params.sort} />
      <input type="hidden" name="dir" value={params.dir} />
      {params.refund ? <input type="hidden" name="refund" value={params.refund} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="h-11 rounded-control border border-line bg-panel px-3 text-body font-medium text-ink hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:h-9"
        >
          Apply filters
        </button>
        <Link href={buildRefundsHref({})} className="text-body text-primary underline">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
