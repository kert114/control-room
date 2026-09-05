CREATE TYPE "public"."change_request_kind" AS ENUM('rollout', 'kill_switch');--> statement-breakpoint
CREATE TYPE "public"."kyc_document_status" AS ENUM('received', 'verified', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."kyc_identity_field" AS ENUM('document_number', 'date_of_birth', 'address');--> statement-breakpoint
CREATE TYPE "public"."kyc_signal_severity" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'kyc_case.claimed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'kyc_case.reassigned';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'kyc_case.information_requested';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'kyc_case.identity_unmasked';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'refund.escalated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'flag_change_request.applied';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'flag_change_request.cancelled';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'flag.kill_switch_requested';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'flag.kill_switch_applied';--> statement-breakpoint
ALTER TYPE "public"."change_request_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."kyc_case_status" ADD VALUE 'information_requested';--> statement-breakpoint
ALTER TYPE "public"."refund_status" ADD VALUE 'escalated';--> statement-breakpoint
CREATE TABLE "kyc_case_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"status" "kyc_document_status" DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_case_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"field" "kyc_identity_field" NOT NULL,
	"masked_value" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_case_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_case_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"code" text NOT NULL,
	"severity" "kyc_signal_severity" NOT NULL,
	"detail" text NOT NULL,
	"raised_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_approval_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" text NOT NULL,
	"threshold_minor" integer NOT NULL,
	"updated_by_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_requests" ADD COLUMN "kind" "change_request_kind" DEFAULT 'rollout' NOT NULL;--> statement-breakpoint
ALTER TABLE "change_requests" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "change_requests" ADD COLUMN "applied_by_id" uuid;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN "owner" text DEFAULT 'Platform engineering' NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN "targeting" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN "killed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_cases" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "escalated_by_id" uuid;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "escalated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "decision_note" text;--> statement-breakpoint
ALTER TABLE "kyc_case_documents" ADD CONSTRAINT "kyc_case_documents_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_case_identity" ADD CONSTRAINT "kyc_case_identity_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_case_notes" ADD CONSTRAINT "kyc_case_notes_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_case_notes" ADD CONSTRAINT "kyc_case_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_case_signals" ADD CONSTRAINT "kyc_case_signals_case_id_kyc_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_approval_policy" ADD CONSTRAINT "refund_approval_policy_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_case_documents_case_idx" ON "kyc_case_documents" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_case_identity_case_field_key" ON "kyc_case_identity" USING btree ("case_id","field");--> statement-breakpoint
CREATE INDEX "kyc_case_notes_case_idx" ON "kyc_case_notes" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "kyc_case_signals_case_idx" ON "kyc_case_signals" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_approval_policy_currency_key" ON "refund_approval_policy" USING btree ("currency");--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_applied_by_id_users_id_fk" FOREIGN KEY ("applied_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_escalated_by_id_users_id_fk" FOREIGN KEY ("escalated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;