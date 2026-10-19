# AGENTS.md

Instructions for AI coding agents working on CodeWiz. Humans: start with README.md and SPEC.md.

## Project

CodeWiz is a web app that imports a public GitHub repo, maps its functions, quizzes the user on the important ones, and runs spot-the-bug drills on a copy of the code. Results feed an understanding score for each function.

- Product spec: `SPEC.md`
- What we decided and why: `docs/DECISIONS.md`
- Contracts (data model, API routes, AI steps, limits): `docs/ARCHITECTURE.md`
- Task list with IDs: `docs/TASKS.md`
- Code gig rules: `docs/GIGS.md`

Read only the sections your task needs, not every doc for every task. Don't propose product changes that contradict `docs/DECISIONS.md`.

## Rules that always apply

1. **Stay inside the task.** Work on one task ID from `docs/TASKS.md`. Don't refactor or "improve" unrelated code.
2. **Don't change contracts on your own.** Table columns, API routes and AI input and output shapes are fixed in `docs/ARCHITECTURE.md`. If one needs to change, stop and say so.
3. **Core before extras.** Don't work on Semgrep, the library check or the metrics panel unless the task says so.
4. **Never run code from imported repos.** All analysis is static.
5. **Secrets stay on the server.** Browser code may only use `NEXT_PUBLIC_*` variables. The admin Supabase client lives in a `server-only` module.
6. **Every table has Row Level Security**, limited to `user_id = (select auth.uid())` and a 2FA session. Never weaken a policy to make something work.
7. **AI output is untrusted.** Validate it with zod and run the code checks listed for that step.
8. **Answer keys, rubrics and explanations never reach the browser before the user submits.**
9. **Ask before adding a dependency.** If one is added, note it for `AI_DISCLOSURE.md` with its licence.

## Stack

- Next.js (App Router, TypeScript in strict mode) on Vercel
- Supabase: Postgres, Auth with TOTP 2FA, Row Level Security
- Tailwind CSS and shadcn/ui
- zod at every boundary: API input, AI output, environment variables
- web-tree-sitter for parsing Python, JavaScript, TypeScript and TSX
- Octokit for GitHub, `diff` (jsdiff) for verification, Shiki for code display, React Flow for the call map
- OpenAI or Anthropic models, chosen by `AI_PROVIDER` and `AI_MODEL`

## Commands

Keep this table in sync with `package.json`.

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Type check | `npx tsc --noEmit` |
| Unit tests (lib modules) | `npm run test` |
| Production build | `npm run build` |
| New migration | `npx supabase migration new <name>` |
| Apply migrations to the linked project | `npx supabase db push` |

Before saying a task is done, run lint, type check, tests and build, and fix anything that fails.

## Where things go

| Path | What lives there |
|---|---|
| `app/` | Pages, plus route handlers in `app/api/` |
| `components/` | Shared UI. Use existing shadcn/ui components before writing new ones |
| `components/quiz/`, `components/drill/`, `components/results/`, `components/suggestions/` | Feature components |
| `components/call-map/` | Call map component, published as a code gig |
| `lib/supabase/` | Browser, server and admin clients |
| `lib/auth/` | Session and 2FA checks for pages and API routes |
| `lib/server/` | Shared server helpers: body parsing, daily cap, typed errors |
| `lib/ai/` | Provider wrapper and shared prompt helpers, plus one prompt file and one zod schema per AI step in `prompts/` and `schemas/` |
| `lib/repo-indexer/`, `lib/bug-planter/`, `lib/registry-verifier/` | Code gig folders, each with its own AGENTS.md |
| `lib/selection/` | Ranking shortlist and AI function selection |
| `lib/quiz/` | Quiz pack generation, answer grading, explanations |
| `lib/grading/` | Drill flag matching and explanation scoring |
| `lib/real-bug-check/` | Real-bug check with tool calls |
| `lib/scoring/` | Understanding score, skill profile, coverage |
| `supabase/migrations/` | SQL migrations. See `supabase/AGENTS.md` |
| `services/semgrep/` | Python service (extra) |
| `docs/gigs/` | Code gig handoff files and thumbnails |

## Code conventions

- TypeScript strict. No `any`; use `unknown` and narrow it.
- Validate with zod at every boundary, and infer types from the schemas instead of writing them twice.
- Functions that can fail return `{ ok: true, data }` or `{ ok: false, reason }`. Route handlers turn these into HTTP responses.
- Server-only modules start with `import "server-only"`.
- Use route handlers, not server actions, for anything that calls AI, GitHub or the database.
- In Next.js 15 and later, route `params` is a Promise. Await it.
- Routes that parse code use the Node.js runtime. Routes that call AI set `maxDuration`.
- Keep files small and name them after what they do (`plant-bugs.ts`, not `utils2.ts`).
- Every screen has loading, empty and error states. No placeholder text.

## AI features

