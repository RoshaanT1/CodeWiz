import { z } from "zod";
import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { checkAiCap } from "@/lib/server/daily-cap";
import { apiError } from "@/lib/server/responses";
import { selectFunctions } from "@/lib/selection/select-ai";
import { weakBugTypes } from "@/lib/scoring";
import type { FunctionCandidate } from "@/lib/selection/rank";
import { getAiConfig } from "@/lib/ai/user-config";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";
import { audit, newRequestId } from "@/lib/server/audit-log";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  repo_id: z.string().uuid(),
  size: z.union([z.literal(3), z.literal(5), z.literal(10)]),
});

/**
 * POST /api/rounds
 * ROUND-3: Rank candidates, pick functions with AI (Contract A),
 * apply daily cap, create the round and round_functions rows.
 */
export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? newRequestId();

  const session = await requireApiAal2Session();
  if (!session.ok) {
    audit(session.status === 401 ? "api.unauthorized" : "api.forbidden", {
      requestId, route: "/api/rounds", method: "POST",
    });
    return apiError(session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", session.reason, session.status);
  }
  const userId = session.data.id;

  // SEC-06: In-memory sliding-window rate limit (5 req/min per user).
  const rateCheck = checkRateLimit(`rounds:${userId}`, RATE_LIMITS.roundCreate);
  if (!rateCheck.ok) {
    audit("api.rate_limited", {
      requestId, userId, route: "/api/rounds", method: "POST",
      meta: { retryAfterMs: rateCheck.retryAfterMs },
    });
    return apiError("RATE_LIMITED", rateCheck.reason, 429);
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError("BAD_REQUEST", "Send a JSON body with repo_id and size.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid body.", 400);
  }
  const { repo_id, size } = parsed.data;

  const tempClient = await createClient();
  if (!tempClient.ok) return apiError("UPSTREAM", tempClient.reason, 503);
  const cap = await checkAiCap(tempClient.data, userId);
  if (!cap.ok) {
    audit("round.daily_cap_exceeded", {
      requestId, userId, route: "/api/rounds", method: "POST",
    });
    return apiError("RATE_LIMITED", cap.reason, 429);
  }

  const client = tempClient;

  // Verify repo ownership.
  const { data: repo } = await client.data
    .from("repos").select("id, status").eq("id", repo_id).eq("user_id", userId).single();
  if (!repo) return apiError("NOT_FOUND", "Repo not found.", 404);
  if (repo.status !== "indexed") return apiError("BAD_REQUEST", "Repo is not fully indexed yet.", 400);

  // Load candidates: eligible functions (not excluded, not explained).
  const { data: fns } = await client.data
    .from("functions")
    .select("id, name, qualified_name, file_path, language, start_line, end_line, length, branches, callers, callees, data_access, category, importance, excluded, explained, code")
    .eq("repo_id", repo_id)
    .eq("user_id", userId)
    .eq("excluded", false)
    .eq("explained", false)
    .order("importance", { ascending: false })
    .limit(50);

  const candidates: FunctionCandidate[] = (fns ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    qualifiedName: f.qualified_name ?? f.name,
    file: f.file_path ?? "",
    language: f.language ?? "typescript",
    startLine: f.start_line ?? 1,
    endLine: f.end_line ?? 1,
    length: f.length ?? (f.end_line ? f.end_line - f.start_line + 1 : 1),
    branches: f.branches ?? 0,
    callers: f.callers ?? 0,
    callees: f.callees ?? 0,
    dataAccess: f.data_access ?? false,
    category: (f.category ?? "helper") as FunctionCandidate["category"],
    importance: f.importance ?? 0,
    code: f.code ?? undefined,
  }));

  if (candidates.length < size) {
    return apiError("BAD_REQUEST", `Not enough eligible functions (${candidates.length}) for a round of ${size}.`, 400);
  }

  // Load skill profile to weight weak bug types.
  const { data: skillRows } = await client.data
    .from("skill_scores").select("bug_type, attempts, caught").eq("user_id", userId);
  const rates: Record<string, number> = {};
  for (const row of skillRows ?? []) {
    rates[row.bug_type] = row.attempts === 0 ? 0 : row.caught / row.attempts;
  }
  const weak = weakBugTypes(rates);

  const aiConfig = await getAiConfig();
  const selection = await selectFunctions({
    candidates,
    roundSize: size,
    weakBugTypes: weak,
    apiKey: aiConfig.apiKey,
    provider: aiConfig.provider,
  });

  // Create round row.
  const { data: round, error: roundErr } = await client.data
    .from("rounds")
    .insert({ user_id: userId, repo_id, size, status: "active" })
    .select("id").single();
  if (roundErr || !round) return apiError("UPSTREAM", "Failed to create round.", 500);

  // Create round_functions rows.
  const rfRows = selection.picks.map((pick, i) => ({
    user_id: userId,
    round_id: round.id,
    function_id: pick.function_id,
    position: i + 1,
    selection_reason: pick.reason,
    status: "pending",
  }));

  const { data: rfs, error: rfErr } = await client.data
    .from("round_functions").insert(rfRows).select("id, function_id, position, selection_reason");
  if (rfErr || !rfs) {
    await client.data.from("rounds").delete().eq("id", round.id);
    return apiError("UPSTREAM", "Failed to create round functions.", 500);
  }

  // Round count is tracked via the rounds table; no separate increment needed.

  audit("round.create", {
    requestId, userId, route: "/api/rounds", method: "POST",
    meta: { roundId: round.id, repoId: repo_id, size },
  });

  return NextResponse.json({ ok: true, data: { id: round.id, size, roundFunctions: rfs } }, { status: 201 });
}
