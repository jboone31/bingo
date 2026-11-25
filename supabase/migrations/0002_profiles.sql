-- Migration: 0002_profiles
-- F1: one profile per auth user, holding the display name.
--
-- profiles.id is the auth user id (one-to-one with auth.users), a deliberate
-- exception to the "uuid with database default" key rule.
-- Authenticated users get a select policy only; writes go through a server route.
begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (display_name = btrim(display_name)
           and char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Default name: Google full name, else name, else "Player xxxx".
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'full_name'), 40)), ''),
      nullif(btrim(left(btrim(new.raw_user_meta_data ->> 'name'), 40)), ''),
      'Player ' || left(new.id::text, 4)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill users created before this migration.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(btrim(left(btrim(u.raw_user_meta_data ->> 'full_name'), 40)), ''),
    nullif(btrim(left(btrim(u.raw_user_meta_data ->> 'name'), 40)), ''),
    'Player ' || left(u.id::text, 4)
  )
from auth.users u
on conflict (id) do nothing;

commit;
