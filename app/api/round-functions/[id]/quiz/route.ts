import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuizPack } from "@/lib/quiz";
import { apiError } from "@/lib/server/responses";
import { getAiConfig } from "@/lib/ai/user-config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/round-functions/[id]/quiz
 * QUIZ-1: Generate quiz pack (questions, rubrics, explanation) for a round function.
 * Rubrics and explanation are stored but NOT returned — only question text and kind.
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
  const { id: rfId } = await params;

  const client = await createClient();
  if (!client.ok) return apiError("UPSTREAM", client.reason, 503);

  // Verify ownership and load the function.
  const { data: rf } = await client.data
    .from("round_functions")
    .select("id, function_id, status, round_id")
    .eq("id", rfId).eq("user_id", userId).single();
  if (!rf) return apiError("NOT_FOUND", "Round function not found.", 404);

  // Check if quiz already generated.
  const { data: existing } = await client.data
    .from("quiz_items").select("id, kind, question").eq("round_function_id", rfId).eq("user_id", userId);
  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, data: { questions: existing, cached: true } });
  }

  const { data: fn } = await client.data
    .from("functions")
    .select("name, file_path, language, code, start_line, qualified_name")
    .eq("id", rf.function_id).eq("user_id", userId).single();
  if (!fn) return apiError("NOT_FOUND", "Function not found.", 404);

  // Load up to 3 caller snippets.
  const { data: callerEdges } = await client.data
    .from("function_calls")
    .select("caller_id")
    .eq("callee_id", rf.function_id)
    .eq("user_id", userId)
    .limit(3);

  let callerSnippets: string[] = [];
  if (callerEdges && callerEdges.length > 0) {
    const callerIds = callerEdges.map((e) => e.caller_id);
    const { data: callers } = await client.data
      .from("functions").select("name, code, start_line").in("id", callerIds);
    callerSnippets = (callers ?? []).map((c) => `// ${c.name}\n${(c.code ?? "").slice(0, 400)}`);
  }

  const aiConfig = await getAiConfig();
  const result = await generateQuizPack({
    functionName: fn.name,
    filePath: fn.file_path,
    language: fn.language ?? "typescript",
    code: fn.code ?? "",
    startLine: fn.start_line ?? 1,
    callerSnippets,
    apiKey: aiConfig.apiKey,
    provider: aiConfig.provider,
  });

  if (!result.ok) return apiError("AI_ERROR", result.reason, 502);

  // Store explanation on the function row.
  await client.data
    .from("functions")
    .update({ explanation: result.data.explanation })
    .eq("id", rf.function_id);

  // Store quiz items in client-accessible table WITHOUT rubrics to protect confidentiality.
  const quizRows = result.data.questions.map((q) => ({
    user_id: userId,
    round_function_id: rfId,
    kind: q.kind,
    question: q.question,
  }));

  const { data: inserted, error: insertErr } = await client.data
    .from("quiz_items").insert(quizRows).select("id, kind, question");

  if (insertErr || !inserted) {
    return apiError("UPSTREAM", "Failed to store quiz items.", 500);
  }

  // Store rubrics in server-only quiz_answer_keys table (zero RLS read policy for client).
  const admin = createAdminClient();
  if (admin.ok) {
    const keyRows = inserted.map((item, idx) => ({
      quiz_item_id: item.id,
      user_id: userId,
      rubric: result.data.questions[idx]?.rubric ?? {},
    }));
    await admin.data.from("quiz_answer_keys").insert(keyRows);
  }

  // Update round function status.
  await client.data.from("round_functions").update({ status: "quiz_ready" }).eq("id", rfId);

  // Return ONLY question text and kind — NOT the rubric or explanation.
  return NextResponse.json({
    ok: true,
    data: {
      questions: (inserted ?? []).map((q) => ({ id: q.id, kind: q.kind, question: q.question })),
    },
  }, { status: 201 });
}
