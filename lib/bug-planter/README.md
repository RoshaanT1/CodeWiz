# Verified Bug Planter

Give it a function and get back a copy with 1 to 3 realistic bugs and an answer key. Every bug is thoroughly verified: the diff matches the answer key lines, line counts stay identical, the code still parses, and a second-pass confirmation verifies that runtime behaviour changes.

## What it does

- Plants subtle, educational bugs into functions without altering overall line count.
- In-place editing ensures exact line correspondence between original code and drills.
- Restricts mutations to a curated catalogue of realistic developer mistakes (`off_by_one`, `wrong_condition`, `missing_guard`, `wrong_variable`, `swallowed_error`).
- Enforces strict verification:
  1. Identical line count.
  2. Every changed line matches an answer-key range.
  3. Syntax check (optional AST parser hook).
  4. Second-pass LLM behaviour confirmation.
- Retries automatically once if verification fails.
- Completely self-contained with zero external dependencies and no framework coupling.

## Install

Copy `lib/bug-planter/index.ts` into your TypeScript project:

```bash
npm install zod
```

## Usage Example

```ts
import { plantBugs } from "./lib/bug-planter";

const code = `function calculateDiscount(price, isMember) {
  if (isMember && price > 100) {
    return price * 0.8;
  }
  return price;
}`;

// Provide any LLM caller (OpenAI, Anthropic, Gemini, Groq, local model, etc.)
const result = await plantBugs({
  code,
  language: "javascript",
  startLine: 1,
  count: 1,
  llm: async ({ prompt, systemPrompt, schema }) => {
    // Call your LLM of choice and return structured JSON matching schema
    const raw = await myLlmClient(prompt);
    return { ok: true, data: schema.parse(raw) };
  },
});

if (result.ok) {
  console.log("Mutated Code:\n", result.changedCode);
  console.log("Planted Bugs:\n", result.bugs);
} else {
  console.error("Planting failed:", result.reason);
}
```

## Public API

```ts
export type BugType =
  | "off_by_one"
  | "wrong_condition"
  | "missing_guard"
  | "wrong_variable"
  | "swallowed_error";

export type PlantedBug = {
  lineStart: number;
  lineEnd: number;
  bugType: BugType;
  explanation: string;
  fix: string;
};

export type PlantBugsOptions = {
  code: string;
  language: string;
  startLine?: number;
  count?: number; // 1 to 3, defaults to 2
  bugTypes?: BugType[];
  llm: LlmFunction;
  parse?: ParseFunction;
};

export function plantBugs(options: PlantBugsOptions): Promise<PlantBugsResult>;
```

## Options and Limits

- **`count`**: 1 to 3 bugs per function.
- **Line count**: Always preserves identical line count to guarantee line-number stability.
- **Bug catalogue**: Restricted to valid bugs; invalid types or hallucinated diffs are rejected.

## Dependencies

- **[zod](https://github.com/colinhacks/zod)** (MIT) - Schema validation.

## Contributors

- Roshaan Tahir
- M Hammad Khan
- Fizzah Abdullah
- Hammad Khan
