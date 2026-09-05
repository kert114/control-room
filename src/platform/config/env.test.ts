import { describe, expect, it } from "vitest";

import {
  assertAuthProviderAvailable,
  isEntraConfigured,
  readEnv,
} from "@/platform/config/env";

const base = {
  DATABASE_URL: "postgresql://user:pw@localhost:5432/control_room",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("environment configuration", () => {
  it("parses demo mode as a boolean", () => {
    expect(readEnv({ ...base, DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
    expect(readEnv({ ...base, DEMO_MODE: "false" }).DEMO_MODE).toBe(false);
    expect(readEnv(base).DEMO_MODE).toBe(false);
  });

  it("rejects a short auth secret", () => {
    expect(() => readEnv({ ...base, AUTH_SECRET: "short" })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it("treats Entra as configured only when all three values are present", () => {
    const partial = readEnv({
      ...base,
      AUTH_MICROSOFT_ENTRA_ID_ID: "client",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
    });
    expect(isEntraConfigured(partial)).toBe(false);

    const complete = readEnv({
      ...base,
      AUTH_MICROSOFT_ENTRA_ID_ID: "client",
      AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
      AUTH_MICROSOFT_ENTRA_ID_ISSUER: "https://login.microsoftonline.com/tenant/v2.0",
    });
    expect(isEntraConfigured(complete)).toBe(true);
  });

  it("fails closed when neither demo mode nor Entra is available", () => {
    expect(() => assertAuthProviderAvailable(readEnv(base))).toThrow(
      /No authentication provider available/,
    );
  });

  it("allows demo mode alone and Entra alone", () => {
    expect(() =>
      assertAuthProviderAvailable(readEnv({ ...base, DEMO_MODE: "true" })),
    ).not.toThrow();
    expect(() =>
      assertAuthProviderAvailable(
        readEnv({
          ...base,
          AUTH_MICROSOFT_ENTRA_ID_ID: "client",
          AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret",
          AUTH_MICROSOFT_ENTRA_ID_ISSUER:
            "https://login.microsoftonline.com/tenant/v2.0",
        }),
      ),
    ).not.toThrow();
  });
});
