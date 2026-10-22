# AI and Dependency Disclosures

This document records libraries and external dependencies added to CodeWiz, their purpose, and their licenses. It also lists the AI models used, the steps they power, and what data is sent to each provider.

---

## AI Models

| Step | ID | What it does | Provider options | Data sent |
|---|---|---|---|---|
| A — Function selection | `lib/ai/prompts/select-functions.ts` | Picks the most instructive N functions for a round | OpenAI / Anthropic / Google | Function names, categories, importance scores, code (first 40 lines each) |
| B — Quiz pack | `lib/ai/prompts/generate-quiz.ts` | Generates 3 questions with rubrics and a plain-language explanation | OpenAI / Anthropic / Google | Full function code with line numbers |
| C — Answer grading | `lib/ai/prompts/grade-answer.ts` | Scores each quiz answer 0–2 with feedback | OpenAI / Anthropic / Google | Question, rubric, user's answer |
| D — Bug planting | `lib/ai/prompts/plant-bug.ts` | Rewrites the function with one realistic planted bug | OpenAI / Anthropic / Google | Full function code with line numbers |
| E — Bug verification | `lib/ai/prompts/verify-bug.ts` | Confirms the planted code still parses and behaviour changed | OpenAI / Anthropic / Google | Original and modified function code |
| F — Explanation scoring | `lib/ai/prompts/score-explanation.ts` | Scores the user's explanation of a caught bug 0–2 | OpenAI / Anthropic / Google | Bug description, user's explanation |

**What is never sent to AI providers:** user email addresses, Supabase auth tokens, planted bug answer keys, or any data from other users.

**AI output handling:** All AI responses are validated with Zod before being stored or shown to the user. Each step retries once on schema failure, then fails cleanly.

---

## Runtime Dependencies

| Package | Version | Purpose | License |
|---|---|---|---|
| `zod` | `^3.24.x` | Runtime schema validation at every boundary (API input, AI output, environment variables) | MIT |
| `openai` | `^4.x` | OpenAI API client for structured JSON completions in AI features | Apache-2.0 |
| `@anthropic-ai/sdk` | `^0.39.x` | Anthropic Claude API client for structured JSON completions in AI features | MIT |
| `@google/genai` | `^2.30.x` | Google Gen AI SDK for Gemini models in structured AI features | Apache-2.0 |
| `@xyflow/react` | `^12.x` | React Flow — interactive graph renderer used by the Call Map component (Gig 6) | MIT |
| `web-tree-sitter` | `^0.24.x` | WASM build of tree-sitter for static parsing of Python, JavaScript, TypeScript and TSX | MIT |
| `tree-sitter-python` | `^0.23.x` | Python grammar for web-tree-sitter | MIT |
| `tree-sitter-javascript` | `^0.23.x` | JavaScript grammar for web-tree-sitter | MIT |
| `tree-sitter-typescript` | `^0.23.x` | TypeScript and TSX grammars for web-tree-sitter | MIT |
| `@supabase/ssr` | `^0.5.x` | Supabase client with cookie-based session for Next.js App Router | MIT |
| `@supabase/supabase-js` | `^2.x` | Core Supabase JavaScript client | MIT |
| `diff` (jsdiff) | `^7.x` | Unified-diff verification for planted bug patches | BSD-3-Clause |
| `octokit` | `^4.x` | GitHub API client used by the repo indexer | MIT |
| `react-flow-renderer` / `@xyflow/react` | see above | See above | MIT |

---

## Dev Dependencies (not shipped to users)

| Package | Purpose | License |
|---|---|---|
| `typescript` | Static typing | Apache-2.0 |
| `eslint` | Linting | MIT |
| `tailwindcss` | Utility CSS (compiled at build time, not shipped as a library) | MIT |
| `@testing-library/*` | Unit testing | MIT |
| `vitest` | Test runner | MIT |

---

## Disclosure of AI-generated code

Parts of this codebase were written with the assistance of AI coding agents (Antigravity / Gemini). All AI-generated code was reviewed, tested, and committed by a human team member. The following modules were substantially AI-assisted:

- `lib/ai/` — all prompt files, Zod schemas, and the provider wrapper
- `lib/repo-indexer/` — tree-sitter integration and call-graph extraction
- `lib/bug-planter/` — bug planting and diff verification
- `lib/quiz/` — quiz generation and answer grading
- `lib/grading/` — flag matching and explanation scoring
- `lib/scoring/` — understanding score formula
- `components/call-map/` — React Flow call map component
- `supabase/migrations/` — all SQL migration files
- `app/api/` — all route handlers

Human-authored code: auth flows, environment configuration, project setup, documentation.
