# Verified Bug Planter

Give it a function and get back a copy with 1 to 3 realistic bugs, plus an answer key. Every bug is checked before you see it:

- **Same line count.** Bugs are changed in place, so line numbers in the copy match the original exactly.
- **Exact diff.** Every changed line belongs to a listed bug, and every listed bug changes at least one line.
- **Catalogue types only.** Bug types come from a fixed catalogue, filtered by language.
- **Still parses.** An optional `parse` function (for example tree-sitter) rejects copies with syntax errors.
- **Behaviour really changes.** A second model pass confirms each bug changes the result for some input. Bugs that don't are dropped and their original lines restored.

Any failed check retries once with the problems fed back to the model, then returns `{ ok: false, reason }`. It never throws.

It is model-agnostic: you pass in an `llm` function, so it works with OpenAI, Anthropic or anything else that can return JSON.

## Install

Copy the `bug-planter` folder into your project and install its one dependency:

```bash
npm install zod
```

## Setup

Write an `llm` adapter: prompt, system prompt and a zod schema in, validated JSON out. Here it is with the OpenAI SDK:

```ts
import OpenAI from "openai";
import type { PlanterLlm } from "./bug-planter";

const openai = new OpenAI();

export const llm: PlanterLlm = async ({ systemPrompt, prompt, schema }) => {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });
  const parsed = schema.safeParse(JSON.parse(res.choices[0]?.message.content ?? "null"));
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: parsed.error.message };
};
```

For Anthropic, swap only this function. Nothing else changes.

## Usage

```ts
import { plantBugs } from "./bug-planter";
import { llm } from "./llm";

const code = [
  "function sum(items) {",
  "  let total = 0;",
  "  for (let i = 0; i < items.length; i++) {",
  "    total += items[i];",
  "  }",
  "  return total;",
  "}",
].join("\n");

const result = await plantBugs({
  code,
  language: "javascript",
  startLine: 10, // real line number of `code`'s first line in its file
  count: 2,
  weakBugTypes: ["off_by_one"], // planted more often
  llm,
});

if (result.ok) {
  console.log(result.changedCode); // same number of lines as `code`
  for (const bug of result.bugs) {
    console.log(bug.lineStart, bug.lineEnd, bug.bugType, bug.explanation, bug.fix);
  }
} else {
  console.error(result.reason); // checks failed twice, or the model call failed
}
```

## Options

| Option | Type | Notes |
|---|---|---|
| `code` | `string` | The function's source |
| `language` | `"python" \| "javascript" \| "typescript" \| "tsx"` | Picks the allowed bug types |
| `startLine` | `number` | Defaults to 1. Bug line numbers use this offset |
| `count` | `1 \| 2 \| 3` | How many bugs to plant |
| `bugTypes` | `BugType[]` | Optional allow-list. Defaults to every type for the language |
| `weakBugTypes` | `string[]` | Optional. These types are preferred |
| `llm` | `PlanterLlm` | Your model adapter |
| `parse` | `(code, language) => boolean \| Promise<boolean>` | Optional syntax check. Return `false` on errors |

**Bug types:** `off_by_one`, `wrong_condition`, `missing_guard`, `wrong_variable`, `swallowed_error`, `wrong_return`, `unchecked_input`, plus `async_mistake` (JavaScript and TypeScript) and `mutable_default` (Python). `BUG_CATALOGUE` describes each one.

## Limits

- Up to 3 bugs per call, and at most 2 attempts, each making 2 model calls (plant, then confirm).
- The behaviour check is done by a model, not by running the code. Nothing is ever executed.
- Treat the code as untrusted: the prompts wrap it in delimiters and tell the model it is data, not instructions.

## Tests

`index.test.ts` uses a fake `llm` with fixed outputs, including wrong ones, to prove the checks reject bad results. No API keys needed:

```bash
npx vitest run lib/bug-planter
```

## Dependencies

| Package | Licence | Link |
|---|---|---|
| zod | MIT | https://github.com/colinhacks/zod |
| web-tree-sitter (optional, for `parse`) | MIT | https://github.com/tree-sitter/tree-sitter |

## Contributors

Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan
