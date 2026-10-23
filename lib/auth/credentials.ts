import type { SupabaseClient } from "@supabase/supabase-js";

import {
  describeAuthError,
  NETWORK_ERROR_MESSAGE,
  type AuthMode,
} from "./messages";

// Used by the sign-in and sign-up forms (Client Components).

export const MIN_NEW_PASSWORD_LENGTH = 8;

export type AuthOutcome =
  | { status: "signed-in" }
  | { status: "needs-confirmation" }
  | { status: "error"; message: string };

/** Returns a message when the input is unusable, or null when it is fine. */
export function validateCredentials(
  email: string,
  password: string,
  mode: AuthMode,
): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "That email address isn't valid. Check it and try again.";
  }
  if (!password) return "Enter your password.";
  if (mode === "sign-up" && password.length < MIN_NEW_PASSWORD_LENGTH) {
    return `Use a password with at least ${MIN_NEW_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function submitCredentials(
  supabase: { auth: SupabaseClient["auth"] },
  mode: AuthMode,
  email: string,
  password: string,
  /** Display name saved in user metadata on sign-up. */
  name?: string,
): Promise<AuthOutcome> {
  try {
    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { status: "error", message: describeAuthError(error, mode) };
      }
      return { status: "signed-in" };
    }

    // Send the confirmation link back to this site (it must be in Supabase's
    // redirect allow-list; otherwise Supabase falls back to the Site URL).
    const emailRedirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/sign-in`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo, ...(name ? { data: { full_name: name } } : {}) },
    });
    if (error) {
      return { status: "error", message: describeAuthError(error, mode) };
    }
    // With email confirmation on, Supabase hides existing accounts by
    // returning a user with no identities instead of an error.
    if (data.user && data.user.identities?.length === 0) {
      return {
        status: "error",
        message: describeAuthError({ message: "", code: "user_already_exists" }, mode),
      };
    }
    // With confirmation off a session comes back at once; with it on, the
    // user confirms by email and then signs in.
    if (data.session) return { status: "signed-in" };
    return { status: "needs-confirmation" };
  } catch {
    return { status: "error", message: NETWORK_ERROR_MESSAGE };
  }
}
