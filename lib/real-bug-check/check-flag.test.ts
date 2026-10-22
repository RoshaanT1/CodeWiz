import { describe, expect, it, vi } from "vitest";

import { checkFlag, type RealBugTools, type ToolFunction } from "./check-flag";

const FN: ToolFunction = { alias: "f1", name: "parse", file: "a.py", startLine: 10, endLine: 14, code: "def parse(s):\n    n = int(s)\n    return 100 / n\n\n" };
const CALLER: ToolFunction = { alias: "f2", name: "main", file: "b.py", startLine: 1, endLine: 3, code: "def main():\n    parse('0')\n" };

function tools(): RealBugTools {
  return {
    getFunction: vi.fn(async (alias: string) => (alias === "f1" ? FN : alias === "f2" ? CALLER : null)),
    getCallers: vi.fn(async () => [{ alias: "f2", name: "main", file: "b.py" }]),
    search: vi.fn(async () => []),
  };
}

function scripted(...steps: unknown[]) {
  const prompts: string[] = [];
  const llm = vi.fn(async ({ prompt }: { prompt: string }) => {
    prompts.push(prompt);
    return { ok: true as const, data: steps.shift() };
  });
  return { llm: llm as never, prompts, fn: llm };
}

const input = { fn: FN, flagLine: 12, comment: "divides by zero when s is '0'" };

describe("checkFlag", () => {
  it("runs tool calls, then accepts a real bug with valid evidence", async () => {
    const { llm, prompts } = scripted(
      { action: "get_callers", function_id: "f1" },
      { action: "get_function", function_id: "f2" },
      { action: "answer", verdict: "possible_real_bug", reason: "main passes '0', so line 12 divides by zero.", evidence: [{ function_id: "f2", line: 2 }, { function_id: "f1", line: 12 }] },
    );
    const t = tools();
    const result = await checkFlag(input, { llm, tools: t });
    expect(result).toEqual({
      ok: true,
      data: { verdict: "possible_real_bug", reason: "main passes '0', so line 12 divides by zero.", evidence: [{ alias: "f2", line: 2 }, { alias: "f1", line: 12 }] },
    });
    expect(prompts[2]).toContain("get_callers f1: f2 main (b.py)");
    expect(prompts[2]).toContain("2:     parse('0')");
  });

  it("turns a real-bug verdict with no valid evidence into a false alarm", async () => {
    const { llm } = scripted({ action: "answer", verdict: "possible_real_bug", reason: "Trust me.", evidence: [{ function_id: "f1", line: 99 }, { function_id: "f9", line: 1 }] });
    const result = await checkFlag(input, { llm, tools: tools() });
    expect(result).toMatchObject({ ok: true, data: { verdict: "false_alarm", evidence: [] } });
  });

  it("stops after four steps and returns a false alarm", async () => {
    const step = { action: "search", text: "int(" };
    const { llm, fn } = scripted(step, step, step, step, step);
    const result = await checkFlag(input, { llm, tools: tools() });
    expect(result).toMatchObject({ ok: true, data: { verdict: "false_alarm" } });
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("keeps the code and comment inside untrusted delimiters", async () => {
    const { llm, prompts } = scripted({ action: "answer", verdict: "false_alarm", reason: "The line is fine.", evidence: [] });
    await checkFlag(input, { llm, tools: tools() });
    expect(prompts[0]).toContain("=== BEGIN UNTRUSTED CODE DATA ===");
    expect(prompts[0]).toContain("12:     return 100 / n");
    expect(prompts[0]).toContain("=== BEGIN USER COMMENT ===");
  });
});
