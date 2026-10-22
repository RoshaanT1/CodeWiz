import { z } from "zod";

/** AI Contract Step F: Score explanation of a caught bug. */
export const ScoreExplanationOutputSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  feedback: z.string().min(5),
});

export type ScoreExplanationOutput = z.infer<typeof ScoreExplanationOutputSchema>;
