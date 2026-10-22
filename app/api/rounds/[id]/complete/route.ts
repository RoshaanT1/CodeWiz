import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeUnderstandingScore } from "@/lib/scoring";
import { apiError } from "@/lib/server/responses";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/rounds/[id]/complete
 * SCORE-1 + SCORE-2 + SCORE-3: Compute understanding scores, update skill profile
 * and mark the round as completed.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return apiError(session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", session.reason, session.status);
  }
  const userId = session.data.id;
  const { id: roundId } = await params;

  const client = await createClient();
  if (!client.ok) return apiError("UPSTREAM", client.reason, 503);

  const { data: round } = await client.data
    .from("rounds").select("id, status, size").eq("id", roundId).eq("user_id", userId).single();
  if (!round) return apiError("NOT_FOUND", "Round not found.", 404);
  if (round.status === "completed") {
    return NextResponse.json({ ok: true, data: { cached: true } });
  }

  const { data: rfs } = await client.data
    .from("round_functions")
    .select("id, function_id")
    .eq("round_id", roundId).eq("user_id", userId);

  const scores: { functionId: string; score: number }[] = [];

  for (const rf of rfs ?? []) {
    // Quiz grades.
    const { data: quizItems } = await client.data
      .from("quiz_items")
      .select("score")
      .eq("round_function_id", rf.id).eq("user_id", userId);
    const quiz = (quizItems ?? [])
      .filter((q) => q.score !== null)
      .map((q) => ({ score: q.score as number }));

    // Drill grades.
    const { data: drill } = await client.data
      .from("drills")
      .select("id")
      .eq("round_function_id", rf.id).eq("user_id", userId).maybeSingle();

    let drillGrade = { caughtCount: 0, totalBugs: 0, avgExplanationScore: 0, falseAlarmCount: 0 };
    if (drill) {
      const { data: findings } = await client.data
        .from("findings")
        .select("outcome, explanation_score")
        .eq("drill_id", drill.id).eq("user_id", userId);

      const allFindings = findings ?? [];
      const caught = allFindings.filter((f) => f.outcome === "caught");
      const falseAlarms = allFindings.filter((f) => f.outcome === "false_alarm").length;
      const admin = createAdminClient();
      let totalBugs = 0;
      let bugTypes: { id: string; bug_type: string }[] = [];
      if (admin.ok) {
        const totalBugsResult = await admin.data
          .from("planted_bugs").select("id", { count: "exact" }).eq("drill_id", drill.id).eq("user_id", userId);
        totalBugs = totalBugsResult.count ?? 0;
        const bugTypesResult = await admin.data
          .from("planted_bugs").select("id, bug_type").eq("drill_id", drill.id).eq("user_id", userId);
        bugTypes = (bugTypesResult.data ?? []) as { id: string; bug_type: string }[];
      }

      const avgExpl =
        caught.length === 0
          ? 0
          : caught.reduce((s, f) => s + (f.explanation_score ?? 0), 0) / caught.length;

      drillGrade = { caughtCount: caught.length, totalBugs, avgExplanationScore: avgExpl, falseAlarmCount: falseAlarms };

      // Update skill_scores.
      for (const bug of bugTypes) {
        const wasCaught = caught.some((f) => f.outcome === "caught");
        await client.data.from("skill_scores").upsert(
          { user_id: userId, bug_type: bug.bug_type, attempts: 1, caught: wasCaught ? 1 : 0 },
          { onConflict: "user_id,bug_type", ignoreDuplicates: false },
        );
      }
    }

    const score = computeUnderstandingScore(quiz, drillGrade);
    scores.push({ functionId: rf.function_id, score });

    await client.data.from("understanding_scores").upsert(
      {
        user_id: userId,
        function_id: rf.function_id,
        score,
        quiz_part: quiz.length === 0 ? 0 : quiz.reduce((s, q) => s + q.score / 2, 0) / quiz.length,
        drill_part: drillGrade.caughtCount / Math.max(drillGrade.totalBugs, 1),
        defend_part: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,function_id" },
    );

    // Mark functions as explained (reviewed).
    await client.data.from("functions").update({ explained: true }).eq("id", rf.function_id);
  }

  await client.data.from("rounds").update({
    status: "completed",
    submitted_at: new Date().toISOString(),
  }).eq("id", roundId);

  return NextResponse.json({ ok: true, data: { scores } });
}
