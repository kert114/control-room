import { beforeEach, describe, expect, it, vi } from "vitest";

const account = {
  id: "user-1",
  email: "operator@demo.control-room.test",
  name: "Ola Operator",
  role: "operator",
  isActive: true,
};

const rows: Array<Partial<typeof account>> = [];

vi.mock("@/platform/db/client", () => {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select } };
});

vi.mock("@/platform/config/env", () => ({
  env: () => ({
    DATABASE_URL: "postgresql://user:pw@localhost:5432/control_room",
    AUTH_SECRET: "0123456789abcdef0123456789abcdef",
    DEMO_MODE: true,
  }),
  assertAuthProviderAvailable: () => undefined,
  isEntraConfigured: () => false,
}));

import { buildAuthConfig } from "@/platform/auth/config";
import { SESSION_MAX_AGE_SECONDS } from "@/platform/auth/refresh";

type JwtCallback = NonNullable<
  NonNullable<ReturnType<typeof buildAuthConfig>["callbacks"]>["jwt"]
>;

function jwtCallback(): JwtCallback {
  const callback = buildAuthConfig().callbacks?.jwt;
  if (!callback) throw new Error("jwt callback missing");
  return callback;
}

async function runJwt(token: Parameters<JwtCallback>[0]["token"]) {
  return jwtCallback()({ token, user: undefined as never, account: null });
}

describe("session claims track the database", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("sets an explicit session lifetime", () => {
    expect(buildAuthConfig().session?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("keeps cached claims inside the refresh window without touching the database", async () => {
    const token = { email: account.email, role: "operator" as const, refreshedAt: Date.now() };
    const result = await runJwt(token);
    expect(result).toMatchObject({ role: "operator" });
  });

  it("re-reads role after the window so a demotion takes effect", async () => {
    rows.push({ ...account, role: "auditor" });
    const stale = { email: account.email, role: "operator" as const, refreshedAt: 0 };
    const result = await runJwt(stale);
    expect(result?.role).toBe("auditor");
    expect(result?.refreshedAt).toBeGreaterThan(0);
  });

  it("invalidates the session when the account is deactivated or gone", async () => {
    rows.push({ ...account, isActive: false });
    const stale = { email: account.email, role: "operator" as const, refreshedAt: 0 };
    expect(await runJwt(stale)).toBeNull();

    rows.length = 0;
    expect(await runJwt(stale)).toBeNull();
  });
});
