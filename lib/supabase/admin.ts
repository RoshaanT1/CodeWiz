import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client — uses the secret key, bypasses Row Level Security.
 * Use ONLY for server-side operations that need to read planted_bugs or write
 * scores, always filtering by the verified user id from the session.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return {
      ok: false as const,
      reason:
        "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set. Add it to your environment.",
    };
  }
  return {
    ok: true as const,
    data: createSupabaseClient(url, key, {
      auth: { persistSession: false },
    }),
  };
}
