"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { OpenClosedBadge } from "@/app/(app)/refunds/open-closed-badge";
import {
  buildRefundsHref,
  hasQueueFilters,
  isOpenStatus,
  type ListParams,
} from "@/modules/refunds/params";
import { formatDateTime, formatMoney, STATUS_LABEL, statusTone } from "@/modules/refunds/format";
import type { RefundListItem } from "@/modules/refunds/queries";
import { EmptyState } from "@/platform/ui/empty-state";
import { StatusBadge } from "@/platform/ui/status-badge";

function activeFilters(params: ListParams, currency: string): string {
  return [
    params.q ? `search “${params.q}”` : "",
    params.status.length > 0
      ? params.status.map((status) => STATUS_LABEL[status].toLowerCase()).join(" or ")
      : "",
    params.min !== undefined ? `minimum ${formatMoney(params.min, currency)}` : "",
    params.max !== undefined ? `maximum ${formatMoney(params.max, currency)}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function RefundsTable({
  rows,
  params,
  currency,
  thresholdMinor,
}: {
  rows: RefundListItem[];
  params: ListParams;
  currency: string;
  thresholdMinor: number;
}): React.ReactElement {
  const router = useRouter();
  const href = buildRefundsHref;
  const hasFilters = hasQueueFilters(params);
  const selectRow = (row: RefundListItem): void => {
    router.push(
      href({
        ...params,
        refund: row.id,
        step: 2,
        decision: undefined,
      }),
    );
  };
  const sortHref = (sort: ListParams["sort"]): string =>
    href({
      ...params,
      sort,
      dir: params.sort === sort && params.dir === "asc" ? "desc" : "asc",
    });
  const ariaSort = (sort: ListParams["sort"]): "ascending" | "descending" | "none" =>
    params.sort === sort ? (params.dir === "asc" ? "ascending" : "descending") : "none";
  const header = (
    label: string,
    sort: ListParams["sort"],
  ): React.ReactElement => (
    <Link href={sortHref(sort)} className="underline">
      {label}
      {params.sort === sort ? (params.dir === "asc" ? " ↑" : " ↓") : null}
    </Link>
  );

  if (rows.length === 0) {
    return hasFilters ? (
      <EmptyState
        title="No refunds match these filters"
        description={`No refund requests match ${activeFilters(params, currency)}.`}
        action={
          <Link
            href={href({ sort: params.sort, dir: params.dir, range: params.range })}
            className="text-body text-primary underline"
          >
            Clear all filters
          </Link>
        }
      />
    ) : (
      <EmptyState
        title="No open refunds"
        description="Nothing is waiting for a decision. Closed requests are available under the Closed filter."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-panel">
      <table className="w-full border-collapse text-table lg:table">
        <caption className="sr-only">Refund queue</caption>
        <thead className="sr-only lg:not-sr-only lg:table-header-group">
          <tr className="border-b border-line">
            <th
              scope="col"
              aria-sort={ariaSort("reference")}
              className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted"
            >
              {header("Reference", "reference")}
            </th>
            <th scope="col" className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted">
              Payment
            </th>
            <th scope="col" className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted">
              Customer
            </th>
            <th
              scope="col"
              aria-sort={ariaSort("amount")}
              className="h-9 px-3 text-right text-meta font-medium uppercase tracking-wide text-muted"
            >
              {header("Amount", "amount")}
            </th>
            <th
              scope="col"
              aria-sort={ariaSort("status")}
              className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted"
            >
              {header("Status", "status")}
            </th>
            <th scope="col" className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted">
              Requested by
            </th>
            <th
              scope="col"
              aria-sort={ariaSort("createdAt")}
              className="h-9 px-3 text-right text-meta font-medium uppercase tracking-wide text-muted"
            >
              {header("Requested", "createdAt")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = params.refund === row.id;
            return (
              <tr
                key={row.id}
                tabIndex={0}
                aria-selected={selected}
                data-selected={selected ? "true" : undefined}
                onClick={() => selectRow(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRow(row);
                  }
                }}
                className={`block min-h-12 cursor-pointer border-b border-line text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary lg:table-row lg:min-h-10 ${
                  selected ? "bg-selection font-medium" : ""
                }`}
              >
                <td data-label="Reference" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:before:hidden">
                  <Link
                    href={href({ ...params, refund: row.id, step: 2, decision: undefined })}
                    onClick={(event) => event.stopPropagation()}
                    className="underline"
                  >
                    {row.reference}
                  </Link>
                  {selected ? <span className="block text-meta text-primary">▸ Selected</span> : null}
                </td>
                <td data-label="Payment" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:before:hidden">
                  {row.paymentReference}
                </td>
                <td data-label="Customer" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:before:hidden">
                  {row.customerAlias}
                </td>
                <td data-label="Amount" className="block px-3 py-2 text-left align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:text-right lg:before:hidden">
                  {formatMoney(row.amountMinor, row.currency)}
                  {row.amountMinor > thresholdMinor && isOpenStatus(row.status) ? (
                    <span className="block text-meta text-muted">
                      {row.status === "pending_approval" ? "Needs escalation" : "Above threshold"}
                    </span>
                  ) : null}
                </td>
                <td data-label="Status" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:before:hidden">
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <OpenClosedBadge status={row.status} />
                    <StatusBadge label={STATUS_LABEL[row.status]} tone={statusTone(row.status)} />
                  </span>
                </td>
                <td data-label="Requested by" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:before:hidden">
                  {row.requesterName}
                </td>
                <td data-label="Requested" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] lg:table-cell lg:text-right lg:before:hidden">
                  {formatDateTime(row.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
