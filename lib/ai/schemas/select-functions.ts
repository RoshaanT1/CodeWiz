import { z } from "zod";

/**
 * AI Contract Step A: Select functions schema.
 * Output shape: picks: a list of { function_id, reason }
 */
export const SelectFunctionPickSchema = z.object({
  function_id: z.string().min(1, "function_id is required"),
  reason: z.string().min(5, "reason must explain why this function was chosen"),
});

export const SelectFunctionsOutputSchema = z.object({
  picks: z
    .array(SelectFunctionPickSchema)
    .min(1, "picks must contain at least one function"),
});

export type SelectFunctionPick = z.infer<typeof SelectFunctionPickSchema>;
export type SelectFunctionsOutput = z.infer<typeof SelectFunctionsOutputSchema>;
