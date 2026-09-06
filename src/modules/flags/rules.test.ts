import { describe, expect, it } from "vitest";

import type { Actor } from "@/platform/auth/session";
import { AuthorizationError, SeparationOfDutiesError } from "@/platform/authz/errors";
import { assertNoSensitiveMetadata } from "@/platform/audit/events";
import { BusinessRuleError } from "@/platform/mutations/errors";

import {
  assertCanApplyDirectly,
  assertCanCancel,
  assertCanDecide,
  assertCanKill,
  assertCanRequestRollout,
  assertKillSwitchConfirmation,
  changeRequestMetadata,
  flagMetadata,
  requiresChangeRequest,
} from "@/modules/flags/rules";
import { collectServiceHealth, worstStatus, type ServiceHealthProvider } from "@/modules/flags/health/provider";
import { SERVICE_HEALTH_PROVIDERS } from "@/modules/flags/health/registry";
import { directChangeSchema, killSwitchSchema, rolloutChangeSchema } from "@/modules/flags/schemas";
import { parseTargeting, regionsFromTargeting, sameRegions, withRegions } from "@/modules/flags/targeting";
import { assertTransition, canTransition, isOpen } from "@/modules/flags/transitions";
import { buildFlagsHref, parseFlagsQuery } from "@/modules/flags/url-state";

const actor = (role: Actor["role"], id = `${role}-1`): Actor => ({
  id,
  role,
  name: "Synthetic User",
  email: `${role}@demo.control-room.test`,
});

describe("environment rules", () => {
  it("only production needs a change request", () => {
    expect(requiresChangeRequest("development")).toBe(false);
    expect(requiresChangeRequest("staging")).toBe(false);
    expect(requiresChangeRequest("production")).toBe(true);
  });

  it("lets administrators edit development and staging directly, never production", () => {
    const admin = actor("administrator");
    expect(() => assertCanApplyDirectly(admin, { key: "f", environment: "development" })).not.toThrow();
    expect(() => assertCanApplyDirectly(admin, { key: "f", environment: "staging" })).not.toThrow();
    expect(() => assertCanApplyDirectly(admin, { key: "f", environment: "production" })).toThrow(
      BusinessRuleError,
    );
  });

  it("denies direct edits and kill switches to every non-administrator role", () => {
    for (const role of ["operator", "approver", "auditor"] as const) {
      expect(() => assertCanApplyDirectly(actor(role), { key: "f", environment: "development" })).toThrow(
        AuthorizationError,
      );
      expect(() => assertCanKill(actor(role))).toThrow(AuthorizationError);
    }
  });

  it("keeps the auditor away from every mutation", () => {
    const auditor = actor("auditor");
    expect(() => assertCanRequestRollout(auditor, { key: "f", environment: "production" })).toThrow(
      AuthorizationError,
    );
    expect(() =>
      assertCanDecide(auditor, { reference: "CR-1", status: "pending_approval", requestedById: "x" }, "applied"),
    ).toThrow(AuthorizationError);
    expect(() =>
      assertCanCancel(auditor, { reference: "CR-1", status: "pending_approval", requestedById: "auditor-1" }),
    ).toThrow(AuthorizationError);
  });
});

