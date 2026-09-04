"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import * as React from "react";

import { cn } from "@/platform/ui/cn";
import { EmptyState } from "@/platform/ui/empty-state";

export interface DataTableProps<TData> {
  caption: string;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowId: (row: TData) => string;
  selectedRowId?: string;
  onSelect?: (row: TData) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  noResultsTitle?: string;
  noResultsDescription?: string;
}

export function DataTable<TData>({
  caption,
  columns,
  data,
  getRowId,
  selectedRowId,
  onSelect,
  searchLabel = "Search records",
  searchPlaceholder = "Search",
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records appear here once they are created.",
  noResultsTitle = "No matching records",
  noResultsDescription = "Clear the search to see every record.",
}: DataTableProps<TData>): React.ReactElement {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const searchId = React.useId();

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="text-meta font-medium text-muted">
          {searchLabel}
        </label>
        <input
          id={searchId}
          type="search"
          value={globalFilter}
          placeholder={searchPlaceholder}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="h-9 w-full rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={noResultsTitle}
          description={noResultsDescription}
        />
      ) : (
        <div className="overflow-hidden rounded-panel border border-line bg-panel">
          <table className="w-full border-collapse text-table">
            <caption className="sr-only">{caption}</caption>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-line">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className="h-9 px-3 text-left align-middle text-meta font-medium uppercase tracking-wide text-muted"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = row.id;
                const selected = selectedRowId === id;
                return (
                  <tr
                    key={id}
                    tabIndex={0}
                    aria-selected={selected}
                    data-selected={selected ? "true" : undefined}
                    onClick={() => onSelect?.(row.original)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect?.(row.original);
                      }
                    }}
                    className={cn(
                      "min-h-10 cursor-pointer border-b border-line text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                      selected && "bg-selection font-medium",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
