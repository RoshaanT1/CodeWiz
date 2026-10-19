import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Client Components. Stores the session in cookies, so
 * the server client sees the same session.
 *
 * Returns `{ ok: false, reason }` with a readable message when the Supabase
 * variables are missing, so callers can show it instead of crashing.
 */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env.ok) return env;

  return {
    ok: true as const,
    data: createBrowserClient(env.data.url, env.data.publishableKey),
  };
}
