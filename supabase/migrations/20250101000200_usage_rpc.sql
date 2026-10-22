-- DB-3: RPC for atomic increment of usage.rounds.
-- Called by lib/server/daily-cap.ts after a round is created.

create or replace function public.increment_usage_rounds(
  p_user_id uuid,
  p_day date
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage (user_id, day, rounds, ai_calls)
    values (p_user_id, p_day, 1, 0)
  on conflict (user_id, day)
    do update set rounds = public.usage.rounds + 1;
$$;

-- Grant execute to authenticated users (service role can always call it).
grant execute on function public.increment_usage_rounds(uuid, date) to authenticated;
