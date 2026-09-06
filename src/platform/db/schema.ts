import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "operator",
  "approver",
  "administrator",
  "auditor",
]);

export const kycCaseStatusEnum = pgEnum("kyc_case_status", [
  "pending_review",
  "in_review",
  "escalated",
  "approved",
  "rejected",
  "information_requested",
]);

export const kycIdentityFieldEnum = pgEnum("kyc_identity_field", [
  "document_number",
  "date_of_birth",
  "address",
]);

export const kycDocumentStatusEnum = pgEnum("kyc_document_status", [
  "received",
  "verified",
  "rejected",
  "expired",
]);

export const kycSignalSeverityEnum = pgEnum("kyc_signal_severity", [
  "low",
  "medium",
  "high",
]);

export const kycRiskEnum = pgEnum("kyc_risk", ["low", "medium", "high"]);

export const kycDecisionEnum = pgEnum("kyc_decision", [
  "approve",
  "escalate",
  "reject",
]);

export const refundStatusEnum = pgEnum("refund_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "settled",
  "escalated",
]);

export const flagEnvironmentEnum = pgEnum("flag_environment", [
  "development",
  "staging",
  "production",
]);

export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "pending_approval",
  "approved",
  "rejected",
  "applied",
  "cancelled",
]);

export const changeRequestKindEnum = pgEnum("change_request_kind", [
  "rollout",
  "kill_switch",
]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "approved",
  "rejected",
]);

export const auditActionEnum = pgEnum("audit_action", [
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
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: roleEnum("role").notNull(),
    passwordHash: text("password_hash"),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

export const kycCases = pgTable(
  "kyc_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    customerAlias: text("customer_alias").notNull(),
    customerCountry: text("customer_country").notNull(),
    riskLevel: kycRiskEnum("risk_level").notNull(),
    riskScore: integer("risk_score").notNull(),
    status: kycCaseStatusEnum("status").notNull().default("pending_review"),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
    assignedToId: uuid("assigned_to_id").references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kyc_cases_reference_key").on(table.reference),
    index("kyc_cases_status_idx").on(table.status),
  ],
);

/**
 * Identity evidence for a case. `maskedValue` is safe to render in the queue;
 * `value` must only be read by the audited unmask action, never by list queries.
 */
export const kycCaseIdentity = pgTable(
  "kyc_case_identity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => kycCases.id),
    field: kycIdentityFieldEnum("field").notNull(),
    maskedValue: text("masked_value").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("kyc_case_identity_case_field_key").on(table.caseId, table.field),
  ],
);

export const kycCaseDocuments = pgTable(
  "kyc_case_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => kycCases.id),
    documentType: text("document_type").notNull(),
    status: kycDocumentStatusEnum("status").notNull().default("received"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [index("kyc_case_documents_case_idx").on(table.caseId)],
);

export const kycCaseSignals = pgTable(
  "kyc_case_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => kycCases.id),
    code: text("code").notNull(),
    severity: kycSignalSeverityEnum("severity").notNull(),
    detail: text("detail").notNull(),
    raisedAt: timestamp("raised_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("kyc_case_signals_case_idx").on(table.caseId)],
);

export const kycCaseNotes = pgTable(
  "kyc_case_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => kycCases.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("kyc_case_notes_case_idx").on(table.caseId)],
);

export const kycDecisions = pgTable(
  "kyc_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => kycCases.id),
    decidedById: uuid("decided_by_id")
      .notNull()
      .references(() => users.id),
    decision: kycDecisionEnum("decision").notNull(),
    rationale: text("rationale").notNull(),
    checklist: jsonb("checklist").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [index("kyc_decisions_case_idx").on(table.caseId)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    paymentReference: text("payment_reference").notNull(),
    customerAlias: text("customer_alias").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull(),
    status: refundStatusEnum("status").notNull().default("pending_approval"),
    requestedById: uuid("requested_by_id")
      .notNull()
      .references(() => users.id),
    approvedById: uuid("approved_by_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    escalatedById: uuid("escalated_by_id").references(() => users.id),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("refunds_reference_key").on(table.reference),
    index("refunds_status_idx").on(table.status),
  ],
);

/**
 * Configured approval threshold. Refunds above `thresholdMinor` must be
 * escalated before an eligible approver can approve them. One row per currency.
 */
export const refundApprovalPolicy = pgTable(
  "refund_approval_policy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    currency: text("currency").notNull(),
    thresholdMinor: integer("threshold_minor").notNull(),
    updatedById: uuid("updated_by_id").references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("refund_approval_policy_currency_key").on(table.currency),
  ],
);

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    description: text("description").notNull(),
    environment: flagEnvironmentEnum("environment").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    rolloutPercentage: integer("rollout_percentage").notNull().default(0),
    owner: text("owner").notNull().default("Platform engineering"),
    /** Targeting rules; shape is validated by the flags module. */
    targeting: jsonb("targeting").notNull().default([]),
    killedAt: timestamp("killed_at", { withTimezone: true }),
    updatedById: uuid("updated_by_id").references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("feature_flags_key_environment_key").on(
      table.key,
      table.environment,
    ),
  ],
);

export const changeRequests = pgTable(
  "change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    flagId: uuid("flag_id")
      .notNull()
      .references(() => featureFlags.id),
    requestedById: uuid("requested_by_id")
      .notNull()
      .references(() => users.id),
    previousEnabled: boolean("previous_enabled").notNull(),
    previousRollout: integer("previous_rollout").notNull(),
    proposedEnabled: boolean("proposed_enabled").notNull(),
    proposedRollout: integer("proposed_rollout").notNull(),
    reason: text("reason").notNull(),
    ticket: text("ticket"),
    kind: changeRequestKindEnum("kind").notNull().default("rollout"),
    status: changeRequestStatusEnum("status")
      .notNull()
      .default("pending_approval"),
    requiresApproval: boolean("requires_approval").notNull().default(true),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    appliedById: uuid("applied_by_id").references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("change_requests_reference_key").on(table.reference),
    index("change_requests_flag_idx").on(table.flagId),
  ],
);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    changeRequestId: uuid("change_request_id")
      .notNull()
      .references(() => changeRequests.id),
    approvedById: uuid("approved_by_id")
      .notNull()
      .references(() => users.id),
    decision: approvalDecisionEnum("decision").notNull(),
    note: text("note"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("approvals_request_approver_key").on(
      table.changeRequestId,
      table.approvedById,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: auditActionEnum("action").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    actorRole: roleEnum("actor_role").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    entityVersion: integer("entity_version").notNull(),
    summary: text("summary").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_occurred_idx").on(table.occurredAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type KycCaseRow = typeof kycCases.$inferSelect;
export type KycDecisionRow = typeof kycDecisions.$inferSelect;
export type KycCaseIdentityRow = typeof kycCaseIdentity.$inferSelect;
export type KycCaseDocumentRow = typeof kycCaseDocuments.$inferSelect;
export type KycCaseSignalRow = typeof kycCaseSignals.$inferSelect;
export type KycCaseNoteRow = typeof kycCaseNotes.$inferSelect;
export type RefundRow = typeof refunds.$inferSelect;
export type RefundApprovalPolicyRow = typeof refundApprovalPolicy.$inferSelect;
export type FeatureFlagRow = typeof featureFlags.$inferSelect;
export type ChangeRequestRow = typeof changeRequests.$inferSelect;
export type ApprovalRow = typeof approvals.$inferSelect;
export type AuditEventRow = typeof auditEvents.$inferSelect;
