"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import type { QueueRow } from "@/modules/kyc/queries";
import type { QueueParams, QueueSortKey } from "@/modules/kyc/schemas";
import { STATUS_LABELS } from "@/modules/kyc/transitions";
import {
  RISK_LABELS,
  RISK_TONE,
  STATUS_TONE,
  countryName,
  describeNextStep,
  describeSla,
  formatDate,
  queueHref,
} from "@/modules/kyc/ui/presentation";
import type { Actor } from "@/platform/auth/session";
import { cn } from "@/platform/ui/cn";
import { StatusBadge } from "@/platform/ui/status-badge";

interface Column {
  key: QueueSortKey | "customer" | "assignee";
  label: string;
  sortable: boolean;
  align?: "right";
  narrow?: boolean;
  /** Only shown on wide desktops; sortable via URL regardless. */
  wide?: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: "reference", label: "Case", sortable: true, narrow: true },
  { key: "customer", label: "Customer", sortable: false },
  { key: "risk", label: "Risk", sortable: true, narrow: true },
  { key: "status", label: "Status", sortable: true, narrow: true },
  { key: "assignee", label: "Waiting on", sortable: false },
  { key: "opened", label: "Opened", sortable: true, align: "right", wide: true },
  { key: "sla", label: "SLA", sortable: true, align: "right", narrow: true },
];

export interface QueueTableProps {
  rows: readonly QueueRow[];
  params: QueueParams;
  actor: Actor;
  now: Date;
}

export function QueueTable({
  rows,
  params,
  actor,
  now,
}: QueueTableProps): React.ReactElement {
  const router = useRouter();
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => setHydrated(true), []);
  const [loading, startTransition] = React.useTransition();
  const [loadingReference, setLoadingReference] = React.useState<string | null>(
    null,
  );

  const select = (row: QueueRow): void => {
    setLoadingReference(row.reference);
    startTransition(() => {
      router.push(queueHref(params, { case: row.id, step: undefined }), {
        scroll: false,
      });
    });
  };

  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-panel">
      <div role="status" aria-live="polite" className="sr-only">
        {loading && loadingReference ? `Opening ${loadingReference}…` : ""}
      </div>
      <table
        className="w-full border-collapse text-table"
        data-testid="kyc-queue"
        data-hydrated={hydrated ? "true" : "false"}
        aria-busy={loading}
      >
        <caption className="sr-only">
          KYC cases matching the current filters. Use Enter or Space on a row to
          open it.
        </caption>
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((column) => {
              const active = column.sortable && params.sort === column.key;
              const nextDir = active && params.dir === "asc" ? "desc" : "asc";
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    active
                      ? params.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "h-9 px-2 md:px-3 text-left align-middle text-meta font-medium uppercase tracking-wide text-muted",
                    column.align === "right" && "text-right",
                    !column.narrow && (column.wide ? "hidden 2xl:table-cell" : "hidden md:table-cell"),
                  )}
                >
                  {column.sortable ? (
                    <Link prefetch={false}
                      href={queueHref(params, { sort: column.key, dir: nextDir })}
                      scroll={false}
                      className="inline-flex min-h-8 items-center gap-1 rounded-control hover:text-ink"
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {active ? (params.dir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                      <span className="sr-only">
                        {active ? `, sorted ${params.dir}ending` : ", sortable"}
                      </span>
                    </Link>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = params.case === row.id;
            const opening = loading && loadingReference === row.reference;
            const sla = describeSla(row.slaDueAt, row.status, now);
            const next = describeNextStep(row, actor);
            return (
              <tr
                key={row.id}
                tabIndex={0}
                aria-selected={selected}
                data-selected={selected ? "true" : undefined}
                data-testid={`kyc-row-${row.reference}`}
                onClick={() => select(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(row);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-line text-ink last:border-b-0 hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
                  selected && "bg-selection font-medium",
                )}
              >
                <td className="min-h-12 px-2 md:px-3 py-2 align-middle md:min-h-10">
                  <span className="flex flex-col">
                    <span className="md:whitespace-nowrap">
                      <Link prefetch={false}
                        href={queueHref(params, { case: row.id, step: undefined })}
                        scroll={false}
                        tabIndex={-1}
                        className="text-inherit no-underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {row.reference}
                      </Link>
                      {selected ? (
                        <span className="block text-meta text-primary md:ml-1 md:inline">
                          <span className="hidden md:inline">· </span>Selected
                        </span>
                      ) : opening ? (
                        <span className="block text-meta text-muted md:ml-1 md:inline">
                          <span className="hidden md:inline">· </span>Opening…
                        </span>
                      ) : null}
                    </span>
                    <span className="text-meta font-normal text-muted md:hidden">
                      {row.customerAlias} · {countryName(row.customerCountry)}
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 py-2 align-middle md:table-cell">
                  {row.customerAlias}
                  <span className="block text-meta font-normal text-muted">
                    {countryName(row.customerCountry)}
                  </span>
                </td>
                <td className="px-2 md:px-3 py-2 align-middle">
                  <StatusBadge
                    tone={RISK_TONE[row.riskLevel]}
                    label={`${RISK_LABELS[row.riskLevel]} ${row.riskScore}`}
                    className="md:whitespace-nowrap"
                  />
                </td>
                <td className="px-2 md:px-3 py-2 align-middle">
                  <span className="flex flex-col items-start gap-1">
                    <StatusBadge
                      tone={STATUS_TONE[row.status]}
                      label={STATUS_LABELS[row.status]}
                      className="md:whitespace-nowrap"
                    />
                    {next.mine ? (
                      <StatusBadge
                        tone="info"
                        label="Your action"
                        className="md:hidden"
                      />
                    ) : null}
                  </span>
                </td>
                <td className="hidden px-3 py-2 align-middle md:table-cell">
                  <span className="flex flex-col whitespace-nowrap">
                    <span className={cn(next.mine && "font-medium text-primary")}>
                      {next.mine ? "Your action" : next.owner}
                    </span>
                    <span className="text-meta font-normal text-muted">{next.action}</span>
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-right align-middle 2xl:table-cell">
                  {formatDate(row.openedAt)}
                </td>
                <td className="px-2 md:px-3 py-2 text-right align-middle">
                  <StatusBadge
                    tone={sla.tone}
                    label={sla.label}
                    className="md:whitespace-nowrap"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
