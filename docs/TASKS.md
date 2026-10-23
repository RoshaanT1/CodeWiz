# CodeWiz Tasks

Everything we need to build, grouped by module. Turn each task into a GitHub issue and assign yourself before starting. Do **Core** tasks first. **Extra** tasks start only after the core journey works on the live site.

Each task names its owner (see the folder ownership table in AGENTS.md), what it needs first, what to watch out for, and when it counts as done. The contracts, tables and limits mentioned here are in ARCHITECTURE.md.

## 0. Setup

- [ ] **SETUP-1 Scaffold the app** (Core, Fizzah)
  - Next.js App Router, TypeScript, Tailwind, shadcn/ui, ESLint. Deploy to Vercel from `main`.
  - Watch out: not before 9 AM Monday. Use the Node.js runtime for any route that parses code.
  - Done when: the live site loads and pull requests get preview URLs.
- [ ] **SETUP-2 Supabase clients** (Core, Fizzah). Needs SETUP-1
  - A browser client, a server client with session cookies (`@supabase/ssr`), and an admin client with the secret key.
  - Watch out: put the admin client in a module marked `server-only`, so it can never end up in browser code.
  - Done when: a server route can read the signed-in user.
- [ ] **SETUP-3 Environment variables** (Core, Fizzah)
  - Set them in Vercel for production and preview, and add `.env.example`.
  - Done when: a fresh clone runs locally after copying `.env.example`.
- [ ] **SETUP-4 Feature flags** (Core, Fizzah)
  - Read `FEATURE_*` variables on the server to hide extras that aren't ready.
  - Done when: turning a flag off removes the feature without errors.

## 1. Auth and 2FA

- [x] **AUTH-1 Sign-up and sign-in** (Core, Fizzah). Needs SETUP-2
  - Email and password pages, sign-out, friendly errors.
  - Watch out: Supabase's built-in email sender is rate-limited. Turn off email confirmation for the event or use a custom SMTP provider, so judges can create two accounts quickly.
  - Done when: a new account can sign up, sign in and sign out on the live site.
- [x] **AUTH-2 Forced 2FA enrolment** (Core, Fizzah). Needs AUTH-1
  - After the first sign-in, show a QR code for an authenticator app and confirm with a 6-digit code.
  - Done when: a new user can't reach the dashboard until 2FA is set up.
- [x] **AUTH-3 2FA on every sign-in** (Core, Fizzah). Needs AUTH-2
  - Password, then a 6-digit code. Middleware (proxy in Next.js 16) sends any session below AAL2 to the code screen, and API routes check the level too.
  - Watch out: the UI check alone isn't enough. Enforce it on the server and in the access rules (DB-2).
  - Done when: signing in without the code gives access to nothing, including API routes.
- [x] **AUTH-4 Profile on sign-up** (Core, M Hammad). Needs DB-1
  - A database trigger creates the `profiles` row for each new user.
  - Done when: every new user has a profile row without any browser code.

**Gig 3 (bonus):** when AUTH-3 is done, the agent prepares it automatically (see GIGS.md).

## 2. Database

- [ ] **DB-1 Schema migration** (Core, M Hammad)
  - All tables from ARCHITECTURE.md, with `user_id` on every user-owned table, plus indexes.
  - Watch out: every schema change goes in a new file in `supabase/migrations/`. Never change the database by hand.
  - Done when: running the migrations on an empty project creates everything.
- [ ] **DB-2 Access rules** (Core, M Hammad). Needs DB-1
  - Row Level Security on every table. Policies: own rows only, and only with a 2FA session. No signed-in access to `planted_bugs`.
  - Done when: user B can't read or change any of user A's rows, tested with two real accounts.
- [ ] **DB-3 Daily usage and caps** (Core, M Hammad). Needs DB-1
  - A `usage` table and a helper that blocks AI routes over the daily limit with a clear message.
  - Done when: hitting the limit shows a friendly message, not an error page.

## 3. Repo import

- [ ] **IMPORT-1 URL parsing** (Core, M Hammad)
  - Accept `https://github.com/owner/repo`, with or without `.git`, a trailing slash, or `/tree/branch/path`.
  - Done when: all of these resolve to owner, repo, branch and optional folder, and anything else gets a clear error.
- [ ] **IMPORT-2 Repo metadata** (Core, M Hammad). Needs IMPORT-1
  - Default branch, latest commit SHA, size, and whether it's private.
  - Watch out: always use the server token. Unauthenticated GitHub requests have a very low rate limit.
  - Done when: private or missing repos show a clear message.
- [ ] **IMPORT-3 File tree** (Core, M Hammad). Needs IMPORT-2
  - Recursive tree listing, skip lists, supported extensions, size caps.
  - Watch out: GitHub cuts off very large trees and marks them `truncated`. When that happens, or the repo is over the size limit, ask for a folder.
  - Done when: each sample repo lists only the files we care about.
