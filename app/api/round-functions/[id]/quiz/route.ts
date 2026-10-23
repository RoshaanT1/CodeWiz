// POST /api/round-functions/[id]/quiz: generates the quiz pack (AI step B)
// once, stores questions, rubrics and the explanation, and returns only the
// questions. The explanation is returned after every question is answered.
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildQuizPackPrompt } from "@/lib/ai/prompts/quiz-pack";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { QuizPackSchema, type QuizPack } from "@/lib/ai/schemas/quiz-pack";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { claimGeneration, releaseGeneration, waitForGenerated } from "@/lib/server/generation-claim";
import { toQuizView, type QuizItemRow } from "@/lib/quiz/quiz-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });

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

/** Everything needed to grade an answer and teach afterwards; never sent before the answer. */
function answerKey(q: QuizPack["questions"][number], explanation: string | null) {
  return {
    ...q.rubric,
    lines: q.lines,
    correct_index: q.correct_index,
    why_correct: q.why_correct,
    best_practice: q.best_practice,
    ...(explanation ? { explanation } : {}),
  };
}

const ITEM_COLUMNS = "id, kind, question, answer, score, feedback, options, correct_option, recommendation";
const MAX_CALLER_LINES = 15;

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

  const { data: existing, error: existingError } = await db
    .from("quiz_items")
    .select(ITEM_COLUMNS)
    .eq("round_function_id", roundFunctionId)
    .eq("user_id", userId)
    .order("id");
  if (existingError) return error("UPSTREAM", "Couldn't load the quiz. Try again.", 502);
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true as const, data: toQuizView(existing as QuizItemRow[], fn.explanation) });
  }

  // Context: up to 3 callers (first lines only) and the callee names.
  const [callerLinks, calleeLinks] = await Promise.all([
    db.from("function_calls").select("functions!function_calls_caller_id_fkey(name, code, start_line)").eq("user_id", userId).eq("callee_id", fn.id).limit(3),
    db.from("function_calls").select("functions!function_calls_callee_id_fkey(name)").eq("user_id", userId).eq("caller_id", fn.id).limit(15),
  ]);
  const CallerRows = z.array(z.object({ functions: z.object({ name: z.string(), code: z.string().nullable(), start_line: z.number().nullable() }).nullable() }));
  const CalleeRows = z.array(z.object({ functions: z.object({ name: z.string() }).nullable() }));
  const callers = (CallerRows.safeParse(callerLinks.data ?? []).data ?? []).flatMap((row) =>
    row.functions?.code
      ? [{ name: row.functions.name, code: row.functions.code.split("\n").slice(0, MAX_CALLER_LINES).join("\n"), startLine: row.functions.start_line ?? 1 }]
      : [],
  );
  const calleeNames = (CalleeRows.safeParse(calleeLinks.data ?? []).data ?? []).flatMap((row) => (row.functions ? [row.functions.name] : []));

  const cap = await checkAiCap(db, userId);
  if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

  // Only one request writes this quiz; an overlapping one waits for it.
  const claim = await claimGeneration(db, userId, roundFunctionId, "quiz");
  if (claim === "taken") {
    const found = await waitForGenerated(async () => {
      const { data } = await db.from("quiz_items").select(ITEM_COLUMNS).eq("round_function_id", roundFunctionId).eq("user_id", userId).order("id");
      return data && data.length > 0 ? (data as QuizItemRow[]) : null;
    });
    if (!found) return error("UPSTREAM", "The questions are still being written. Try again in a moment.", 503);
    const { data: fnNow } = await db.from("functions").select("explanation").eq("id", fn.id).maybeSingle<{ explanation: string | null }>();
    return NextResponse.json({ ok: true as const, data: toQuizView(found, fnNow?.explanation ?? null) });
  }
  const fail = async (message: string, status = 502) => {
    if (claim === "claimed") await releaseGeneration(db, userId, roundFunctionId, "quiz");
    return error("UPSTREAM", message, status);
  };

  const calls = callCounter();
  const llm = loggedLlm({ route: "quiz", temperature: 0.5, maxTokens: 3000, onCall: calls.onCall });
  const { systemPrompt, prompt } = buildQuizPackPrompt({
    code: fn.code,
    startLine: fn.start_line,
    language: fn.language ?? "javascript",
    name: fn.qualified_name ?? fn.name,
    file: fn.file_path,
    callers,
    calleeNames,
  });

  // The schema retry lives in callJson; this loop retries once when the
  // line ranges fall outside the function.
  let pack: QuizPack | null = null;
  let issue = "";
  for (let attempt = 0; attempt < 2 && !pack; attempt++) {
    const result = await llm({ systemPrompt, prompt: issue ? `${prompt}\n\nYour last answer had a problem: ${issue}` : prompt, schema: QuizPackSchema });
    if (!result.ok) {
      issue = result.reason;
      continue;
    }
    const bad = result.data.questions.find((q) => q.lines.start < fn.start_line || q.lines.end > fn.end_line || q.lines.start > q.lines.end);
    if (bad) {
      issue = `lines must be between ${fn.start_line} and ${fn.end_line}.`;
      continue;
    }
    pack = result.data;
  }
  await recordAiCalls(db, userId, calls.count);
  if (!pack) return fail("We couldn't write questions for this function. Try again.");

  // Rubrics go in quiz_answer_keys, which has no read policy for signed-in
  // users, so they can't be fetched through the database API before answering.
  // Another request (for example one started before a page reload) may have
  // saved a quiz while this one was waiting on the model: use that one.
  const { data: raced } = await db.from("quiz_items").select(ITEM_COLUMNS).eq("round_function_id", roundFunctionId).eq("user_id", userId).order("id");
  if (raced && raced.length > 0) {
    const { data: fnNow } = await db.from("functions").select("explanation").eq("id", fn.id).maybeSingle<{ explanation: string | null }>();
    return NextResponse.json({ ok: true as const, data: toQuizView(raced as QuizItemRow[], fnNow?.explanation ?? null) });
  }

  const admin = createAdminClient();
  if (!admin.ok) {
    if (claim === "claimed") await releaseGeneration(db, userId, roundFunctionId, "quiz");
    return error("SERVER_CONFIG", admin.reason, 500);
  }
  const questions = pack.questions.map((q) => ({ ...q, id: randomUUID() }));
  const { data: inserted, error: insertError } = await db
    .from("quiz_items")
    .insert(questions.map((q) => ({ id: q.id, user_id: userId, round_function_id: roundFunctionId, kind: q.kind, question: q.question, rubric: null, options: q.options })))
    .select(ITEM_COLUMNS);
  if (insertError || !inserted) {
    console.warn(`[quiz] quiz_items insert failed: ${insertError?.message}`);
    return fail("Couldn't save the quiz. Try again.");
  }
  const { error: keyError } = await admin.data
    .from("quiz_answer_keys")
    .insert(questions.map((q) => ({ quiz_item_id: q.id, user_id: userId, rubric: answerKey(q, pack.explanation) })));
  if (keyError) {
    // Until migration 20250101000300 is applied the table doesn't exist, so
    // keep the rubric on quiz_items as before rather than failing the quiz.
    console.warn(`[quiz] quiz_answer_keys insert failed (${keyError.code}): ${keyError.message}; storing rubrics on quiz_items`);
    const fallbacks = await Promise.all(
      questions.map((q) => db.from("quiz_items").update({ rubric: answerKey(q, null) }).eq("id", q.id).eq("user_id", userId)),
    );
    if (fallbacks.some((r) => r.error)) {
      await db.from("quiz_items").delete().in("id", questions.map((q) => q.id)).eq("user_id", userId);
      return fail("Couldn't save the quiz. Try again.");
    }
    await db.from("functions").update({ explanation: pack.explanation }).eq("id", fn.id).eq("user_id", userId);
  }
  // Otherwise the explanation waits in quiz_answer_keys: functions.explanation
  // is readable by the user, so it's copied there only after the last answer.

  return NextResponse.json({ ok: true as const, data: toQuizView(inserted as QuizItemRow[], pack.explanation) });
}
