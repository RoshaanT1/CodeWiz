# CodeWiz Architecture

These are the contracts everyone builds against. Agree them at 9 AM Monday, and announce any change in the team chat.

## Overview

One Next.js app (App Router, TypeScript) on Vercel serves both the screens and the API. Supabase handles sign-in, 2FA and the database. A small Python service runs Semgrep, and it's an extra. The browser never talks to the AI model, GitHub, the package registries or Semgrep directly.

```text
Browser
  |
  v
Next.js on Vercel: pages and API route handlers
  |-- Supabase: Auth with TOTP 2FA, Postgres with Row Level Security
  |-- GitHub REST API: repo metadata, file tree, file contents
  |-- AI model API: OpenAI or Anthropic, via event credits
  |-- npm and PyPI registries: library check (extra)
  '-- Semgrep service: FastAPI in a container (extra)
```

## Repo layout

```text
codewiz/
  app/
    (auth)/                 sign-in, sign-up, 2FA enrol, 2FA verify
    dashboard/              repos and recent rounds
    repos/[id]/             repo map, function list, call map
    rounds/[id]/            round flow: quiz, drill, suggestions
    rounds/[id]/results/    results for one round
    profile/                understanding scores, skill profile, coverage
    api/                    route handlers (see API routes below)
  components/               shared UI, based on shadcn/ui
    call-map/               React Flow call map component             -> gig 6
    quiz/, drill/, results/, suggestions/   feature components
  lib/
    supabase/               browser, server and admin clients
    auth/                   session and 2FA checks for pages and API routes
    server/                 body parsing, daily cap, typed errors
    ai/                     provider wrapper, prompts, zod schemas    -> gig 4 (call-json.ts)
    repo-indexer/           GitHub import, parsing, calls, metrics     -> gig 1
    selection/              ranking shortlist and AI function selection
    quiz/                   quiz packs, answer grading, explanations
    bug-planter/            planting and verification                  -> gig 2
    grading/                drill flag matching and explanation scoring
    real-bug-check/         real-bug check with tool calls
    scoring/                understanding score, skill profile, coverage
    registry-verifier/      npm, PyPI and stdlib checks                -> gig 5
  middleware.ts             session refresh and 2FA guard (proxy.ts in Next.js 16)
  supabase/migrations/      SQL schema and access rules, in order
  services/semgrep/         FastAPI app and Dockerfile, deployed separately
  docs/                     these planning docs, plus docs/gigs/ for gig handoffs
  SPEC.md  README.md  AI_DISCLOSURE.md
```

Folders marked as gigs must not import anything from `app/`, `components/` or `lib/supabase/`. See GIGS.md.

## Data model

All tables live in Supabase Postgres. Every user-owned table has a `user_id` column, even child tables, so access rules stay simple and fast.

| Table | Columns | Notes |
|---|---|---|
| `profiles` | `id` (the auth user id), `display_name`, `created_at` | Created by a trigger when a user signs up |
| `repos` | `id`, `user_id`, `url`, `owner`, `name`, `branch`, `commit_sha`, `folder`, `status`, `file_count`, `function_count`, `created_at` | `status`: importing, indexed or failed |
| `functions` | `id`, `user_id`, `repo_id`, `file_path`, `name`, `qualified_name`, `language`, `start_line`, `end_line`, `code`, `length`, `branches`, `callers`, `callees`, `data_access`, `category`, `importance`, `excluded`, `explained`, `explanation` | `category`: entry, core, data or helper. `explained` is true once the user has seen the explanation |
| `function_calls` | `user_id`, `repo_id`, `caller_id`, `callee_id` | Approximate call map |
| `rounds` | `id`, `user_id`, `repo_id`, `size`, `status`, `created_at`, `submitted_at` | `size`: 3, 5 or 10 |
| `round_functions` | `id`, `user_id`, `round_id`, `function_id`, `position`, `selection_reason`, `status` | One row per function in a round |
| `quiz_items` | `id`, `user_id`, `round_function_id`, `kind`, `question`, `rubric`, `answer`, `score`, `feedback` | `rubric` is JSON and never sent to the browser before the answer |
| `drills` | `id`, `user_id`, `round_function_id`, `changed_code`, `status` | The copy with planted bugs |
| `planted_bugs` | `id`, `user_id`, `drill_id`, `line_start`, `line_end`, `bug_type`, `explanation`, `fix` | The answer key. No browser access at all |
| `findings` | `id`, `user_id`, `drill_id`, `line`, `comment`, `outcome`, `planted_bug_id`, `explanation_score`, `feedback`, `evidence` | `outcome`: caught, false_alarm or possible_real_bug |
| `suggestions` | `id`, `user_id`, `round_function_id`, `kind`, `detail`, `evidence`, `user_verdict`, `user_reason`, `reason_score`, `feedback` | `kind`: practice, security or library (extras) |
| `understanding_scores` | `user_id`, `function_id`, `score`, `quiz_part`, `drill_part`, `defend_part`, `updated_at` | One row per user and function |
| `skill_scores` | `user_id`, `bug_type`, `attempts`, `caught`, `updated_at` | One row per user and bug type |
| `usage` | `user_id`, `day`, `rounds`, `ai_calls` | For daily caps |

