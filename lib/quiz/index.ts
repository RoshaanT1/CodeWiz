import { callJson, type LlmProvider } from "@/lib/ai/call-json";
import { buildQuizPackPrompt } from "@/lib/ai/prompts/quiz-pack";
import { QuizPackOutputSchema, type QuizPackOutput } from "@/lib/ai/schemas/quiz-pack";
import { buildGradeAnswerPrompt } from "@/lib/ai/prompts/grade-answer";
import { GradeAnswerOutputSchema, type GradeAnswerOutput } from "@/lib/ai/schemas/grade-answer";

export type QuizPackInput = {
  functionName: string;
  filePath: string;
  language: string;
  code: string;
  startLine: number;
  callerSnippets?: string[];
  calleeNames?: string[];
  apiKey?: string;
  provider?: LlmProvider;
};

export type QuizPackResult =
  | { ok: true; data: QuizPackOutput; attempts: number }
  | { ok: false; reason: string };

/**
 * AI Step B: Generate a quiz pack for a function.
 * Returns questions, rubrics, and an explanation.
 * The rubrics and explanation are NOT sent to the browser before the user answers.
 */
export async function generateQuizPack(input: QuizPackInput): Promise<QuizPackResult> {
  const { systemPrompt, prompt } = buildQuizPackPrompt(input);

  const result = await callJson({
    prompt,
    systemPrompt,
    schema: QuizPackOutputSchema,
    temperature: 0.5,
    apiKey: input.apiKey,
    provider: input.provider,
  });

  if (!result.ok) return { ok: false, reason: result.reason };

  // Code checks: every line number must be in range.
  const lineCount = input.code.split("\n").length;
  const maxLine = input.startLine + lineCount - 1;
  for (const q of result.data.questions) {
    for (const ln of q.lines) {
      if (ln < input.startLine || ln > maxLine) {
        return { ok: false, reason: `Question references out-of-range line ${ln}.` };
      }
    }
  }

  return { ok: true, data: result.data, attempts: result.attempts };
}

export type GradeAnswerInput = {
  question: string;
  rubric: { key_points: string[]; full_credit: string; partial_credit: string };
  functionCode: string;
  startLine: number;
  userAnswer: string;
  apiKey?: string;
  provider?: LlmProvider;
};

export type GradeAnswerResult =
  | { ok: true; data: GradeAnswerOutput; attempts: number }
  | { ok: false; reason: string };

/**
 * AI Step C: Grade one quiz answer.
 * An empty answer scores 0 without calling the AI.
 */
export async function gradeAnswer(input: GradeAnswerInput): Promise<GradeAnswerResult> {
  if (!input.userAnswer.trim()) {
    return {
      ok: true,
      data: { score: 0, feedback: "No answer was provided.", missed_points: input.rubric.key_points },
      attempts: 0,
    };
  }

  const { systemPrompt, prompt } = buildGradeAnswerPrompt(input);
  const result = await callJson({
    prompt,
    systemPrompt,
    schema: GradeAnswerOutputSchema,
    temperature: 0.1,
    apiKey: input.apiKey,
    provider: input.provider,
  });

  if (!result.ok) return { ok: false, reason: result.reason };
  return { ok: true, data: result.data, attempts: result.attempts };
}
