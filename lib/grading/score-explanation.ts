import type { z } from "zod";

import { buildScoreExplanationPrompt, type ScoreExplanationInput } from "@/lib/ai/prompts/score-explanation";
import { ScoreExplanationOutputSchema, type ScoreExplanationOutput } from "@/lib/ai/schemas/score-explanation";

export type GradingLlm = <T>(request: {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<{ ok: true; data: T } | { ok: false; reason: string }>;

/** Comments shorter than this score 0 without a model call. */
const MIN_COMMENT_CHARS = 3;

/**
 * GRADE-2: AI step F. Scores a caught bug's comment from 0 to 2. Empty
 * comments score 0 in code. A failed model call returns ok: false.
 */
export async function scoreExplanation(
  input: ScoreExplanationInput,
  llm: GradingLlm,
): Promise<{ ok: true; data: ScoreExplanationOutput } | { ok: false; reason: string }> {
  if (input.comment.trim().length < MIN_COMMENT_CHARS) {
    return { ok: true, data: { score: 0, feedback: "You found the line, but didn't say what goes wrong there." } };
  }
  const { systemPrompt, prompt } = buildScoreExplanationPrompt(input);
  return llm({ systemPrompt, prompt, schema: ScoreExplanationOutputSchema });
}
