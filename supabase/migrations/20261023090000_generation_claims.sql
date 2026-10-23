-- One AI generation per round function and kind (quiz or drill).
-- A request inserts its claim before calling the model; the primary key makes
-- a second, overlapping request fail instead of generating a duplicate set.
create table if not exists public.generation_claims (
  round_function_id uuid not null references public.round_functions(id) on delete cascade,
  kind text not null check (kind in ('quiz', 'drill')),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_function_id, kind)
);

create index if not exists generation_claims_user_id_idx on public.generation_claims (user_id);

alter table public.generation_claims enable row level security;

create policy "generation_claims: owner with 2FA" on public.generation_claims
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');
