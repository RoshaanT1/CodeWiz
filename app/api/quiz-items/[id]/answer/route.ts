import { z } from "zod";
import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeAnswer } from "@/lib/quiz";
import { apiError } from "@/lib/server/responses";
import { getAiConfig } from "@/lib/ai/user-config";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({ answer: z.string().max(5000) });

/**
 * POST /api/quiz-items/[id]/answer
 * QUIZ-2: Grade one quiz answer (Contract C).
 * Empty answers score 0 without an AI call.
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
  const { id: itemId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return apiError("BAD_REQUEST", "Send { answer: string }.", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return apiError("BAD_REQUEST", "answer field is required.", 400);

  const client = await createClient();
  if (!client.ok) return apiError("UPSTREAM", client.reason, 503);

  // Load quiz item with rubric (server-side only).
  const { data: item } = await client.data
    .from("quiz_items")
    .select("id, question, rubric, round_function_id, score")
    .eq("id", itemId).eq("user_id", userId).single();
  if (!item) return apiError("NOT_FOUND", "Quiz item not found.", 404);
  if (item.score !== null) {
    return apiError("BAD_REQUEST", "This question has already been answered.", 400);
  }

  // Load the function code for context.
  const { data: rf } = await client.data
    .from("round_functions").select("function_id").eq("id", item.round_function_id).single();
  const { data: fn } = rf
    ? await client.data.from("functions").select("code, start_line").eq("id", rf.function_id).single()
    : { data: null };

  // Load rubric from server-only quiz_answer_keys via admin client (bypasses RLS),
  // falling back to legacy item.rubric if present.
  let rubric = item.rubric as { key_points: string[]; full_credit: string; partial_credit: string } | null;
  const admin = createAdminClient();
  if (admin.ok) {
    const { data: keyRow } = await admin.data
      .from("quiz_answer_keys")
      .select("rubric")
      .eq("quiz_item_id", itemId)
      .eq("user_id", userId)
      .maybeSingle();
    if (keyRow?.rubric) {
      rubric = keyRow.rubric as { key_points: string[]; full_credit: string; partial_credit: string };
    }
  }

  if (!rubric) {
    return apiError("NOT_FOUND", "Answer key rubric not found for this quiz item.", 404);
  }

  const aiConfig = await getAiConfig();
  const result = await gradeAnswer({
    question: item.question,
    rubric,
    functionCode: fn?.code ?? "",
    startLine: fn?.start_line ?? 1,
    userAnswer: parsed.data.answer,
    apiKey: aiConfig.apiKey,
    provider: aiConfig.provider,
  });

  if (!result.ok) return apiError("AI_ERROR", result.reason, 502);

  // Store answer and grade.
  await client.data.from("quiz_items").update({
    answer: parsed.data.answer,
    score: result.data.score,
    feedback: result.data.feedback,
  }).eq("id", itemId);

  return NextResponse.json({
    ok: true,
    data: {
      score: result.data.score,
      feedback: result.data.feedback,
      missed_points: result.data.missed_points,
    },
  });
}
