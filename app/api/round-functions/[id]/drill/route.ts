// POST /api/round-functions/[id]/drill: plants bugs in a copy of the
// function (AI steps D and E), stores the copy in `drills` and the answer key
// in `planted_bugs`. The answer key is never returned here.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter } from "@/lib/ai/logged-llm";
import { plantVerifiedBugs } from "@/lib/ai/plant-bugs";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { bugTypesForLanguage } from "@/lib/bug-planter";
import { weakBugTypes } from "@/lib/scoring/weak-bug-types";
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
    code: z.string(),
    language: z.enum(["python", "javascript", "typescript", "tsx"]),
    start_line: z.number().int().positive(),
    end_line: z.number().int().positive(),
  }),
});

const DrillRowSchema = z.object({
  id: z.string(),
  changed_code: z.string().nullable(),
  status: z.string().nullable(),
});

type DrillView = {
  drillId: string;
  status: "ready" | "skipped" | "submitted";
  code: string | null;
  startLine: number;
  language: string;
  bugCount: number;
};

/** 1 bug for short functions, 2 for medium, 3 for long ones. */
function bugCountFor(lines: number): number {
  if (lines < 15) return 1;
  if (lines < 40) return 2;
  return 3;
}

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
    .select("id, functions(code, language, start_line, end_line)")
    .eq("id", roundFunctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (rfError) return error("UPSTREAM", "Couldn't load this function. Try again.", 502);
  if (!rfData) return error("NOT_FOUND", "We couldn't find that function in your rounds.", 404);
  const roundFunction = RoundFunctionSchema.safeParse(rfData);
  if (!roundFunction.success) return error("UPSTREAM", "This function's stored code is incomplete.", 502);
  const fn = roundFunction.data.functions;

  // Reuse an existing drill so a reload never plants a second set of bugs.
  const { data: existing, error: existingError } = await db
    .from("drills")
    .select("id, changed_code, status")
    .eq("round_function_id", roundFunctionId)
    .eq("user_id", userId)
    .order("id")
    .limit(1)
    .maybeSingle();
  if (existingError) return error("UPSTREAM", "Couldn't check for an existing drill. Try again.", 502);

  const admin = createAdminClient();
  if (!admin.ok) return error("SERVER_CONFIG", admin.reason, 500);

  if (existing) {
    const drill = DrillRowSchema.parse(existing);
    const { count } = await admin.data
      .from("planted_bugs")
      .select("id", { count: "exact", head: true })
      .eq("drill_id", drill.id)
      .eq("user_id", userId);
    return NextResponse.json({ ok: true as const, data: toView(drill, fn, count ?? 0) });
  }

  const { data: skills } = await db.from("skill_scores").select("bug_type, attempts, caught").eq("user_id", userId);
  const weak = weakBugTypes(skills ?? [], bugTypesForLanguage(fn.language));

  const cap = await checkAiCap(db, userId);
  if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

  const calls = callCounter();
  const planted = await plantVerifiedBugs(
    {
      code: fn.code,
      language: fn.language,
      startLine: fn.start_line,
      count: bugCountFor(fn.end_line - fn.start_line + 1),
      weakBugTypes: weak,
    },
    calls.onCall,
  );
  await recordAiCalls(db, userId, calls.count);

  // Another request may have stored a drill while this one was planting: use that one.
  const { data: raced } = await db
    .from("drills")
    .select("id, changed_code, status")
    .eq("round_function_id", roundFunctionId)
    .eq("user_id", userId)
    .order("id")
    .limit(1)
    .maybeSingle();
  if (raced) {
    const drill = DrillRowSchema.parse(raced);
    const { count } = await admin.data.from("planted_bugs").select("id", { count: "exact", head: true }).eq("drill_id", drill.id).eq("user_id", userId);
    return NextResponse.json({ ok: true as const, data: toView(drill, fn, count ?? 0) });
  }

  const { data: inserted, error: insertError } = await db
    .from("drills")
    .insert({
      user_id: userId,
      round_function_id: roundFunctionId,
      changed_code: planted.ok ? planted.changedCode : null,
      status: planted.ok ? "ready" : "skipped",
    })
    .select("id, changed_code, status")
    .single();
  if (insertError || !inserted) return error("UPSTREAM", "Couldn't save the drill. Try again.", 502);
  const drill = DrillRowSchema.parse(inserted);

  if (!planted.ok) {
    console.warn(`[drill] skipped round_function=${roundFunctionId}: ${planted.reason}`);
    return NextResponse.json({ ok: true as const, data: toView(drill, fn, 0) });
  }

  const { error: bugsError } = await admin.data.from("planted_bugs").insert(
    planted.bugs.map((bug) => ({
      user_id: userId,
      drill_id: drill.id,
      line_start: bug.lineStart,
      line_end: bug.lineEnd,
      bug_type: bug.bugType,
      explanation: bug.explanation,
      fix: bug.fix,
    })),
  );
  if (bugsError) {
    await db.from("drills").delete().eq("id", drill.id).eq("user_id", userId);
    return error("UPSTREAM", "Couldn't save the drill's answer key. Try again.", 502);
  }

  return NextResponse.json({ ok: true as const, data: toView(drill, fn, planted.bugs.length) });
}

function toView(
  drill: z.infer<typeof DrillRowSchema>,
  fn: z.infer<typeof RoundFunctionSchema>["functions"],
  bugCount: number,
): DrillView {
  const status = drill.status === "submitted" ? "submitted" : drill.status === "ready" ? "ready" : "skipped";
  return { drillId: drill.id, status, code: drill.changed_code, startLine: fn.start_line, language: fn.language, bugCount };
}
