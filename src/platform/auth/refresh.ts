/** How long a session token may serve cached role and active-status claims. */
export const TOKEN_REFRESH_WINDOW_MS = 60 * 1000;

/** Session lifetime: one operations shift, then sign in again. */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface RefreshableClaims {
  role?: string;
  refreshedAt?: number;
}

export function isTokenStale(
  token: RefreshableClaims,
  now: number = Date.now(),
): boolean {
  if (!token.role || typeof token.refreshedAt !== "number") {
    return true;
  }
  return now - token.refreshedAt >= TOKEN_REFRESH_WINDOW_MS;
}
