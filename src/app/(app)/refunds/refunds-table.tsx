"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { buildRefundsHref, type ListParams } from "@/modules/refunds/params";
import { formatDateTime, formatMoney, STATUS_LABEL, statusTone } from "@/modules/refunds/format";
import type { RefundListItem } from "@/modules/refunds/queries";
import { EmptyState } from "@/platform/ui/empty-state";
import { StatusBadge } from "@/platform/ui/status-badge";

function activeFilters(params: ListParams): string {
  return [
    params.q ? `search “${params.q}”` : "",
    params.status !== "open" ? STATUS_LABEL[params.status as keyof typeof STATUS_LABEL] ?? params.status : "",
    params.min !== undefined ? `minimum ${formatMoney(params.min, "EUR")}` : "",
    params.max !== undefined ? `maximum ${formatMoney(params.max, "EUR")}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function RefundsTable({
  rows,
  params,
}: {
  rows: RefundListItem[];
  params: ListParams;
}): React.ReactElement {
  const router = useRouter();
  const hasFilters = Boolean(activeFilters(params));
  const selectRow = (row: RefundListItem): void => {
    router.push(
      buildRefundsHref({
        ...params,
        refund: row.id,
        step: 2,
        decision: undefined,
      }),
    );
  };
  const sortHref = (sort: ListParams["sort"]): string =>
    buildRefundsHref({
      ...params,
      sort,
      dir: params.sort === sort && params.dir === "asc" ? "desc" : "asc",
    });
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
        description={`No refund requests match ${activeFilters(params)}.`}
        action={
          <Link href={buildRefundsHref({})} className="text-body text-primary underline">
            Clear filters
          </Link>
        }
      />
    ) : (
      <EmptyState
        title="No refunds yet"
        description="Refund requests appear here when payment operations raises them."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-panel">
      <table className="w-full border-collapse text-table md:table">
        <caption className="sr-only">Refund queue</caption>
        <thead className="sr-only md:not-sr-only md:table-header-group">
          <tr className="border-b border-line">
            <th scope="col" className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted">
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
              aria-sort={params.sort === "amount" ? (params.dir === "asc" ? "ascending" : "descending") : "none"}
              className="h-9 px-3 text-right text-meta font-medium uppercase tracking-wide text-muted"
            >
              {header("Amount", "amount")}
            </th>
            <th scope="col" className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted">
              {header("Status", "status")}
            </th>
            <th scope="col" className="h-9 px-3 text-left text-meta font-medium uppercase tracking-wide text-muted">
              Requested by
            </th>
            <th scope="col" className="h-9 px-3 text-right text-meta font-medium uppercase tracking-wide text-muted">
              Requested
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
                className={`block min-h-12 cursor-pointer border-b border-line text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:table-row md:min-h-10 ${
                  selected ? "bg-selection font-medium" : ""
                }`}
              >
                <td data-label="Reference" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:before:hidden">
                  <Link
                    href={buildRefundsHref({ ...params, refund: row.id, step: 2, decision: undefined })}
                    onClick={(event) => event.stopPropagation()}
                    className="underline"
                  >
                    {row.reference}
                  </Link>
                  {selected ? <span className="block text-meta text-primary">▸ Selected</span> : null}
                </td>
                <td data-label="Payment" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:before:hidden">
                  {row.paymentReference}
                </td>
                <td data-label="Customer" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:before:hidden">
                  {row.customerAlias}
                </td>
                <td data-label="Amount" className="block px-3 py-2 text-left align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:text-right md:before:hidden">
                  {formatMoney(row.amountMinor, row.currency)}
                </td>
                <td data-label="Status" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:before:hidden">
                  <StatusBadge label={STATUS_LABEL[row.status]} tone={statusTone(row.status)} />
                </td>
                <td data-label="Requested by" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:before:hidden">
                  {row.requesterName}
                </td>
                <td data-label="Requested" className="block px-3 py-2 align-middle before:mr-2 before:block before:text-meta before:font-medium before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:text-right md:before:hidden">
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
