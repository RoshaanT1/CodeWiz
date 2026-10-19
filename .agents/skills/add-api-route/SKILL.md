---
name: add-api-route
description: Use when adding or changing a Next.js route handler under app/api in CodeWiz. Covers the 2FA session check, zod validation, ownership checks, daily AI caps, typed errors and maxDuration.
---

# Add an API route

## Before you start

- Find the route in the "API routes" table in `docs/ARCHITECTURE.md`. If it isn't there, stop and ask: routes are part of the contract.
- Check `lib/server/` for the shared helpers. If one is missing, add it there first instead of writing it inline.

## Steps

1. Create `app/api/<path>/route.ts` and export only the HTTP methods the contract lists.
2. Add `export const runtime = "nodejs"` if the route parses code, and `export const maxDuration = <seconds>` if it calls AI, within the Vercel plan's limit.
3. Get the user from the server Supabase client. Return 401 if there's no session, and 403 if the session hasn't completed 2FA (AAL2).
4. Await `params` (a Promise in Next.js 15 and later). Validate it and the body with zod, and return 400 with the issues if invalid.
5. Load the target row with the session client so Row Level Security applies. Return 404 if it isn't found. Never reveal that a row exists for another user.
6. If the route calls AI, check and increment the daily cap first. Return 429 with a friendly message when over the limit.
7. Call the logic in `lib/`. Keep the handler thin, with no business logic inline.
8. Turn `{ ok: false, reason }` results into typed error responses. Never return stack traces.
9. Use the admin client only where the task needs it (answer keys, scoring writes), and filter by the session user's id, never an id from the request.

## Response shape

- Success: `{ ok: true, data }`
- Failure: `{ ok: false, error: { code, message } }`, with a matching HTTP status

## Check before finishing

- [ ] Signed out returns 401, and signed in without 2FA returns 403
- [ ] Another user's id returns 404
- [ ] An invalid body returns 400 with a clear message
- [ ] Nothing hidden in the response: no rubric, explanation or answer key before submission
- [ ] Lint, type check, tests and build pass