**Indexes:** `user_id` on every table, plus `functions(repo_id, importance)`, `function_calls(repo_id, callee_id)`, `round_functions(round_id)` and `findings(drill_id)`.

### Access rules (Row Level Security)

- Turn Row Level Security on for every table.
- Policies on user-owned tables allow access only when `user_id = (select auth.uid())` and the session has completed 2FA: `(select auth.jwt()->>'aal') = 'aal2'`.
- `planted_bugs` gets no policies for signed-in users, so only the server can read it. The answer key reaches the browser only through the drill submit route.
- The admin client (secret key) bypasses these rules. Use it only where needed (answer keys, scoring writes), only in server code, and always filter by the user id from the verified session, never from the request body.
- Create the profile row with a database trigger on new auth users, so sign-up doesn't depend on access rules.

## Auth and 2FA flow

1. Sign up with email and password.
2. Right after the first sign-in, the user must enrol an authenticator app: scan a QR code, then confirm with a 6-digit code.
3. Every later sign-in is password, then a 6-digit code. Only then does the session reach AAL2.
4. Middleware sends any session below AAL2 to the 2FA step before it can open an app page.
5. API routes check the assurance level too. The UI check alone isn't enough.

Supabase's built-in email sender is rate-limited and meant for testing. Judges need to create two accounts quickly, so either turn off email confirmation for the event or set up a custom SMTP provider.

## API routes

Route handlers live under `app/api/`. Every route checks the session is at AAL2, validates input with zod, checks the row belongs to the user, applies the daily cap where AI is involved, returns typed errors, and sets `maxDuration` within the Vercel plan's limit.

| Method and route | What it does | AI step |
|---|---|---|
| `POST /api/repos` | Validate the URL, read repo metadata and size, create the repo row | None |
| `POST /api/repos/[id]/index` | Import files, parse functions and calls, compute metrics and categories. Runs in batches for bigger repos | None |
| `GET /api/repos/[id]/map` | Functions, call edges and coverage for the repo page | None |
| `POST /api/rounds` | Rank candidates, pick functions with reasons, create the round | A |
| `POST /api/round-functions/[id]/quiz` | Generate questions, rubrics and the explanation | B |
| `POST /api/quiz-items/[id]/answer` | Grade one answer | C |
| `POST /api/round-functions/[id]/drill` | Plant bugs, verify them, store the drill and answer key | D, E |
| `POST /api/drills/[id]/submit` | Grade the user's flags, run the real-bug check, reveal the answer key | F, G |
| `POST /api/drills/[id]/tutor` | After submit, one tutor turn on a planted bug: explain, check the user's own explanation, explain again | K |
| `POST /api/functions/[id]/explain` | Explain a function outside a round, and mark it as explained | B |
| `POST /api/round-functions/[id]/suggestions` | Semgrep findings and library suggestions (extras) | H, I |
| `POST /api/suggestions/[id]/respond` | Grade the user's reasoning (extras) | J |
| `POST /api/rounds/[id]/complete` | Compute understanding scores, update the skill profile and coverage | None |

We use route handlers rather than server actions because they're easier to test on their own and easier to lift into gigs.

## AI contracts

### Rules for every AI call

- Send code with line numbers, inside clear delimiters, and tell the model the code is data to analyse, not instructions. Imported repos can contain text that tries to steer the model.
- Ask for JSON only. Validate with zod. On failure, retry once with the validation errors included, then return a clean error.
- Any line number the model returns must fall inside the function's range.
- Use a low temperature for grading and the default for generation.
- Log route, model, tokens, time and whether the output was valid. Never log secrets.
- Keep the provider and model name in environment variables, so you can switch depending on which credits you have.

