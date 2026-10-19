// Path rules shared by the middleware, the auth pages and the dashboard.
// No server-only import: the middleware and Client Components use this too.

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const TWO_FACTOR_ENROL_PATH = "/2fa/enrol";
export const TWO_FACTOR_VERIFY_PATH = "/2fa/verify";
export const DEFAULT_AFTER_SIGN_IN = "/dashboard";

/** Paths that need a signed-in user. Checked on the server in middleware. */
const PROTECTED_PREFIXES = ["/dashboard"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_UP_PATH ||
    pathname === TWO_FACTOR_ENROL_PATH ||
    pathname === TWO_FACTOR_VERIFY_PATH
  );
}

export function isTwoFactorPage(pathname: string): boolean {
  return pathname === TWO_FACTOR_ENROL_PATH || pathname === TWO_FACTOR_VERIFY_PATH;
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Accepts a `next` value from the query string and returns a safe in-app
 * path. Anything that could leave the site (absolute URLs, `//host`,
 * backslashes, control characters) falls back to the dashboard.
 */
export function safeNextPath(
  value: string | string[] | null | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return DEFAULT_AFTER_SIGN_IN;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  if (candidate.includes("\\") || hasControlCharacter(candidate)) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  if (isAuthPage(candidate.split("?")[0])) return DEFAULT_AFTER_SIGN_IN;
  return candidate;
}
