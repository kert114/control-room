import { AuditExplorer } from "@/app/(app)/audit/audit-explorer";
import { requirePermission } from "@/platform/auth/session";
import { loadAuditEntries } from "@/platform/reporting/overview";

export const dynamic = "force-dynamic";

export default async function AuditPage(): Promise<React.ReactElement> {
  await requirePermission("audit.read");
  const entries = await loadAuditEntries();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">Audit trail</h1>
        <p className="text-body text-muted">
          Every business mutation and its audit event commit together.
        </p>
      </div>
      <AuditExplorer
        entries={entries.map((entry) => ({
          ...entry,
          occurredAt: entry.occurredAt.toISOString(),
        }))}
      />
    </div>
  );
}
