"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";

import type { AuditEntry } from "@/platform/reporting/overview";
import { ActivityTimeline } from "@/platform/ui/activity-timeline";
import { DataTable } from "@/platform/ui/data-table";
import { EmptyState } from "@/platform/ui/empty-state";
import { Panel } from "@/platform/ui/panel";
import { StatusBadge } from "@/platform/ui/status-badge";

interface SerializedAuditEntry extends Omit<AuditEntry, "occurredAt"> {
  occurredAt: string;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function AuditExplorer({
  entries,
}: {
  entries: SerializedAuditEntry[];
}): React.ReactElement {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    entries[0]?.id,
  );

  const selected = entries.find((entry) => entry.id === selectedId);

  const columns = React.useMemo<ColumnDef<SerializedAuditEntry, unknown>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: "When (UTC)",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatter.format(new Date(row.original.occurredAt))}
          </span>
        ),
      },
      { accessorKey: "action", header: "Action" },
      {
        accessorKey: "actor",
        header: "Actor",
        cell: ({ row }) => (
          <span>
            {row.original.actor}
            <span className="block text-meta text-muted">
              {row.original.actorRole}
            </span>
          </span>
        ),
      },
      { accessorKey: "entityType", header: "Record type" },
      {
        accessorKey: "entityVersion",
        header: "Version",
        cell: ({ row }) => (
          <span className="block text-right">{row.original.entityVersion}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[65fr_35fr]">
      <Panel
        title="Audit events"
        description="Newest first. Search covers action, actor, and record type."
      >
        <DataTable
          caption="Audit events"
          columns={columns}
          data={entries}
          getRowId={(row) => row.id}
          selectedRowId={selectedId}
          onSelect={(row) => setSelectedId(row.id)}
          searchLabel="Search audit events"
          searchPlaceholder="Action, actor, or record type"
          emptyTitle="No audit events yet"
          emptyDescription="Events appear as soon as a business mutation commits."
        />
      </Panel>

      <Panel title="Selected event" description="Audit rows never copy sensitive values.">
        {selected ? (
          <div className="flex flex-col gap-3">
            <StatusBadge tone="info" label={selected.action} />
            <dl className="flex flex-col gap-2 text-body">
              <Field label="Summary" value={selected.summary} />
              <Field label="Actor" value={`${selected.actor} (${selected.actorRole})`} />
              <Field
                label="Record"
                value={`${selected.entityType} ${selected.entityId}`}
              />
              <Field label="Version" value={String(selected.entityVersion)} />
              <Field
                label="Occurred"
                value={`${formatter.format(new Date(selected.occurredAt))} UTC`}
              />
            </dl>
            <div>
              <h3 className="mb-1 text-section font-medium text-ink">Metadata</h3>
              {Object.keys(selected.metadata).length === 0 ? (
                <p className="text-body text-muted">No metadata recorded.</p>
              ) : (
                <dl className="flex flex-col gap-1 text-body">
                  {Object.entries(selected.metadata).map(([key, value]) => (
                    <Field key={key} label={key} value={String(value)} />
                  ))}
                </dl>
              )}
            </div>
            <div>
              <h3 className="mb-1 text-section font-medium text-ink">
                Record history
              </h3>
              <ActivityTimeline
                entries={entries
                  .filter((entry) => entry.entityId === selected.entityId)
                  .map((entry) => ({
                    id: entry.id,
                    summary: entry.summary,
                    actor: entry.actor,
                    action: entry.action,
                    occurredAt: new Date(entry.occurredAt),
                  }))}
              />
            </div>
          </div>
        ) : (
          <EmptyState
            title="No event selected"
            description="Choose a row to inspect the recorded event."
          />
        )}
      </Panel>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}
