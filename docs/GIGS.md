# Code Gigs Plan

## What the rules ask for

- At least two code gigs published on Devmarketplace during the build, not all at the end
- Each one is code we wrote during the event, lifted out of our project
- Each has a clear title, a short description, and setup instructions another developer can follow
- Every teammate is credited as a contributor
- Only code we wrote gets published. Open-source pieces are linked under their own licences, not copied
- Gigs are reviewed as part of judging

## How gigs get made during the build

Nobody has to remember to ask for a gig.

1. Each gig has a **trigger task** (table below). When an agent finishes that task, AGENTS.md tells it to prepare the gig straight away: check the code, write the README, pick the code snippet, and save everything in `docs/gigs/<slug>.md`.
2. The agent ends its reply with a **GIG READY** block listing every field of the Devmarketplace form, in the form's order, ready to copy.
3. A human opens Devmarketplace → **Add your Gigs** and fills in the form from that block.
4. After publishing, update the tracker below and add the link to the Devpost draft.

## Gigs by stage

| Stage | Gig | Trigger task | Built by | Code lives in | Priority |
|---|---|---|---|---|---|
| Monday night | 3. Supabase TOTP 2FA | AUTH-3 | Fizzah | middleware or proxy, `app/(auth)/`, `lib/auth/` | Bonus |
| Tuesday | 1. GitHub Repo Indexer | PARSE-5 | M Hammad | `lib/repo-indexer/` | Required |
| Tuesday | 4. Typed LLM JSON Calls | AI-1 | Roshaan | `lib/ai/call-json.ts` | Bonus |
| Wednesday | 2. Verified Bug Planter | DRILL-3 | Roshaan | `lib/bug-planter/` | Required |
| Wednesday | 6. React Call Map | MAP-2 | Fizzah | `components/call-map/` | Bonus |
| Thursday | 5. Package Registry Verifier | LIB-2 | Roshaan | `lib/registry-verifier/` | Only if the library check gets built |

Hammad Khan publishes every gig from its GIG READY block.

Gigs 1 and 2 come first. Publish a bonus gig only while the core build is on track. Two good gigs beat six rushed ones.

## Tracker

| Gig | Status | Devmarketplace link | Commit |
|---|---|---|---|
| 1. GitHub Repo Indexer | Not started | | |
| 2. Verified Bug Planter | Not started | | |
| 3. Supabase TOTP 2FA | Not started | | |
| 4. Typed LLM JSON Calls | Not started | | |
| 5. Package Registry Verifier | Not started | | |
| 6. React Call Map | Not started | | |

Status goes from Not started, to Ready (the agent prepared it), to Published (link added).

## The Devmarketplace form

| Field | Limit | Where it comes from |
|---|---|---|
| Import from GitHub | Optional | Try it with our repo first. If it can't point at one folder, fill the fields by hand from the GIG READY block |
| Thumbnail | JPEG or PNG, up to 5 MB | Ready-made in `docs/gigs/thumbnails/` |
| Title | 50 characters | Pre-written below |
| Description | 200 characters | Pre-written below |
| Skills | Pick from the list | Suggested below. Choose the closest ones the list offers |
| Custom tags | Up to 10, press Enter after each | Pre-written below |
| Code Snippet | Choose the language, then paste | Picked by the agent when the gig is ready |
| Read ME | Rich text editor | The gig's README. Open it on GitHub, copy the rendered page and paste it in, so headings and lists keep their formatting |

The form has no contributors field, so every README ends with a Contributors section naming all four of us: Roshaan Tahir, M Hammad Khan, Fizzah Abdullah, Hammad Khan.

## Form content for each gig

Titles and descriptions are already within the character limits. The code snippet and README are written by the agent when the gig is ready.

### 1. GitHub Repo Indexer (required)

- **Thumbnail:** `docs/gigs/thumbnails/github-repo-indexer.png`
- **Title (49/50):** GitHub Repo Indexer: functions, calls and metrics
- **Description (195/200):** Point it at a public GitHub repo and get every Python, JavaScript and TypeScript function with exact line ranges, a call graph and simple metrics. Uses tree-sitter. No cloning, no code execution.
- **Skills:** TypeScript, Node.js
- **Custom tags:** tree-sitter, Octokit, GitHub API, static analysis, call graph, code search
- **Code snippet (TypeScript):** a short `indexRepo` call and what it returns
- **Public API:** `indexRepo(options)` returns the repo's owner, name and commit SHA, plus `files`, `functions`, `calls`, `skipped` and a `truncated` flag. Options: `url`, `token`, an optional `folder`, and limits. Each function has `id`, `file`, `name`, `qualifiedName`, `language`, `startLine`, `endLine`, `code`, metrics, `category` and `importance`
- **Done when:** someone can index all three sample repos from a clean install using only the README

### 2. Verified Bug Planter (required)

