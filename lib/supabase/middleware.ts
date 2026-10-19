import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "./env";

// Used only by middleware.ts. Not marked server-only because middleware runs
// in its own runtime. It uses the publishable key, so Row Level Security
// still applies.

export type AssuranceLevel = "aal1" | "aal2" | null;

export type SessionUpdate = {
  /** Response to return when no redirect is needed. Carries refreshed cookies. */
  response: NextResponse;
  /** The verified user, or null when signed out or Supabase is unavailable. */
  user: User | null;
  /** Supabase MFA assurance levels for the active session. */
  aal: { currentLevel: AssuranceLevel; nextLevel: AssuranceLevel };
};

/**
 * Refreshes the Supabase session cookies for this request and reports who is
 * signed in. If Supabase isn't configured or can't be reached, the user is
 * treated as signed out, so protected pages stay closed.
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdate> {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  const signedOut = {
    response,
    user: null,
    aal: { currentLevel: null, nextLevel: null },
  };
  if (!env.ok) return signedOut;

  const supabase = createServerClient(env.data.url, env.data.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return signedOut;

    const { data: aalData, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    return {
      response,
      user: data.user,
      aal: {
        currentLevel: aalError ? null : aalData.currentLevel,
        nextLevel: aalError ? null : aalData.nextLevel,
      },
    };
  } catch {
    return signedOut;
  }
}

/** Redirects while keeping any session cookies that were just refreshed. */
export function redirectWithCookies(
  url: URL,
  from: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
