import "@/platform/config/dotenv";

import { hash } from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

import { DEMO_PASSWORD, DEMO_USERS } from "@/platform/auth/demo";
import { readEnv } from "@/platform/config/env";
import {
  approvals,
  auditEvents,
  changeRequests,
  featureFlags,
  kycCases,
  kycDecisions,
  refunds,
  users,
} from "@/platform/db/schema";

/**
 * All seeded records are synthetic. No production customer, payment, or
 * identity data may enter this file.
 */

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  const { DATABASE_URL, DEMO_MODE } = readEnv();
  if (!DEMO_MODE) {
    throw new Error(
      "Refusing to seed synthetic demo data while DEMO_MODE is not true.",
    );
  }

  const pool = new Pool({ connectionString: DATABASE_URL, max: 1 });
  const db = drizzle(pool);

  await db.execute(
    sql`truncate table ${auditEvents}, ${approvals}, ${changeRequests}, ${featureFlags}, ${refunds}, ${kycDecisions}, ${kycCases}, ${users} restart identity cascade`,
  );

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const insertedUsers = await db
    .insert(users)
    .values(
      DEMO_USERS.map((user) => ({
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      })),
    )
    .returning();

  const byRole = new Map(insertedUsers.map((user) => [user.role, user]));
  const operator = byRole.get("operator");
  const approver = byRole.get("approver");
  const administrator = byRole.get("administrator");
  const auditor = byRole.get("auditor");

  if (!operator || !approver || !administrator || !auditor) {
    throw new Error("Seed failed: demo users were not created.");
  }

  const caseSeeds = [
    {
      reference: "KYC-2401",
      customerAlias: "Northwind Traders (synthetic)",
      customerCountry: "EE",
      riskLevel: "high" as const,
      riskScore: 82,
      status: "pending_review" as const,
      slaDueAt: daysFromNow(-1),
    },
    {
      reference: "KYC-2402",
      customerAlias: "Contoso Retail (synthetic)",
      customerCountry: "DE",
      riskLevel: "medium" as const,
      riskScore: 54,
      status: "in_review" as const,
      slaDueAt: daysFromNow(2),
    },
    {
      reference: "KYC-2403",
      customerAlias: "Fabrikam Logistics (synthetic)",
      customerCountry: "FI",
      riskLevel: "low" as const,
      riskScore: 21,
      status: "approved" as const,
      slaDueAt: daysFromNow(-4),
    },
    {
      reference: "KYC-2404",
      customerAlias: "Tailspin Toys (synthetic)",
      customerCountry: "SE",
      riskLevel: "high" as const,
      riskScore: 91,
      status: "escalated" as const,
      slaDueAt: daysFromNow(1),
    },
    {
      reference: "KYC-2405",
      customerAlias: "Proseware Health (synthetic)",
      customerCountry: "NL",
      riskLevel: "medium" as const,
      riskScore: 47,
      status: "rejected" as const,
      slaDueAt: daysFromNow(-6),
    },
  ];

  const insertedCases = await db
    .insert(kycCases)
    .values(
      caseSeeds.map((seed) => ({
        ...seed,
        assignedToId: operator.id,
        createdById: administrator.id,
      })),
    )
    .returning();

  const approvedCase = insertedCases.find((row) => row.status === "approved");
  const rejectedCase = insertedCases.find((row) => row.status === "rejected");
  const escalatedCase = insertedCases.find((row) => row.status === "escalated");

  if (!approvedCase || !rejectedCase || !escalatedCase) {
    throw new Error("Seed failed: KYC cases were not created.");
  }

  await db.insert(kycDecisions).values([
    {
      caseId: approvedCase.id,
      decidedById: operator.id,
      decision: "approve",
      rationale: "Synthetic documents verified and sanctions screening clear.",
      checklist: {
        identityVerified: true,
        sanctionsScreened: true,
        sourceOfFundsReviewed: true,
      },
    },
    {
      caseId: rejectedCase.id,
      decidedById: approver.id,
      decision: "reject",
      rationale: "Synthetic case: ownership structure could not be evidenced.",
      checklist: {
        identityVerified: true,
        sanctionsScreened: true,
        sourceOfFundsReviewed: false,
      },
    },
    {
      caseId: escalatedCase.id,
      decidedById: operator.id,
      decision: "escalate",
      rationale: "Synthetic case: adverse media requires senior review.",
      checklist: {
        identityVerified: true,
        sanctionsScreened: false,
        sourceOfFundsReviewed: false,
      },
    },
  ]);

  const insertedRefunds = await db
    .insert(refunds)
    .values([
      {
        reference: "RFD-5001",
        paymentReference: "PAY-88213",
        customerAlias: "Northwind Traders (synthetic)",
        amountMinor: 12500,
        currency: "EUR",
        reason: "Duplicate charge reported by the customer.",
        status: "pending_approval" as const,
        requestedById: operator.id,
      },
      {
        reference: "RFD-5002",
        paymentReference: "PAY-88320",
        customerAlias: "Contoso Retail (synthetic)",
        amountMinor: 480000,
        currency: "EUR",
        reason: "Service outage credit agreed with the account team.",
        status: "pending_approval" as const,
        requestedById: administrator.id,
      },
      {
        reference: "RFD-5003",
        paymentReference: "PAY-88044",
        customerAlias: "Fabrikam Logistics (synthetic)",
        amountMinor: 29900,
        currency: "EUR",
        reason: "Goods returned within the refund window.",
        status: "approved" as const,
        requestedById: operator.id,
        approvedById: approver.id,
        decidedAt: daysFromNow(-2),
      },
      {
        reference: "RFD-5004",
        paymentReference: "PAY-87991",
        customerAlias: "Tailspin Toys (synthetic)",
        amountMinor: 7500,
        currency: "EUR",
        reason: "Chargeback withdrawn, refund no longer required.",
        status: "rejected" as const,
        requestedById: operator.id,
        approvedById: approver.id,
        decidedAt: daysFromNow(-3),
      },
    ])
    .returning();

  const insertedFlags = await db
    .insert(featureFlags)
    .values([
      {
        key: "instant-refunds",
        description: "Settle approved refunds without the nightly batch.",
        environment: "production" as const,
        enabled: true,
        rolloutPercentage: 25,
        updatedById: administrator.id,
      },
      {
        key: "instant-refunds",
        description: "Settle approved refunds without the nightly batch.",
        environment: "staging" as const,
        enabled: true,
        rolloutPercentage: 100,
        updatedById: administrator.id,
      },
      {
        key: "kyc-auto-triage",
        description: "Score low-risk cases automatically before human review.",
        environment: "production" as const,
        enabled: false,
        rolloutPercentage: 0,
        updatedById: administrator.id,
      },
      {
        key: "kyc-auto-triage",
        description: "Score low-risk cases automatically before human review.",
        environment: "development" as const,
        enabled: true,
        rolloutPercentage: 100,
        updatedById: administrator.id,
      },
    ])
    .returning();

  const productionRefundFlag = insertedFlags.find(
    (flag) => flag.key === "instant-refunds" && flag.environment === "production",
  );
  const productionTriageFlag = insertedFlags.find(
    (flag) => flag.key === "kyc-auto-triage" && flag.environment === "production",
  );

  if (!productionRefundFlag || !productionTriageFlag) {
    throw new Error("Seed failed: feature flags were not created.");
  }

  const insertedChangeRequests = await db
    .insert(changeRequests)
    .values([
      {
        reference: "CR-9001",
        flagId: productionRefundFlag.id,
        requestedById: operator.id,
        previousEnabled: true,
        previousRollout: 25,
        proposedEnabled: true,
        proposedRollout: 50,
        reason: "Error budget healthy for two weeks; widen the rollout.",
        ticket: "PLAT-412",
        status: "pending_approval" as const,
      },
      {
        reference: "CR-9002",
        flagId: productionTriageFlag.id,
        requestedById: administrator.id,
        previousEnabled: false,
        previousRollout: 0,
        proposedEnabled: true,
        proposedRollout: 10,
        reason: "Pilot auto-triage on the lowest risk band.",
        ticket: "PLAT-419",
        status: "approved" as const,
      },
    ])
    .returning();

  const approvedChangeRequest = insertedChangeRequests.find(
    (request) => request.status === "approved",
  );
  if (!approvedChangeRequest) {
    throw new Error("Seed failed: change requests were not created.");
  }

  await db.insert(approvals).values({
    changeRequestId: approvedChangeRequest.id,
    approvedById: approver.id,
    decision: "approved",
    note: "Second approver: rollout capped at ten percent.",
  });

  const settledRefund = insertedRefunds.find(
    (refund) => refund.status === "approved",
  );
  const rejectedRefund = insertedRefunds.find(
    (refund) => refund.status === "rejected",
  );
  if (!settledRefund || !rejectedRefund) {
    throw new Error("Seed failed: refunds were not created.");
  }

  await db.insert(auditEvents).values([
    {
      action: "kyc_case.decided" as const,
      actorId: operator.id,
      actorRole: operator.role,
      entityType: "kyc_case",
      entityId: approvedCase.id,
      entityVersion: approvedCase.version,
      summary: `Approved case ${approvedCase.reference}.`,
      metadata: { decision: "approve", riskLevel: approvedCase.riskLevel },
      occurredAt: daysFromNow(-5),
    },
    {
      action: "kyc_case.decided" as const,
      actorId: approver.id,
      actorRole: approver.role,
      entityType: "kyc_case",
      entityId: rejectedCase.id,
      entityVersion: rejectedCase.version,
      summary: `Rejected case ${rejectedCase.reference}.`,
      metadata: { decision: "reject", riskLevel: rejectedCase.riskLevel },
      occurredAt: daysFromNow(-4),
    },
    {
      action: "kyc_case.decided" as const,
      actorId: operator.id,
      actorRole: operator.role,
      entityType: "kyc_case",
      entityId: escalatedCase.id,
      entityVersion: escalatedCase.version,
      summary: `Escalated case ${escalatedCase.reference}.`,
      metadata: { decision: "escalate", riskLevel: escalatedCase.riskLevel },
      occurredAt: daysFromNow(-3),
    },
    {
      action: "refund.requested" as const,
      actorId: operator.id,
      actorRole: operator.role,
      entityType: "refund",
      entityId: settledRefund.id,
      entityVersion: settledRefund.version,
      summary: `Requested refund ${settledRefund.reference}.`,
      metadata: { amountMinor: settledRefund.amountMinor, currency: "EUR" },
      occurredAt: daysFromNow(-3),
    },
    {
      action: "refund.approved" as const,
      actorId: approver.id,
      actorRole: approver.role,
      entityType: "refund",
      entityId: settledRefund.id,
      entityVersion: settledRefund.version,
      summary: `Approved refund ${settledRefund.reference}.`,
      metadata: { amountMinor: settledRefund.amountMinor, currency: "EUR" },
      occurredAt: daysFromNow(-2),
    },
    {
      action: "refund.rejected" as const,
      actorId: approver.id,
      actorRole: approver.role,
      entityType: "refund",
      entityId: rejectedRefund.id,
      entityVersion: rejectedRefund.version,
      summary: `Rejected refund ${rejectedRefund.reference}.`,
      metadata: { amountMinor: rejectedRefund.amountMinor, currency: "EUR" },
      occurredAt: daysFromNow(-2),
    },
    {
      action: "flag_change_request.created" as const,
      actorId: administrator.id,
      actorRole: administrator.role,
      entityType: "change_request",
      entityId: approvedChangeRequest.id,
      entityVersion: approvedChangeRequest.version,
      summary: `Raised change request ${approvedChangeRequest.reference}.`,
      metadata: { proposedRollout: approvedChangeRequest.proposedRollout },
      occurredAt: daysFromNow(-2),
    },
    {
      action: "flag_change_request.approved" as const,
      actorId: approver.id,
      actorRole: approver.role,
      entityType: "change_request",
      entityId: approvedChangeRequest.id,
      entityVersion: approvedChangeRequest.version,
      summary: `Approved change request ${approvedChangeRequest.reference}.`,
      metadata: { proposedRollout: approvedChangeRequest.proposedRollout },
      occurredAt: daysFromNow(-1),
    },
    {
      action: "flag.updated" as const,
      actorId: administrator.id,
      actorRole: administrator.role,
      entityType: "feature_flag",
      entityId: productionTriageFlag.id,
      entityVersion: productionTriageFlag.version,
      summary: `Updated ${productionTriageFlag.key} in production.`,
      metadata: { rolloutPercentage: 10, enabled: true },
      occurredAt: daysFromNow(-1),
    },
  ]);

  await pool.end();
  console.log(
    `seeded ${insertedUsers.length} users, ${insertedCases.length} KYC cases, ${insertedRefunds.length} refunds, ${insertedFlags.length} flags`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