- **Thumbnail:** `docs/gigs/thumbnails/verified-bug-planter.png`
- **Title (45/50):** Verified Bug Planter for code review practice
- **Description (181/200):** Give it a function and get back a copy with 1 to 3 realistic bugs and an answer key. Every bug is checked: the diff matches the key, the code still parses and the behaviour changes.
- **Skills:** TypeScript, Node.js, plus AI or LLM if the list has it
- **Custom tags:** LLM, code review, bug seeding, jsdiff, tree-sitter, zod, education
- **Code snippet (TypeScript):** a `plantBugs` call with an `llm` adapter, and how to read the result
- **Public API:** `plantBugs(options)` returns `{ ok: true, changedCode, bugs }` or `{ ok: false, reason }`. Options: `code`, `language`, `startLine`, `count`, allowed `bugTypes`, an `llm` function (prompt and schema in, JSON out), and an optional `parse` function. Each bug has `lineStart`, `lineEnd`, `bugType`, `explanation` and `fix`
- **Done when:** it works with both OpenAI and Anthropic by swapping only the `llm` function

### 3. Supabase TOTP 2FA (bonus)

- **Thumbnail:** `docs/gigs/thumbnails/supabase-totp-2fa.png`
- **Title (40/50):** Supabase TOTP 2FA for Next.js App Router
- **Description (177/200):** Drop-in 2FA for Next.js and Supabase: authenticator setup with a QR code, a code check at sign-in, and a guard that blocks pages, API routes and database rows until 2FA is done.
- **Skills:** Next.js, React, TypeScript, Supabase, PostgreSQL
- **Custom tags:** 2FA, TOTP, MFA, authentication, Row Level Security, App Router
- **Code snippet (TypeScript):** the middleware or proxy guard that sends sessions without 2FA to the code screen
- **Includes:** the enrolment page with QR code, the code entry page, the guard, a server-side check for API routes, an example policy that requires 2FA, and the profile trigger
- **Done when:** a fresh Next.js app gets working 2FA by following the README

### 4. Typed LLM JSON Calls (bonus)

- **Thumbnail:** `docs/gigs/thumbnails/typed-llm-json.png`
- **Title (39/50):** Typed LLM JSON calls with zod and retry
- **Description (177/200):** One function to get schema-checked JSON from OpenAI or Anthropic. It validates the output with zod, retries once with the errors, and returns a clean result instead of throwing.
- **Skills:** TypeScript, Node.js
- **Custom tags:** LLM, zod, OpenAI, Anthropic, structured output, JSON, retry
- **Code snippet (TypeScript):** a zod schema and a `callJson` call that returns typed data
- **Public API:** `callJson({ prompt, schema, provider, model })` returns validated data, or a clean error after one retry
- **Done when:** the same call works with either provider by changing two environment variables

### 5. Package Registry Verifier (only if the library check gets built)

- **Thumbnail:** `docs/gigs/thumbnails/package-registry-verifier.png`
- **Title (42/50):** Package Registry Verifier for npm and PyPI
- **Description (180/200):** Stops AI from recommending packages that don't exist. Checks npm, PyPI or the Python standard library, confirms the function appears in the package docs, and returns the docs link.
- **Skills:** TypeScript, Node.js, Python
- **Custom tags:** npm, PyPI, LLM, hallucination, package registry, verification
- **Code snippet (TypeScript):** `verifyPackage` calls for a real package and a made-up one, side by side
- **Public API:** `verifyPackage({ ecosystem, package, functionName })` returns whether the package exists, whether the function name appears in its README or description, and the docs link
- **Done when:** it accepts a real package and rejects a made-up one

### 6. React Call Map (bonus)

- **Thumbnail:** `docs/gigs/thumbnails/react-call-map.png`
- **Title (41/50):** React Call Map: callers and callees graph
- **Description (166/200):** A React component that shows a function's callers and callees as an interactive graph, coloured by category. Click a node to move the view to it. Built on React Flow.
- **Skills:** React, TypeScript, Next.js
- **Custom tags:** React Flow, graph, call graph, visualisation, code navigation
- **Code snippet (TypeScript):** `<CallMap />` used in a page with sample functions and calls
- **Public API:** `<CallMap functions={...} calls={...} selectedId={...} onSelect={...} />`, with no data fetching inside
- **Done when:** it renders sample data in a fresh React app using only the README

## How to build code so it lifts out cleanly

Write each gig's code this way from the start, not as a clean-up at the end.

- **Its own folder** (for example `lib/repo-indexer/`), with one `index.ts` that exports a small public API. Gig 4 is a single file, `lib/ai/call-json.ts`.
- **No app imports.** Nothing from `app/`, `lib/supabase/`, `lib/server/`, `lib/auth/`, shared components or our database types. Pass in what it needs: tokens, an LLM call function, limits.
- **Typed inputs and outputs.** Export the types so users know exactly what goes in and what comes out.
- **No secrets or hard-coded URLs.** Everything is configurable, with sensible defaults.
- **Errors as results.** Return `{ ok: false, reason }` rather than throwing raw strings.
- **One example or test** that shows it working without secrets.
- **Framework-free, unless the gig is about the framework.** Gigs 3 and 6 are framework-specific by design. The rest shouldn't be.

## Timing

- Publish as soon as a gig works, then update it as it improves. Don't wait for polish.
- If the rules above are followed from the start, publishing a gig from its GIG READY block takes about 15 minutes.
