# Verified Bug Planter for code review practice

## Description

Give it a function and get back a copy with 1 to 3 realistic bugs and an answer key. Every bug is checked: the diff matches the key, the code still parses and the behaviour changes.

## Skills

TypeScript, Node.js

## Custom tags

LLM, code review, bug seeding, jsdiff, tree-sitter, zod, education

## What it does

- Plants subtle, realistic bugs into source functions for developer education and spot-the-bug drills.
- In-place editing ensures exact line count correspondence between the original function and drill copy.
- Enforces a 4-point verification pipeline:
  1. Identical line counts.
  2. Diff touches only listed lines in the answer key.
  3. Syntax check via AST parser.
  4. Second-pass LLM verification to confirm observable behavior change.
- Automatically retries once if any verification check fails.
- Completely lifts out into any project: caller supplies their own LLM adapter (OpenAI, Claude, Gemini, local models) with zero external network or database dependencies.

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
  count?: number; // 1 to 3, default 2
  bugTypes?: BugType[];
  llm: LlmFunction;
  parse?: ParseFunction;
};

export function plantBugs(options: PlantBugsOptions): Promise<PlantBugsResult>;
```

## Install

```bash
npm install zod
```

Copy `lib/bug-planter/index.ts` directly into your application.

---

GIG READY: Verified Bug Planter
Publish at Devmarketplace → Add your Gigs

1. Thumbnail
   Upload docs/gigs/thumbnails/verified-bug-planter.png

2. Basic Info
   Title (45/50): Verified Bug Planter for code review practice
   Description (181/200): Give it a function and get back a copy with 1 to 3 realistic bugs and an answer key. Every bug is checked: the diff matches the key, the code still parses and the behaviour changes.

3. Tech Stack
   Skills (pick the closest ones in the list): TypeScript, Node.js
   Custom tags (7/10, press Enter after each): LLM, code review, bug seeding, jsdiff, tree-sitter, zod, education

4. Code Snippet
   Language: TypeScript
   From: lib/bug-planter/index.ts, lines 65 to 101

```ts
export async function plantBugs(options: PlantBugsOptions): Promise<PlantBugsResult> {
  const count = Math.min(Math.max(options.count ?? 2, 1), 3);
  const startLine = options.startLine ?? 1;

  let lastReason = "Verification failed after two attempts.";
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await runAttempt({ ...options, count, startLine });
    if (result.ok) return result;
    lastReason = result.reason;
  }

  return { ok: false, reason: lastReason };
}
```

5. Read ME
   Open lib/bug-planter/README.md on GitHub, copy the rendered page and paste it into the editor.

6. After you click Create
   Add the gig link to the tracker in docs/GIGS.md and to the Devpost draft.
