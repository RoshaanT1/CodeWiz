import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";

export type LlmProvider = "openai" | "anthropic" | "gemini" | "qwen" | "openrouter" | "groq";

export type CallJsonOptions<T> = {
  /** The user prompt requesting structured JSON. */
  prompt: string;
  /** Zod schema to validate the output against. */
  schema: z.ZodSchema<T>;
  /** Optional system instructions. */
  systemPrompt?: string;
  /** Sampling temperature (default: 0.2 for deterministic/grading, 0.7 for creative). */
  temperature?: number;
  /** Maximum completion tokens to generate. */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 30000). */
  timeoutMs?: number;
  /** Provider to call. Falls back to process.env.AI_PROVIDER or "openai". */
  provider?: LlmProvider;
  /** Model to use. Falls back to process.env.AI_MODEL or sensible default. */
  model?: string;
  /** Optional API key override. If not set, reads OPENAI_API_KEY, ANTHROPIC_API_KEY,
   * GEMINI_API_KEY, DASHSCOPE_API_KEY, OPENROUTER_API_KEY, or GROQ_API_KEY. */
  apiKey?: string;
};

export type CallJsonResult<T> =
  | {
      ok: true;
      data: T;
      tokens: { prompt: number; completion: number };
      durationMs: number;
      attempts: number;
    }
  | {
      ok: false;
      reason: string;
      attempts: number;
    };

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }
  return trimmed;
}

/**
 * Sends a prompt to OpenAI, Anthropic, Google Gemini, Qwen, OpenRouter, or Groq,
 * parses the JSON response, validates it against the provided Zod schema, and
 * automatically retries once if validation fails.
 *
 * Self-contained module with zero application imports — safe to extract as a gig.
 * Qwen, OpenRouter, and Groq reuse the OpenAI SDK with provider-specific baseURLs.
 */
