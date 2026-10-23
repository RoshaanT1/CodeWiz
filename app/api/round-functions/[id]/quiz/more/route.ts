// POST /api/round-functions/[id]/quiz/more: once every question is answered,
// writes up to 3 more multiple-choice questions on the same function (AI step
// B, practice round). Their answer keys are stored like the first ones, and
// they count toward the function's quiz score.
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildMoreQuestionsPrompt } from "@/lib/ai/prompts/quiz-pack";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { MoreQuestionsSchema, type MoreQuestions } from "@/lib/ai/schemas/quiz-pack";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { answerKey } from "@/lib/quiz/answer-key";
import { toQuizView, type QuizItemRow } from "@/lib/quiz/quiz-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });

/** The first pack plus two practice rounds. */
const MAX_QUIZ_ITEMS = 9;
const MORE_COUNT = 3;

const RoundFunctionSchema = z.object({
  id: z.string(),
  functions: z.object({
    id: z.string(),
    name: z.string(),
    qualified_name: z.string().nullable(),
    file_path: z.string(),
    code: z.string(),
    language: z.string().nullable(),
    start_line: z.number().int().positive(),
    end_line: z.number().int().positive(),
    explanation: z.string().nullable(),
  }),
});

const ITEM_COLUMNS = "id, kind, question, answer, score, feedback, options, correct_option, recommendation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That round function id isn't valid.", 400);
  const roundFunctionId = parsedParams.data.id;

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;
  const admin = createAdminClient();
  if (!admin.ok) return error("SERVER_CONFIG", admin.reason, 500);

  const { data: rfData, error: rfError } = await db
    .from("round_functions")
    .select("id, functions(id, name, qualified_name, file_path, code, language, start_line, end_line, explanation)")
    .eq("id", roundFunctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (rfError) return error("UPSTREAM", "Couldn't load this function. Try again.", 502);
  if (!rfData) return error("NOT_FOUND", "We couldn't find that function in your rounds.", 404);
  const parsed = RoundFunctionSchema.safeParse(rfData);
  if (!parsed.success) return error("UPSTREAM", "This function's stored code is incomplete.", 502);
  const fn = parsed.data.functions;

  const loadItems = async () => {
    const { data, error: loadError } = await db.from("quiz_items").select(ITEM_COLUMNS).eq("round_function_id", roundFunctionId).eq("user_id", userId).order("id");
    return loadError ? null : ((data ?? []) as QuizItemRow[]);
  };
  const items = await loadItems();
  if (!items) return error("UPSTREAM", "Couldn't load the quiz. Try again.", 502);
  if (items.length === 0) return error("CONFLICT", "Start the quiz for this function first.", 409);
  if (items.some((item) => item.answer === null)) return error("CONFLICT", "Answer the open questions first.", 409);
  if (items.length >= MAX_QUIZ_ITEMS) return error("CONFLICT", `That's the most questions for one function (${MAX_QUIZ_ITEMS}). Try the bug drill next.`, 409);

  const cap = await checkAiCap(db, userId);
  if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

  const calls = callCounter();
  const llm = loggedLlm({ route: "quiz-more", temperature: 0.6, maxTokens: 2500, onCall: calls.onCall });
  const { systemPrompt, prompt } = buildMoreQuestionsPrompt({
    code: fn.code,
    startLine: fn.start_line,
    language: fn.language ?? "javascript",
    name: fn.qualified_name ?? fn.name,
    file: fn.file_path,
    asked: items.map((item) => item.question ?? "").filter(Boolean),
    count: Math.min(MORE_COUNT, MAX_QUIZ_ITEMS - items.length),
  });

  // The schema retry lives in callJson; this loop retries once when the
  // line ranges fall outside the function.
  let more: MoreQuestions | null = null;
  let issue = "";
  for (let attempt = 0; attempt < 2 && !more; attempt++) {
    const result = await llm({ systemPrompt, prompt: issue ? `${prompt}\n\nYour last answer had a problem: ${issue}` : prompt, schema: MoreQuestionsSchema });
    if (!result.ok) {
      issue = result.reason;
      continue;
    }
    const bad = result.data.questions.find((q) => q.lines.start < fn.start_line || q.lines.end > fn.end_line || q.lines.start > q.lines.end);
    if (bad) {
      issue = `lines must be between ${fn.start_line} and ${fn.end_line}.`;
      continue;
    }
    more = result.data;
  }
  await recordAiCalls(db, userId, calls.count);
  if (!more) return error("UPSTREAM", "We couldn't write more questions for this function. Try again.", 502);

  // A double click can run two of these at once: only the first one adds questions.
  const now = await loadItems();
  if (!now) return error("UPSTREAM", "Couldn't load the quiz. Try again.", 502);
  if (now.length !== items.length) return NextResponse.json({ ok: true as const, data: toQuizView(now, fn.explanation) });

  const questions = more.questions.slice(0, MAX_QUIZ_ITEMS - items.length).map((q) => ({ ...q, id: randomUUID() }));
  const { error: insertError } = await db
    .from("quiz_items")
    .insert(questions.map((q) => ({ id: q.id, user_id: userId, round_function_id: roundFunctionId, kind: q.kind, question: q.question, rubric: null, options: q.options })));
  if (insertError) {
    console.warn(`[quiz-more] quiz_items insert failed: ${insertError.message}`);
    return error("UPSTREAM", "Couldn't save the new questions. Try again.", 502);
  }
  // Rubrics stay in quiz_answer_keys, which signed-in users can't read.
  const { error: keyError } = await admin.data
    .from("quiz_answer_keys")
    .insert(questions.map((q) => ({ quiz_item_id: q.id, user_id: userId, rubric: answerKey(q, null) })));
  if (keyError) {
    console.warn(`[quiz-more] quiz_answer_keys insert failed: ${keyError.message}`);
    await db.from("quiz_items").delete().in("id", questions.map((q) => q.id)).eq("user_id", userId);
    return error("UPSTREAM", "Couldn't save the new questions. Try again.", 502);
  }

  const after = await loadItems();
  if (!after) return error("UPSTREAM", "Couldn't load the quiz. Try again.", 502);
  return NextResponse.json({ ok: true as const, data: toQuizView(after, fn.explanation) });
}
