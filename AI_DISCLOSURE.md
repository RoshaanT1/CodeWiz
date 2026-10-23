# AI and Dependency Disclosures

This file lists the AI tools used to build CodeWiz, the AI models the app calls at runtime and what data they receive, the external services it uses, and every dependency with its version and licence.

Versions are the ones installed from `package-lock.json` (checked on 2026-10-23).

---

## AI tools used to build CodeWiz

Parts of this codebase were written with AI coding agents. Every change went in through a pull request, was reviewed and merged by a team member, and passed lint, type check, unit tests and a production build. The core user journey was also checked end to end against a real Supabase project.

| Tool | Model | Used for |
|---|---|---|
| Claude Code (Anthropic) | Claude Opus 5.5 | Bug planting and verification, drill grading, real-bug check, scoring, library check, call map, the core journey (import, rounds, quiz, round flow), UI fixes, and end-to-end tests |
| Antigravity | Gemini | The provider wrapper, the repo indexer, the repository graph and call map, the SQL migrations, and parts of the routes and UI. Auth flows, environment setup and project setup were written by the team |

<!-- Team: add any other assistant used (for example, for the original UI design ported in UI-1). -->

---

## AI models used inside the app

The provider and model are set by `AI_PROVIDER` and `AI_MODEL`. The app was tested with **Google Gemini (`gemini-3.5-flash-lite`)**. `lib/ai/call-json.ts` also supports OpenAI, Anthropic, Groq, OpenRouter and Qwen.

| Step | What it does | Data sent to the provider |
|---|---|---|
| A. Select functions | Picks the round's functions from the top 15 | Function names, files, categories and metrics |
| B. Quiz pack and explanation | 2–3 questions with rubrics, and a plain explanation | The function's code with line numbers, up to 3 caller snippets, callee names |
| C. Grade answer | Scores an answer 0–2 | The question, its rubric, the code, the user's answer |
| D. Plant bugs | Changes 1–3 lines in a copy of the function | The function's code with line numbers |
| E. Confirm behaviour | Checks each planted bug changes behaviour | The original and changed lines |
| F. Score explanation | Scores the user's explanation of a caught bug | The bug's explanation, nearby changed lines, the user's comment |
| G. Real-bug check | Decides whether an unmatched flag is a real bug, using tools | The flagged function, and code or callers it asks for |
| H. Library suggestion | Suggests a library for hand-written code | The function's code |
| J. Grade reasoning | Scores the user's reason for agreeing or disagreeing | The suggestion, the code, the user's reason |

**Never sent:** email addresses, auth tokens, secrets, or other users' data.

**How output is handled:** every response is validated with zod and checked in code (line ranges, IDs, counts, registry lookups) before it's stored or shown. Each step retries once on a schema failure, then fails cleanly. Repository code is sent as delimited data that the model is told not to follow, and it is never run. Every call is logged with route, model, token counts, time and validity, but no content.

---

## External services

| Service | Used for |
|---|---|
| GitHub REST API | Reading public repositories |
| npm registry, PyPI JSON API, docs.python.org | Verifying library suggestions |
| Supabase | Postgres, Auth with TOTP 2FA, Row Level Security |
| Vercel | Hosting |
| The configured AI provider | The steps above |

---

## Runtime dependencies

| Package | Version | Purpose | Licence |
|---|---|---|---|
| `next` | 15.5.28 | App framework (App Router, route handlers) | MIT |
| `react`, `react-dom` | 19.3.1 | UI | MIT |
| `@supabase/supabase-js` | 2.118.0 | Supabase client | MIT |
| `@supabase/ssr` | 0.6.1 | Cookie-based Supabase sessions for Next.js | MIT |
| `zod` | 4.6.7 | Validation of API input and AI output | MIT |
| `openai` | 7.39.0 | OpenAI client; also used for Groq, OpenRouter and Qwen | Apache-2.0 |
| `@anthropic-ai/sdk` | 0.135.0 | Anthropic client | MIT |
| `@google/genai` | 2.30.0 | Gemini client | Apache-2.0 |
| `web-tree-sitter` | 0.20.8 | Static parsing of Python, JavaScript, TypeScript and TSX | MIT |
| `tree-sitter-wasms` | 0.1.11 | Prebuilt tree-sitter grammars (each grammar is MIT) | Unlicense |
| `@xyflow/react` | 12.12.0 | React Flow, used by the call map | MIT |
| `lucide-react` | 0.545.0 | Icons | ISC |
| `@radix-ui/react-slot` | 1.5.0 | shadcn/ui button composition | MIT |
| `class-variance-authority` | 0.7.1 | shadcn/ui component variants | Apache-2.0 |
| `clsx` | 2.1.1 | Class name joining | MIT |
| `tailwind-merge` | 2.6.1 | Tailwind class merging | MIT |
| `tailwindcss-animate` | 1.0.7 | Tailwind animations | MIT |
| `server-only` | 0.0.1 | Keeps server modules out of browser bundles | MIT |

## Development dependencies (not shipped to users)

| Package | Version | Purpose | Licence |
|---|---|---|---|
| `typescript` | 5.9.3 | Type checking | Apache-2.0 |
| `vitest` | 2.1.9 | Unit tests | MIT |
| `eslint`, `eslint-config-next`, `@eslint/eslintrc` | 9.39.5, 15.5.28, 3.3.7 | Linting | MIT |
| `tailwindcss`, `postcss`, `autoprefixer` | 3.4.19, 8.5.31, 10.6.1 | CSS build | MIT |
| `@types/node`, `@types/react`, `@types/react-dom` | 20.19.43, 19.3.0, 19.3.0 | Type definitions | MIT |

## Other material

- The Python standard library module list in `lib/registry-verifier/python-stdlib.ts` was generated from Python 3.11's `sys.stdlib_module_names` (PSF licence).
- No third-party source code is copied into the repository. Open-source packages are used as dependencies under their own licences.
