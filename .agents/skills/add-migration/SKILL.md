---
name: add-migration
description: Use when adding or changing CodeWiz database tables, columns, indexes, triggers or Row Level Security policies in supabase/migrations.
---

# Add a migration

## Steps

1. Check the data model in `docs/ARCHITECTURE.md`. New tables or columns are contract changes, so confirm with the team first.
2. Create the file with `npx supabase migration new <short_name>`. Never edit a migration that's already been applied.
3. Create or alter the table. User-owned tables get `user_id uuid not null references auth.users(id) on delete cascade` and an index on `user_id`.
4. Turn on Row Level Security and add the owner policy in the same file:

```sql
alter table public.<table> enable row level security;

create policy "<table>: owner with 2FA"
  on public.<table>
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    user_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );
```

5. For `planted_bugs`, turn on Row Level Security and add no policy for `authenticated`. Only the server reads it.
6. Add the indexes listed in `docs/ARCHITECTURE.md`.
7. Apply it with `npx supabase db push`.

## Profile trigger

Profiles are created by a trigger on `auth.users`. Write the trigger function as `security definer` with `set search_path = ''`, and use fully qualified names such as `public.profiles`.

## Check before finishing

- [ ] The migrations run cleanly on an empty database
- [ ] With two real accounts, user B can't read or change user A's rows
- [ ] A session that hasn't completed 2FA can't read any rows
- [ ] Generated TypeScript types are updated, if the team uses them
