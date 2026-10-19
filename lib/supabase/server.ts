import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, route handlers and server code.
 * Reads and writes the session cookies through `next/headers`.
 *
 * It uses the publishable key, so Row Level Security applies. There is no
 * admin client yet.
 *
 * Returns `{ ok: false, reason }` with a readable message when the Supabase
 * variables are missing, so callers can show it instead of crashing.
 */
export async function createClient() {
  const env = getSupabaseEnv();
  if (!env.ok) return env;

  const cookieStore = await cookies();

  const client = createServerClient(env.data.url, env.data.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. That's fine: route handlers
          // can, and middleware.ts refreshes the session on every request.
        }
      },
    },
  });

  return { ok: true as const, data: client };
}
