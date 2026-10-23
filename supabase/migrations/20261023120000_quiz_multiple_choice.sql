-- Multiple-choice quiz answers.
-- options: the 4 choices shown to the user (not secret).
-- correct_option and recommendation are written only after the user answers,
-- so they never reach the browser early. Before that they live with the
-- rubric in quiz_answer_keys (server-only).
alter table public.quiz_items add column if not exists options jsonb;
alter table public.quiz_items add column if not exists correct_option integer check (correct_option between 0 and 3);
alter table public.quiz_items add column if not exists recommendation text;
