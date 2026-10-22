# CodeWiz

> **Map a GitHub repo. Quiz yourself on the important functions. Spot the bugs.**

CodeWiz imports a public GitHub repository, uses tree-sitter to parse every function, builds a call graph, and then runs AI-powered practice rounds: quiz questions grounded in the real code, and spot-the-bug drills where a real bug was planted in a verified copy of the function. Results feed a per-function understanding score.

Built for the [Devmarketplace Hackathon](https://devmarketplace.dev).

---

## Demo

Live site: **https://codewiz.vercel.app**  
Demo video: `docs/demo.mp4`

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
| OpenAI **or** Anthropic **or** Google AI key | one is enough |

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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key — **never expose to the browser** |
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `public_repo` read access |
| `AI_PROVIDER` | ✅ | `openai`, `anthropic`, or `google` |
| `AI_MODEL` | ✅ | e.g. `gpt-4o-mini`, `claude-3-haiku-20240307`, `gemini-2.0-flash` |
| `OPENAI_API_KEY` | if `AI_PROVIDER=openai` | OpenAI secret key |
| `ANTHROPIC_API_KEY` | if `AI_PROVIDER=anthropic` | Anthropic secret key |
| `GOOGLE_API_KEY` | if `AI_PROVIDER=google` | Google AI / Gemini key |
| `DAILY_ROUND_LIMIT` | optional | Max rounds per user per day (default: `10`) |

### 3. Database

Link your project and push the migrations:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates all tables, indexes, Row Level Security policies, and the `increment_usage_rounds` RPC.

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
GitHub URL → fetch file tree → fetch files → tree-sitter parse
         → extract functions + call graph → compute importance
         → AI selects top N functions for the round
         → for each function:
             1. Quiz (3 questions, graded by AI)
             2. Spot-the-Bug drill (AI plants + verifies a real bug)
         → understanding score = 50% quiz + 50% drill (+ 20% "defend your choice" if extras are on)
```

### AI steps

| Step | Contract | What the AI does |
|---|---|---|
| A | Function selection | Picks the most instructive N functions from the shortlist |
| B | Quiz pack | Generates 3 questions with rubrics and a plain-language explanation |
| C | Answer grading | Scores each answer 0–2 with feedback |
| D | Bug planting | Writes a modified version of the function with one realistic bug |
| E | Bug verification | Confirms the planted code still parses and the behaviour changed |
| F | Explanation scoring | Scores the user's bug explanation 0–2 |

All AI output is validated with Zod. Each step retries once on schema failure, then fails cleanly with an error the user can see.

---

## Security

- Every table has Row Level Security. Policies require `user_id = auth.uid()` **and** an AAL2 (2FA) session.
- `planted_bugs` has RLS enabled with **no** authenticated policy — only the service-role admin client can read it.
- Answer keys, rubrics, and explanations are never sent to the browser before the user submits.
- All AI output is validated with Zod before being stored or shown.
- Server-only modules are marked `import "server-only"` and cannot be imported from client components.

---

## Project structure

```
app/               Pages and API route handlers
  api/             Route handlers (auth, repos, rounds, quiz, drills, …)
  dashboard/       Dashboard — repo list + import form
  repos/[id]/      Repo map — function browser + call graph
  rounds/[id]/     Active round — quiz and bug drill
  rounds/[id]/results/  Round results
  profile/         Skill profile, history, coverage
components/        Shared UI built on shadcn/ui
  call-map/        React Flow call graph (Gig 6)
  quiz/            Quiz question cards
  drill/           Spot-the-bug drill UI
  results/         Results view
lib/
  ai/              Provider wrapper + per-step prompts and Zod schemas
  repo-indexer/    GitHub fetch, tree-sitter parsing, call graph, metrics
  bug-planter/     Bug planting and verification
  quiz/            Quiz pack generation and answer grading
  grading/         Flag matching and explanation scoring
  scoring/         Understanding score, skill profile, coverage
  auth/            Session and 2FA helpers
  supabase/        Browser, server, and admin clients
  server/          Daily cap, typed errors, body parsing
supabase/
  migrations/      SQL migration files — schema, RLS, RPCs
docs/              Architecture, decisions, tasks, gig handoffs
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
