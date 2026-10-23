import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimKind = "quiz" | "drill";

/** Longer than any generation can run (routes stop at 60 s). */
const STALE_AFTER_MS = 90_000;

/**
 * Claims the right to generate a quiz or drill for one round function. Only one
 * request can hold a claim (primary key), so overlapping requests, such as one
 * started before a page reload and one after, can't both call the model.
 * Returns "claimed", "taken" (another request holds it), or "unavailable" when
 * the claims table is missing, in which case callers carry on as before.
 */
export async function claimGeneration(
  db: SupabaseClient,
  userId: string,
  roundFunctionId: string,
  kind: ClaimKind,
): Promise<"claimed" | "taken" | "unavailable"> {
  const { error } = await db.from("generation_claims").insert({ round_function_id: roundFunctionId, kind, user_id: userId });
  if (!error) return "claimed";
  if (error.code === "23505") {
    // A claim left by a request that was killed (for example at the function
    // time limit) would block this function forever: take over stale ones.
    const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    const { data: removed } = await db
      .from("generation_claims")
      .delete()
      .eq("round_function_id", roundFunctionId)
      .eq("kind", kind)
      .eq("user_id", userId)
      .lt("created_at", staleBefore)
      .select("round_function_id");
    if (removed && removed.length > 0) {
      const retry = await db.from("generation_claims").insert({ round_function_id: roundFunctionId, kind, user_id: userId });
      if (!retry.error) return "claimed";
    }
    return "taken";
  }
  console.warn(`[claims] ${kind} claim unavailable (${error.code}): ${error.message}`);
  return "unavailable";
}

/** Gives the claim back after a failed generation, so a retry can run. */
export async function releaseGeneration(db: SupabaseClient, userId: string, roundFunctionId: string, kind: ClaimKind): Promise<void> {
  await db.from("generation_claims").delete().eq("round_function_id", roundFunctionId).eq("kind", kind).eq("user_id", userId);
}

/** Polls until `find` returns a value or the time runs out (for the request that lost the claim). */
export async function waitForGenerated<T>(find: () => Promise<T | null>, timeoutMs = 45000, everyMs = 1500): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = await find();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
  return null;
}
