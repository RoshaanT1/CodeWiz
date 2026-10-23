import { z } from "zod";

/** AI Contract Step G: Real-bug check verdict. */
export const RealBugEvidenceSchema = z.object({
  function_id: z.string(),
  line: z.number().int().positive(),
});

export const RealBugCheckOutputSchema = z.object({
  verdict: z.enum(["false_alarm", "possible_real_bug"]),
  reason: z.string().min(5),
  evidence: z.array(RealBugEvidenceSchema),
});

export type RealBugEvidence = z.infer<typeof RealBugEvidenceSchema>;
export type RealBugCheckOutput = z.infer<typeof RealBugCheckOutputSchema>;

/** One step in the tool-loop: either a tool call or the final answer. */
export const RealBugStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("get_function"), function_id: z.string() }),
  z.object({ action: z.literal("get_callers"), function_id: z.string() }),
  z.object({ action: z.literal("search"), text: z.string().min(1) }),
  z.object({
    action: z.literal("answer"),
    verdict: z.enum(["false_alarm", "possible_real_bug"]),
    reason: z.string().min(5),
    evidence: z.array(RealBugEvidenceSchema),
  }),
]);

export type RealBugStep = z.infer<typeof RealBugStepSchema>;