export async function callJson<T>(
  options: CallJsonOptions<T>,
): Promise<CallJsonResult<T>> {
  const startTime = Date.now();
  const envProvider = process.env.AI_PROVIDER?.toLowerCase();
  const provider: LlmProvider =
    options.provider ??
    (envProvider === "gemini"
      ? "gemini"
      : envProvider === "anthropic"
        ? "anthropic"
        : envProvider === "qwen"
          ? "qwen"
          : envProvider === "openrouter"
            ? "openrouter"
            : envProvider === "groq"
              ? "groq"
              : "openai");

  const defaultModel =
    provider === "gemini"
      ? "gemini-3.8-flash"
      : provider === "anthropic"
        ? "claude-3-5-sonnet-20241022"
        : provider === "qwen"
          ? "qwen-plus"
          : provider === "openrouter"
            ? "mistralai/mistral-7b-instruct"
            : provider === "groq"
              ? "openai/gpt-oss-20b"
              : "gpt-4o-mini";

  const model = options.model ?? process.env.AI_MODEL ?? defaultModel;
  const timeoutMs = options.timeoutMs ?? 30000;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 2000;

  const totalTokens = { prompt: 0, completion: 0 };
  let lastErrorReason = "";

  const systemPrompt = [
    options.systemPrompt,
    "You MUST respond ONLY with valid JSON matching the requested schema. Do not wrap with prose, conversational commentary, or explanations outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const currentPrompt =
      attempt === 1
        ? options.prompt
        : `${options.prompt}\n\n[ATTENTION: Your previous output failed schema validation]:\n${lastErrorReason}\n\nPlease fix the errors and output ONLY valid JSON.`;

    try {
      let rawContent = "";

      if (provider === "gemini") {
        const apiKey =
          options.apiKey ??
          process.env.GEMINI_API_KEY ??
          process.env.GOOGLE_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            reason: "GEMINI_API_KEY is not configured.",
            attempts: attempt,
          };
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
          contents: currentPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        });

        const usage = response.usageMetadata;
        if (usage) {
          totalTokens.prompt += usage.promptTokenCount ?? 0;
          totalTokens.completion += usage.candidatesTokenCount ?? 0;
        }

        rawContent = response.text ?? "";
      } else if (provider === "anthropic") {
        const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            reason: "ANTHROPIC_API_KEY is not configured.",
            attempts: attempt,
          };
        }

        const client = new Anthropic({ apiKey, timeout: timeoutMs });
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [{ role: "user", content: currentPrompt }],
        });

        totalTokens.prompt += response.usage.input_tokens;
        totalTokens.completion += response.usage.output_tokens;

        for (const block of response.content) {
          if (block.type === "text") {
            rawContent += block.text;
          }
        }
      } else if (provider === "qwen") {
        const apiKey =
          options.apiKey ??
          process.env.DASHSCOPE_API_KEY ??
          process.env.QWEN_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            reason: "DASHSCOPE_API_KEY is not configured.",
            attempts: attempt,
          };
        }

        // Qwen uses an OpenAI-compatible endpoint — no extra SDK needed.
        const client = new OpenAI({
          apiKey,
          baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          timeout: timeoutMs,
        });
        const response = await client.chat.completions.create({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: currentPrompt },
          ],
          // DashScope does not support response_format:json_object;
          // we rely on the system prompt + extractJsonBlock instead.
        });

        const usage = response.usage;
        if (usage) {
          totalTokens.prompt += usage.prompt_tokens;
          totalTokens.completion += usage.completion_tokens;
        }

        rawContent = response.choices[0]?.message?.content ?? "";
      } else if (provider === "openrouter") {
        const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            reason: "OPENROUTER_API_KEY is not configured.",
            attempts: attempt,
          };
        }

        const client = new OpenAI({
          apiKey,
          baseURL: "https://openrouter.ai/api/v1",
          timeout: timeoutMs,
        });
        const response = await client.chat.completions.create({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: currentPrompt },
          ],
          // Rely on system prompt + extractJsonBlock for universal model compatibility on OpenRouter
        });

        const usage = response.usage;
        if (usage) {
          totalTokens.prompt += usage.prompt_tokens;
          totalTokens.completion += usage.completion_tokens;
        }

        rawContent = response.choices[0]?.message?.content ?? "";
      } else if (provider === "groq") {
        const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            reason: "GROQ_API_KEY is not configured.",
            attempts: attempt,
          };
        }

        const client = new OpenAI({
          apiKey,
          baseURL: "https://api.groq.com/openai/v1",
          timeout: timeoutMs,
        });
        const response = await client.chat.completions.create({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: currentPrompt },
          ],
          // Groq supports json_object mode but only on specific models;
          // rely on system prompt + extractJsonBlock for universal compatibility.
        });

        const usage = response.usage;
        if (usage) {
          totalTokens.prompt += usage.prompt_tokens;
          totalTokens.completion += usage.completion_tokens;
        }

        rawContent = response.choices[0]?.message?.content ?? "";
      } else {
        const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            reason: "OPENAI_API_KEY is not configured.",
            attempts: attempt,
          };
        }

        const client = new OpenAI({ apiKey, timeout: timeoutMs });
        const response = await client.chat.completions.create({
          model,
          temperature,
          max_completion_tokens: maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: currentPrompt },
          ],
          response_format: { type: "json_object" },
        });

        const usage = response.usage;
        if (usage) {
          totalTokens.prompt += usage.prompt_tokens;
          totalTokens.completion += usage.completion_tokens;
        }

        rawContent = response.choices[0]?.message?.content ?? "";
      }

      if (!rawContent.trim()) {
        lastErrorReason = "Model returned empty text output.";
        continue;
      }

      let parsedJson: unknown;
      try {
        const jsonString = extractJsonBlock(rawContent);
        parsedJson = JSON.parse(jsonString);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : "JSON syntax error";
        lastErrorReason = `Failed to parse JSON string: ${msg}\nOutput was: ${rawContent.slice(0, 300)}`;
        continue;
      }

      const parseResult = options.schema.safeParse(parsedJson);
      if (parseResult.success) {
        return {
          ok: true,
          data: parseResult.data,
          tokens: totalTokens,
          durationMs: Date.now() - startTime,
          attempts: attempt,
        };
      }

      const issues = parseResult.error.issues
        .map((issue) => `- ${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("\n");
      lastErrorReason = `Validation errors:\n${issues}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorReason = `LLM request failed: ${msg}`;
    }
  }

  return {
    ok: false,
    reason: `Failed after 2 attempts. ${lastErrorReason}`,
    attempts: 2,
  };
}
