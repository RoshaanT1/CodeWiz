import { z } from "zod";

/** AI Contract Step C: Grade answer output schema. */
export const GradeAnswerOutputSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  feedback: z.string().min(5),
  missed_points: z.array(z.string()),
});

export type GradeAnswerOutput = z.infer<typeof GradeAnswerOutputSchema>;
