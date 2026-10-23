import { z } from "zod";

/** AI contract B: explanation plus 2 to 3 questions with rubrics. */
export const QuizQuestionSchema = z.object({
  kind: z.enum(["purpose", "behaviour", "edge_case", "impact"]),
  question: z.string().min(10).max(400),
  rubric: z.object({
    key_points: z.array(z.string().min(3)).min(1).max(5),
    full_credit: z.string().min(5),
    partial_credit: z.string().min(5),
  }),
  lines: z.object({ start: z.number().int().positive(), end: z.number().int().positive() }),
});

export const QuizPackSchema = z.object({
  explanation: z.string().min(40).max(1200),
  questions: z.array(QuizQuestionSchema).min(2).max(3),
});

export type QuizPack = z.infer<typeof QuizPackSchema>;

/** AI contract C: grade one answer against its rubric. */
export const GradeAnswerSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  feedback: z.string().min(1).max(600),
  missed_points: z.array(z.string()).max(5),
});

export type GradeAnswer = z.infer<typeof GradeAnswerSchema>;
