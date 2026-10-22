// POST /api/functions/[id]/explain: explains a function outside a round
// (AI step B, explanation only) and marks it explained, which leaves it out
// of future quizzes. A stored explanation is reused without a model call.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildQuizPackPrompt } from "@/lib/ai/prompts/quiz-pack";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { QuizPackOutputSchema } from "@/lib/ai/schemas/quiz-pack";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });

const FunctionSchema = z.object({
  id: z.string(),
  name: z.string(),
  qualified_name: z.string().nullable(),
  file_path: z.string(),
  code: z.string(),
  language: z.string().nullable(),
  start_line: z.number().int().positive(),
  explanation: z.string().nullable(),
});

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That function id isn't valid.", 400);

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;

  const { data, error: loadError } = await db
    .from("functions")
    .select("id, name, qualified_name, file_path, code, language, start_line, explanation")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) return error("UPSTREAM", "Couldn't load this function. Try again.", 502);
  if (!data) return error("NOT_FOUND", "We couldn't find that function.", 404);
  const fn = FunctionSchema.safeParse(data);
  if (!fn.success) return error("UPSTREAM", "This function's stored code is incomplete.", 502);

  let explanation = fn.data.explanation;
  if (!explanation) {
    const cap = await checkAiCap(db, userId);
    if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

    const calls = callCounter();
    const llm = loggedLlm({ route: "explain", temperature: 0.4, maxTokens: 1800, onCall: calls.onCall });
    const result = await llm({
      ...buildQuizPackPrompt({
        code: fn.data.code,
        startLine: fn.data.start_line,
        language: fn.data.language ?? "javascript",
        functionName: fn.data.qualified_name ?? fn.data.name,
        filePath: fn.data.file_path,
        callerSnippets: [],
        calleeNames: [],
      }),
      schema: QuizPackOutputSchema,
    });
    await recordAiCalls(db, userId, calls.count);
    if (!result.ok) return error("UPSTREAM", "We couldn't explain this function right now. Try again.", 502);
    explanation = result.data.explanation;
  }

  const { error: updateError } = await db
    .from("functions")
    .update({ explanation, explained: true })
    .eq("id", fn.data.id)
    .eq("user_id", userId);
  if (updateError) return error("UPSTREAM", "Couldn't save the explanation. Try again.", 502);

  return NextResponse.json({ ok: true as const, data: { functionId: fn.data.id, explanation } });
}
