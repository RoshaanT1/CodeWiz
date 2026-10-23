// Used by the forgot and reset password forms (Client Components).
import { MIN_NEW_PASSWORD_LENGTH } from "./credentials";
import { NETWORK_ERROR_MESSAGE } from "./messages";

/** The one auth call the request needs, so tests can pass a fake. */
type ResetAuth = {
  resetPasswordForEmail: (
    email: string,
    options?: { redirectTo?: string },
  ) => Promise<{ error: { message: string; code?: string; status?: number } | null }>;
};

/** Where the reset email sends people: /auth/confirm checks the token, then opens the reset page. */
export function resetRedirectUrl(origin: string): string {
  return `${origin}/auth/confirm`;
}

/** Returns a message when the new password is unusable, or null when it is fine. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_NEW_PASSWORD_LENGTH) return `Use a password with at least ${MIN_NEW_PASSWORD_LENGTH} characters.`;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

/**
 * Asks Supabase to email a reset link. The answer is the same whether or not
 * the account exists, so the form can't be used to find out who has one.
 */
export async function requestPasswordReset(
  supabase: { auth: ResetAuth },
  email: string,
  origin: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl(origin) });
    if (!error) return { ok: true };
    if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return { ok: false, message: "We've sent a few emails already. Wait a few minutes, then try again." };
    }
    if (error.code === "email_address_invalid" || error.code === "validation_failed") {
      return { ok: false, message: "That email address isn't valid. Check it and try again." };
    }
    // Any other error (including an unknown address) looks the same as success.
    return { ok: true };
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

/** Plain-language messages for errors while saving the new password. */
export function describeResetError(error: { message: string; code?: string }): string {
  switch (error.code) {
    case "same_password":
      return "Choose a password different from your old one.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
    case "session_not_found":
    case "session_expired":
      return "This reset link has expired. Request a new one.";
    case "insufficient_aal":
      return "Enter the 6-digit code from your authenticator app first.";
    default:
      return `Couldn't change your password: ${error.message}`;
  }
}
