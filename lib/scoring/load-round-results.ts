import "server-only";

import { z } from "zod";

import { buildDrillResult, type DrillResult, type FindingRow } from "@/lib/grading/drill-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RoundResultFunction = {
  roundFunctionId: string;
  functionId: string;
  name: string;
  file: string;
  score: number | null;
  quiz: { question: string; answer: string; score: number | null; feedback: string | null }[];
  drill: DrillResult | null;
};

export type RoundResultsData = {
  id: string;
  repo: string;
  createdAt: string;
  status: string;
  functions: RoundResultFunction[];
};

const RoundSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: z.string().nullable(),
  repos: z.object({ owner: z.string(), name: z.string() }).nullable(),
  round_functions: z.array(
    z.object({
      id: z.string(),
      function_id: z.string(),
      position: z.number().nullable(),
      functions: z.object({
        name: z.string(),
        qualified_name: z.string().nullable(),
        file_path: z.string(),
        code: z.string(),
        start_line: z.number(),
      }),
    }),
  ),
});
const QuizRows = z.array(
  z.object({
    round_function_id: z.string(),
    question: z.string().nullable(),
    answer: z.string().nullable(),
    score: z.number().nullable(),
    feedback: z.string().nullable(),
  }),
);
const DrillRows = z.array(
  z.object({ id: z.string(), round_function_id: z.string(), changed_code: z.string().nullable(), status: z.string().nullable() }),
);
const FindingRows = z.array(
  z.object({
    drill_id: z.string(),
    line: z.number(),
    comment: z.string(),
    outcome: z.enum(["caught", "false_alarm", "possible_real_bug"]),
    planted_bug_id: z.string().nullable(),
    explanation_score: z.number().nullable(),
    feedback: z.string().nullable(),
  }),
);
const BugRows = z.array(
  z.object({
    id: z.string(),
    drill_id: z.string(),
    line_start: z.number(),
    line_end: z.number(),
    bug_type: z.string(),
    explanation: z.string(),
    fix: z.string(),
  }),
);
const ScoreRows = z.array(z.object({ function_id: z.string(), score: z.number().nullable() }));

/**
 * SCORE-4: one round's results. Answer keys are included only for drills
 * the user has already submitted.
 */
export async function loadRoundResults(
  userId: string,
  roundId: string,
): Promise<{ ok: true; data: RoundResultsData | null } | { ok: false; reason: string }> {
  const client = await createClient();
  if (!client.ok) return client;
  const db = client.data;

  const { data: roundData, error: roundError } = await db
    .from("rounds")
    .select(
      "id, created_at, status, repos(owner, name), round_functions(id, function_id, position, functions(name, qualified_name, file_path, code, start_line))",
    )
    .eq("id", roundId)
    .eq("user_id", userId)
    .maybeSingle();
  if (roundError) return { ok: false, reason: "Couldn't load this round. Try again in a moment." };
  if (!roundData) return { ok: true, data: null };
  const parsed = RoundSchema.safeParse(roundData);
  if (!parsed.success) return { ok: false, reason: "This round's data is incomplete." };
  const round = parsed.data;

  const rfIds = round.round_functions.map((rf) => rf.id);
  const functionIds = round.round_functions.map((rf) => rf.function_id);
  const [quiz, drills, scores] = await Promise.all([
    db.from("quiz_items").select("round_function_id, question, answer, score, feedback").eq("user_id", userId).in("round_function_id", rfIds),
    db.from("drills").select("id, round_function_id, changed_code, status").eq("user_id", userId).in("round_function_id", rfIds),
    db.from("understanding_scores").select("function_id, score").eq("user_id", userId).in("function_id", functionIds),
  ]);
  if (quiz.error || drills.error || scores.error) return { ok: false, reason: "Couldn't load this round's answers." };

  const submitted = DrillRows.parse(drills.data ?? []).filter((d) => d.status === "submitted" && d.changed_code !== null);
  const drillIds = submitted.map((d) => d.id);
  let findingRows: z.infer<typeof FindingRows> = [];
  let bugRows: z.infer<typeof BugRows> = [];
  if (drillIds.length > 0) {
    const admin = createAdminClient();
    if (!admin.ok) return admin;
    const [findings, bugs] = await Promise.all([
      db
        .from("findings")
        .select("drill_id, line, comment, outcome, planted_bug_id, explanation_score, feedback")
        .eq("user_id", userId)
        .in("drill_id", drillIds),
      admin.data
        .from("planted_bugs")
        .select("id, drill_id, line_start, line_end, bug_type, explanation, fix")
        .eq("user_id", userId)
        .in("drill_id", drillIds),
    ]);
    if (findings.error || bugs.error) return { ok: false, reason: "Couldn't load this round's drill results." };
    findingRows = FindingRows.parse(findings.data ?? []);
    bugRows = BugRows.parse(bugs.data ?? []);
  }

  const quizRows = QuizRows.parse(quiz.data ?? []);
  const scoreRows = ScoreRows.parse(scores.data ?? []);

  return {
    ok: true,
    data: {
      id: round.id,
      repo: round.repos ? `${round.repos.owner}/${round.repos.name}` : "Unknown repo",
      createdAt: round.created_at,
      status: round.status ?? "in_progress",
      functions: [...round.round_functions]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((rf) => {
          const drill = submitted.find((d) => d.round_function_id === rf.id);
          const findings: FindingRow[] = drill ? findingRows.filter((f) => f.drill_id === drill.id) : [];
          return {
            roundFunctionId: rf.id,
            functionId: rf.function_id,
            name: rf.functions.qualified_name ?? rf.functions.name,
            file: rf.functions.file_path,
            score: scoreRows.find((s) => s.function_id === rf.function_id)?.score ?? null,
            quiz: quizRows
              .filter((q) => q.round_function_id === rf.id && q.answer !== null)
              .map((q) => ({ question: q.question ?? "", answer: q.answer ?? "", score: q.score, feedback: q.feedback })),
            drill:
              drill && drill.changed_code !== null
                ? buildDrillResult({
                    bugs: bugRows.filter((b) => b.drill_id === drill.id),
                    findings,
                    originalCode: rf.functions.code,
                    changedCode: drill.changed_code,
                    startLine: rf.functions.start_line,
                  })
                : null,
          };
        }),
    },
  };
}
