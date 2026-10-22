// POST /api/rounds: ranks the repo's eligible functions, picks the round's
// functions with reasons (AI step A, with a code fallback), applies the daily
// round cap, and stores the round.
import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAiCalls } from "@/lib/ai/record-usage";
import { requireApiAal2Session } from "@/lib/auth/session";
import { bugTypesForLanguage } from "@/lib/bug-planter";
import { weakBugTypes } from "@/lib/scoring/weak-bug-types";
import type { FunctionCandidate } from "@/lib/selection/rank";
import { selectFunctions } from "@/lib/selection/select-ai";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "RATE_LIMITED" | "SERVER_CONFIG" | "UPSTREAM";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const BodySchema = z.object({
  repoId: z.uuid(),
  size: z.union([z.literal(3), z.literal(5), z.literal(10)]),
});

const FunctionRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    qualified_name: z.string().nullable(),
    file_path: z.string(),
    language: z.string().nullable(),
    start_line: z.number().nullable(),
    end_line: z.number().nullable(),
    length: z.number().nullable(),
    branches: z.number().nullable(),
    callers: z.number().nullable(),
    callees: z.number().nullable(),
    data_access: z.boolean(),
    category: z.enum(["entry", "core", "data", "helper"]).nullable(),
    importance: z.number().nullable(),
  }),
);

function dailyLimit(): number {
  const value = Number(process.env.DAILY_ROUND_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 10;
}

export async function POST(request: Request) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return error("BAD_REQUEST", "Choose a repo and a round size of 3, 5 or 10.", 400);
    body = parsed.data;
  } catch {
    return error("BAD_REQUEST", "Send JSON like { repoId, size }.", 400);
  }

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;

  const day = new Date().toISOString().slice(0, 10);
  const { data: usage } = await db
    .from("usage")
    .select("rounds")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle<{ rounds: number }>();
  if ((usage?.rounds ?? 0) >= dailyLimit()) {
    return error("RATE_LIMITED", `You've started ${dailyLimit()} rounds today, the daily limit. Come back tomorrow for more.`, 429);
  }

  const { data: repo } = await db
    .from("repos")
    .select("id, status")
    .eq("id", body.repoId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string; status: string }>();
  if (!repo) return error("NOT_FOUND", "We couldn't find that repo.", 404);
  if (repo.status !== "indexed") return error("BAD_REQUEST", "This repo hasn't finished importing.", 400);

  const [fnResult, reviewedResult, skillResult] = await Promise.all([
    db
      .from("functions")
      .select("id, name, qualified_name, file_path, language, start_line, end_line, length, branches, callers, callees, data_access, category, importance")
      .eq("user_id", userId)
      .eq("repo_id", body.repoId)
      .eq("excluded", false)
      .eq("explained", false)
      .order("importance", { ascending: false })
      .limit(200),
    db.from("understanding_scores").select("function_id").eq("user_id", userId),
    db.from("skill_scores").select("bug_type, attempts, caught").eq("user_id", userId),
  ]);
  if (fnResult.error) return error("UPSTREAM", "Couldn't load the repo's functions. Try again.", 502);

  const reviewed = new Set((reviewedResult.data ?? []).map((r: { function_id: string }) => r.function_id));
  const candidates: FunctionCandidate[] = FunctionRows.parse(fnResult.data ?? [])
    .filter((f) => !reviewed.has(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      qualifiedName: f.qualified_name ?? f.name,
      file: f.file_path,
      language: f.language ?? "javascript",
      startLine: f.start_line ?? 1,
      endLine: f.end_line ?? 1,
      length: f.length ?? 0,
      branches: f.branches ?? 0,
      callers: f.callers ?? 0,
      callees: f.callees ?? 0,
      dataAccess: f.data_access,
      category: f.category ?? "helper",
      importance: f.importance ?? undefined,
    }));
  if (candidates.length === 0) {
    return error("BAD_REQUEST", "You've reviewed every eligible function in this repo. Import another repo to keep going.", 400);
  }

  const language = candidates[0]?.language === "python" ? "python" : "javascript";
  const weak = weakBugTypes(skillResult.data ?? [], bugTypesForLanguage(language));
  const selection = await selectFunctions({ candidates, roundSize: body.size, weakBugTypes: weak });
  await recordAiCalls(db, userId, 1);
  if (selection.picks.length === 0) return error("BAD_REQUEST", "No functions in this repo are ready for a round.", 400);

  const { data: round, error: roundError } = await db
    .from("rounds")
    .insert({ user_id: userId, repo_id: body.repoId, size: body.size, status: "in_progress" })
    .select("id")
    .single<{ id: string }>();
  if (roundError || !round) return error("UPSTREAM", "Couldn't create the round. Try again.", 502);

  const { error: rfError } = await db.from("round_functions").insert(
    selection.picks.map((pick, position) => ({
      user_id: userId,
      round_id: round.id,
      function_id: pick.function_id,
      position,
      selection_reason: pick.reason,
      status: "pending",
    })),
  );
  if (rfError) {
    await db.from("rounds").delete().eq("id", round.id).eq("user_id", userId);
    return error("UPSTREAM", "Couldn't save the round's functions. Try again.", 502);
  }

  await db
    .from("usage")
    .upsert({ user_id: userId, day, rounds: (usage?.rounds ?? 0) + 1 }, { onConflict: "user_id,day" });

  return NextResponse.json({ ok: true as const, data: { roundId: round.id, count: selection.picks.length, usedAi: selection.usedAi } });
}
