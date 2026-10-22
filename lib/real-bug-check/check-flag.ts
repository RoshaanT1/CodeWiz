import type { z } from "zod";

import { buildRealBugPrompt } from "@/lib/ai/prompts/real-bug-check";
import { RealBugStepSchema } from "@/lib/ai/schemas/real-bug-check";

type Llm = <T>(request: {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<{ ok: true; data: T } | { ok: false; reason: string }>;

export type ToolFunction = { alias: string; name: string; file: string; startLine: number; endLine: number; code: string };
export type ToolRef = { alias: string; name: string; file: string };

/** Repo access for the model, by short alias (f1, f2…). The caller owns the alias map. */
export type RealBugTools = {
  getFunction: (alias: string) => Promise<ToolFunction | null>;
  getCallers: (alias: string) => Promise<ToolRef[]>;
  search: (text: string) => Promise<(ToolRef & { line: number; text: string })[]>;
};

export type RealBugVerdict = {
  verdict: "false_alarm" | "possible_real_bug";
  reason: string;
  /** Only evidence lines that exist in the cited function. */
  evidence: { alias: string; line: number }[];
};

const MAX_STEPS = 4;
const MAX_TOOL_LINES = 60;

/**
 * GRADE-3: AI step G as a small tool loop. The model may look up code,
 * callers or search text up to three times, then answers. Evidence lines
 * are checked against the functions; no valid evidence means false_alarm.
 */
export async function checkFlag(
  input: { fn: ToolFunction; flagLine: number; comment: string },
  deps: { llm: Llm; tools: RealBugTools },
): Promise<{ ok: true; data: RealBugVerdict } | { ok: false; reason: string }> {
  const seen = new Map<string, ToolFunction>([[input.fn.alias, input.fn]]);
  const history: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const stepsLeft = MAX_STEPS - step;
    const { systemPrompt, prompt } = buildRealBugPrompt({
      functionAlias: input.fn.alias,
      functionName: input.fn.name,
      code: input.fn.code,
      startLine: input.fn.startLine,
      flagLine: input.flagLine,
      comment: input.comment,
      history,
      stepsLeft,
    });
    const res = await deps.llm({ systemPrompt, prompt, schema: RealBugStepSchema });
    if (!res.ok) return { ok: false, reason: res.reason };
    const action = res.data;

    if (action.action === "answer") {
      const evidence: RealBugVerdict["evidence"] = [];
      for (const item of action.evidence) {
        const fn = seen.get(item.function_id) ?? (await deps.tools.getFunction(item.function_id));
        if (fn && item.line >= fn.startLine && item.line <= fn.endLine) evidence.push({ alias: fn.alias, line: item.line });
      }
      const real = action.verdict === "possible_real_bug" && evidence.length > 0;
      return {
        ok: true,
        data: {
          verdict: real ? "possible_real_bug" : "false_alarm",
          reason: action.verdict === "possible_real_bug" && !real ? "The check couldn't point to code that shows this bug, so it counts as a false alarm." : action.reason,
          evidence: real ? evidence : [],
        },
      };
    }

    if (stepsLeft <= 1) break;
    if (action.action === "get_function") {
      const fn = await deps.tools.getFunction(action.function_id);
      if (fn) seen.set(fn.alias, fn);
      history.push(
        fn
          ? `get_function ${fn.alias} (${fn.name}, ${fn.file}):\n${fn.code
              .split("\n")
              .slice(0, MAX_TOOL_LINES)
              .map((line, i) => `${fn.startLine + i}: ${line}`)
              .join("\n")}`
          : `get_function ${action.function_id}: no such function id.`,
      );
    } else if (action.action === "get_callers") {
      const callers = await deps.tools.getCallers(action.function_id);
      history.push(
        `get_callers ${action.function_id}: ${callers.length ? callers.map((c) => `${c.alias} ${c.name} (${c.file})`).join("; ") : "no callers found"}`,
      );
    } else {
      const hits = await deps.tools.search(action.text);
      history.push(
        `search "${action.text}": ${hits.length ? hits.map((h) => `\n${h.alias} ${h.name} (${h.file}) line ${h.line}: ${h.text.trim().slice(0, 160)}`).join("") : "no matches"}`,
      );
    }
  }

  return { ok: true, data: { verdict: "false_alarm", reason: "The check ran out of steps without finding evidence of a bug.", evidence: [] } };
}
