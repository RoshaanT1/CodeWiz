import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";

/**
 * Supabase client with the secret key. It bypasses Row Level Security, so use
 * it only where the rules require it (the `planted_bugs` answer key, scoring
 * writes) and always filter by the user id from the verified session.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  if (!env.ok) return env;

  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) {
    return {
      ok: false as const,
      reason:
        "SUPABASE_SECRET_KEY isn't set on the server. Add it in .env.local or the Vercel project settings, then restart.",
    };
  }

  const client = createSupabaseClient(env.data.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { ok: true as const, data: client };
}
