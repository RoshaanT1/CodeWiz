# AGENTS.md: database

These rules add to the root AGENTS.md for anything in `supabase/`. Use the `add-migration` skill.

- Never edit a migration that has already been applied. Create a new one with `npx supabase migration new <name>`.
- Every user-owned table has `user_id uuid not null references auth.users(id) on delete cascade`, plus an index on it.
- Turn on Row Level Security in the same migration that creates the table.
- Policies allow access only to the row's owner, and only with a 2FA session (`aal2`).
- `planted_bugs` has Row Level Security on and no policies for the `authenticated` role. Only the server reads it.
- Profiles are created by a trigger on `auth.users`, not by app code.
- Column names are `snake_case`. Timestamps are `timestamptz` with `default now()`.
- After changing a policy, test with two real accounts: user B must not see or change user A's rows.
