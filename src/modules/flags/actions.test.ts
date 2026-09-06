import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertNoSensitiveMetadata, type AuditMetadata } from "@/platform/audit/events";
import type { Actor } from "@/platform/auth/session";
import { db } from "@/platform/db/client";
import { approvals, auditEvents, changeRequests, featureFlags, users } from "@/platform/db/schema";

import {
  applyDirectChange,
  approveChangeRequest,
  cancelChangeRequest,
  createChangeRequest,
  rejectChangeRequest,
  requestKillSwitch,
  type FlagsActionResult,
} from "@/modules/flags/actions";
import type { RegionCode } from "@/modules/flags/targeting";

/**
 * Integration tests for the module interface. They need DATABASE_URL (CI provides
 * a service container) and only touch rows they created themselves.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.AUTH_SECRET);

const run = randomUUID().slice(0, 8);
const key = (name: string) => `t-${run}-${name}`;

function makeActor(role: Actor["role"]): Actor {
  return {
    id: randomUUID(),
    role,
    name: `Synthetic ${role}`,
    email: `${role}-${run}@demo.control-room.test`,
  };
}

const operator = makeActor("operator");
const approver = makeActor("approver");
const admin = makeActor("administrator");
const auditor = makeActor("auditor");
const actors = [operator, approver, admin, auditor];
const createdFlagIds: string[] = [];

async function insertFlag(name: string, environment: "development" | "staging" | "production") {
  const [flag] = await db
    .insert(featureFlags)
    .values({
      key: key(name),
      description: "Synthetic test flag.",
      environment,
      enabled: false,
      rolloutPercentage: 0,
      owner: "Test owner",
      targeting: [],
      updatedById: admin.id,
    })
    .returning();
  if (!flag) throw new Error("flag insert failed");
  createdFlagIds.push(flag.id);
  return flag;
}

async function flagById(id: string) {
  const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.id, id));
  if (!flag) throw new Error("flag missing");
  return flag;
}

async function requestById(id: string) {
  const [request] = await db.select().from(changeRequests).where(eq(changeRequests.id, id));
  if (!request) throw new Error("request missing");
  return request;
}

async function auditFor(entityId: string) {
  return db.select().from(auditEvents).where(eq(auditEvents.entityId, entityId));
}

function ok(result: FlagsActionResult) {
  if (!result.ok) throw new Error(`expected success, got ${result.code}: ${result.message}`);
  return result.data;
}

function fail(result: FlagsActionResult) {
  if (result.ok) throw new Error("expected failure");
  return result;
}

const rollout = (
  flag: { id: string; version: number },
  enabled: boolean,
  pct: number,
  regions: RegionCode[] = [],
) => ({
  flagId: flag.id,
  flagVersion: flag.version,
  enabled,
  rolloutPercentage: pct,
  reason: "Synthetic reason for the test run.",
  ticket: undefined,
  regions,
});

describe.skipIf(!hasDatabase)("flags actions (database)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.insert(users).values(
      actors.map((actor) => ({
        id: actor.id,
        email: actor.email,
        name: actor.name,
        role: actor.role,
      })),
    );
  });

  afterAll(async () => {
    const flagIds = createdFlagIds;
    const requestIds = flagIds.length
      ? (
          await db
            .select({ id: changeRequests.id })
            .from(changeRequests)
            .where(inArray(changeRequests.flagId, flagIds))
        ).map((row) => row.id)
      : [];
    const entityIds = [...flagIds, ...requestIds];
    if (entityIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.entityId, entityIds));
    }
    if (requestIds.length) {
      await db.delete(approvals).where(inArray(approvals.changeRequestId, requestIds));
      await db.delete(changeRequests).where(inArray(changeRequests.id, requestIds));
    }
    if (flagIds.length) {
      await db.delete(featureFlags).where(inArray(featureFlags.id, flagIds));
    }
    await db.delete(users).where(
      inArray(
        users.id,
        actors.map((actor) => actor.id),
      ),
    );
  });

  it("applies a development change directly for an administrator with one flag.updated event", async () => {
    const flag = await insertFlag("dev-direct", "development");
    const outcome = ok(await applyDirectChange(admin, rollout(flag, true, 40)));

    const updated = await flagById(flag.id);
    expect(updated).toMatchObject({ enabled: true, rolloutPercentage: 40, version: 2 });
    expect(outcome.version).toBe(2);

    const events = await auditFor(flag.id);
    expect(events.map((event) => event.action)).toEqual(["flag.updated"]);
    expect(events[0]?.entityVersion).toBe(2);
    expect(() => assertNoSensitiveMetadata(events[0]?.metadata as AuditMetadata)).not.toThrow();
  });

  it("restricts a direct change to selected regions and treats a region-only change as a change", async () => {
    const flag = await insertFlag("dev-regions", "development");
    ok(await applyDirectChange(admin, rollout(flag, true, 100, ["FI", "EE"])));
    let updated = await flagById(flag.id);
    expect(updated.targeting).toEqual([{ attribute: "country", operator: "in", values: ["EE", "FI"] }]);

    expect(fail(await applyDirectChange(admin, rollout(updated, true, 100, ["EE", "FI"]))).code).toBe(
      "business_rule",
    );

    ok(await applyDirectChange(admin, rollout(updated, true, 100, [])));
    updated = await flagById(flag.id);
    expect(updated.targeting).toEqual([]);
    expect(updated.version).toBe(3);
    expect((await auditFor(flag.id)).map((event) => event.action)).toEqual(["flag.updated", "flag.updated"]);
  });

  it("refuses direct production edits and non-administrator direct edits", async () => {
    const production = await insertFlag("prod-direct", "production");
    expect(fail(await applyDirectChange(admin, rollout(production, true, 10))).code).toBe("business_rule");

    const staging = await insertFlag("staging-direct", "staging");
    expect(fail(await applyDirectChange(operator, rollout(staging, true, 10))).code).toBe("forbidden");
    expect((await flagById(staging.id)).version).toBe(1);
  });

  it("never lets the auditor mutate anything", async () => {
    const flag = await insertFlag("auditor", "production");
    expect(fail(await createChangeRequest(auditor, rollout(flag, true, 10))).code).toBe("forbidden");
    expect(fail(await applyDirectChange(auditor, rollout(flag, true, 10))).code).toBe("forbidden");
    expect(
      fail(
        await requestKillSwitch(auditor, {
          flagId: flag.id,
          flagVersion: flag.version,
          confirmation: flag.key,
          reason: "Synthetic reason for the test run.",
        }),
      ).code,
    ).toBe("forbidden");
    expect(await auditFor(flag.id)).toHaveLength(0);
  });

  it("requires a second person to approve a production change and applies it in one transaction", async () => {
    const flag = await insertFlag("two-person", "production");
    // Raised by someone who could approve other requests: self-approval must still be blocked.
    const created = ok(await createChangeRequest(admin, rollout(flag, true, 25)));
    expect((await flagById(flag.id)).version).toBe(1);

    const self = fail(
      await approveChangeRequest(admin, { requestId: created.entityId, requestVersion: created.version }),
    );
    expect(self.code).toBe("forbidden");
    expect(self.message).toMatch(/different user/);

    const duplicate = fail(await createChangeRequest(operator, rollout(flag, true, 50)));
    expect(duplicate.code).toBe("business_rule");
    expect(duplicate.message).toMatch(/already has open change request/);

    const applied = ok(
      await approveChangeRequest(approver, {
        requestId: created.entityId,
        requestVersion: created.version,
        flagVersion: 1,
        note: "Synthetic decision note.",
      }),
    );
    expect(applied.notice).toBe("request_applied");

    const updated = await flagById(flag.id);
    expect(updated).toMatchObject({ enabled: true, rolloutPercentage: 25, version: 2 });
    const request = await requestById(created.entityId);
    expect(request.status).toBe("applied");
    expect(request.appliedById).toBe(approver.id);
    expect(request.appliedAt).not.toBeNull();

    const rows = await db.select().from(approvals).where(eq(approvals.changeRequestId, request.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ approvedById: approver.id, decision: "approved" });

    const requestEvents = (await auditFor(request.id)).map((event) => event.action).sort();
    expect(requestEvents).toEqual([
      "flag_change_request.applied",
      "flag_change_request.approved",
      "flag_change_request.created",
    ]);
    const flagEvents = await auditFor(flag.id);
    expect(flagEvents.map((event) => event.action)).toEqual(["flag.updated"]);
    expect(flagEvents[0]?.entityVersion).toBe(2);
    for (const event of [...flagEvents, ...(await auditFor(request.id))]) {
      expect(JSON.stringify(event.metadata)).not.toMatch(/Synthetic (reason|decision)/);
      expect(() => assertNoSensitiveMetadata(event.metadata as AuditMetadata)).not.toThrow();
    }

    // Terminal: nothing leaves applied.
    const again = fail(
      await approveChangeRequest(approver, { requestId: request.id, requestVersion: request.version }),
    );
    expect(again.code).toBe("business_rule");
    expect(fail(await rejectChangeRequest(approver, { requestId: request.id, requestVersion: request.version })).code).toBe(
      "business_rule",
    );
    expect(fail(await cancelChangeRequest(admin, { requestId: request.id, requestVersion: request.version })).code).toBe(
      "business_rule",
    );
  });

  it("surfaces a stale flag version on apply as version_conflict with no partial write", async () => {
    const flag = await insertFlag("stale", "production");
    const created = ok(await createChangeRequest(operator, rollout(flag, true, 10)));

    const stale = fail(
      await approveChangeRequest(approver, {
        requestId: created.entityId,
        requestVersion: created.version,
        flagVersion: flag.version + 1,
      }),
    );
    expect(stale.code).toBe("version_conflict");
    expect((await flagById(flag.id)).version).toBe(1);
    expect((await requestById(created.entityId)).status).toBe("pending_approval");
    expect(await db.select().from(approvals).where(eq(approvals.changeRequestId, created.entityId))).toHaveLength(0);
    expect((await auditFor(created.entityId)).map((event) => event.action)).toEqual(["flag_change_request.created"]);

    const staleRequest = fail(
      await approveChangeRequest(approver, { requestId: created.entityId, requestVersion: created.version + 1 }),
    );
    expect(staleRequest.code).toBe("version_conflict");
  });

  it("rejects a stale version on a direct change without writing", async () => {
    const flag = await insertFlag("stale-direct", "staging");
    const result = fail(await applyDirectChange(admin, { ...rollout(flag, true, 10), flagVersion: 5 }));
    expect(result.code).toBe("version_conflict");
    expect((await flagById(flag.id)).version).toBe(1);
    expect(await auditFor(flag.id)).toHaveLength(0);
  });

  it("lets only the requester cancel, and rejection leaves the flag untouched", async () => {
    const flag = await insertFlag("cancel", "production");
    const created = ok(await createChangeRequest(operator, rollout(flag, true, 10)));
    expect(fail(await cancelChangeRequest(approver, { requestId: created.entityId, requestVersion: created.version })).code).toBe(
      "forbidden",
    );
    ok(await cancelChangeRequest(operator, { requestId: created.entityId, requestVersion: created.version }));
    expect((await requestById(created.entityId)).status).toBe("cancelled");

    const second = ok(await createChangeRequest(operator, rollout(flag, true, 10)));
    ok(await rejectChangeRequest(approver, { requestId: second.entityId, requestVersion: second.version, note: "No." }));
    expect((await requestById(second.entityId)).status).toBe("rejected");
    expect((await flagById(flag.id)).version).toBe(1);
  });

  it("kill switch: rejects a mismatched confirmation, applies immediately outside production", async () => {
    const flag = await insertFlag("kill-dev", "development");
    await applyDirectChange(admin, rollout(flag, true, 50));
    const live = await flagById(flag.id);

    const mismatch = fail(
      await requestKillSwitch(admin, {
        flagId: live.id,
        flagVersion: live.version,
        confirmation: `${live.key}x`,
        reason: "Synthetic incident reason.",
      }),
    );
    expect(mismatch.code).toBe("business_rule");
    expect(mismatch.message).toMatch(/Type the flag key exactly/);
    expect((await flagById(flag.id)).version).toBe(live.version);

    expect(
      fail(
        await requestKillSwitch(operator, {
          flagId: live.id,
          flagVersion: live.version,
          confirmation: live.key,
          reason: "Synthetic incident reason.",
        }),
      ).code,
    ).toBe("forbidden");

    const killed = ok(
      await requestKillSwitch(admin, {
        flagId: live.id,
        flagVersion: live.version,
        confirmation: live.key,
        reason: "Synthetic incident reason.",
      }),
    );
    expect(killed.notice).toBe("flag_killed");
    const after = await flagById(flag.id);
    expect(after).toMatchObject({ enabled: false, rolloutPercentage: 0, version: live.version + 1 });
    expect(after.killedAt).not.toBeNull();

    const events = await auditFor(flag.id);
    expect(events.map((event) => event.action)).toContain("flag.kill_switch_applied");
    for (const event of events) {
      expect(JSON.stringify(event.metadata)).not.toMatch(/incident/i);
      expect(() => assertNoSensitiveMetadata(event.metadata as AuditMetadata)).not.toThrow();
    }
  });

  it("kill switch in production still needs a different approver", async () => {
    const flag = await insertFlag("kill-prod", "production");
    const requested = ok(
      await requestKillSwitch(admin, {
        flagId: flag.id,
        flagVersion: flag.version,
        confirmation: flag.key,
        reason: "Synthetic incident reason.",
      }),
    );
    expect(requested.notice).toBe("kill_requested");
    expect((await flagById(flag.id)).killedAt).toBeNull();
    const request = await requestById(requested.entityId);
    expect(request).toMatchObject({ kind: "kill_switch", status: "pending_approval" });
    expect((await auditFor(request.id)).map((event) => event.action)).toEqual(["flag.kill_switch_requested"]);

    // The administrator raised it, so even with approval rights they cannot decide it.
    expect(fail(await approveChangeRequest(admin, { requestId: request.id, requestVersion: request.version })).code).toBe(
      "forbidden",
    );

    ok(await approveChangeRequest(approver, { requestId: request.id, requestVersion: request.version }));
    const after = await flagById(flag.id);
    expect(after.killedAt).not.toBeNull();
    expect(after).toMatchObject({ enabled: false, rolloutPercentage: 0, version: 2 });
    expect((await auditFor(flag.id)).map((event) => event.action)).toEqual(["flag.kill_switch_applied"]);
  });
});
