import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/platform/config/env";

/**
 * Defence in depth only: every route under the app shell needs a valid session
 * before a page or action runs. Permissions are still enforced per page and
 * per action through `requirePermission`; this gate never grants anything.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({
    req: request,
    secret: env().AUTH_SECRET,
    secureCookie: request.nextUrl.protocol === "https:",
  });
  if (token?.sub) {
    return NextResponse.next();
  }
  const signIn = new URL("/signin", request.url);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    // Everything except sign-in, the Auth.js handlers, Next internals, and static files.
    "/((?!signin|api/auth|_next/static|_next/image|favicon.ico|.*\\.[a-z0-9]+$).*)",
  ],
};
