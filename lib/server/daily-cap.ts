import "server-only";

import { createClient } from "@/lib/supabase/server";

const DEFAULT_DAILY_LIMIT = 10;

export type CapResult =
  | { ok: true }
  | { ok: false; status: 429 | 503; reason: string };

/**
 * Checks whether the signed-in user has reached today's round limit.
 * Returns ok:false with a 429 if they have.
 *
 * SEC-06: Fails CLOSED on database errors — if we can't verify the cap,
 * we reject with 503 rather than silently allowing unlimited rounds.
 */
export async function checkDailyCap(userId: string): Promise<CapResult> {
  const client = await createClient();
  if (!client.ok) {
    // Fail closed: if Supabase is unreachable, do not allow unmetered rounds.
    return {
      ok: false,
      status: 503,
      reason: "Can't verify your daily usage right now. Please try again in a moment.",
    };
  }

  const limit =
    Number(process.env.DAILY_ROUND_LIMIT) || DEFAULT_DAILY_LIMIT;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data, error } = await client.data
    .from("usage")
    .select("rounds")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();

  if (error) {
    // SEC-06: Fail closed on quota lookup errors.
    return {
      ok: false,
      status: 503,
      reason: "Can't verify your daily usage right now. Please try again in a moment.",
    };
  }

  const used = data?.rounds ?? 0;
  if (used >= limit) {
    return {
      ok: false,
      status: 429,
      reason: `You've started ${used} rounds today. The daily limit is ${limit}. Come back tomorrow.`,
    };
  }
  return { ok: true };
}

/**
 * Increments the round counter for today. Call after a round is successfully
 * created, not before. Fails silently so a DB error never blocks the user
 * (the cap check already enforced the limit).
 */
export async function incrementRoundCount(userId: string): Promise<void> {
  const client = await createClient();
  if (!client.ok) return;

  const today = new Date().toISOString().slice(0, 10);

  await client.data.from("usage").upsert(
    { user_id: userId, day: today, rounds: 1, ai_calls: 0 },
    {
      onConflict: "user_id,day",
      ignoreDuplicates: false,
    },
  );

  // Supabase upsert with onConflict doesn't support increment natively via
  // REST, so do a separate increment.
  await client.data.rpc("increment_usage_rounds", {
    p_user_id: userId,
    p_day: today,
  });
}

/**
 * Increments the AI call counter. Call after each successful AI call.
 * Fails silently.
 */
export async function incrementAiCallCount(userId: string): Promise<void> {
  const client = await createClient();
  if (!client.ok) return;

  const today = new Date().toISOString().slice(0, 10);

  await client.data.from("usage").upsert(
    { user_id: userId, day: today, rounds: 0, ai_calls: 1 },
    { onConflict: "user_id,day", ignoreDuplicates: false },
  );
}
