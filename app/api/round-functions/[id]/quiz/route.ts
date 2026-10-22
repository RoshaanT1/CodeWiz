// POST /api/round-functions/[id]/quiz: generates the quiz pack (AI step B)
// once, stores questions, rubrics and the explanation, and returns only the
// questions. The explanation is returned after every question is answered.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildQuizPackPrompt } from "@/lib/ai/prompts/quiz-pack";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { QuizPackSchema, type QuizPack } from "@/lib/ai/schemas/quiz-pack";
import { requireApiAal2Session } from "@/lib/auth/session";
import { toQuizView, type QuizItemRow } from "@/lib/quiz/quiz-view";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM";

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

const ITEM_COLUMNS = "id, kind, question, answer, score, feedback";
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

  const calls = callCounter();
  const llm = loggedLlm({ route: "quiz", temperature: 0.5, maxTokens: 1800, onCall: calls.onCall });
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
  if (!pack) return error("UPSTREAM", "We couldn't write questions for this function. Try again.", 502);

  const { data: inserted, error: insertError } = await db
    .from("quiz_items")
    .insert(pack.questions.map((q) => ({ user_id: userId, round_function_id: roundFunctionId, kind: q.kind, question: q.question, rubric: { ...q.rubric, lines: q.lines } })))
    .select(ITEM_COLUMNS);
  if (insertError || !inserted) return error("UPSTREAM", "Couldn't save the quiz. Try again.", 502);
  await db.from("functions").update({ explanation: pack.explanation }).eq("id", fn.id).eq("user_id", userId);

  return NextResponse.json({ ok: true as const, data: toQuizView(inserted as QuizItemRow[], pack.explanation) });
}