describe("kill switch confirmation", () => {
  it("requires the exact flag key", () => {
    expect(() => assertKillSwitchConfirmation({ key: "instant-refunds" }, "instant-refund")).toThrow(
      BusinessRuleError,
    );
    expect(() => assertKillSwitchConfirmation({ key: "instant-refunds" }, "Instant-Refunds")).toThrow(
      BusinessRuleError,
    );
    expect(() => assertKillSwitchConfirmation({ key: "instant-refunds" }, "instant-refunds")).not.toThrow();
  });

  it("rejects an empty reason at the schema boundary", () => {
    const result = killSwitchSchema.safeParse({
      flagId: "0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10",
      flagVersion: "1",
      confirmation: "instant-refunds",
      reason: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("separation of duties", () => {
  const request = { reference: "CR-9001", status: "pending_approval" as const, requestedById: "operator-1" };

  it("blocks the requester from deciding their own request", () => {
    expect(() => assertCanDecide(actor("approver", "operator-1"), request, "applied")).toThrow(
      SeparationOfDutiesError,
    );
  });

  it("lets a different approver decide", () => {
    expect(() => assertCanDecide(actor("approver"), request, "applied")).not.toThrow();
    expect(() => assertCanDecide(actor("administrator"), request, "rejected")).not.toThrow();
  });

  it("only the requester may cancel", () => {
    expect(() => assertCanCancel(actor("operator", "operator-1"), request)).not.toThrow();
    expect(() => assertCanCancel(actor("operator", "operator-2"), request)).toThrow(AuthorizationError);
  });
});

describe("change request transitions", () => {
  it("allows only the documented moves out of pending approval", () => {
    expect(canTransition("pending_approval", "applied")).toBe(true);
    expect(canTransition("pending_approval", "rejected")).toBe(true);
    expect(canTransition("pending_approval", "cancelled")).toBe(true);
    expect(canTransition("pending_approval", "approved")).toBe(false);
  });

  it("never leaves a terminal state", () => {
    for (const from of ["approved", "applied", "rejected", "cancelled"] as const) {
      expect(isOpen(from)).toBe(false);
      for (const to of ["pending_approval", "approved", "applied", "rejected", "cancelled"] as const) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
    expect(() => assertTransition("CR-9002", "applied", "rejected")).toThrow(BusinessRuleError);
    expect(() => assertTransition("CR-9002", "cancelled", "applied")).toThrow(BusinessRuleError);
  });
});

describe("audit metadata", () => {
  const flag = {
    key: "instant-refunds",
    environment: "production" as const,
    enabled: true,
    rolloutPercentage: 25,
  };

  it("passes the platform sensitivity check for flag updates", () => {
    const metadata = flagMetadata(flag, { enabled: false, rolloutPercentage: 0 });
    expect(() => assertNoSensitiveMetadata(metadata)).not.toThrow();
    expect(metadata).toEqual({
      flagKey: "instant-refunds",
      environment: "production",
      previousEnabled: false,
      previousRollout: 0,
      enabled: true,
      rolloutPercentage: 25,
    });
  });

  it("never copies the reason or note into change request metadata", () => {
    const metadata = changeRequestMetadata(
      {
        reference: "CR-9001",
        kind: "kill_switch",
        status: "pending_approval",
        ticket: "PLAT-1",
        previousEnabled: true,
        previousRollout: 25,
        proposedEnabled: false,
        proposedRollout: 0,
      },
      flag,
    );
    expect(() => assertNoSensitiveMetadata(metadata)).not.toThrow();
    expect(Object.keys(metadata)).not.toEqual(
      expect.arrayContaining(["reason", "note", "email", "name", "requestedBy"]),
    );
    expect(JSON.stringify(metadata)).not.toMatch(/reason|note/i);
  });
});

describe("rollout schema", () => {
  const base = { flagId: "0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10", flagVersion: "2", enabled: "on" };

  it("rejects rollout outside 0-100 and short reasons", () => {
    expect(rolloutChangeSchema.safeParse({ ...base, rolloutPercentage: "250", reason: "long enough reason" }).success).toBe(false);
    expect(rolloutChangeSchema.safeParse({ ...base, rolloutPercentage: "10", reason: "short" }).success).toBe(false);
  });

  it("normalises an empty ticket to undefined and validates the format", () => {
    const ok = rolloutChangeSchema.parse({ ...base, rolloutPercentage: "10", reason: "long enough reason", ticket: "" });
    expect(ok.ticket).toBeUndefined();
    expect(ok.enabled).toBe(true);
    expect(rolloutChangeSchema.safeParse({ ...base, rolloutPercentage: "10", reason: "long enough reason", ticket: "bad ticket" }).success).toBe(false);
  });
});

describe("targeting schema", () => {
  it("accepts well-formed rules and rejects drifted shapes", () => {
    expect(parseTargeting([{ attribute: "country", operator: "in", values: ["EE", "FI"] }])).toHaveLength(1);
    expect(() => parseTargeting([{ attribute: "Country!", operator: "in", values: ["EE"] }])).toThrow();
    expect(() => parseTargeting([{ attribute: "country", operator: "like", values: ["EE"] }])).toThrow();
    expect(() => parseTargeting([{ attribute: "country", operator: "in", values: [] }])).toThrow();
  });
});

describe("region targeting", () => {
  const base = parseTargeting([{ attribute: "plan", operator: "equals", values: ["pro"] }]);

  it("adds, replaces, and removes the country rule without touching other rules", () => {
    const restricted = withRegions(base, ["FI", "EE"]);
    expect(restricted).toEqual([...base, { attribute: "country", operator: "in", values: ["EE", "FI"] }]);
    expect(regionsFromTargeting(restricted)).toEqual(["EE", "FI"]);
    expect(withRegions(restricted, ["DE"])).toEqual([...base, { attribute: "country", operator: "in", values: ["DE"] }]);
    expect(withRegions(restricted, [])).toEqual(base);
    expect(regionsFromTargeting(base)).toEqual([]);
    expect(sameRegions(["EE", "FI"], ["FI", "EE"])).toBe(true);
    expect(sameRegions(["EE"], ["FI", "EE"])).toBe(false);
  });

  it("accepts a single, several, or no regions from the form and rejects unknown codes", () => {
    const input = {
      flagId: "0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10",
      flagVersion: "1",
      enabled: "on",
      rolloutPercentage: "50",
      reason: "Synthetic reason for the test run.",
      ticket: "",
    };
    expect(directChangeSchema.parse(input).regions).toEqual([]);
    expect(directChangeSchema.parse({ ...input, regions: "EE" }).regions).toEqual(["EE"]);
    expect(directChangeSchema.parse({ ...input, regions: ["EE", "FI"] }).regions).toEqual(["EE", "FI"]);
    expect(directChangeSchema.safeParse({ ...input, regions: "XX" }).success).toBe(false);
  });
});

describe("service health providers", () => {
  it("normalises every mock provider into the shared signal shape", async () => {
    const snapshot = await collectServiceHealth(SERVICE_HEALTH_PROVIDERS);
    expect(snapshot.reports.map((report) => report.providerId)).toEqual([
      "datadog",
      "grafana",
      "sentry",
      "internal-status",
    ]);
    for (const report of snapshot.reports) {
      expect(report.status).toBe("ok");
      expect(report.signals.length).toBeGreaterThan(0);
      for (const signal of report.signals) {
        expect(["healthy", "degraded", "down", "unknown"]).toContain(signal.status);
        expect(signal.service).not.toBe("");
        expect(signal.owner).not.toBe("");
      }
    }
    expect(snapshot.overall).toBe("degraded");
  });

  it("isolates a failing provider and reports the worst status", async () => {
    const broken: ServiceHealthProvider = {
      id: "broken",
      name: "Broken",
      fetchSignals: () => Promise.reject(new Error("timeout")),
    };
    const healthy: ServiceHealthProvider = {
      id: "ok",
      name: "OK",
      fetchSignals: async () => [
        { service: "svc", status: "healthy", detail: "fine", owner: "Team", observedAt: new Date(0) },
      ],
    };
    const snapshot = await collectServiceHealth([broken, healthy]);
    expect(snapshot.reports[0]).toMatchObject({ providerId: "broken", status: "unavailable", signals: [] });
    expect(snapshot.reports[1]).toMatchObject({ providerId: "ok", status: "ok" });
    expect(snapshot.overall).toBe("unknown");
    expect(worstStatus(["healthy", "down", "degraded"])).toBe("down");
    expect(worstStatus([])).toBe("healthy");
  });
});

describe("URL state", () => {
  it("keeps valid filters and drops malformed values individually", () => {
    const query = parseFlagsQuery({
      q: "kyc",
      key: "kyc-auto-triage",
      env: "production",
      owner: "Risk platform",
      sort: "nonsense",
      dir: "desc",
      flag: "not-a-uuid",
      request: "0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10",
    });
    expect(query).toMatchObject({
      q: "kyc",
      key: "kyc-auto-triage",
      env: "production",
      owner: "Risk platform",
      dir: "desc",
    });
    expect(query.sort).toBe("key");
    expect(query.flag).toBeUndefined();
    expect(query.request).toBe("0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10");
  });

  it("builds deep links that survive a reload and drop one-shot notices", () => {
    const query = parseFlagsQuery({ q: "kyc", env: "development", notice: "flag_updated", ref: "CR-9001" });
    const href = buildFlagsHref(query, { flag: "0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10" });
    expect(href).toBe("/flags?q=kyc&env=development&flag=0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10");
    expect(parseFlagsQuery(Object.fromEntries(new URL(href, "http://x").searchParams))).toMatchObject({
      q: "kyc",
      env: "development",
      flag: "0b7b0d2e-3c2f-4b7c-9c4e-1f4b2d9e8a10",
    });
  });
});
