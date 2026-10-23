import { z } from "zod";

/** AI contract F: score a caught bug's explanation. */
export const ScoreExplanationSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  feedback: z.string().min(1).max(600),
});

export type ScoreExplanationOutput = z.infer<typeof ScoreExplanationSchema>;
