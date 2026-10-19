# Typed LLM JSON calls with zod and retry

## Description

One function to get schema-checked JSON from OpenAI or Anthropic. It validates the output with zod, retries once with the errors, and returns a clean result instead of throwing.

## Skills

TypeScript, Node.js

## Custom tags

LLM, zod, OpenAI, Anthropic, structured output, JSON, retry

## What it does

- Prompts OpenAI or Anthropic models for structured JSON output.
- Automatically strips Markdown code fences (e.g., ````json ... ````).
- Validates the returned object against any Zod schema (`z.ZodSchema<T>`).
- If parsing or validation fails, it automatically retries once, feeding the exact Zod validation error issues back to the model.
- Catches network, timeout, and authentication errors, returning a typed `{ ok: true, data }` or `{ ok: false, reason }` result without throwing unhandled exceptions.
- Zero dependencies on application code or specific database schemas — drop it directly into any TypeScript project.

## Public API

```ts
export type CallJsonOptions<T> = {
  prompt: string;
  schema: z.ZodSchema<T>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  provider?: "openai" | "anthropic";
  model?: string;
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

export function callJson<T>(options: CallJsonOptions<T>): Promise<CallJsonResult<T>>;
```

## Install

```bash
npm install zod openai @anthropic-ai/sdk
```

## Setup

Set environment variables for the provider you want to use:

```bash
# For OpenAI
OPENAI_API_KEY=sk-...
AI_PROVIDER=openai          # optional, default is openai
AI_MODEL=gpt-4o-mini        # optional, default is gpt-4o-mini

# For Anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=anthropic
AI_MODEL=claude-3-5-sonnet-20241022
```

## Usage Example

```ts
import { z } from "zod";
import { callJson } from "./call-json";

const UserReviewSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  keyFindings: z.array(z.string()),
});

const result = await callJson({
  prompt: "Review this pull request diff and evaluate quality and risks.",
  schema: UserReviewSchema,
  temperature: 0.2,
});

if (result.ok) {
  console.log("Validated data:", result.data.score, result.data.summary);
  console.log("Took", result.durationMs, "ms and", result.attempts, "attempt(s)");
} else {
  console.error("Call failed:", result.reason);
}
```

## Options and Limits

- Default timeout is 30,000 ms (30 seconds).
- Default temperature is 0.2 for deterministic structured responses.
- Automatic retry is capped at 1 retry (2 total attempts) to prevent burning API credits.
- Both providers use the official client libraries for reliable connection management and token counting.

## Dependencies and Licences

- Zod — MIT: https://github.com/colinhacks/zod
- OpenAI Node SDK — Apache-2.0: https://github.com/openai/openai-node
- Anthropic TypeScript SDK — MIT: https://github.com/anthropics/anthropic-sdk-typescript

## Contributors

Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan

---

## GIG READY block

GIG READY: Typed LLM JSON Calls
Publish at Devmarketplace → Add your Gigs

1. Thumbnail
   Upload docs/gigs/thumbnails/typed-llm-json.png

2. Basic Info
   Title (39/50): Typed LLM JSON calls with zod and retry
   Description (177/200): One function to get schema-checked JSON from OpenAI or Anthropic. It validates the output with zod, retries once with the errors, and returns a clean result instead of throwing.

3. Tech Stack
   Skills (pick the closest ones in the list): TypeScript, Node.js
   Custom tags (7/10, press Enter after each): LLM, zod, OpenAI, Anthropic, structured output, JSON, retry

4. Code Snippet
   Language: TypeScript
   From: lib/ai/call-json.ts, lines 65 to 105

```ts
export async function callJson<T>(
  options: CallJsonOptions<T>,
): Promise<CallJsonResult<T>> {
  const startTime = Date.now();
  const provider =
    options.provider ??
    (process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "openai");

  const defaultModel =
    provider === "anthropic"
      ? "claude-3-5-sonnet-20241022"
      : "gpt-4o-mini";

  const model = options.model ?? process.env.AI_MODEL ?? defaultModel;
  const timeoutMs = options.timeoutMs ?? 30000;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 2000;

  const totalTokens = { prompt: 0, completion: 0 };
  let lastErrorReason = "";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const currentPrompt =
      attempt === 1
        ? options.prompt
        : `${options.prompt}\n\n[ATTENTION: Your previous output failed schema validation]:\n${lastErrorReason}\n\nPlease fix the errors and output ONLY valid JSON.`;

    try {
      // Calls OpenAI or Anthropic, parses JSON, and validates with options.schema.safeParse()
      // ...
    } catch (err) {
      lastErrorReason = String(err);
    }
  }
}
```

5. Read ME
   Open docs/gigs/typed-llm-json.md on GitHub, copy the rendered page and paste it into the editor.

6. After you click Create
   Add the gig link to the tracker in docs/GIGS.md and to the Devpost draft.
