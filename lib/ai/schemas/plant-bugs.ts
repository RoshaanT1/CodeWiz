import { z } from "zod";

const BUG_TYPES = [
  "off_by_one",
  "wrong_condition",
  "missing_guard",
  "wrong_variable",
  "swallowed_error",
  "wrong_return",
  "unchecked_input",
  "async_mistake",
  "mutable_default",
] as const;

/** AI Contract Step D: Plant bugs output schema. */
export const PlantedBugSchema = z.object({
  line_start: z.number().int().positive(),
  line_end: z.number().int().positive(),
  bug_type: z.enum(BUG_TYPES),
  explanation: z.string().min(10),
  fix: z.string().min(5),
});

export const PlantBugsOutputSchema = z.object({
  changed_code: z.string().min(1),
  bugs: z.array(PlantedBugSchema).min(1).max(3),
});

export type PlantedBug = z.infer<typeof PlantedBugSchema>;
export type PlantBugsOutput = z.infer<typeof PlantBugsOutputSchema>;
