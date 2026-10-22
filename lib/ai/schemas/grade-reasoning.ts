import { z } from "zod";

/** AI contract J: grade the user's reasoning about a suggestion. */
export const GradeReasoningSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  feedback: z.string().min(1).max(600),
});

export type GradeReasoning = z.infer<typeof GradeReasoningSchema>;
