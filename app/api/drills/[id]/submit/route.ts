import { z } from "zod";
import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchFlags, scoreExplanation } from "@/lib/grading";
import { checkRealBug } from "@/lib/real-bug-check";
import { apiError } from "@/lib/server/responses";
import { getAiConfig } from "@/lib/ai/user-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const FlagSchema = z.object({
  line: z.number().int().positive(),
  comment: z.string().max(2000),
});

const BodySchema = z.object({
  flags: z.array(FlagSchema).max(20),
});

/**
 * POST /api/drills/[id]/submit
 * GRADE-1 + GRADE-2 + GRADE-3: Grade flags, score explanations, run real-bug check.
 * Reveals the answer key after grading.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return apiError(session.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN", session.reason, session.status);
  }
  const userId = session.data.id;
  const { id: drillId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError("BAD_REQUEST", "Send { flags: [{line, comment}] }.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid body.", 400);

  const client = await createClient();
  if (!client.ok) return apiError("UPSTREAM", client.reason, 503);

  const { data: drill } = await client.data
    .from("drills")
    .select("id, status, round_function_id")
    .eq("id", drillId).eq("user_id", userId).single();
  if (!drill) return apiError("NOT_FOUND", "Drill not found.", 404);
  if (drill.status === "submitted") return apiError("BAD_REQUEST", "Drill already submitted.", 400);

  // Load answer key via admin client (server-only).
  const admin = createAdminClient();
  if (!admin.ok) {
    return apiError(
      "SERVER_CONFIG",
      "Supabase service role secret key is missing. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to your .env file from Supabase Dashboard > Project Settings > API > service_role.",
      500,
    );
  }

  const { data: bugs } = await admin.data
    .from("planted_bugs")
    .select("id, line_start, line_end, bug_type, explanation, fix")
    .eq("drill_id", drillId).eq("user_id", userId);

  const bugRefs = (bugs ?? []).map((b) => ({
    id: b.id,
    lineStart: b.line_start,
    lineEnd: b.line_end,
    explanation: b.explanation ?? "",
  }));

  // GRADE-1: Match flags.
  const outcomes = matchFlags(parsed.data.flags, bugRefs);

  // GRADE-2: Score explanations for caught bugs.
  const aiConfig = await getAiConfig();
  const scoredOutcomes = await Promise.all(
    outcomes.map(async (outcome) => {
      if (outcome.outcome !== "caught" || !outcome.plantedBugId) {
        return { ...outcome, explanationScore: null, explanationFeedback: null };
      }
      const bug = bugs?.find((b) => b.id === outcome.plantedBugId);
      const scored = await scoreExplanation({
        answerKeyExplanation: bug?.explanation ?? "",
        userComment: outcome.comment,
        apiKey: aiConfig.apiKey,
        provider: aiConfig.provider,
      });
      return {
        ...outcome,
        explanationScore: scored.ok ? scored.data.score : null,
        explanationFeedback: scored.ok ? scored.data.feedback : null,
      };
    }),
  );

  // Load function for real-bug check context.
  const { data: rf } = await client.data
    .from("round_functions").select("function_id").eq("id", drill.round_function_id).single();

  let availableFunctionIds = new Set<string>();
  let fnData: { id: string; name: string; code: string; startLine: number } | null = null;

  if (rf) {
    const { data: fn } = await client.data
      .from("functions").select("id, name, code, start_line").eq("id", rf.function_id).single();
    if (fn) {
      fnData = { id: fn.id, name: fn.name, code: fn.code ?? "", startLine: fn.start_line ?? 1 };
    }
    const { data: allFns } = await client.data
      .from("functions").select("id").eq("user_id", userId);
    availableFunctionIds = new Set((allFns ?? []).map((f) => f.id));
  }

  // GRADE-3: Real-bug check for false alarms.
  const finalOutcomes = await Promise.all(
    scoredOutcomes.map(async (outcome) => {
      if (outcome.outcome !== "false_alarm" || !fnData) {
        return { ...outcome, outcome: outcome.outcome as "caught" | "false_alarm" | "possible_real_bug", evidence: [] };
      }
      const check = await checkRealBug(
        { flagLine: outcome.line, flagComment: outcome.comment, targetFunction: fnData },
        availableFunctionIds,
      );
      const finalOutcome = check.ok && check.data.verdict === "possible_real_bug"
        ? "possible_real_bug" as const
        : "false_alarm" as const;
      return {
        ...outcome,
        outcome: finalOutcome,
        realBugReason: check.ok ? check.data.reason : null,
        evidence: check.ok ? check.data.evidence : [],
      };
    }),
  );

  // Store findings.
  const findingRows = finalOutcomes.map((o) => ({
    user_id: userId,
    drill_id: drillId,
    line: o.line,
    comment: o.comment,
    outcome: o.outcome,
    planted_bug_id: o.plantedBugId ?? null,
    explanation_score: (o as { explanationScore?: number | null }).explanationScore ?? null,
    feedback: (o as { explanationFeedback?: string | null }).explanationFeedback ?? null,
    evidence: (o as { evidence?: unknown[] }).evidence ?? [],
  }));

  await client.data.from("findings").insert(findingRows);
  await client.data.from("drills").update({ status: "submitted" }).eq("id", drillId);

  // Reveal answer key to the browser now that the drill is submitted.
  const answerKey = (bugs ?? []).map((b) => ({
    lineStart: b.line_start,
    lineEnd: b.line_end,
    bugType: b.bug_type,
    explanation: b.explanation,
    fix: b.fix,
  }));

  return NextResponse.json({
    ok: true,
    data: { outcomes: finalOutcomes, answerKey },
  });
}
