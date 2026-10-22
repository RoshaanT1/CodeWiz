import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type LiveRoundFunction = {
  roundFunctionId: string;
  name: string;
  file: string;
  reason: string | null;
  quizDone: boolean;
  drillDone: boolean;
};

export type LiveRoundData = { id: string; repo: string; status: string; functions: LiveRoundFunction[] };

const RoundSchema = z.object({
  id: z.string(),
  status: z.string().nullable(),
  repos: z.object({ owner: z.string(), name: z.string() }).nullable(),
  round_functions: z.array(
    z.object({
      id: z.string(),
      position: z.number().nullable(),
      selection_reason: z.string().nullable(),
      functions: z.object({ name: z.string(), qualified_name: z.string().nullable(), file_path: z.string() }),
      quiz_items: z.array(z.object({ answer: z.string().nullable() })),
      drills: z.array(z.object({ status: z.string().nullable() })),
    }),
  ),
});

/** ROUND-4: a round's functions and how far the user got with each, for resuming. */
export async function loadLiveRound(userId: string, roundId: string): Promise<{ ok: true; data: LiveRoundData | null } | { ok: false; reason: string }> {
  const client = await createClient();
  if (!client.ok) return client;
  const { data, error } = await client.data
    .from("rounds")
    .select(
      "id, status, repos(owner, name), round_functions(id, position, selection_reason, functions(name, qualified_name, file_path), quiz_items(answer), drills(status))",
    )
    .eq("id", roundId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, reason: "Couldn't load this round. Try again in a moment." };
  if (!data) return { ok: true, data: null };
  const round = RoundSchema.safeParse(data);
  if (!round.success) return { ok: false, reason: "This round's data is incomplete." };

  return {
    ok: true,
    data: {
      id: round.data.id,
      repo: round.data.repos ? `${round.data.repos.owner}/${round.data.repos.name}` : "Unknown repo",
      status: round.data.status ?? "in_progress",
      functions: [...round.data.round_functions]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((rf) => ({
          roundFunctionId: rf.id,
          name: rf.functions.qualified_name ?? rf.functions.name,
          file: rf.functions.file_path,
          reason: rf.selection_reason,
          quizDone: rf.quiz_items.length > 0 && rf.quiz_items.every((q) => q.answer !== null),
          drillDone: rf.drills.some((d) => d.status === "submitted" || d.status === "skipped"),
        })),
    },
  };
}
