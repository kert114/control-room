import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { z } from "zod";

import {
  assertAuthProviderAvailable,
  env,
  isEntraConfigured,
} from "@/platform/config/env";
import {
  isTokenStale,
  SESSION_MAX_AGE_SECONDS,
} from "@/platform/auth/refresh";
import { db } from "@/platform/db/client";
import { users } from "@/platform/db/schema";
import { ROLES, type Role } from "@/platform/authz/policy";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function buildAuthConfig(): NextAuthConfig {
  const current = env();
  assertAuthProviderAvailable(current);

  const providers: NextAuthConfig["providers"] = [];

  if (current.DEMO_MODE) {
    providers.push(
      Credentials({
        id: "demo-credentials",
        name: "Demo account",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(raw) {
          const parsed = credentialsSchema.safeParse(raw);
          if (!parsed.success) {
            return null;
          }
          const [account] = await db
            .select()
            .from(users)
            .where(eq(users.email, parsed.data.email.toLowerCase()))
            .limit(1);

          if (!account || !account.isActive || !account.passwordHash) {
            return null;
          }
          const valid = await compare(
            parsed.data.password,
            account.passwordHash,
          );
          if (!valid) {
            return null;
          }
          return {
            id: account.id,
            email: account.email,
            name: account.name,
            role: account.role,
          };
        },
      }),
    );
  }

  if (isEntraConfigured(current)) {
    providers.push(
      MicrosoftEntraID({
        clientId: current.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: current.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: current.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      }),
    );
  }

  return {
    providers,
    secret: current.AUTH_SECRET,
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
    pages: { signIn: "/signin" },
    trustHost: true,
    callbacks: {
      async signIn({ user }) {
        if (!user.email) {
          return false;
        }
        const [account] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email.toLowerCase()))
          .limit(1);
        // Fail closed: only provisioned, active accounts may sign in.
        return Boolean(account?.isActive);
      },
      async jwt({ token, user }) {
        const email = user?.email ?? token.email;
        if (!email) {
          return token;
        }
        if (user || isTokenStale(token)) {
          const [account] = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);
          // Fail closed: a deactivated or deleted account loses its session.
          if (!account?.isActive) {
            return null;
          }
          token.sub = account.id;
          token.name = account.name;
          token.email = account.email;
          token.role = account.role;
          token.refreshedAt = Date.now();
        }
        return token;
      },
      async session({ session, token }) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        const role = typeof token.role === "string" ? token.role : undefined;
        session.user.role = role && isRole(role) ? role : "auditor";
        return session;
      },
    },
  };
}
