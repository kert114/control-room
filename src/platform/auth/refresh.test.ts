import { describe, expect, it } from "vitest";

import {
  isTokenStale,
  SESSION_MAX_AGE_SECONDS,
  TOKEN_REFRESH_WINDOW_MS,
} from "@/platform/auth/refresh";

describe("session token refresh", () => {
  const now = 1_000_000_000;

  it("treats a token without role or refresh time as stale", () => {
    expect(isTokenStale({}, now)).toBe(true);
    expect(isTokenStale({ role: "operator" }, now)).toBe(true);
    expect(isTokenStale({ refreshedAt: now }, now)).toBe(true);
  });

  it("serves cached claims inside the refresh window and re-reads after it", () => {
    const token = { role: "operator", refreshedAt: now };
    expect(isTokenStale(token, now)).toBe(false);
    expect(isTokenStale(token, now + TOKEN_REFRESH_WINDOW_MS - 1)).toBe(false);
    expect(isTokenStale(token, now + TOKEN_REFRESH_WINDOW_MS)).toBe(true);
  });

  it("bounds the session to one shift rather than the 30-day default", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBeLessThanOrEqual(8 * 60 * 60);
    expect(TOKEN_REFRESH_WINDOW_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
