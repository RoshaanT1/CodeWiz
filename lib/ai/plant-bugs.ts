import "server-only";

import Parser from "web-tree-sitter";

import { loggedLlm, type AiCallLog } from "@/lib/ai/logged-llm";
import { plantBugs, type PlanterLanguage, type PlanterLlm, type PlantBugsOptions, type PlantBugsResult } from "@/lib/bug-planter";
import { loadLanguage } from "@/lib/repo-indexer/parser-loader";

/** Model adapter for the bug planter, using the shared provider wrapper. */
export function planterLlm(onCall?: (log: AiCallLog) => void): PlanterLlm {
  return loggedLlm({ route: "drill", temperature: 0.7, maxTokens: 2000, onCall });
}

function dedent(code: string): string {
  const lines = code.split("\n");
  const indents = lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)?.[0].length ?? 0);
  const min = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(Math.min(min, /^[ \t]*/.exec(l)?.[0].length ?? 0))).join("\n");
}

/** Ways to make an extracted function parse on its own, e.g. a class method. */
const WRAPPERS: Record<PlanterLanguage, ((code: string) => string)[]> = {
  python: [(c) => c, dedent],
  javascript: [(c) => c, (c) => `class __Wrap {\n${c}\n}`],
  typescript: [(c) => c, (c) => `class __Wrap {\n${c}\n}`],
  tsx: [(c) => c, (c) => `class __Wrap {\n${c}\n}`],
};

async function hasSyntaxError(code: string, language: PlanterLanguage): Promise<boolean | null> {
  const loaded = await loadLanguage(language);
  if (!loaded.ok) return null;
  const parser = new Parser();
  try {
    parser.setLanguage(loaded.data);
    const tree = parser.parse(code);
    try {
      return tree.rootNode.hasError();
    } finally {
      tree.delete();
    }
  } finally {
    parser.delete();
  }
}

/**
 * Builds a parse check for one function: finds a wrapper under which the
 * original parses cleanly, then requires the changed code to as well. If no
 * wrapper works, or the grammar can't load, the check is skipped (true).
 */
export function makeParseCheck(original: string) {
  return async (changed: string, language: PlanterLanguage): Promise<boolean> => {
    for (const wrap of WRAPPERS[language]) {
      const originalError = await hasSyntaxError(wrap(original), language);
      if (originalError === null) return true;
      if (!originalError) return (await hasSyntaxError(wrap(changed), language)) === false;
    }
    return true;
  };
}

/** Plants and verifies bugs for one function with the app's model and parser. */
export function plantVerifiedBugs(
  options: Omit<PlantBugsOptions, "llm" | "parse">,
  onCall?: (log: AiCallLog) => void,
): Promise<PlantBugsResult> {
  return plantBugs({ ...options, llm: planterLlm(onCall), parse: makeParseCheck(options.code) });
}
