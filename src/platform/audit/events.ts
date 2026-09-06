import { z } from "zod";

export const AUDIT_ACTIONS = [
  "user.signed_in",
  "kyc_case.assigned",
  "kyc_case.decided",
  "refund.requested",
  "refund.approved",
  "refund.rejected",
  "flag_change_request.created",
  "flag_change_request.approved",
  "flag_change_request.rejected",
  "flag.updated",
  "kyc_case.claimed",
  "kyc_case.reassigned",
  "kyc_case.information_requested",
  "kyc_case.identity_unmasked",
  "refund.escalated",
  "flag_change_request.applied",
  "flag_change_request.cancelled",
  "flag.kill_switch_requested",
  "flag.kill_switch_applied",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPES = [
  "user",
  "kyc_case",
  "refund",
  "feature_flag",
  "change_request",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Audit metadata is restricted to non-sensitive descriptors: identifiers,
 * enum-like states, numbers, and booleans. Free text that could carry customer
 * data, credentials, or payment details must never be written here.
 */
export const auditMetadataSchema = z.record(
  z.string(),
  z.union([z.string().max(64), z.number(), z.boolean(), z.null()]),
);

export type AuditMetadata = z.infer<typeof auditMetadataSchema>;

const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "secret",
  "token",
  "pan",
  "cardnumber",
  "iban",
  "ssn",
  "nationalid",
  "dateofbirth",
  "address",
  "email",
  "rationale",
  "reason",
  "note",
];

export function assertNoSensitiveMetadata(metadata: AuditMetadata): void {
  for (const key of Object.keys(metadata)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase().replace(/[_-]/g, ""))) {
      throw new Error(`Audit metadata must not contain "${key}".`);
    }
  }
}

export interface AuditEventInput {
  action: AuditAction;
  actorId: string;
  actorRole: "operator" | "approver" | "administrator" | "auditor";
  entityType: EntityType;
  entityId: string;
  entityVersion: number;
  summary: string;
  metadata?: AuditMetadata;
}
