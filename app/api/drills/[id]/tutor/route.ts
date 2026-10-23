// POST /api/drills/[id]/tutor: one turn of the bug tutor (AI step K). After
// the drill is submitted, the tutor explains a planted bug, asks the user to
// explain it back, and tries another way until they get it. The conversation
// lives in the browser and is sent with each turn.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { buildBugTutorPrompt } from "@/lib/ai/prompts/bug-tutor";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { BugTutorSchema } from "@/lib/ai/schemas/bug-tutor";
import { requireApiAal2Session } from "@/lib/auth/session";
import { checkAiCap } from "@/lib/server/daily-cap";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "SERVER_CONFIG" | "UPSTREAM" | "RATE_LIMITED";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

/** How many times the user can try explaining it back before the tutor gives the full answer. */
const MAX_USER_TURNS = 4;

const ParamsSchema = z.object({ id: z.uuid() });

const BodySchema = z.object({
  lineStart: z.number().int().positive(),
  history: z
    .array(z.object({ role: z.enum(["tutor", "user"]), text: z.string().trim().min(1).max(1500) }))
    .max(MAX_USER_TURNS * 2 + 1),
});

const DrillSchema = z.object({
  id: z.string(),
  changed_code: z.string().nullable(),
  status: z.string().nullable(),
  round_functions: z.object({
    functions: z.object({ code: z.string(), start_line: z.number().int() }),
  }),
});

const BugSchema = z.object({
  line_start: z.number().int(),
  line_end: z.number().int(),
  bug_type: z.string(),
  explanation: z.string(),
  fix: z.string(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireApiAal2Session();
  if (!session.ok) {
    return error(session.status === 401 ? "UNAUTHORIZED" : session.status === 403 ? "FORBIDDEN" : "UPSTREAM", session.reason, session.status);
  }
  const userId = session.data.id;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return error("BAD_REQUEST", "That drill id isn't valid.", 400);
  const drillId = parsedParams.data.id;

  let body: z.infer<typeof BodySchema>;
  try {
    const parsed = BodySchema.safeParse(await request.json());
    if (!parsed.success) return error("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Send { lineStart, history }.", 400);
    body = parsed.data;
  } catch {
    return error("BAD_REQUEST", "Send the conversation as JSON.", 400);
  }
  const userTurns = body.history.filter((m) => m.role === "user").length;
  if (userTurns > MAX_USER_TURNS) return error("BAD_REQUEST", "This lesson has ended. Start it again to go over the bug once more.", 400);
  if (body.history.length > 0 && body.history.at(-1)?.role !== "user") return error("BAD_REQUEST", "Write your answer first.", 400);

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;
  const admin = createAdminClient();
  if (!admin.ok) return error("SERVER_CONFIG", admin.reason, 500);

  const { data: drillData, error: drillError } = await db
    .from("drills")
    .select("id, changed_code, status, round_functions(functions(code, start_line))")
    .eq("id", drillId)
    .eq("user_id", userId)
    .maybeSingle();
  if (drillError) return error("UPSTREAM", "Couldn't load this drill. Try again.", 502);
  if (!drillData) return error("NOT_FOUND", "We couldn't find that drill.", 404);
  const drill = DrillSchema.safeParse(drillData);
  if (!drill.success || drill.data.changed_code === null) return error("CONFLICT", "This drill has no code to review.", 409);
  // The answer key stays hidden until the drill is submitted.
  if (drill.data.status !== "submitted") return error("CONFLICT", "Submit the drill first, or choose \"Show me the bugs\".", 409);
  const fn = drill.data.round_functions.functions;

  const { data: bugData, error: bugError } = await admin.data
    .from("planted_bugs")
    .select("line_start, line_end, bug_type, explanation, fix")
    .eq("drill_id", drillId)
    .eq("user_id", userId)
    .eq("line_start", body.lineStart)
    .maybeSingle();
  if (bugError) return error("UPSTREAM", "Couldn't load this bug. Try again.", 502);
  const bug = BugSchema.safeParse(bugData);
  if (!bug.success) return error("NOT_FOUND", "There's no planted bug on that line.", 404);

  const cap = await checkAiCap(db, userId);
  if (!cap.ok) return error("RATE_LIMITED", cap.reason, 429);

  const slice = (code: string) => code.split("\n").slice(bug.data.line_start - fn.start_line, bug.data.line_end - fn.start_line + 1).join("\n");
  const calls = callCounter();
  const llm = loggedLlm({ route: "drill-tutor", temperature: 0.4, maxTokens: 700, onCall: calls.onCall });
  const turn = await llm({
    ...buildBugTutorPrompt({
      bugType: bug.data.bug_type,
      keyExplanation: bug.data.explanation,
      fix: bug.data.fix,
      originalLines: slice(fn.code),
      changedLines: slice(drill.data.changed_code),
      lineStart: bug.data.line_start,
      changedCode: drill.data.changed_code,
      startLine: fn.start_line,
      history: body.history,
      finalTurn: userTurns >= MAX_USER_TURNS,
    }),
    schema: BugTutorSchema,
  });
  await recordAiCalls(db, userId, calls.count);
  if (!turn.ok) return error("UPSTREAM", "The tutor couldn't answer right now. Try again.", 502);

  // Checks in code: the first turn can't be "understood", and the lesson ends
  // when they understand or run out of tries.
  const understood = userTurns > 0 && turn.data.understood;
  const done = understood || userTurns >= MAX_USER_TURNS;
  return NextResponse.json({
    ok: true as const,
    data: {
      message: turn.data.message,
      question: done ? null : (turn.data.question ?? "In your own words, what goes wrong here, and for which input?"),
      understood,
      done,
      triesLeft: Math.max(0, MAX_USER_TURNS - userTurns),
    },
  });
}
