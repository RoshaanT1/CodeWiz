// POST /api/suggestions/[id]/respond: stores the user's agree or disagree
// and reason, and grades the reasoning (AI step J). A reason under 10
// characters scores 0 without a model call.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildGradeReasoningPrompt } from "@/lib/ai/prompts/grade-reasoning";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { GradeReasoningSchema } from "@/lib/ai/schemas/grade-reasoning";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });
const BodySchema = z.object({
  verdict: z.enum(["agree", "disagree"]),
  reason: z.string().trim().max(2000, "Keep your reason under 2000 characters."),
});

const SuggestionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  detail: z.string().nullable(),
  evidence: z.unknown(),
  user_verdict: z.enum(["agree", "disagree"]).nullable(),
  user_reason: z.string().nullable(),
  reason_score: z.number().nullable(),
  feedback: z.string().nullable(),
  round_functions: z.object({ functions: z.object({ code: z.string(), start_line: z.number() }) }),
});

const MIN_REASON_CHARS = 10;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That suggestion id isn't valid.", 400);

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return error("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Send { verdict, reason }.", 400);
    body = parsed.data;
  } catch {
    return error("BAD_REQUEST", "Send your answer as JSON.", 400);
  }

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;

  const { data, error: loadError } = await db
    .from("suggestions")
    .select("id, kind, detail, evidence, user_verdict, user_reason, reason_score, feedback, round_functions(functions(code, start_line))")
    .eq("id", parsedParams.data.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) return error("UPSTREAM", "Couldn't load this suggestion. Try again.", 502);
  if (!data) return error("NOT_FOUND", "We couldn't find that suggestion.", 404);
  const suggestion = SuggestionSchema.safeParse(data);
  if (!suggestion.success) return error("UPSTREAM", "This suggestion's data is incomplete.", 502);
  const s = suggestion.data;

  if (s.user_verdict !== null) {
    return NextResponse.json({ ok: true as const, data: { verdict: s.user_verdict, reason: s.user_reason, reasonScore: s.reason_score, feedback: s.feedback } });
  }

  let score = 0;
  let feedback = "Say why you agree or disagree, in a sentence or two about this code.";
  if (body.reason.length >= MIN_REASON_CHARS) {
    const cap = await checkAiCap(db, userId);
    if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);
    const evidence = s.evidence as { package?: string; functionName?: string } | null;
    const summary = [s.detail ?? "", evidence?.package ? `Suggested: ${evidence.package}${evidence.functionName ? `.${evidence.functionName}` : ""}` : ""].filter(Boolean).join("\n");
    const calls = callCounter();
    const llm = loggedLlm({ route: "suggestion-respond", temperature: 0.1, maxTokens: 400, onCall: calls.onCall });
    const graded = await llm({
      ...buildGradeReasoningPrompt({
        suggestion: summary,
        verdict: body.verdict,
        reason: body.reason,
        code: s.round_functions.functions.code,
        startLine: s.round_functions.functions.start_line,
      }),
      schema: GradeReasoningSchema,
    });
    await recordAiCalls(db, userId, calls.count);
    if (!graded.ok) return error("UPSTREAM", "We couldn't grade your reasoning. Try again.", 502);
    score = graded.data.score;
    feedback = graded.data.feedback;
  }

  const { error: updateError } = await db
    .from("suggestions")
    .update({ user_verdict: body.verdict, user_reason: body.reason, reason_score: score, feedback })
    .eq("id", s.id)
    .eq("user_id", userId)
    .is("user_verdict", null);
  if (updateError) return error("UPSTREAM", "Couldn't save your answer. Try again.", 502);

  return NextResponse.json({ ok: true as const, data: { verdict: body.verdict, reason: body.reason, reasonScore: score, feedback } });
}
