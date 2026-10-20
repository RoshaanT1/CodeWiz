import type { z } from "zod";

import type { PlanterLanguage } from "./catalogue";

/** Caller-supplied model adapter: prompt and schema in, validated JSON out. */
export type PlanterLlm = <T>(request: {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<{ ok: true; data: T } | { ok: false; reason: string }>;

/** Optional parser check: returns false when the code has syntax errors. */
export type PlanterParse = (code: string, language: PlanterLanguage) => boolean | Promise<boolean>;
