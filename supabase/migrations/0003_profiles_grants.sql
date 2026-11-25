-- Migration: 0003_profiles_grants
-- The RLS select policy on profiles needs a matching table privilege. This
-- project does not grant new public tables to API roles by default, so grant
-- select only. No insert, update or delete is granted to anyone but the server.
begin;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

commit;
