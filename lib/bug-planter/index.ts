import type { z } from "zod";

import {
  bugTypesForLanguage,
  weightBugTypes,
  type BugType,
  type PlanterLanguage,
} from "./catalogue";
import { checkPlantedBugs, type PlantedBug } from "./check";
import { buildPlantBugsPrompt } from "./prompt";
import { PlantBugsOutputSchema } from "./schema";

export { BUG_CATALOGUE, BUG_TYPES, bugTypesForLanguage, type BugType, type PlanterLanguage } from "./catalogue";
export type { PlantedBug } from "./check";

/** Caller-supplied model adapter: prompt and schema in, validated JSON out. */
export type PlanterLlm = <T>(request: {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<{ ok: true; data: T } | { ok: false; reason: string }>;

/** Optional parser check: returns false when the code has syntax errors. */
export type PlanterParse = (code: string, language: PlanterLanguage) => boolean | Promise<boolean>;

export type PlantBugsOptions = {
  code: string;
  language: PlanterLanguage;
  /** Real line number of the first line of `code` in its file. */
  startLine?: number;
  /** 1 to 3 bugs. */
  count: number;
  /** Allowed bug types; defaults to every catalogue type for the language. */
  bugTypes?: readonly BugType[];
  /** The user's weak bug types; planting is weighted toward these. */
  weakBugTypes?: readonly string[];
  llm: PlanterLlm;
  parse?: PlanterParse;
};

export type PlantBugsResult =
  | { ok: true; changedCode: string; bugs: PlantedBug[] }
  | { ok: false; reason: string };

const MAX_ATTEMPTS = 2;

/** AI step D: plants 1 to 3 in-place bugs and checks the result. Retries once. */
export async function plantBugs(options: PlantBugsOptions): Promise<PlantBugsResult> {
  const { code, language, startLine = 1, count, weakBugTypes, llm, parse } = options;

  if (!Number.isInteger(count) || count < 1 || count > 3) {
    return { ok: false, reason: "count must be 1, 2 or 3" };
  }
  if (!Number.isInteger(startLine) || startLine < 1) {
    return { ok: false, reason: "startLine must be a positive integer" };
  }
  const languageTypes = bugTypesForLanguage(language);
  const allowed = options.bugTypes
    ? languageTypes.filter((type) => options.bugTypes?.includes(type))
    : languageTypes;
  if (allowed.length === 0) {
    return { ok: false, reason: `No allowed bug types apply to ${language}` };
  }
  const { preferred, others } = weightBugTypes(allowed, weakBugTypes);

  let previousIssues: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { systemPrompt, prompt } = buildPlantBugsPrompt({
      code,
      language,
      startLine,
      count,
      preferred,
      others,
      previousIssues,
    });
    const response = await llm({ systemPrompt, prompt, schema: PlantBugsOutputSchema });
    if (!response.ok) {
      return { ok: false, reason: `Model call failed: ${response.reason}` };
    }

    const checked = checkPlantedBugs({ original: code, startLine, count, allowed, output: response.data });
    if (!checked.ok) {
      previousIssues = checked.issues;
      continue;
    }
    if (parse && !(await parse(checked.changedCode, language))) {
      previousIssues = ["changed_code does not parse. Keep the code syntactically valid."];
      continue;
    }
    return checked;
  }

  return { ok: false, reason: `Planted bugs failed checks: ${previousIssues.join(" ")}` };
}