- [ ] **IMPORT-4 File contents** (Core, M Hammad). Needs IMPORT-3
  - Fetch with at most 8 requests in parallel, retry once on failure, cache by commit SHA, skip binary files.
  - Done when: the sample repos import in a reasonable time on the live site.

## 4. Parsing and call map data

- [ ] **PARSE-1 tree-sitter on Vercel** (Core, M Hammad)
  - Load web-tree-sitter and the Python, JavaScript, TypeScript and TSX grammars in a deployed route.
  - Watch out: the `.wasm` files must be included in the deployed bundle. Test this on the live site on Monday.
  - Done when: a deployed route parses a sample file and returns its function names.
- [ ] **PARSE-2 Extract functions** (Core, M Hammad). Needs PARSE-1
  - Named functions, class methods, and arrow functions or function expressions assigned to variables, with exact start and end lines, qualified names and code text.
  - Done when: checking 5 functions per sample repo by hand shows correct names and line ranges.
- [ ] **PARSE-3 Extract calls** (Core, M Hammad). Needs PARSE-2
  - Call expressions inside each function, resolved by name (same file, then imports, then a unique name repo-wide). Skip ambiguous ones.
  - Done when: callers and callees look right for 5 hand-checked functions.
- [ ] **PARSE-4 Metrics, categories, importance** (Core, M Hammad). Needs PARSE-3
  - Length, branches, callers, callees, data access, category, importance score and exclusions (see ARCHITECTURE.md).
  - Done when: the top 10 functions by importance in each sample repo look like functions that matter.
- [ ] **PARSE-5 Store the index** (Core, M Hammad). Needs PARSE-4, DB-1
  - Batched inserts into `functions` and `function_calls`, then update the repo's counts and status.
  - Done when: re-importing the same commit reuses the cache instead of parsing again.

**Gig 1 (required):** when PARSE-5 is done, the agent prepares it automatically (see GIGS.md).

## 5. Repo map screens

- [ ] **MAP-1 Repo page** (Core, Fizzah). Needs PARSE-5
  - Function list with category, importance and whether it's been reviewed. Filter by category and search by name.
  - Done when: a sample repo's functions are easy to browse.
- [ ] **MAP-2 Call map** (Core, Fizzah). Needs MAP-1
  - React Flow view of the selected function's callers and callees, coloured by category. Show the full graph only for small repos.
  - Watch out: big graphs get slow and unreadable. Default to one hop around the selected function and cap the number of nodes.
  - Done when: clicking a function shows its neighbours, and clicking a neighbour moves the view to it.
- [ ] **MAP-3 Folder picker** (Core, Fizzah). Needs IMPORT-3
  - For big or cut-off repos, let the user pick a folder before parsing.
  - Done when: a large repo can be imported by choosing one folder.
- [x] **MAP-4 Paginate the function list** (Core, Roshaan). Needs MAP-1
  - Show the repo's functions 25 at a time with previous and next buttons. Changing the category or search goes back to page 1.
  - Done when: a repo with more than 25 functions shows "1–25 of N" and the next page shows the rest.

**Gig 6 (bonus):** when MAP-2 is done, the agent prepares it automatically (see GIGS.md). Build the call map in `components/call-map/` with no data fetching inside, so it lifts out cleanly.

## 6. AI layer

- [x] **AI-1 Provider wrapper** (Core, Roshaan)
  - One function that calls OpenAI or Anthropic with a zod schema, JSON-only output, one retry with the validation errors, timeouts and token caps.
  - Watch out: the provider and model come from environment variables, so it's easy to switch if credits change.
  - Done when: a test route on the live site returns a validated object.
- [x] **AI-2 Shared prompt helpers** (Core, Roshaan). Needs AI-1
  - Helpers every AI step uses: numbering code lines, wrapping code in delimiters, and the instruction to treat code as data. Each step's owner writes their own prompt and schema with these helpers.
  - Watch out: imported repos can contain text that tries to steer the model. Test with a file containing "ignore all previous instructions".
  - Done when: every AI step uses the helpers, and each prompt passes its schema on all three sample repos.
- [ ] **AI-3 Logging and usage** (Core, Roshaan). Needs AI-1, DB-3
  - Log route, model, tokens, time and validity, and count calls per user per day.
  - Done when: you can tell how many calls a full round costs.

**Gig 4 (bonus):** when AI-1 is done, the agent prepares it automatically (see GIGS.md).

## 7. Rounds

- [x] **ROUND-1 Candidate shortlist** (Core, M Hammad). Needs PARSE-5
  - Top 15 eligible functions by importance, leaving out reviewed and explained ones.
- [x] **ROUND-2 AI selection** (Core, M Hammad). Needs ROUND-1, AI-2
  - Contract A, with code checks on the picks and a one-line reason for each.
  - Done when: a round never repeats a function and spreads across categories when it can.
