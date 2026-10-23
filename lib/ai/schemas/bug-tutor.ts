import { z } from "zod";

/** AI contract K: one tutor turn about a planted bug. */
export const BugTutorSchema = z.object({
  /** True once the user's own explanation shows they get the bug. Always false on the first turn. */
  understood: z.boolean(),
  /** The explanation, or feedback on the user's answer plus a fresh explanation. */
  message: z.string().min(20).max(1500),
  /** What the user should answer next in their own words, or null when the lesson is over. */
  question: z.string().min(5).max(300).nullable(),
});

export type BugTutorTurn = z.infer<typeof BugTutorSchema>;
