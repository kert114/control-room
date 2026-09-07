import { AuditExplorer } from "@/app/(app)/audit/audit-explorer";
import { requirePermission } from "@/platform/auth/session";
import {
  AUDIT_LIST_LIMIT,
  countAuditEntries,
  loadAuditEntries,
} from "@/platform/reporting/overview";
import { TruncationNotice } from "@/platform/ui/truncation-notice";

export const dynamic = "force-dynamic";

export default async function AuditPage(): Promise<React.ReactElement> {
  await requirePermission("audit.read");
  const [entries, total] = await Promise.all([loadAuditEntries(), countAuditEntries()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">Audit trail</h1>
        <p className="text-body text-muted">
          Every business mutation and its audit event commit together.
        </p>
      </div>
      <TruncationNotice shown={AUDIT_LIST_LIMIT} total={total} noun="audit events" />
      <AuditExplorer
        entries={entries.map((entry) => ({
          ...entry,
          occurredAt: entry.occurredAt.toISOString(),
        }))}
      />
    </div>
  );
}
