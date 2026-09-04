import NextAuth from "next-auth";

import { buildAuthConfig } from "@/platform/auth/config";

/**
 * Configured per request so the providers are resolved from the runtime
 * environment. A build must not need database or auth secrets.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() =>
  buildAuthConfig(),
);
