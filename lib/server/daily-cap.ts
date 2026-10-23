import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_AI_CALL_LIMIT = 300;

function aiCallLimit(): number {
  const value = Number(process.env.DAILY_AI_CALL_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_AI_CALL_LIMIT;
}

/**
 * DB-3: blocks AI routes once the user has made today's limit of AI calls
 * (usage.ai_calls). Rounds have their own cap in POST /api/rounds.
 * A failed read lets the request through rather than locking the user out.
 */
export async function checkAiCap(db: SupabaseClient, userId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const day = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("usage")
    .select("ai_calls")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle<{ ai_calls: number }>();
  if (error) return { ok: true };
  if ((data?.ai_calls ?? 0) >= aiCallLimit()) {
    return { ok: false, reason: "You've reached today's limit for AI features. Your progress is saved; come back tomorrow to continue." };
  }
  return { ok: true };
}
