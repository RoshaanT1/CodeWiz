// POST /api/drills/[id]/submit: grades the user's flags against the answer
// key (GRADE-1), scores each catch's comment (AI step F), checks unmatched
// flags for real bugs (AI step G), stores findings, updates the skill
// profile, then reveals the answer key.
import { NextResponse } from "next/server";
import { z } from "zod";

import { callCounter, loggedLlm } from "@/lib/ai/logged-llm";
import { recordAiCalls } from "@/lib/ai/record-usage";
import { requireApiAal2Session } from "@/lib/auth/session";
import { buildDrillResult, type BugRow, type FindingRow } from "@/lib/grading/drill-result";
import { caughtBugIds, matchFlags } from "@/lib/grading/match-flags";
import { scoreExplanation } from "@/lib/grading/score-explanation";
import { checkFlag } from "@/lib/real-bug-check/check-flag";
import { makeRepoTools } from "@/lib/real-bug-check/repo-tools";
import { addDrillToSkills } from "@/lib/scoring/skill-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "SERVER_CONFIG" | "UPSTREAM";

function error(code: ErrorCode, message: string, status: number) {
  return NextResponse.json({ ok: false as const, error: { code, message } }, { status });
}

const ParamsSchema = z.object({ id: z.uuid() });

const MAX_REAL_BUG_CHECKS = 3;

const BodySchema = z.object({
  flags: z
    .array(z.object({ line: z.number().int().positive(), comment: z.string().trim().max(1000) }))
    .max(30, "You can flag at most 30 lines."),
});

const DrillSchema = z.object({
  id: z.string(),
  changed_code: z.string().nullable(),
  status: z.string().nullable(),
  round_functions: z.object({
    functions: z.object({
      id: z.string(),
      repo_id: z.string(),
      name: z.string(),
      qualified_name: z.string().nullable(),
      file_path: z.string(),
      code: z.string(),
      start_line: z.number().int(),
      end_line: z.number().int(),
    }),
  }),
});

const BugRowSchema = z.object({
  id: z.string(),
  line_start: z.number().int(),
  line_end: z.number().int(),
  bug_type: z.string(),
  explanation: z.string(),
  fix: z.string(),
});