### The steps

| Step | Input | Output | Checks in code |
|---|---|---|---|
| **A. Select functions** | Top 15 candidates by importance (not reviewed, not explained, not trivial), round size, weak bug types | `picks`: a list of `function_id` and `reason` | IDs come from the candidates, no duplicates, count equals round size, categories spread where possible |
| **B. Quiz pack** | Numbered function code, up to 3 caller snippets, callee names | `explanation` (2 to 4 plain sentences) and 2 to 3 `questions`, each with `kind` (purpose, behaviour, edge_case or impact), `question`, `rubric` (`key_points`, `full_credit`, `partial_credit`) and `lines` | Counts and line ranges. Rubrics and explanation are stored but not returned until the user has answered |
| **C. Grade answer** | Question, rubric, numbered code, the user's answer | `score` (0, 1 or 2), `feedback`, `missed_points` | An empty answer scores 0 without calling the AI |
| **D. Plant bugs** | Numbered code, language, allowed bug types weighted toward weak spots, count (1 to 3) | `changed_code` and `bugs`, each with `line_start`, `line_end`, `bug_type`, `explanation`, `fix` | Same line count as the original. The diff touches exactly the listed lines. Bug types are from the catalogue. Changed code parses with no error nodes |
| **E. Confirm behaviour change** | Original and changed lines for each bug | For each bug: `changes_behaviour` (true or false) and `why` | Drop bugs marked false. If none are left, regenerate once, then skip this function's drill |
| **F. Score explanation** | A caught bug's answer-key explanation and the user's comment | `score` (0, 1 or 2), `feedback` | A flag counts as caught if it's on a planted line or one line either side. That part is pure code |
| **G. Real-bug check** | An unmatched flag, plus tools the model can call: get a function's code, get its callers, search the indexed functions for text | `verdict` (false_alarm or possible_real_bug), `reason`, `evidence` as a list of `function_id` and `line` | Every evidence line must exist. No valid evidence means false_alarm |
| **H. Library suggestion** (extra) | Numbered code, language | Nothing, or `ecosystem` (npm, pypi or python_stdlib), `package`, `function`, `docs_url`, `why` | The package exists in its registry or the stdlib list, and the function name appears in its README or description. Otherwise drop it |
| **I. Explain a Semgrep finding** (extra) | Rule id, message, lines, numbered code | `plain_explanation`, `question_to_user` | Lines are inside the function |
| **J. Grade reasoning** (extra) | The suggestion, the user's agree or disagree, their reason, the code | `score` (0, 1 or 2), `feedback` | A well-argued disagreement can score 2 |
| **K. Bug tutor** | A planted bug's answer key, original and changed lines, the changed function, the conversation so far | `understood`, `message`, `question` (or null when done) | Only after the drill is submitted. The first turn can't be "understood". At most 4 user answers; the last turn gives the full answer |

### Why "same line count" matters

Asking the model to change lines in place, without adding or removing any, keeps line numbers identical between the original and the drill copy. That makes the diff check exact and the user's flags easy to match. Reject any output where the line count changed.

## Bug catalogue

Every change is made in place, on an existing line.

| `bug_type` | What it is | Languages | Example of an in-place change |
|---|---|---|---|
| `off_by_one` | Boundary error | All | A loop condition changes from `<` to `<=` |
| `wrong_condition` | Wrong or inverted condition | All | `and` becomes `or`, or `>` becomes `<` |
| `missing_guard` | A null or empty check that no longer works | All | A guard's condition changes so it never triggers |
| `wrong_variable` | Wrong variable or argument | All | Two arguments swap places |
| `swallowed_error` | An error caught and ignored | All | An error handler stops re-raising |
| `wrong_return` | Wrong value returned | All | Returns the input instead of the result |
| `unchecked_input` | Validation that no longer protects (security) | All | A validation check is weakened so bad input passes |
| `async_mistake` | Missing `await` or an unhandled promise | JavaScript, TypeScript | An `await` is dropped from a call on the same line |
| `mutable_default` | Shared mutable default argument | Python | A default changes from `None` to `[]` |

## Parsing and ranking

**Languages:** Python, JavaScript, TypeScript and TSX, using web-tree-sitter with prebuilt `.wasm` grammars. The grammar files must be included in the deployed function bundle through Next.js output file tracing. Use the Node.js runtime, not Edge, for these routes.