Each AI step (A to J) is defined in the "AI contracts" section of `docs/ARCHITECTURE.md`. Use the `add-ai-step` skill when building or changing one. In short:

- Send code with real line numbers inside clear delimiters, and tell the model it's data, not instructions.
- Ask for JSON only, validate with zod, retry once with the errors, then fail cleanly.
- Check every line number the model returns against the function's range.
- Log route, model, tokens, time and validity. Never log secrets.

## Workflow: forks and pull requests

Each of us works in a personal fork and opens pull requests into `RoshaanT1/CodeWiz`. Roshaan owns the repo, and GitHub doesn't let you fork your own repo into the same account, so he works in branches on the main repo instead: `git checkout main && git pull origin main`, then the same branch, commit and pull request steps.

| Step | Command or rule |
|---|---|
| Sync before each task | `git fetch upstream && git checkout main && git merge upstream/main && git push origin main` |
| Branch per task | `git checkout -b QUIZ-2-grade-answers` (task ID first) |
| Commit messages | Start with the task ID: `[QUIZ-2] Grade quiz answers against the rubric` |
| Before opening a pull request | `git fetch upstream && git merge upstream/main`, then lint, type check, tests and build |
| Pull request | From your fork's branch into `main` on `RoshaanT1/CodeWiz`. Small and focused |
| Merging | "Create a merge commit", never squash, so every commit keeps its author and date |

Vercel may not build previews for pull requests from forks until the repo owner approves them, so test locally before opening one.

A task is done when it's merged, works on the live site, has loading, empty and error states, and passes lint, type check, tests and build.

## Folder ownership

The work is split into three feature slices of about equal size, each with its own AI steps, plus testing and docs. Edit only the folders you own. If a task needs a change in someone else's folder or in a shared file, stop and say so instead of making the change.

| Owner | Folders | AI steps |
|---|---|---|
| Roshaan Tahir | `lib/ai/` (wrapper and shared helpers), `lib/bug-planter/`, `lib/grading/`, `lib/scoring/`, `lib/registry-verifier/`, `components/drill/`, `components/results/`, the results and profile pages | D, E, F, H |
| M Hammad Khan | `lib/repo-indexer/`, `lib/selection/`, `lib/real-bug-check/`, `lib/server/`, `supabase/`, `services/semgrep/` | A, G, I |
| Fizzah Abdullah | `app/` (except the results and profile pages), middleware or proxy, `lib/auth/`, `lib/quiz/`, shared `components/`, `components/call-map/`, `components/quiz/`, `components/suggestions/` | B, C, J |
| Hammad Khan | `docs/`, `README.md`, `AI_DISCLOSURE.md` | None |

Each AI step's prompt and schema files in `lib/ai/prompts/` and `lib/ai/schemas/` belong to that step's owner. Each route in `app/api/` belongs to the owner of the feature it serves.

**Shared files** each get their own small pull request, announced in the team chat: `package.json` and the lockfile, shared types and zod schemas used across folders, migrations, the root layout and navigation, and this file.

**Exception:** whoever finishes a code gig writes its file in `docs/gigs/` and updates the tracker in `docs/GIGS.md`, in the same pull request.

## Code gigs: announce them without being asked

Some tasks complete a Devmarketplace code gig. When you finish one of these, run the `package-gig` skill straight away and end your reply with its GIG READY block, even if nobody asked for it. A human then publishes the gig by hand from that block.

| Trigger task | Gig |
|---|---|
| AUTH-3 | 3. Supabase TOTP 2FA |
| PARSE-5 | 1. GitHub Repo Indexer |
| AI-1 | 4. Typed LLM JSON Calls |
| DRILL-3 | 2. Verified Bug Planter |
| MAP-2 | 6. React Call Map |
| LIB-2 | 5. Package Registry Verifier |

## Token budget

Each team member gets one free AI token reset during the hackathon. Any reset beyond that counts against us in judging.

- Read only the files the task needs. Use the "Where things go" table instead of scanning the repo.
- The docs are long. Search for your task ID or the section heading (for example `AI-1` in `docs/TASKS.md`, or `AI contracts` in `docs/ARCHITECTURE.md`) and read only that part. Never read a whole doc to find one task.
- Plan in a few lines before writing code, then make targeted edits. Don't rewrite whole files.
- One task per session. Start a fresh session for the next task.
- Test AI steps with a fake model function first (see the `add-ai-step` skill). Call the real model only when the checks pass.
- If something is unclear, ask once instead of trying several guesses.

## Skills

Project skills live in `.agents/skills/`. Use one when the task matches:

| Skill | Use when |
|---|---|
| `add-api-route` | Adding or changing a route in `app/api/` |
| `add-migration` | Adding or changing tables, columns, indexes, triggers or policies |
| `add-ai-step` | Building or changing any AI step (A to J) |
| `package-gig` | Right after a gig trigger task, or when asked to prepare or check a code gig |