const FindingRowSchema = z.object({
  line: z.number().int(),
  comment: z.string(),
  outcome: z.enum(["caught", "false_alarm", "possible_real_bug"]),
  planted_bug_id: z.string().nullable(),
  explanation_score: z.number().int().nullable(),
  feedback: z.string().nullable(),
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
    if (!parsed.success) return error("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Send your flags as { flags: [{ line, comment }] }.", 400);
    body = parsed.data;
  } catch {
    return error("BAD_REQUEST", "Send your flags as JSON.", 400);
  }

  const client = await createClient();
  if (!client.ok) return error("SERVER_CONFIG", client.reason, 500);
  const db = client.data;
  const admin = createAdminClient();
  if (!admin.ok) return error("SERVER_CONFIG", admin.reason, 500);

  const { data: drillData, error: drillError } = await db
    .from("drills")
    .select("id, changed_code, status, round_functions(functions(id, repo_id, name, qualified_name, file_path, code, start_line, end_line))")
    .eq("id", drillId)
    .eq("user_id", userId)
    .maybeSingle();
  if (drillError) return error("UPSTREAM", "Couldn't load this drill. Try again.", 502);
  if (!drillData) return error("NOT_FOUND", "We couldn't find that drill.", 404);
  const drill = DrillSchema.safeParse(drillData);
  if (!drill.success || drill.data.changed_code === null) {
    return error("CONFLICT", "This drill has no code to review.", 409);
  }
  const fn = drill.data.round_functions.functions;
  const changedCode = drill.data.changed_code;

  const { data: bugData, error: bugError } = await admin.data
    .from("planted_bugs")
    .select("id, line_start, line_end, bug_type, explanation, fix")
    .eq("drill_id", drillId)
    .eq("user_id", userId);
  if (bugError) return error("UPSTREAM", "Couldn't load the answer key. Try again.", 502);
  const bugs: BugRow[] = z.array(BugRowSchema).parse(bugData ?? []);

  const respond = (findings: FindingRow[]) =>
    NextResponse.json({
      ok: true as const,
      data: buildDrillResult({ bugs, findings, originalCode: fn.code, changedCode, startLine: fn.start_line }),
    });

  // Already graded: return the stored result instead of grading twice.
  if (drill.data.status === "submitted") {
    const { data: stored, error: storedError } = await db
      .from("findings")
      .select("line, comment, outcome, planted_bug_id, explanation_score, feedback")
      .eq("drill_id", drillId)
      .eq("user_id", userId);
    if (storedError) return error("UPSTREAM", "Couldn't load your results. Try again.", 502);
    return respond(z.array(FindingRowSchema).parse(stored ?? []));
  }

  const outside = body.flags.find((f) => f.line < fn.start_line || f.line > fn.end_line);
  if (outside) return error("BAD_REQUEST", `Line ${outside.line} isn't part of this function.`, 400);

  const matches = matchFlags(
    body.flags,
    bugs.map((b) => ({ id: b.id, lineStart: b.line_start, lineEnd: b.line_end })),
  );
  const calls = callCounter();
  const llm = loggedLlm({ route: "drill-submit", temperature: 0.1, maxTokens: 400, onCall: calls.onCall });
  const changedLines = changedCode.split("\n");

  // AI step G runs on the first few unmatched flags only, to cap the cost.
  const repoTools = makeRepoTools(db, userId, fn.repo_id);
  const startFunction = repoTools.toFunction({ ...fn, qualified_name: fn.qualified_name });
  const checkLlm = loggedLlm({ route: "drill-real-bug", temperature: 0.1, maxTokens: 500, onCall: calls.onCall });
  const toCheck = new Set(matches.filter((m) => m.outcome === "unmatched").slice(0, MAX_REAL_BUG_CHECKS).map((m) => m.flag));
  const evidenceByLine = new Map<number, { function_id: string; line: number }[]>();

  const findings: FindingRow[] = await Promise.all(
    matches.map(async (match): Promise<FindingRow> => {
      if (match.outcome === "unmatched") {
        const falseAlarm: FindingRow = {
          line: match.flag.line,
          comment: match.flag.comment,
          outcome: "false_alarm",
          planted_bug_id: null,
          explanation_score: null,
          feedback: "No planted bug was on or next to this line.",
        };
        if (!toCheck.has(match.flag)) return falseAlarm;
        const checked = await checkFlag({ fn: startFunction, flagLine: match.flag.line, comment: match.flag.comment }, { llm: checkLlm, tools: repoTools.tools });
        if (!checked.ok) return falseAlarm;
        if (checked.data.verdict === "possible_real_bug") {
          evidenceByLine.set(
            match.flag.line,
            checked.data.evidence.flatMap((e) => {
              const id = repoTools.idOf(e.alias);
              return id ? [{ function_id: id, line: e.line }] : [];
            }),
          );
        }
        return {
          ...falseAlarm,
          outcome: checked.data.verdict,
          feedback: `${checked.data.verdict === "possible_real_bug" ? "Possible real bug (AI check, not confirmed): " : "No planted bug here. "}${checked.data.reason}`,
        };
      }
      const bug = bugs.find((b) => b.id === match.bugId);
      if (!bug) throw new Error("matched bug missing");
      const from = Math.max(fn.start_line, bug.line_start - 1);
      const to = Math.min(fn.end_line, bug.line_end + 1);
      const scored = await scoreExplanation(
        {
          bugType: bug.bug_type,
          keyExplanation: bug.explanation,
          changedLines: changedLines.slice(from - fn.start_line, to - fn.start_line + 1).join("\n"),
          changedStartLine: from,
          comment: match.flag.comment,
        },
        llm,
      );
      return {
        line: match.flag.line,
        comment: match.flag.comment,
        outcome: "caught",
        planted_bug_id: bug.id,
        explanation_score: scored.ok ? scored.data.score : null,
        feedback: scored.ok ? scored.data.feedback : "We couldn't score this comment right now, but the catch counts.",
      };
    }),
  );
  await recordAiCalls(db, userId, calls.count);

  if (findings.length > 0) {
    const { error: insertError } = await db
      .from("findings")
      .insert(findings.map((f) => ({ ...f, user_id: userId, drill_id: drillId, evidence: evidenceByLine.get(f.line) ?? null })));
    if (insertError) return error("UPSTREAM", "Couldn't save your flags. Try again.", 502);
  }

  const { data: claimed, error: statusError } = await db
    .from("drills")
    .update({ status: "submitted" })
    .eq("id", drillId)
    .eq("user_id", userId)
    .neq("status", "submitted")
    .select("id");
  if (statusError) return error("UPSTREAM", "Couldn't finish grading. Try again.", 502);

  // Only the request that flipped the status updates the skill profile.
  if (claimed && claimed.length > 0 && bugs.length > 0) {
    const types = [...new Set(bugs.map((b) => b.bug_type))];
    const { data: skillData } = await db
      .from("skill_scores")
      .select("bug_type, attempts, caught")
      .eq("user_id", userId)
      .in("bug_type", types);
    const existing = z
      .array(z.object({ bug_type: z.string(), attempts: z.number(), caught: z.number() }))
      .parse(skillData ?? [])
      .map((r) => ({ bugType: r.bug_type, attempts: r.attempts, caught: r.caught }));
    const updated = addDrillToSkills(
      existing,
      bugs.map((b) => ({ id: b.id, bugType: b.bug_type })),
      caughtBugIds(matches),
    );
    const now = new Date().toISOString();
    const { error: skillError } = await db.from("skill_scores").upsert(
      updated.map((r) => ({ user_id: userId, bug_type: r.bugType, attempts: r.attempts, caught: r.caught, updated_at: now })),
      { onConflict: "user_id,bug_type" },
    );
    if (skillError) console.warn(`[drill-submit] skill profile update failed: ${skillError.message}`);
  }

  return respond(findings);
}
