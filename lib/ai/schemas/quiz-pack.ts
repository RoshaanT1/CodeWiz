import { z } from "zod";

/** AI Contract Step B: Quiz pack output schema. */
export const QuizQuestionSchema = z.object({
  kind: z.enum(["purpose", "behaviour", "edge_case", "impact"]),
  question: z.string().min(10),
  rubric: z.object({
    key_points: z.array(z.string()).min(1),
    full_credit: z.string(),
    partial_credit: z.string(),
  }),
  lines: z.array(z.number().int().positive()),
});

export const QuizPackOutputSchema = z.object({
  explanation: z.string().min(20),
  questions: z.array(QuizQuestionSchema).min(2).max(3),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizPackOutput = z.infer<typeof QuizPackOutputSchema>;
