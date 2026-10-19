# CodeWiz

CodeWiz imports a public GitHub repo, maps its functions, quizzes you on the important ones and runs spot-the-bug drills. See `SPEC.md` for the product and `docs/` for decisions, contracts and tasks. Agents should read `AGENTS.md` first.

## Stack

Next.js 15 (App Router) with TypeScript in strict mode, Tailwind CSS 3, shadcn/ui (new-york style, neutral theme) and ESLint.

## Run locally

Needs Node 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production build |

## Environment variables

`.env.example` lists every variable by name, with no values. Locally, copy it to `.env.local` and fill it in. `.env.local` is never committed. In the workspace preview, add the values in the Secrets panel. On Vercel, add them under Project Settings > Environment Variables.

| Variable | Used by | Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server Supabase clients | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server Supabase clients | No |
| `GITHUB_TOKEN` | Server only (`/api/repos/preview`) | Yes |

Only `NEXT_PUBLIC_*` variables ever reach the browser. If a Supabase variable is missing, the clients return `{ ok: false, reason }` with a message naming the missing variable instead of throwing.

## Supabase clients

Both clients use `@supabase/ssr` and keep the session in cookies.

| File | Use it in |
|---|---|
| `lib/supabase/client.ts` | Client Components (`createClient()`) |
| `lib/supabase/server.ts` | Server Components and route handlers (`await createClient()`), marked `server-only` |
| `lib/supabase/env.ts` | Shared check of the two Supabase variables |

```ts
import { createClient } from "@/lib/supabase/server";

const result = await createClient();
if (!result.ok) {
  // show result.reason
} else {
  const { data } = await result.data.auth.getUser();
}
```

There is no admin client yet.

## Auth, 2FA and the protected dashboard

Email and password auth through Supabase Auth with forced TOTP two-factor authentication. New users must set up an authenticator app before opening the dashboard, and returning users must enter a fresh 6-digit code after every password sign-in.

| URL | What it is |
|---|---|
| `/sign-up` | Create an account. With email confirmation off, you get a session and land on `/dashboard` |
| `/sign-in` | Sign in. Wrong credentials and existing accounts show a clear message |
| `/2fa/enrol` | Set up a TOTP authenticator app with a QR code, manual secret and 6-digit verification |
| `/2fa/verify` | Enter the current authenticator code to promote the session to AAL2 |
| `/sign-out` | `POST` only. The dashboard's Sign out button posts here, clears the session and goes to `/sign-in` |
| `/dashboard` | Protected. Signed-out visitors go to `/sign-in`; sessions below AAL2 go to `/2fa/enrol` or `/2fa/verify` |

Protection is enforced on the server in two places, never only in the browser:

1. `middleware.ts` refreshes the session cookies on each request and redirects signed-out visitors away from `/dashboard` before the page renders. It also checks Supabase MFA assurance levels: `nextLevel === "aal1"` goes to enrolment, and `nextLevel === "aal2"` with `currentLevel !== "aal2"` goes to verification.
2. `app/dashboard/page.tsx` calls `requireAal2User()` from `lib/auth/session.ts`, which re-checks both the user and AAL2 status with Supabase before rendering content. Route handlers can use `requireApiAal2Session()` for JSON 401/403/503 responses.

Both use `auth.getUser()`, which verifies the token with Supabase, so a forged or expired cookie doesn't count as signed in. If the Supabase variables are missing, `/dashboard` stays closed and the sign-in page shows which variable is missing.

The `next` query parameter only accepts paths inside the app (`lib/auth/redirect.ts`), so sign-in can't redirect to another site.

To add another protected area, add its path prefix to `PROTECTED_PREFIXES` in `lib/auth/redirect.ts` and call `requireUser()` in its page.

**Supabase project setup:** turn on the Email provider and turn off "Confirm email" (Authentication > Providers > Email). With confirmation on, sign-up shows a "check your inbox" message instead of opening the dashboard.

| File | What it does |
|---|---|
| `middleware.ts` | Route protection and session refresh |
| `lib/supabase/middleware.ts` | Session refresh helper used by the middleware |
| `lib/auth/session.ts` | `getSessionUser()` and `requireUser()` for server code, marked `server-only` |
| `lib/auth/redirect.ts` | Protected paths and the safe `next` check |
| `lib/auth/credentials.ts` | Form validation and the sign-in and sign-up calls |
| `lib/auth/messages.ts` | Turns Supabase auth errors into readable messages |
| `components/auth/` | Sign-in and sign-up form, page frame, sign-out button |

## Repo file preview (checkpoint)

The dashboard has a "Preview a repo" form. Paste a public GitHub repo and it lists the default branch's files grouped by folder. Set `GITHUB_TOKEN` (Secrets panel or `.env.local`) first; if it's missing, the form shows a clear message. The API route now requires an AAL2 session, so users must finish 2FA before previewing repos.

- Accepts `owner/repo`, `.git`, a trailing slash, `https://github.com/...` and `/tree/branch/path` links. The branch is parsed but the default branch is always listed.
- Skips `node_modules`, `dist`, `build`, `.next`, `vendor` and binary files. Listing is static: no repo code is fetched or run.
- Distinct messages for an invalid URL, a repo that's not found or private (one shared message), and a GitHub rate limit. A "Partial list" notice shows when GitHub truncates the tree.
- `POST /api/repos/preview` with `{ "url": "..." }` needs a signed-in user (401 otherwise). No 2FA check yet. It's **temporary** and not in the `docs/ARCHITECTURE.md` contract, so replace it with the contract route later.

| File | What it does |
|---|---|
| `app/api/repos/preview/route.ts` | Temporary route handler |
| `lib/repo-indexer/parse-repo-url.ts` | Pure URL parser (no app imports) |
| `lib/repo-indexer/file-tree.ts` | Pure filter and group-by-folder helpers (no app imports) |
| `lib/repo-indexer/fetch-tree.ts` | GitHub REST calls; token passed in as a parameter |
| `components/repo-preview/` | Form, states and grouped file list |

No database tables are used, and nothing is stored.

## Adding shadcn/ui components

`components.json` is already set up, so this works as usual:

```bash
npx shadcn@latest add input card
```

Components land in `components/ui/`. `Button`, `Card`, `Input` and `Label` are included.

## Layout

```text
middleware.ts   session refresh and protection of /dashboard
app/            pages and (later) route handlers in app/api/
app/(auth)/     sign-in, sign-up and the sign-out route
app/dashboard/  protected dashboard
components/     shared UI; components/ui/ holds shadcn/ui components
components/auth/ auth form, page frame and sign-out button
lib/            helpers; lib/utils.ts has the cn() class-name helper
lib/auth/       session checks, redirect rules and auth error messages
lib/supabase/   browser, server and middleware Supabase helpers and the env check
docs/         planning docs (read-only for this scaffold)
```
