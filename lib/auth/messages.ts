// Turns Supabase Auth errors into messages a person can act on.
// No server-only import: the auth forms (Client Components) use this.

export type AuthMode = "sign-in" | "sign-up";

type AuthErrorLike = {
  message: string;
  code?: string;
  status?: number;
};

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the sign-in service. Check your connection and try again.";

export function describeAuthError(
  error: AuthErrorLike,
  mode: AuthMode,
): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password. Check both and try again.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "email_not_confirmed":
      return "This email isn't confirmed yet. Check your inbox for the confirmation link.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
    case "email_address_invalid":
    case "validation_failed":
      return "That email address isn't valid. Check it and try again.";
    case "signup_disabled":
      return "Sign-up is turned off for this project.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "over_email_send_rate_limit":
      // The confirmation email limit is per hour, so "a minute" isn't true.
      return "We can't send another confirmation email right now. Try again later, or sign in if you've already confirmed your email.";
    default:
      break;
  }

  if (error.status === 429) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (error.status === 0) return NETWORK_ERROR_MESSAGE;

  // Older Supabase versions return text instead of a code.
  const text = error.message.toLowerCase();
  if (text.includes("invalid login credentials")) {
    return "Wrong email or password. Check both and try again.";
  }
  if (text.includes("already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }

  return mode === "sign-in"
    ? `Couldn't sign you in: ${error.message}`
    : `Couldn't create your account: ${error.message}`;
}
