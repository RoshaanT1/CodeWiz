// POST /api/rounds/[id]/complete: computes the understanding score for each
// function in the round (SCORE-1), stores it, and marks the round completed.
// The skill profile is already updated when each drill is submitted.
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiAal2Session } from "@/lib/auth/session";
import { understandingScore } from "@/lib/scoring/understanding";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });

const RoundSchema = z.object({
  id: z.string(),
  round_functions: z.array(z.object({ id: z.string(), function_id: z.string() })),
});
const QuizRows = z.array(z.object({ round_function_id: z.string(), score: z.number().nullable() }));
const DrillRows = z.array(z.object({ id: z.string(), round_function_id: z.string(), status: z.string().nullable() }));
const FindingRows = z.array(
  z.object({
    drill_id: z.string(),
    outcome: z.string().nullable(),
    planted_bug_id: z.string().nullable(),
    explanation_score: z.number().nullable(),
  }),
);
const BugRows = z.array(z.object({ id: z.string(), drill_id: z.string() }));
const SuggestionRows = z.array(z.object({ round_function_id: z.string(), reason_score: z.number().nullable() }));

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That round id isn't valid.", 400);
  const roundId = parsedParams.data.id;

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;
  const admin = createAdminClient();
  if (!admin.ok) return error("SERVER_CONFIG", admin.reason, 500);

  const { data: roundData, error: roundError } = await db
    .from("rounds")
    .select("id, round_functions(id, function_id)")
    .eq("id", roundId)
    .eq("user_id", userId)
    .maybeSingle();
  if (roundError) return error("UPSTREAM", "Couldn't load this round. Try again.", 502);
  if (!roundData) return error("NOT_FOUND", "We couldn't find that round.", 404);
  const round = RoundSchema.parse(roundData);
  const rfIds = round.round_functions.map((rf) => rf.id);
  if (rfIds.length === 0) return error("BAD_REQUEST", "This round has no functions.", 400);

  const [quiz, drills, suggestions] = await Promise.all([
    db.from("quiz_items").select("round_function_id, score").eq("user_id", userId).in("round_function_id", rfIds),
    db.from("drills").select("id, round_function_id, status").eq("user_id", userId).in("round_function_id", rfIds),
    db.from("suggestions").select("round_function_id, reason_score").eq("user_id", userId).in("round_function_id", rfIds),
  ]);
  if (quiz.error || drills.error || suggestions.error) return error("UPSTREAM", "Couldn't load your answers. Try again.", 502);
  const quizRows = QuizRows.parse(quiz.data ?? []);
  const drillRows = DrillRows.parse(drills.data ?? []).filter((d) => d.status === "submitted");
  const suggestionRows = SuggestionRows.parse(suggestions.data ?? []);

  const drillIds = drillRows.map((d) => d.id);
  let findingRows: z.infer<typeof FindingRows> = [];
  let bugRows: z.infer<typeof BugRows> = [];
  if (drillIds.length > 0) {
    const [findings, bugs] = await Promise.all([
      db.from("findings").select("drill_id, outcome, planted_bug_id, explanation_score").eq("user_id", userId).in("drill_id", drillIds),
      admin.data.from("planted_bugs").select("id, drill_id").eq("user_id", userId).in("drill_id", drillIds),
    ]);
    if (findings.error || bugs.error) return error("UPSTREAM", "Couldn't load your drill results. Try again.", 502);
    findingRows = FindingRows.parse(findings.data ?? []);
    bugRows = BugRows.parse(bugs.data ?? []);
  }

  const now = new Date().toISOString();
  const scores = round.round_functions.map((rf) => {
    const drill = drillRows.find((d) => d.round_function_id === rf.id);
    const drillFindings = drill ? findingRows.filter((f) => f.drill_id === drill.id) : [];
    const caught = drillFindings.filter((f) => f.outcome === "caught");
    // Score each caught bug once, by its best explanation.
    const bestByBug = new Map<string, number>();
    for (const f of caught) {
      if (f.planted_bug_id) bestByBug.set(f.planted_bug_id, Math.max(bestByBug.get(f.planted_bug_id) ?? 0, f.explanation_score ?? 0));
    }
    const result = understandingScore({
      quizScores: quizRows.filter((q) => q.round_function_id === rf.id && q.score !== null).map((q) => q.score ?? 0),
      drill: drill
        ? {
            plantedBugs: bugRows.filter((b) => b.drill_id === drill.id).length,
            caughtBugs: bestByBug.size,
            explanationScores: [...bestByBug.values()],
            falseAlarms: drillFindings.filter((f) => f.outcome === "false_alarm").length,
          }
        : null,
      defendScores: suggestionRows.filter((s) => s.round_function_id === rf.id && s.reason_score !== null).map((s) => s.reason_score ?? 0),
    });
    return { functionId: rf.function_id, ...result };
  });

  const { error: upsertError } = await db.from("understanding_scores").upsert(
    scores.map((s) => ({
      user_id: userId,
      function_id: s.functionId,
      score: s.score,
      quiz_part: s.quizPart,
      drill_part: s.drillPart,
      defend_part: s.defendPart,
      updated_at: now,
    })),
    { onConflict: "user_id,function_id" },
  );
  if (upsertError) return error("UPSTREAM", "Couldn't save your scores. Try again.", 502);

  const { error: statusError } = await db
    .from("rounds")
    .update({ status: "completed", submitted_at: now })
    .eq("id", roundId)
    .eq("user_id", userId);
  if (statusError) return error("UPSTREAM", "Couldn't mark the round complete. Try again.", 502);

  const average = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  return NextResponse.json({ ok: true as const, data: { roundId, average, functions: scores } });
}
