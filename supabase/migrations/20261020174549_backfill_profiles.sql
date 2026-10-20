-- Profiles are normally created by the auth.users trigger; this covers users
-- who signed up before the trigger existed.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;
