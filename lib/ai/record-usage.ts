import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AI-3: adds `calls` to today's `usage.ai_calls` for the user. Best effort:
 * a failed write is logged and never fails the request.
 */
export async function recordAiCalls(db: SupabaseClient, userId: string, calls: number): Promise<void> {
  if (calls <= 0) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await db
      .from("usage")
      .select("ai_calls")
      .eq("user_id", userId)
      .eq("day", day)
      .maybeSingle<{ ai_calls: number }>();
    const { error } = await db
      .from("usage")
      .upsert({ user_id: userId, day, ai_calls: (data?.ai_calls ?? 0) + calls }, { onConflict: "user_id,day" });
    if (error) console.warn(`[ai] usage write failed: ${error.message}`);
  } catch (err) {
    console.warn(`[ai] usage write failed: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}
