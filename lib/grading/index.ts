/**
 * lib/grading — drill flag matching (Step F, pure code part) and explanation scoring.
 *
 * A flag "catches" a planted bug if the flagged line is on a planted line
 * or one line either side.
 */

import { callJson } from "@/lib/ai/call-json";
import { ScoreExplanationOutputSchema, type ScoreExplanationOutput } from "@/lib/ai/schemas/score-explanation";

export type PlantedBugRef = {
  id: string;
  lineStart: number;
  lineEnd: number;
  explanation: string;
};

export type UserFlag = {
  line: number;
  comment: string;
};

export type FlagOutcome = {
  line: number;
  comment: string;
  outcome: "caught" | "false_alarm";
  plantedBugId?: string;
};

/**
 * Match user flags against planted bugs.
 * A flag catches a bug if it falls on a planted line or ±1 line.
 */
export function matchFlags(flags: UserFlag[], bugs: PlantedBugRef[]): FlagOutcome[] {
  const matched = new Set<string>();

  return flags.map((flag) => {
    const bug = bugs.find(
      (b) =>
        !matched.has(b.id) &&
        flag.line >= b.lineStart - 1 &&
        flag.line <= b.lineEnd + 1,
    );

    if (bug) {
      matched.add(bug.id);
      return { line: flag.line, comment: flag.comment, outcome: "caught", plantedBugId: bug.id };
    }

    return { line: flag.line, comment: flag.comment, outcome: "false_alarm" };
  });
}

import type { LlmProvider } from "@/lib/ai/call-json";

export type ScoreExplanationInput = {
  answerKeyExplanation: string;
  userComment: string;
  apiKey?: string;
  provider?: LlmProvider;
};

export type ScoreExplanationResult =
  | { ok: true; data: ScoreExplanationOutput; attempts: number }
  | { ok: false; reason: string };

/**
 * AI Step F: Score the user's explanation of a caught bug.
 */
export async function scoreExplanation(input: ScoreExplanationInput): Promise<ScoreExplanationResult> {
  if (!input.userComment.trim()) {
    return {
      ok: true,
      data: { score: 0, feedback: "No explanation was provided." },
      attempts: 0,
    };
  }

  const prompt = `Score this bug explanation.

Answer key explanation: "${input.answerKeyExplanation}"

User's explanation: "${input.userComment}"

Return a JSON object:
{
  "score": 0 | 1 | 2,
  "feedback": "One sentence explaining the score."
}

Scoring: 2 = fully correct; 1 = partially correct; 0 = wrong or missing.
Return valid JSON only.`;

  const result = await callJson({
    prompt,
    schema: ScoreExplanationOutputSchema,
    temperature: 0.1,
    apiKey: input.apiKey,
    provider: input.provider,
  });

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, data: result.data, attempts: result.attempts };
}
