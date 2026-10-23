import { z } from "zod";

/**
 * AI contract D: Plant bugs.
 * Output: changed_code and bugs, each with line_start, line_end, bug_type,
 * explanation and fix. Bug types are checked against the catalogue in code.
 */
export const PlantedBugSchema = z.object({
  line_start: z.number().int().positive(),
  line_end: z.number().int().positive(),
  bug_type: z.string().min(1),
  explanation: z.string().min(5),
  fix: z.string().min(1),
});

export const PlantBugsOutputSchema = z.object({
  changed_code: z.string().min(1),
  bugs: z.array(PlantedBugSchema).min(1).max(3),
});

export type PlantedBugOutput = z.infer<typeof PlantedBugSchema>;
export type PlantBugsOutput = z.infer<typeof PlantBugsOutputSchema>;
