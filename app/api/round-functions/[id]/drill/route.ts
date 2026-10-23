import { NextResponse } from "next/server";

import { requireApiAal2Session } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { plantBugs, type BugType } from "@/lib/bug-planter";
import { callJson } from "@/lib/ai/call-json";
import { apiError } from "@/lib/server/responses";
import { getAiConfig } from "@/lib/ai/user-config";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/round-functions/[id]/drill
 * DRILL-1 + DRILL-2 + DRILL-3: Plant bugs, verify them, store the drill and answer key.
 * Returns the changed code. The answer key (planted_bugs) never leaves the server.
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

  const { data: rf } = await client.data
    .from("round_functions")
    .select("id, function_id, status")
    .eq("id", rfId).eq("user_id", userId).single();
  if (!rf) return apiError("NOT_FOUND", "Round function not found.", 404);

  // Return cached drill if already created.
  const { data: existing } = await client.data
    .from("drills")
    .select("id, changed_code, status")
    .eq("round_function_id", rfId).eq("user_id", userId).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, data: { id: existing.id, changedCode: existing.changed_code, cached: true } });
  }

  const { data: fn } = await client.data
    .from("functions")
    .select("name, file_path, language, code, start_line")
    .eq("id", rf.function_id).eq("user_id", userId).single();
  if (!fn || !fn.code) return apiError("NOT_FOUND", "Function code not found.", 404);

  // Load skill profile to weight bug types.
  const { data: skillRows } = await client.data
    .from("skill_scores").select("bug_type, attempts, caught").eq("user_id", userId);
  const weak = (skillRows ?? [])
    .filter((r) => r.attempts > 0)
    .sort((a, b) => a.caught / a.attempts - b.caught / b.attempts)
    .slice(0, 3)
    .map((r) => r.bug_type as BugType);

  const aiConfig = await getAiConfig();
  const result = await plantBugs({
    code: fn.code,
    language: fn.language ?? "typescript",
    startLine: fn.start_line ?? 1,
    count: 2,
    bugTypes: weak.length > 0 ? weak : undefined,
    llm: async ({ prompt, systemPrompt, schema, temperature }) =>
      callJson({
        prompt,
        systemPrompt,
        schema,
        temperature,
        apiKey: aiConfig.apiKey,
        provider: aiConfig.provider,
      }),
  });

  if (!result.ok) {
    return apiError("AI_ERROR", `Could not generate drill: ${result.reason}`, 502);
  }

  // Create the drill row (changed code).
  const { data: drill, error: drillErr } = await client.data
    .from("drills")
    .insert({ user_id: userId, round_function_id: rfId, changed_code: result.changedCode, status: "active" })
    .select("id").single();
  if (drillErr || !drill) return apiError("UPSTREAM", "Failed to store drill.", 500);

  // Store answer key via admin client (bypasses RLS — planted_bugs has no read policy).
  const admin = createAdminClient();
  if (!admin.ok) {
    return apiError(
      "SERVER_CONFIG",
      "Supabase service role secret key is missing. Add SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) to your .env file.",
      500,
    );
  }

  const bugRows = result.bugs.map((b) => ({
    user_id: userId,
    drill_id: drill.id,
    line_start: b.lineStart,
    line_end: b.lineEnd,
    bug_type: b.bugType,
    explanation: b.explanation,
    fix: b.fix,
  }));
  await admin.data.from("planted_bugs").insert(bugRows);

  await client.data.from("round_functions").update({ status: "drill_ready" }).eq("id", rfId);

  return NextResponse.json({
    ok: true,
    data: {
      id: drill.id,
      changedCode: result.changedCode,
      bugCount: result.bugs.length,
    },
  }, { status: 201 });
}