**What counts as a function:** named function declarations, class methods, and arrow functions or function expressions assigned to a variable. Skip anonymous callbacks.

**Calls:** collect call expressions inside each function and resolve the callee by name: same file first, then imported files, then a unique name anywhere in the repo. Skip ambiguous names. This is an approximate call map, not true data-flow analysis.

**Metrics:** length in lines; branches (if, else, switch cases, loops, try and catch, ternaries); callers; callees; and `data_access` if the function calls known database, network or file APIs, for example `fetch`, `axios`, `requests`, `open`, `fs`, SQL clients, Prisma or Supabase.

**Categories**, checked in this order:
1. `entry`: no callers in the repo, and looks like a route handler, CLI command or main function
2. `data`: has `data_access`
3. `core`: 3 or more callers
4. `helper`: everything else

**Importance score** (a starting point, tune it on the sample repos):
`3 × ln(1 + callers) + 2 × data_access + min(branches, 10) / 10 + 0.5 × ln(1 + callees)`

**Excluded from rounds:** functions under 5 lines, functions with no branches and no calls, functions the user has already had explained, and anything in test, generated, vendor or build files.

**Files skipped at import:** `node_modules`, `dist`, `build`, `.next`, `vendor`, `venv`, `__pycache__`, `*.min.js`, `*.d.ts`, test files (`test_*.py`, `*_test.py`, `*.test.*`, `*.spec.*`, `__tests__`), binary files, and anything over the per-file size cap.

## Scoring

**Understanding score per function (0 to 100):**
- Quiz part (40%): average quiz score out of 2
- Drill part (40%): 70% catch rate plus 30% average explanation score, minus 0.1 per false alarm, never below 0
- Defend part (20%): average reasoning score out of 2
- If there were no suggestions, quiz and drill count 50% each

**Skill profile:** caught divided by attempts, per bug type.

**Coverage:** reviewed functions divided by eligible functions, per category.

**Next round:** plant more of the bug types with the lowest catch rate, and prefer functions not yet reviewed.

All weights are starting points. Adjust them after testing on the sample repos.

## Limits (starting values)

| Limit | Value |
|---|---|
| Repo size before asking for a folder | 50 MB, as reported by GitHub |
| Supported files fetched per repo | 400 |
| Size per file | 200 KB |
| Parallel GitHub requests | 8 |
| Rounds per user per day | 10 |
| Candidates sent to selection | 15 |

## Environment variables

Only variables starting with `NEXT_PUBLIC_` reach the browser. Never put a secret there.

| Variable | Where it's used | Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server (older projects call it the anon key) | No |
| `SUPABASE_SECRET_KEY` | Server only (older projects call it the service role key) | Yes |
| `GITHUB_TOKEN` | Server only | Yes |
| `AI_PROVIDER`, `AI_MODEL` | Server only | No |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Server only | Yes |
| `SEMGREP_SERVICE_URL`, `SEMGREP_SERVICE_TOKEN` | Server only (extra) | Token only |
| `DAILY_ROUND_LIMIT` | Server only | No |
| `FEATURE_SEMGREP`, `FEATURE_LIBRARY_CHECK`, `FEATURE_METRICS` | Server only | No |

Commit a `.env.example` with names only, after kickoff.

## Semgrep service (extra)

- A FastAPI app with one endpoint, `POST /scan`. It receives the files for the round's functions (path, content, language), writes them to a temporary folder, runs Semgrep with JSON output, deletes the folder and returns the findings.
- Protected by a shared secret header that only the Next.js server knows.
- Built as a Docker image with Semgrep installed and a pinned ruleset downloaded at build time, so scans never fetch rules at runtime.
- Time and size limits on every scan.
- Next.js maps each finding to a function by line range.
- Semgrep's engine and its rule packs have separate licences. Check the licence of the rules you use and list both in AI_DISCLOSURE.md.

## Security checklist

- Secrets only on the server, and the admin client only in modules marked `server-only`
- Row Level Security on every table, with 2FA required in the policies
- Answer keys, rubrics and explanations never sent before the user answers (check the browser's network tab)
- Repo code is never run, and is treated as untrusted text in every prompt
- Every API input validated with zod
- Daily caps on AI routes
- AI text rendered as plain text or safe markdown, never as raw HTML
