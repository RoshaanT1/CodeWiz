import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { SIGN_IN_PATH } from "./redirect";

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
