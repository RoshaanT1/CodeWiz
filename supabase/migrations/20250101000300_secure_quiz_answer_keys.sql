-- Migration 20250101000300_secure_quiz_answer_keys.sql
-- SEC-01: Separates quiz rubrics and answer keys into a server-only table
-- with Row Level Security enabled and NO select policy for the authenticated role.
-- Ensures that rubrics cannot be queried directly by browser clients via PostgREST before submitting.

create table if not exists public.quiz_answer_keys (
  quiz_item_id uuid primary key references public.quiz_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rubric jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists quiz_answer_keys_user_id_idx on public.quiz_answer_keys (user_id);

-- Enable RLS with ZERO policies for authenticated users.
-- This ensures access is restricted exclusively to the server-side admin client (service_role).
alter table public.quiz_answer_keys enable row level security;
