import { z } from "zod";

/**
 * AI contract E: Confirm behaviour change.
 * Output: one verdict per bug, in the order the bugs were sent.
 */
export const BehaviourVerdictSchema = z.object({
  changes_behaviour: z.boolean(),
  why: z.string().min(5),
});

export const ConfirmBehaviourOutputSchema = z.object({
  bugs: z.array(BehaviourVerdictSchema).min(1).max(3),
});

export type ConfirmBehaviourOutput = z.infer<typeof ConfirmBehaviourOutputSchema>;
