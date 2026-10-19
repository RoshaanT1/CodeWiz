import type { NextRequest } from "next/server";

import {
  isAuthPage,
  isProtectedPath,
  isTwoFactorPage,
  safeNextPath,
  SIGN_IN_PATH,
  TWO_FACTOR_ENROL_PATH,
  TWO_FACTOR_VERIFY_PATH,
} from "@/lib/auth/redirect";
import { redirectWithCookies, updateSession } from "@/lib/supabase/middleware";

/**
 * Server-side route protection. Runs before the page renders, so a
 * signed-out visitor never receives /dashboard content. It also keeps the
 * Supabase session cookies fresh on every page request.
 */
export async function middleware(request: NextRequest) {
  const { response, user, aal } = await updateSession(request);
  const { pathname, search, origin } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const signIn = new URL(SIGN_IN_PATH, origin);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(signIn, response);
  }

  if (user && isProtectedPath(pathname)) {
    if (aal.nextLevel === "aal1") {
      const enrol = new URL(TWO_FACTOR_ENROL_PATH, origin);
      enrol.searchParams.set("next", `${pathname}${search}`);
      return redirectWithCookies(enrol, response);
    }

    if (aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const verify = new URL(TWO_FACTOR_VERIFY_PATH, origin);
      verify.searchParams.set("next", `${pathname}${search}`);
      return redirectWithCookies(verify, response);
    }
  }

  if (user && isAuthPage(pathname) && !isTwoFactorPage(pathname)) {
    const target = new URL(
      safeNextPath(request.nextUrl.searchParams.get("next")),
      origin,
    );
    return redirectWithCookies(target, response);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