- [ ] **ROUND-3 Create a round** (Core, M Hammad). Needs ROUND-2, DB-3
  - Sizes 3, 5 or 10, with the daily cap applied.
- [ ] **ROUND-4 Round flow screen** (Core, Fizzah). Needs ROUND-3
  - For each function: quiz, explanation, drill, then suggestions if extras are on. A progress bar, and resuming after a page reload.
  - Done when: refreshing mid-round returns you to the same step.
- [ ] **ROUND-5 Progressive generation** (Core, Fizzah). Needs ROUND-4
  - Generate the first function's content first, then the rest in the background while the user works. One request per step per function.
  - Watch out: one failed function shouldn't break the round. Show a retry for that function only.
  - Done when: the first question appears quickly, even for a round of 10.

## 8. Quiz

- [ ] **QUIZ-1 Quiz pack** (Core, Fizzah). Needs AI-2, ROUND-3
  - Contract B. Store questions, rubrics and the explanation, and cache the explanation on the function.
- [ ] **QUIZ-2 Answer and grade** (Core, Fizzah). Needs QUIZ-1
  - An answer box per question, graded with contract C, showing the score, feedback and missed points.
  - Done when: an empty answer scores 0 without an AI call, and a good answer scores 2.
- [ ] **QUIZ-3 Explanation reveal** (Core, Fizzah). Needs QUIZ-2
  - Show the plain-language explanation after the answers, labelled as AI-generated. Add an "Explain" button for functions outside the round.
  - Watch out: an explained function is left out of future quizzes, since the user has already seen the answer. Check the browser's network tab too: rubrics and the explanation must not arrive before the answers are submitted.
- [x] **QUIZ-4 Answer mode and practice questions** (Core, Roshaan). Needs QUIZ-3
  - Before the first question, the user picks multiple choice (easier) or written (deeper). The choice is locked for that function's quiz and suggested next time.
  - After the explanation, "Practise with more questions" adds up to 3 new multiple-choice questions, 9 at most per function. They count toward the quiz score.

## 9. Bug drills

- [ ] **DRILL-1 Plant bugs** (Core, Roshaan). Needs AI-2
  - Contract D, with bug types weighted toward the user's weak spots.
- [ ] **DRILL-2 Verify** (Core, Roshaan). Needs DRILL-1, PARSE-1
  - Same line count, a diff that touches exactly the listed lines, changed code that still parses, and contract E confirming the behaviour changes. Retry once, then skip the drill for that function.
  - Done when: at least 8 of 10 generated drills pass on the sample repos.
- [ ] **DRILL-3 Store the drill** (Core, Roshaan). Needs DRILL-2, DB-2
  - Changed code in `drills`, and the answer key in `planted_bugs` (server only).
- [ ] **DRILL-4 Drill screen** (Core, Roshaan). Needs DRILL-3
  - Highlighted code with line numbers. Click a line to flag it and write why, edit or remove flags, then submit.
  - Watch out: the line numbers on screen must match the stored code exactly.
  - Done when: flags survive a page reload before submitting.
- [x] **DRILL-5 Bug tutor** (Core, Roshaan). Needs DRILL-4, GRADE-4
  - "Stuck? Show me the bugs" submits the drill as it is. Each bug then offers the tutor (contract K): it explains the bug, asks the user to explain it back, and explains it another way until they get it, up to 4 tries.
  - Done when: a missed bug can be explained, a good answer ends the lesson with "You've got it", and the tutor refuses before the drill is submitted.

**Gig 2 (required):** when DRILL-3 is done, the agent prepares it automatically (see GIGS.md).

## 10. Grading

- [ ] **GRADE-1 Match flags** (Core, Roshaan). Needs DRILL-3
  - A flag on a planted line, or one line either side, is a catch. This is pure code.
- [ ] **GRADE-2 Score explanations** (Core, Roshaan). Needs GRADE-1
  - Contract F for each catch.
- [ ] **GRADE-3 Real-bug check** (Core, M Hammad). Needs GRADE-1, PARSE-5
  - Contract G with tool calls: a function's code, its callers, and text search across indexed functions. Confirmed issues are shown with their evidence and labelled "possible".
  - Done when: a real bug you added on purpose to a fork of a sample repo comes back as "possible" with evidence, and a random flag comes back as a false alarm.
- [ ] **GRADE-4 Drill results** (Core, Roshaan). Needs GRADE-2, GRADE-3
  - For each planted bug: the original line next to the changed line, the explanation and the fix. For each flag: caught, false alarm or possible real bug.
  - Done when: a hand-made test with one catch, one miss and one false alarm shows all three correctly.

## 11. Scores and results

