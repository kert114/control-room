import { and, eq, sql } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import type { db as Database } from "@/platform/db/client";
import type { auditEvents as AuditEvents, refunds as Refunds, users as Users } from "@/platform/db/schema";
import type * as RefundService from "@/modules/refunds/service";

const databaseUrl = process.env.REFUNDS_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("refund service integration", () => {
  let db: typeof Database;
  let refunds: typeof Refunds;
  let users: typeof Users;
  let auditEvents: typeof AuditEvents;
  let service: typeof RefundService;
  let operator: { id: string };
  let approver: { id: string; role: "approver" };
  const ids: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.AUTH_SECRET ??= "local-dev-secret-0123456789abcdef";
    process.env.DEMO_MODE ??= "true";
    ({ db } = await import("@/platform/db/client"));
    ({ refunds, users, auditEvents } = await import("@/platform/db/schema"));
    service = await import("@/modules/refunds/service");
    const [operatorRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, "operator@demo.control-room.test"));
    const [approverRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, "approver@demo.control-room.test"));
    if (!operatorRow || !approverRow) throw new Error("Seeded refund users are missing.");
    operator = operatorRow;
    approver = { ...approverRow, role: "approver" };
  });

  afterAll(async () => {
    if (ids.length) {
      await db.delete(auditEvents).where(and(eq(auditEvents.entityType, "refund"), sql`${auditEvents.entityId} in ${ids}`));
      await db.delete(refunds).where(sql`${refunds.id} in ${ids}`);
    }
  });

  async function createRefund(amountMinor: number): Promise<{ id: string; version: number }> {
    const [row] = await db.insert(refunds).values({
      reference: `RFD-T-${Math.random().toString(36).slice(2)}`,
      paymentReference: "PAY-TEST",
      customerAlias: "Synthetic test customer",
      amountMinor,
      currency: "EUR",
      reason: "Synthetic test reason",
      requestedById: operator.id,
    }).returning({ id: refunds.id, version: refunds.version });
    if (!row) throw new Error("Test refund was not inserted.");
    ids.push(row.id);
    return row;
  }

  it("approves atomically with one post-update audit event", async () => {
    const row = await createRefund(12500);
    const result = await service.approveRefund({ id: approver.id, name: "Ada", email: "approver@test", role: "approver" }, row);
    expect(result).toMatchObject({ ok: true, data: { version: 2, status: "approved" } });
    const events = await db.select({ version: auditEvents.entityVersion, metadata: auditEvents.metadata }).from(auditEvents).where(and(eq(auditEvents.entityId, row.id), eq(auditEvents.action, "refund.approved")));
    expect(events).toHaveLength(1);
    expect(events[0]?.version).toBe(2);
    expect(events[0]?.metadata).toMatchObject({ amountMinor: 12500, thresholdMinor: 50000 });
  });

  it("rejects stale writes without a second audit event", async () => {
    const row = await createRefund(12500);
    const actor = { id: approver.id, name: "Ada", email: "approver@test", role: "approver" as const };
    await service.rejectRefund(actor, { ...row, decisionNote: "Synthetic duplicate." });
    const stale = await service.approveRefund(actor, row);
    expect(stale).toMatchObject({ ok: false, code: "version_conflict" });
    const events = await db.select({ id: auditEvents.id }).from(auditEvents).where(eq(auditEvents.entityId, row.id));
    expect(events).toHaveLength(1);
  });

  it("rejects self approval and threshold approval", async () => {
    const self = await createRefund(12500);
    const selfResult = await service.approveRefund({ id: operator.id, name: "Ola", email: "operator@test", role: "operator" }, self);
    expect(selfResult).toMatchObject({ ok: false, code: "forbidden" });
    const high = await createRefund(61000);
    const highResult = await service.approveRefund({ id: approver.id, name: "Ada", email: "approver@test", role: "approver" }, high);
    expect(highResult).toMatchObject({ ok: false, code: "business_rule" });
  });

  it("reads the policy inside the business transaction", async () => {
    const row = await createRefund(61000);
    await db.execute(sql`update refund_approval_policy set threshold_minor = 100000 where currency = 'EUR'`);
    try {
      const result = await service.approveRefund({ id: approver.id, name: "Ada", email: "approver@test", role: "approver" }, row);
      expect(result).toMatchObject({ ok: true });
    } finally {
      await db.execute(sql`update refund_approval_policy set threshold_minor = 50000 where currency = 'EUR'`);
    }
  });
});
