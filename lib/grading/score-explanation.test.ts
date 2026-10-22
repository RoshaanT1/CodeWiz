import { describe, expect, it, vi } from "vitest";

import { scoreExplanation, type GradingLlm } from "./score-explanation";

const INPUT = {
  bugType: "off_by_one",
  keyExplanation: "The loop reads one past the end of the list.",
  changedLines: "for (let i = 0; i <= items.length; i++) {",
  changedStartLine: 12,
  comment: "<= goes past the last item, so it adds undefined",
};

describe("scoreExplanation", () => {
  it("scores an empty comment 0 without calling the model", async () => {
    const llm = vi.fn() as unknown as GradingLlm;
    const result = await scoreExplanation({ ...INPUT, comment: "  " }, llm);
    expect(result).toMatchObject({ ok: true, data: { score: 0 } });
    expect(llm).not.toHaveBeenCalled();
  });

  it("sends the key, the numbered code and the comment as delimited data", async () => {
    const llm = vi.fn(async () => ({ ok: true as const, data: { score: 2, feedback: "Spot on." } }));
    const result = await scoreExplanation(INPUT, llm as unknown as GradingLlm);
    expect(result).toEqual({ ok: true, data: { score: 2, feedback: "Spot on." } });
    const [{ prompt }] = llm.mock.calls[0] as unknown as [{ prompt: string }];
    expect(prompt).toContain("12: for (let i = 0; i <= items.length; i++) {");
    expect(prompt).toContain("=== BEGIN USER COMMENT ===");
    expect(prompt).toContain(INPUT.keyExplanation);
  });

  it("passes a model failure through", async () => {
    const llm = (async () => ({ ok: false as const, reason: "timeout" })) as GradingLlm;
    expect(await scoreExplanation(INPUT, llm)).toEqual({ ok: false, reason: "timeout" });
  });
});
