import type { Transaction } from "@/platform/db/client";
import { auditEvents } from "@/platform/db/schema";
import {
  assertNoSensitiveMetadata,
  auditMetadataSchema,
  type AuditEventInput,
} from "@/platform/audit/events";

/**
 * Writes an audit row. It only accepts a transaction handle so a business
 * mutation and its audit event always commit together.
 */
export async function recordAuditEvent(
  tx: Transaction,
  input: AuditEventInput,
): Promise<void> {
  const metadata = auditMetadataSchema.parse(input.metadata ?? {});
  assertNoSensitiveMetadata(metadata);

  await tx.insert(auditEvents).values({
    action: input.action,
    actorId: input.actorId,
    actorRole: input.actorRole,
    entityType: input.entityType,
    entityId: input.entityId,
    entityVersion: input.entityVersion,
    summary: input.summary,
    metadata,
  });
}
