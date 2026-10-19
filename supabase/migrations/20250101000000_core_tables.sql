-- Core tables, indexes, Row Level Security and policies.
-- Tables are created in dependency order so every foreign key resolves in one push.
-- Owner policy: row owner + 2FA session (aal2). planted_bugs has RLS on and no policy (server-only).

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: owner with 2FA" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- repos ---------------------------------------------------------------------
create table public.repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  owner text not null,
  name text not null,
  branch text,
  commit_sha text,
  folder text,
  status text not null default 'importing'
    check (status in ('importing', 'indexed', 'failed')),
  file_count integer,
  function_count integer,
  created_at timestamptz not null default now()
);
create index repos_user_id_idx on public.repos (user_id);
alter table public.repos enable row level security;
create policy "repos: owner with 2FA" on public.repos
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- functions -----------------------------------------------------------------
create table public.functions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.repos(id) on delete cascade,
  file_path text not null,
  name text not null,
  qualified_name text,
  language text check (language in ('python', 'javascript', 'typescript')),
  start_line integer,
  end_line integer,
  code text,
  length integer,
  branches integer,
  callers integer,
  callees integer,
  data_access boolean not null default false,
  category text check (category in ('entry', 'core', 'data', 'helper')),
  importance real,
  excluded boolean not null default false,
  explained boolean not null default false,
  explanation text
);
create index functions_user_id_idx on public.functions (user_id);
create index functions_repo_id_importance_idx on public.functions (repo_id, importance);
alter table public.functions enable row level security;
create policy "functions: owner with 2FA" on public.functions
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- function_calls ------------------------------------------------------------
create table public.function_calls (
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.repos(id) on delete cascade,
  caller_id uuid not null references public.functions(id) on delete cascade,
  callee_id uuid not null references public.functions(id) on delete cascade,
  primary key (caller_id, callee_id)
);
create index function_calls_user_id_idx on public.function_calls (user_id);
create index function_calls_repo_id_callee_id_idx on public.function_calls (repo_id, callee_id);
alter table public.function_calls enable row level security;
create policy "function_calls: owner with 2FA" on public.function_calls
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- rounds --------------------------------------------------------------------
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repo_id uuid not null references public.repos(id) on delete cascade,
  size integer not null check (size in (3, 5, 10)),
  status text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);
create index rounds_user_id_idx on public.rounds (user_id);
alter table public.rounds enable row level security;
create policy "rounds: owner with 2FA" on public.rounds
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- round_functions -----------------------------------------------------------
create table public.round_functions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  function_id uuid not null references public.functions(id) on delete cascade,
  position integer,
  selection_reason text,
  status text
);
create index round_functions_user_id_idx on public.round_functions (user_id);
create index round_functions_round_id_idx on public.round_functions (round_id);
alter table public.round_functions enable row level security;
create policy "round_functions: owner with 2FA" on public.round_functions
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- quiz_items ----------------------------------------------------------------
create table public.quiz_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_function_id uuid not null references public.round_functions(id) on delete cascade,
  kind text check (kind in ('purpose', 'behaviour', 'edge_case', 'impact')),
  question text,
  rubric jsonb,
  answer text,
  score integer check (score between 0 and 2),
  feedback text
);
create index quiz_items_user_id_idx on public.quiz_items (user_id);
alter table public.quiz_items enable row level security;
create policy "quiz_items: owner with 2FA" on public.quiz_items
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- drills --------------------------------------------------------------------
create table public.drills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_function_id uuid not null references public.round_functions(id) on delete cascade,
  changed_code text,
  status text
);
create index drills_user_id_idx on public.drills (user_id);
alter table public.drills enable row level security;
create policy "drills: owner with 2FA" on public.drills
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- planted_bugs (server-only: RLS on, no policy for authenticated) -----------
create table public.planted_bugs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drill_id uuid not null references public.drills(id) on delete cascade,
  line_start integer,
  line_end integer,
  bug_type text check (bug_type in (
    'off_by_one', 'wrong_condition', 'missing_guard', 'wrong_variable',
    'swallowed_error', 'wrong_return', 'unchecked_input', 'async_mistake',
    'mutable_default')),
  explanation text,
  fix text
);
create index planted_bugs_user_id_idx on public.planted_bugs (user_id);
alter table public.planted_bugs enable row level security;

-- findings ------------------------------------------------------------------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drill_id uuid not null references public.drills(id) on delete cascade,
  line integer,
  comment text,
  outcome text check (outcome in ('caught', 'false_alarm', 'possible_real_bug')),
  planted_bug_id uuid references public.planted_bugs(id) on delete set null,
  explanation_score integer check (explanation_score between 0 and 2),
  feedback text,
  evidence jsonb
);
create index findings_user_id_idx on public.findings (user_id);
create index findings_drill_id_idx on public.findings (drill_id);
alter table public.findings enable row level security;
create policy "findings: owner with 2FA" on public.findings
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- suggestions ---------------------------------------------------------------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_function_id uuid not null references public.round_functions(id) on delete cascade,
  kind text check (kind in ('practice', 'security', 'library')),
  detail text,
  evidence jsonb,
  user_verdict text check (user_verdict in ('agree', 'disagree')),
  user_reason text,
  reason_score integer check (reason_score between 0 and 2),
  feedback text
);
create index suggestions_user_id_idx on public.suggestions (user_id);
alter table public.suggestions enable row level security;
create policy "suggestions: owner with 2FA" on public.suggestions
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- understanding_scores ------------------------------------------------------
create table public.understanding_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  function_id uuid not null references public.functions(id) on delete cascade,
  score integer check (score between 0 and 100),
  quiz_part real,
  drill_part real,
  defend_part real,
  updated_at timestamptz not null default now(),
  primary key (user_id, function_id)
);
create index understanding_scores_user_id_idx on public.understanding_scores (user_id);
alter table public.understanding_scores enable row level security;
create policy "understanding_scores: owner with 2FA" on public.understanding_scores
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- skill_scores --------------------------------------------------------------
create table public.skill_scores (
  user_id uuid not null references auth.users(id) on delete cascade,
  bug_type text not null check (bug_type in (
    'off_by_one', 'wrong_condition', 'missing_guard', 'wrong_variable',
    'swallowed_error', 'wrong_return', 'unchecked_input', 'async_mistake',
    'mutable_default')),
  attempts integer not null default 0,
  caught integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, bug_type)
);
create index skill_scores_user_id_idx on public.skill_scores (user_id);
alter table public.skill_scores enable row level security;
create policy "skill_scores: owner with 2FA" on public.skill_scores
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');

-- usage ---------------------------------------------------------------------
create table public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  rounds integer not null default 0,
  ai_calls integer not null default 0,
  primary key (user_id, day)
);
create index usage_user_id_idx on public.usage (user_id);
alter table public.usage enable row level security;
create policy "usage: owner with 2FA" on public.usage
  for all to authenticated
  using (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check (user_id = (select auth.uid()) and (select auth.jwt() ->> 'aal') = 'aal2');
