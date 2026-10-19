import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  SIGN_IN_PATH,
  TWO_FACTOR_ENROL_PATH,
  TWO_FACTOR_VERIFY_PATH,
} from "./redirect";

export type SessionResult =
  | { ok: true; data: User | null }
  | { ok: false; reason: string };

/**
 * Returns the signed-in user, or `data: null` when nobody is signed in.
 * Uses `getUser()`, which checks the token with Supabase, so a forged or
 * expired cookie never counts as a session.
 */
export async function getSessionUser(): Promise<SessionResult> {
  const client = await createClient();
  if (!client.ok) return client;

  try {
    const { data, error } = await client.data.auth.getUser();
    if (error) return { ok: true, data: null };
    return { ok: true, data: data.user };
  } catch {
    return {
      ok: false,
      reason:
        "Couldn't reach Supabase to check your session. Try again in a moment.",
    };
  }
}

/**
 * Server-side guard for protected pages. Sends signed-out visitors to the
 * sign-in page, and back to `next` once they have signed in.
 */
export async function requireUser(next = "/dashboard"): Promise<User> {
  const session = await getSessionUser();
  const user = session.ok ? session.data : null;
  if (!user) {
    redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`);
  }
  return user;
}

export type Aal2SessionResult =
  | { ok: true; data: User }
  | { ok: false; status: 401 | 403 | 503; reason: string; redirectTo?: string };

function twoFactorRedirect(next: string, nextLevel: string | null, currentLevel: string | null): string | null {
  if (nextLevel === "aal1") {
    return `${TWO_FACTOR_ENROL_PATH}?next=${encodeURIComponent(next)}`;
  }
  if (nextLevel === "aal2" && currentLevel !== "aal2") {
    return `${TWO_FACTOR_VERIFY_PATH}?next=${encodeURIComponent(next)}`;
  }
  return null;
}

/**
 * Server-side guard for pages that require a completed 2FA session. Signed-in
 * users below AAL2 are redirected to enrol or verify before protected content
 * is rendered.
 */
export async function requireAal2User(next = "/dashboard"): Promise<User> {
  const client = await createClient();
  if (!client.ok) redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`);

  const { data: userData, error: userError } = await client.data.auth.getUser();
  if (userError || !userData.user) {
    redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`);
  }

  const { data: aalData, error: aalError } =
    await client.data.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`);

  const redirectTo = twoFactorRedirect(
    next,
    aalData.nextLevel,
    aalData.currentLevel,
  );
  if (redirectTo) redirect(redirectTo);

  return userData.user;
}

export const requireAal2 = requireAal2User;

/** Guard for route handlers. Return a JSON 401/403/503 instead of redirecting. */
export async function requireApiAal2Session(): Promise<Aal2SessionResult> {
  const client = await createClient();
  if (!client.ok) return { ok: false, status: 503, reason: client.reason };

  try {
    const { data: userData, error: userError } = await client.data.auth.getUser();
    if (userError || !userData.user) {
      return { ok: false, status: 401, reason: "Sign in to continue." };
    }

    const { data: aalData, error: aalError } =
      await client.data.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      return {
        ok: false,
        status: 503,
        reason: "Couldn't check your 2FA session. Try again in a moment.",
      };
    }

    const redirectTo = twoFactorRedirect(
      "/dashboard",
      aalData.nextLevel,
      aalData.currentLevel,
    );
    if (redirectTo) {
      return {
        ok: false,
        status: 403,
        reason: "Finish two-factor authentication to use this API.",
        redirectTo,
      };
    }

    return { ok: true, data: userData.user };
  } catch {
    return {
      ok: false,
      status: 503,
      reason: "Couldn't reach Supabase to check your 2FA session.",
    };
  }
}
