import { z } from "zod";

/** AI Contract Step E: Confirm behaviour change. */
export const BehaviourCheckItemSchema = z.object({
  changes_behaviour: z.boolean(),
  why: z.string().min(5),
});

export const ConfirmBehaviourOutputSchema = z.object({
  checks: z.array(BehaviourCheckItemSchema).min(1),
});

export type BehaviourCheckItem = z.infer<typeof BehaviourCheckItemSchema>;
export type ConfirmBehaviourOutput = z.infer<typeof ConfirmBehaviourOutputSchema>;
