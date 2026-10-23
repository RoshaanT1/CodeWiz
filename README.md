# CodeWiz

> **Map a GitHub repo. Quiz yourself on the important functions. Spot the bugs.**

CodeWiz imports a public GitHub repository, uses tree-sitter to parse every function, builds a call graph, and then runs AI-powered practice rounds: quiz questions grounded in the real code, and spot-the-bug drills where a real bug was planted in a verified copy of the function. Results feed a per-function understanding score.

Built for the [Devmarketplace Hackathon](https://devmarketplace.dev).

---

## Demo

<!-- TODO before submitting: add the real Vercel URL and the demo video link (DOC-4, DOC-5). -->
Live site and demo video: see the Devpost submission.

---

## Quick start (local)

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Supabase CLI | ≥ 2 (`npm i -g supabase`) |
| A Supabase project | [supabase.com](https://supabase.com) |
| A GitHub personal access token | `repo:read` scope |
| An AI key: Gemini, OpenAI, Anthropic, Groq or OpenRouter | one is enough |

### 1. Clone and install

```bash
git clone https://github.com/RoshaanT1/CodeWiz.git
cd CodeWiz
npm install
```

### 2. Environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | What it is |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase publishable (anon) key |
| `SUPABASE_SECRET_KEY` | ✅ | Supabase secret (service-role) key, server only. `SUPABASE_SERVICE_ROLE_KEY` also works |
| `GITHUB_TOKEN` | ✅ | GitHub token that can read public repos |
| `AI_PROVIDER` | ✅ | `gemini`, `openai`, `anthropic`, `groq`, `openrouter` or `qwen` |
| `AI_MODEL` | optional | For example `gemini-3.5-flash-lite`. Empty uses the provider's default |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` | for your provider | The key for the provider you chose |
| `DAILY_ROUND_LIMIT` | optional | Rounds per user per day (default `10`) |
| `DAILY_AI_CALL_LIMIT` | optional | AI calls per user per day (default `300`) |
| `FEATURE_LIBRARY_CHECK` | optional | `true` shows verified library suggestions |
| `FEATURE_METRICS` | optional | `true` shows the metrics panel on the repo page |

### 3. Database

Link your project and push the migrations:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --include-all
```

This creates all tables, indexes, Row Level Security policies, the server-only `quiz_answer_keys` table and the `increment_usage_rounds` function. `--include-all` is needed because two migrations have older timestamps than one already applied.

### 4. Run locally

```bash
npm run dev
# → http://localhost:3000
```

### 5. Other commands

| Task | Command |
|---|---|
| Lint | `npm run lint` |
| Type-check | `npx tsc --noEmit` |
| Unit tests | `npm run test` |
| Production build | `npm run build` |
| New migration | `npx supabase migration new <name>` |

---

## How it works

```
GitHub URL (or one folder of it) → fetch the file tree and files → tree-sitter parse
  → functions, call graph, metrics, importance (test and trivial functions excluded)
  → AI picks N functions you haven't reviewed, with a reason for each
  → for each function:
      1. Quiz: 2–3 questions on the real code, graded by AI, then a plain explanation
      2. Spot-the-bug drill: AI plants 1–3 bugs in a copy, each one verified
      3. Defend your choices: verified library suggestions you agree or disagree with
  → understanding score = 40% quiz + 40% drill + 20% defend
    (no suggestions → quiz and drill count 50% each)
```

On the repo page you can browse functions, see each one's callers and callees on the **call map**, explore the whole repo in the **repository graph** (git graph, table and canvas views), read a function's **metrics**, or ask for an **explanation** (which leaves that function out of future quizzes). The profile shows understanding per function, catch rate per bug type, coverage per category and past rounds. Drills plant more of the bug types you miss.

### AI steps

| Step | What the AI does | Checked in code |
|---|---|---|
| A | Picks the round's functions from the top 15 | IDs come from the list, no duplicates, right count, falls back to ranking |
| B | Writes 2–3 questions with rubrics, plus the explanation | Question line ranges inside the function |
| C | Grades each answer 0–2 against its rubric | Empty answers score 0 without a model call |
| D | Plants 1–3 bugs in place | Same line count, the diff matches the answer key exactly, catalogue bug types, still parses |
| E | Confirms each bug changes behaviour | Bugs that don't are dropped and their lines restored |
| F | Scores your explanation of a caught bug 0–2 | A flag within one line of a planted bug counts as a catch |
| G | Checks unmatched flags for real bugs, using tools (get code, get callers, search) | Evidence lines must exist; no evidence means a false alarm |
| H | Suggests a library that already does what the function does | Package must exist on npm, PyPI or the Python stdlib and document the function |
| J | Grades your reasoning for agreeing or disagreeing | A well-argued disagreement can score 2 |

All AI output is validated with zod. Each step retries once on a schema failure, then fails cleanly with a message and a retry button. Code from the imported repo is sent as delimited data and never run.

---

## Security

- Every table has Row Level Security. Policies require `user_id = auth.uid()` **and** an AAL2 (2FA) session.
- `planted_bugs` has RLS enabled with **no** authenticated policy — only the service-role admin client can read it.
- Answer keys, rubrics and explanations are never sent to the browser before the user submits. Rubrics live in `quiz_answer_keys`, which signed-in users can't read.
- Daily caps on rounds and AI calls, a per-user rate limit on imports, and security headers (CSP, `X-Frame-Options`, `nosniff`).
- All AI output is validated with Zod before being stored or shown.
- Server-only modules are marked `import "server-only"` and cannot be imported from client components.

---

## Project structure

```
app/
  (auth)/              Sign-in, sign-up, 2FA enrol and verify
  (app)/dashboard/     Repo list, import (optionally one folder), recent rounds
  (app)/repo/[repoId]/ Function list, call map, repository graph, explain, metrics, start a round
  (app)/round/[roundId]/   Quiz → drill → defend your choices, resumes after a reload
  (app)/results/[roundId]/ Round results with each bug's original and changed lines
  (app)/profile/       Understanding scores, skill profile, coverage, past rounds
  api/                 Route handlers (repos, rounds, quiz, drills, suggestions, explain)
components/
  call-map/            React Flow call map (Gig 6)
  repo-graph/          Repository graph: git graph, table and canvas views
  quiz/ drill/ suggestions/ metrics/ results/ round/ repo/ dashboard/
lib/
  ai/                  Provider wrapper, logging, per-step prompts and zod schemas
  repo-indexer/        GitHub fetch, tree-sitter parsing, call graph, metrics (Gig 1)
  bug-planter/         Bug planting and verification (Gig 2)
  registry-verifier/   npm / PyPI / stdlib package verification (Gig 5)
  real-bug-check/      Tool-calling check for unmatched flags
  grading/             Flag matching and explanation scoring
  scoring/             Understanding score, skill profile, coverage, metrics text
  quiz/                Quiz view and round/workspace loaders
  selection/           Ranking and AI function selection
  auth/ supabase/ server/   Sessions and 2FA, Supabase clients, caps and rate limits
supabase/migrations/   Schema, Row Level Security, functions
docs/                  Spec, architecture, decisions, tasks, gig handoffs
```

---

## Team

| Person | Owns |
|---|---|
| Fizzah Abdullah | Auth, UI, quiz, call map |
| M Hammad Khan | Repo indexer, selection, real-bug check, database |
| Roshaan Tahir | AI layer, bug planter, grading, scoring |
| Hammad Khan | Docs, gigs, QA |

---

## Licences

See `AI_DISCLOSURE.md` for all third-party libraries and their licences.