- [ ] **SCORE-1 Understanding score** (Core, Roshaan). Needs QUIZ-2, GRADE-2
  - The formula in ARCHITECTURE.md, stored per user and function.
- [ ] **SCORE-2 Skill profile** (Core, Roshaan). Needs GRADE-1
  - Caught and attempts per bug type.
- [ ] **SCORE-3 Coverage** (Core, Roshaan). Needs PARSE-5
  - Reviewed vs eligible functions, per category.
- [ ] **SCORE-4 Results, history and profile screens** (Core, Roshaan). Needs SCORE-1 to SCORE-3
  - Round results, past rounds, and a profile page with scores, skill profile and coverage.
- [ ] **SCORE-5 Next-round targeting** (Core, Roshaan). Needs SCORE-2
  - Weight weak bug types and unreviewed functions in the next round.
  - Done when: after two rounds, the second plants more of the bug type you missed.

## 12. Interface quality

Interface quality is 15% of judging. Broken layouts, placeholder text and unhandled errors count against it.

- [ ] **UI-1 App shell** (Core, Fizzah): navigation, dashboard, repo list, and empty states with a clear first action
- [ ] **UI-2 Loading and errors** (Core, everyone, for their own screens): a visible state for every AI step, and plain error messages with a retry
- [ ] **UI-3 Layout pass** (Core, everyone, for their own screens): no broken layouts at laptop or phone widths, and no placeholder text
- [ ] **UI-4 Wording** (Core, everyone, for their own screens): plain language everywhere, with AI-generated content labelled

## 13. Extra: best practices and security

- [ ] **SEC-1 Semgrep service** (Extra, M Hammad)
  - FastAPI, a Docker image with Semgrep and a pinned ruleset, a shared-secret header, time and size limits, deployed.
  - Watch out: check the licence of the rule packs and list it in AI_DISCLOSURE.md.
- [ ] **SEC-2 Scan the round** (Extra, M Hammad). Needs SEC-1, ROUND-3
  - Send only the files for the round's functions, and map findings to functions by line range.
- [ ] **SEC-3 Explain findings** (Extra, M Hammad). Needs SEC-2
  - Contract I explains each finding in plain words.
  - Done when: a sample repo with a known issue shows one explained finding.
- [ ] **SEC-4 Suggestion cards and "defend your choice"** (Extra, Fizzah). Needs SEC-3 or LIB-2
  - One card component for Semgrep findings and library suggestions. The user agrees or disagrees with a reason, and contract J grades the reason.
  - Done when: a reasoned disagreement can score full marks.

## 14. Extra: library check

- [ ] **LIB-1 Suggestion** (Extra, Roshaan). Needs AI-2
  - Contract H.
- [ ] **LIB-2 Registry verification** (Extra, Roshaan). Needs LIB-1
  - The npm registry, the PyPI JSON API, and a static list of Python standard library modules (generate it once from Python's `sys.stdlib_module_names`). The function name must appear in the package's README or description.
  - Done when: a hand-written debounce gets a verified suggestion, and a made-up package is rejected.
- [ ] **LIB-3 Library suggestions in the card** (Extra, Roshaan). Needs LIB-2, SEC-4
  - Show library suggestions in the suggestion card from SEC-4, with the docs link.

**Gig 5 (only if the library check is built):** when LIB-2 is done, the agent prepares it automatically (see GIGS.md).

## 15. Extra: metrics panel

- [ ] **MET-1 Metrics panel** (Extra, Fizzah). Needs PARSE-4
  - Length, branches, callers and callees per function, with a short AI explanation of what the numbers mean. No AI score for the code itself.

## 16. Gigs, QA and docs

Everything in this section belongs to Hammad Khan.

- [ ] **GIG-1 Publish gig 1, GitHub Repo Indexer,** by Tuesday, from its GIG READY block
- [ ] **GIG-2 Publish gig 2, Verified Bug Planter,** by Wednesday, from its GIG READY block
- [ ] **GIG-3 Publish bonus gigs** (3, 4, 6, then 5) as they become ready, only while the core is on track
- [ ] **QA-1 Daily smoke test** on the live site in a private window (QA_AND_SUBMISSION.md)
- [ ] **QA-2 Two-account isolation test** on Wednesday
- [ ] **QA-3 2FA test:** enrol, sign out, sign back in with a code
- [ ] **QA-4 Restart test:** redeploy, sign back in, data still there
- [ ] **QA-5 Final check:** AI features tested on the live site within the last hour before submitting
- [ ] **DOC-1 README** (outline in QA_AND_SUBMISSION.md)
- [ ] **DOC-2 AI_DISCLOSURE.md** (outline in QA_AND_SUBMISSION.md)
- [ ] **DOC-3 Keep SPEC.md updated** as the build changes
- [ ] **DOC-4 Demo video**, 3 minutes or less
- [ ] **DOC-5 Devpost submission** text and links
