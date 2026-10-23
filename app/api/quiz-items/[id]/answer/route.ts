// POST /api/quiz-items/[id]/answer: grades one answer against its rubric
// (AI step C). An empty answer scores 0 without a model call. Once every
// question for the function is answered, the explanation is returned too.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildGradeAnswerPrompt } from "@/lib/ai/prompts/quiz-pack";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { GradeAnswerSchema } from "@/lib/ai/schemas/quiz-pack";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { toQuizView, type QuizItemRow } from "@/lib/quiz/quiz-view";
import { gradeChoice } from "@/lib/quiz/grade-choice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });
// A written answer, or a multiple-choice pick (0 to 3).
const BodySchema = z.object({
  answer: z.string().max(3000, "Keep your answer under 3000 characters.").optional(),
  choice: z.number().int().min(0).max(3).optional(),
});

const RubricSchema = z.object({
  key_points: z.array(z.string()),
  full_credit: z.string(),
  partial_credit: z.string(),
  // Present on quizzes made after multiple choice was added.
  correct_index: z.number().int().min(0).max(3).optional(),
  why_correct: z.string().optional(),
  best_practice: z.string().optional(),
});

const ItemSchema = z.object({
  id: z.string(),
  round_function_id: z.string(),
  question: z.string().nullable(),
  answer: z.string().nullable(),
  options: z.array(z.string()).nullable().optional(),
  // Legacy rows kept the rubric here; new rows keep it in quiz_answer_keys.
  rubric: RubricSchema.nullable(),
  round_functions: z.object({
    functions: z.object({ id: z.string(), code: z.string(), start_line: z.number(), explanation: z.string().nullable() }),
  }),
});

const ITEM_COLUMNS = "id, kind, question, answer, score, feedback, options, correct_option, recommendation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That question id isn't valid.", 400);

  let answer: string;
  let choice: number | undefined;
  try {
    const body = BodySchema.safeParse(await request.json());
    if (!body.success) return error("BAD_REQUEST", body.error.issues[0]?.message ?? "Send { answer } or { choice }.", 400);
    answer = (body.data.answer ?? "").trim();
    choice = body.data.choice;
  } catch {
    return error("BAD_REQUEST", "Send your answer as JSON.", 400);
  }

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;

  const { data: itemData, error: itemError } = await db
    .from("quiz_items")
    .select("id, round_function_id, question, answer, options, rubric, round_functions(functions(id, code, start_line, explanation))")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (itemError) return error("UPSTREAM", "Couldn't load this question. Try again.", 502);
  if (!itemData) return error("NOT_FOUND", "We couldn't find that question.", 404);
  const item = ItemSchema.safeParse(itemData);
  if (!item.success) return error("UPSTREAM", "This question's data is incomplete.", 502);
  const fn = item.data.round_functions.functions;

  let rubric = item.data.rubric;
  if (!rubric) {
    const admin = createAdminClient();
    if (!admin.ok) return error("SERVER_CONFIG", admin.reason, 500);
    const { data: key } = await admin.data
      .from("quiz_answer_keys")
      .select("rubric")
      .eq("quiz_item_id", item.data.id)
      .eq("user_id", userId)
      .maybeSingle<{ rubric: unknown }>();
    const parsedKey = RubricSchema.safeParse(key?.rubric);
    if (!parsedKey.success) return error("UPSTREAM", "This question's answer key is missing.", 502);
    rubric = parsedKey.data;
  }

  let missedPoints: string[] = [];
  if (item.data.answer === null) {
    let score = 0;
    let feedback = "No answer was given, so this question scores 0.";
    const options = item.data.options ?? null;
    if (choice !== undefined) {
      // Multiple choice: graded in code, no model call.
      if (!options || rubric.correct_index === undefined) return error("BAD_REQUEST", "This question has no multiple-choice options. Answer it in writing.", 400);
      const graded = gradeChoice(choice, rubric.correct_index, options, rubric.why_correct ?? "");
      score = graded.score;
      feedback = graded.feedback;
      answer = options[choice] ?? "";
    } else if (answer) {
      const cap = await checkAiCap(db, userId);
      if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

      const calls = callCounter();
      const llm = loggedLlm({ route: "quiz-answer", temperature: 0.1, maxTokens: 400, onCall: calls.onCall });
      const graded = await llm({
        ...buildGradeAnswerPrompt({ question: item.data.question ?? "", rubric, code: fn.code, startLine: fn.start_line, answer }),
        schema: GradeAnswerSchema,
      });
      await recordAiCalls(db, userId, calls.count);
      if (!graded.ok) return error("UPSTREAM", "We couldn't grade that answer. Try again.", 502);
      score = graded.data.score;
      feedback = graded.data.feedback;
      missedPoints = graded.data.missed_points;
    } else {
      missedPoints = rubric.key_points;
    }
    const { error: updateError } = await db
      .from("quiz_items")
      .update({
        answer,
        score,
        feedback,
        // Revealed now that the question is answered.
        correct_option: rubric.correct_index ?? null,
        recommendation: rubric.best_practice ?? null,
      })
      .eq("id", item.data.id)
      .eq("user_id", userId)
      .is("answer", null);
    if (updateError) return error("UPSTREAM", "Couldn't save your answer. Try again.", 502);
  }

  const { data: rows } = await db
    .from("quiz_items")
    .select(ITEM_COLUMNS)
    .eq("round_function_id", item.data.round_function_id)
    .eq("user_id", userId)
    .order("id");
  const quizRows = (rows ?? []) as QuizItemRow[];
  let explanation = fn.explanation;
  if (!explanation && quizRows.length > 0 && quizRows.every((r) => r.answer !== null)) {
    // Every question is answered: release the explanation kept with the keys.
    const admin = createAdminClient();
    if (admin.ok) {
      const { data: keys } = await admin.data
        .from("quiz_answer_keys")
        .select("rubric")
        .in("quiz_item_id", quizRows.map((r) => r.id))
        .eq("user_id", userId);
      const stored = (keys ?? [])
        .map((k: { rubric: unknown }) => (k.rubric as { explanation?: unknown } | null)?.explanation)
        .find((e): e is string => typeof e === "string" && e.length > 0);
      if (stored) {
        explanation = stored;
        await db.from("functions").update({ explanation: stored }).eq("id", fn.id).eq("user_id", userId);
      }
    }
  }
  const view = toQuizView(quizRows, explanation);
  return NextResponse.json({ ok: true as const, data: { ...view, answeredId: item.data.id, missedPoints } });
}
