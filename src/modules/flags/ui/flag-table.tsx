"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { cn } from "@/platform/ui/cn";
import { EmptyState } from "@/platform/ui/empty-state";
import { StatusBadge } from "@/platform/ui/status-badge";

import { ENVIRONMENT_LABEL, type FlagEnvironment } from "@/modules/flags/rules";
import { buildFlagsHref, type FlagsQuery, type SortKey } from "@/modules/flags/url-state";
import { describeState, ENVIRONMENT_TONE, KIND_LABEL, stateTone } from "@/modules/flags/ui/format";

export interface FlagRow {
  id: string;
  key: string;
  description: string;
  environment: FlagEnvironment;
  enabled: boolean;
  rolloutPercentage: number;
  owner: string;
  killed: boolean;
  openRequest: { id: string; reference: string; kind: "rollout" | "kill_switch" } | null;
}

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; className?: string }> = [
  { key: "key", label: "Flag" },
  { key: "environment", label: "Environment" },
  { key: "rollout", label: "State" },
  { key: "owner", label: "Owner", className: "hidden md:table-cell" },
];

export function FlagTable({
  rows,
  query,
  totalCount,
}: {
  rows: readonly FlagRow[];
  query: FlagsQuery;
  totalCount: number;
}): React.ReactElement {
  const router = useRouter();
  const [interactive, setInteractive] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  React.useEffect(() => setInteractive(true), []);

  const select = React.useCallback(
    (row: FlagRow) => {
      startTransition(() => {
        router.push(
          buildFlagsHref(query, { flag: row.id, request: undefined, action: undefined }),
          { scroll: false },
        );
      });
    },
    [query, router],
  );

  if (totalCount === 0) {
    return (
      <EmptyState
        title="No feature flags yet"
        description="Flags appear here once they are created in the platform database."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No flags match these filters"
        description="Try a different search term, environment, or owner."
      />
    );
  }

  return (
    <div
      className="overflow-hidden rounded-panel border border-line bg-panel"
      data-testid="flag-table"
      data-interactive={interactive ? "true" : "false"}
      aria-busy={pending}
    >
      <p role="status" className={cn("px-3 py-1 text-meta text-muted", !pending && "sr-only")}>
        {pending ? "Loading flag detail…" : ""}
      </p>
      <table className="w-full table-fixed border-collapse text-table">
        <caption className="sr-only">
          Feature flags, {rows.length} shown. Select a row with Enter or Space to open its detail.
        </caption>
        <colgroup>
          <col className="w-[40%] md:w-[34%]" />
          <col className="w-[30%] md:w-[18%]" />
          <col className="w-[30%] md:w-[22%]" />
          <col className="hidden md:table-column md:w-[26%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((column) => {
              const activeSort = query.sort === column.key;
              const nextDir = activeSort && query.dir === "asc" ? "desc" : "asc";
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={activeSort ? (query.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn(
                    "h-9 px-3 text-left align-middle text-meta font-medium uppercase tracking-wide text-muted",
                    column.className,
                  )}
                >
                  <Link
                    prefetch={false}
                    href={buildFlagsHref(query, { sort: column.key, dir: nextDir })}
                    scroll={false}
                    className="inline-flex items-center gap-1 rounded-control hover:text-ink"
                  >
                    {column.label}
                    <span aria-hidden="true">{activeSort ? (query.dir === "asc" ? "↑" : "↓") : ""}</span>
                    <span className="sr-only">
                      {activeSort ? `, sorted ${query.dir === "asc" ? "ascending" : "descending"}` : ", sort"}
                    </span>
                  </Link>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = query.flag === row.id;
            const href = buildFlagsHref(query, { flag: row.id, request: undefined, action: undefined });
            const state = { enabled: row.enabled, rolloutPercentage: row.rolloutPercentage, killedAt: row.killed ? new Date(0) : null };
            return (
              <tr
                key={row.id}
                tabIndex={0}
                role="row"
                aria-selected={selected}
                aria-label={`${row.key} in ${ENVIRONMENT_LABEL[row.environment].toLowerCase()}${selected ? ", selected" : ""}`}
                data-selected={selected ? "true" : undefined}
                data-testid="flag-row"
                onClick={(event) => {
                  if (event.target instanceof HTMLElement && event.target.closest("a")) return;
                  select(row);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(row);
                  }
                }}
                className={cn(
                  "cursor-pointer border-b border-line text-ink last:border-b-0 hover:bg-primary-soft focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary",
                  selected && "bg-selection",
                )}
              >
                <td className="px-3 py-2 align-top">
                  <Link
                    prefetch={false}
                    href={href}
                    scroll={false}
                    tabIndex={-1}
                    onClick={(event) => {
                      event.preventDefault();
                      select(row);
                    }}
                    className={cn("block break-words", selected && "font-medium")}
                  >
                    {selected ? <span aria-hidden="true">▸ </span> : null}
                    {row.key}
                  </Link>
                  <span className="hidden text-meta text-muted md:block">{row.description}</span>
                  {row.openRequest ? (
                    <span className="mt-1 block text-meta text-warning">
                      Awaiting approval · {KIND_LABEL[row.openRequest.kind]} {row.openRequest.reference}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 align-top">
                  <StatusBadge tone={ENVIRONMENT_TONE[row.environment]} label={ENVIRONMENT_LABEL[row.environment]} />
                </td>
                <td className="px-3 py-2 align-top">
                  <StatusBadge tone={stateTone(state)} label={describeState(state)} />
                </td>
                <td className="hidden px-3 py-2 align-top text-muted md:table-cell">{row.owner}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
