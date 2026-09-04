import NextAuth from "next-auth";

import { buildAuthConfig } from "@/platform/auth/config";

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig());
