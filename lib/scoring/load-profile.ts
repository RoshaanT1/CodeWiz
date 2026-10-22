import "server-only";

import { z } from "zod";

import { coverage, type CategoryCoverage } from "@/lib/scoring/coverage";
import { createClient } from "@/lib/supabase/server";

export type ProfileData = {
  skills: { bugType: string; attempts: number; caught: number }[];
  functionScores: { functionId: string; name: string; file: string; score: number }[];
  rounds: { id: string; repo: string; createdAt: string; status: string; size: number }[];
  coverage: { categories: CategoryCoverage[]; overall: CategoryCoverage };
};

const SkillRows = z.array(z.object({ bug_type: z.string(), attempts: z.number(), caught: z.number() }));
const ScoreRows = z.array(
  z.object({
    function_id: z.string(),
    score: z.number().nullable(),
    functions: z.object({ qualified_name: z.string().nullable(), name: z.string(), file_path: z.string() }).nullable(),
  }),
);
const RoundRows = z.array(
  z.object({
    id: z.string(),
    created_at: z.string(),
    status: z.string().nullable(),
    size: z.number(),
    repos: z.object({ owner: z.string(), name: z.string() }).nullable(),
  }),
);
const FunctionRows = z.array(z.object({ id: z.string(), category: z.string().nullable(), excluded: z.boolean().nullable() }));

/**
 * SCORE-4: everything the profile page shows, read with the user's own
 * session so Row Level Security applies. Returns ok: true with null data
 * when the user has no rounds yet.
 */
export async function loadProfile(userId: string): Promise<{ ok: true; data: ProfileData | null } | { ok: false; reason: string }> {
  const client = await createClient();
  if (!client.ok) return client;
  const db = client.data;

  const [skills, scores, rounds, functions] = await Promise.all([
    db.from("skill_scores").select("bug_type, attempts, caught").eq("user_id", userId),
    db
      .from("understanding_scores")
      .select("function_id, score, functions(qualified_name, name, file_path)")
      .eq("user_id", userId)
      .order("score", { ascending: true }),
    db
      .from("rounds")
      .select("id, created_at, status, size, repos(owner, name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("functions").select("id, category, excluded").eq("user_id", userId).limit(10000),
  ]);
  if (skills.error || scores.error || rounds.error || functions.error) {
    return { ok: false, reason: "Couldn't load your profile. Try again in a moment." };
  }

  const roundRows = RoundRows.parse(rounds.data ?? []);
  const skillRows = SkillRows.parse(skills.data ?? []);
  if (roundRows.length === 0 && skillRows.length === 0) return { ok: true, data: null };

  const scoreRows = ScoreRows.parse(scores.data ?? []);
  const reviewed = new Set(scoreRows.map((s) => s.function_id));

  return {
    ok: true,
    data: {
      skills: skillRows.map((s) => ({ bugType: s.bug_type, attempts: s.attempts, caught: s.caught })),
      functionScores: scoreRows.map((s) => ({
        functionId: s.function_id,
        name: s.functions?.qualified_name ?? s.functions?.name ?? "Unknown function",
        file: s.functions?.file_path ?? "",
        score: s.score ?? 0,
      })),
      rounds: roundRows.map((r) => ({
        id: r.id,
        repo: r.repos ? `${r.repos.owner}/${r.repos.name}` : "Unknown repo",
        createdAt: r.created_at,
        status: r.status ?? "in_progress",
        size: r.size,
      })),
      coverage: coverage(
        FunctionRows.parse(functions.data ?? []).map((f) => ({ id: f.id, category: f.category ?? "helper", excluded: f.excluded ?? false })),
        reviewed,
      ),
    },
  };
}
