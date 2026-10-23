import "server-only";

import type { z } from "zod";

import { callJson } from "@/lib/ai/call-json";

export type JsonLlm = <T>(request: {
  systemPrompt: string;
  prompt: string;
  schema: z.ZodType<T>;
}) => Promise<{ ok: true; data: T } | { ok: false; reason: string }>;

export type AiCallLog = {
  route: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  attempts: number;
  valid: boolean;
};

/**
 * AI-3: a model adapter that logs route, model, tokens, time and validity
 * for every call, and counts calls through `onCall` (for the daily usage row).
 * Never logs prompts, outputs or keys.
 */
export function loggedLlm(options: {
  route: string;
  temperature: number;
  maxTokens: number;
  onCall?: (log: AiCallLog) => void;
}): JsonLlm {
  return async ({ systemPrompt, prompt, schema }) => {
    const started = Date.now();
    const result = await callJson({
      systemPrompt,
      prompt,
      schema,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
    const log: AiCallLog = {
      route: options.route,
      provider: process.env.AI_PROVIDER ?? "openai",
      model: process.env.AI_MODEL ?? "default",
      promptTokens: result.ok ? result.tokens.prompt : 0,
      completionTokens: result.ok ? result.tokens.completion : 0,
      durationMs: result.ok ? result.durationMs : Date.now() - started,
      attempts: result.attempts,
      valid: result.ok,
    };
    console.info(`[ai] ${JSON.stringify(log)}`);
    options.onCall?.(log);
    return result.ok ? { ok: true, data: result.data } : { ok: false, reason: result.reason };
  };
}

/** Collects calls made during one request so the route can record usage once. */
export function callCounter() {
  const calls: AiCallLog[] = [];
  return {
    onCall: (log: AiCallLog) => calls.push(log),
    get count() {
      return calls.length;
    },
    get tokens() {
      return calls.reduce((sum, c) => sum + c.promptTokens + c.completionTokens, 0);
    },
  };
}
