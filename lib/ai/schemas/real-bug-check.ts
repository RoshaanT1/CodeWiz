import { z } from "zod";

/** AI contract G: one step of the real-bug check, either a tool call or the answer. */
export const RealBugStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("get_function"), function_id: z.string().min(1).max(20) }),
  z.object({ action: z.literal("get_callers"), function_id: z.string().min(1).max(20) }),
  z.object({ action: z.literal("search"), text: z.string().min(2).max(60) }),
  z.object({
    action: z.literal("answer"),
    verdict: z.enum(["false_alarm", "possible_real_bug"]),
    reason: z.string().min(5).max(600),
    evidence: z.array(z.object({ function_id: z.string().min(1).max(20), line: z.number().int().positive() })).max(5),
  }),
]);

export type RealBugStep = z.infer<typeof RealBugStepSchema>;
