-- Migration: 0004_leagues
-- F2: leagues and their members, shared membership helpers, RLS, and the
-- guards the database enforces regardless of the application (forward-only
-- status, join only while pre_draft, 100-member cap, one admin per league).
--
-- Authenticated users get select policies only; every write goes through a
-- server route (conventions.md).
begin;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 60),
  status text not null default 'pre_draft'
    check (status in ('pre_draft', 'drafting', 'in_progress')),
  draft_at timestamptz,
  join_code text not null unique
    check (join_code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  created_by uuid not null references auth.users (id) on delete restrict,
  create_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, create_key)
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create unique index league_members_one_admin
  on public.league_members (league_id) where role = 'admin';
create index league_members_user_id_idx on public.league_members (user_id);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

-- Triggers ------------------------------------------------------------------

create function public.leagues_status_forward() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  old_rank int;
  new_rank int;
begin
  old_rank := case old.status when 'pre_draft' then 0 when 'drafting' then 1 else 2 end;
  new_rank := case new.status when 'pre_draft' then 0 when 'drafting' then 1 else 2 end;
  if new_rank < old_rank then
    raise exception 'league_status_backward';
  end if;
  return new;
end;
$$;

create trigger leagues_status_forward
  before update of status on public.leagues
  for each row execute function public.leagues_status_forward();

create function public.leagues_touch() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger leagues_touch
  before update on public.leagues
  for each row execute function public.leagues_touch();

create function public.league_members_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  league_status text;
  member_count int;
begin
  select status into league_status
    from public.leagues where id = new.league_id for update;
  if league_status is distinct from 'pre_draft' then
    raise exception 'league_not_pre_draft';
  end if;
  select count(*) into member_count
    from public.league_members where league_id = new.league_id;
  if member_count >= 100 then
    raise exception 'league_full';
  end if;
  return new;
end;
$$;

create trigger league_members_guard
  before insert on public.league_members
  for each row execute function public.league_members_guard();

revoke execute on function
  public.leagues_status_forward(),
  public.leagues_touch(),
  public.league_members_guard()
  from public, anon, authenticated;

-- Membership helpers (security definer so policies do not recurse) -----------

create function public.is_league_member(p_league_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = (select auth.uid())
  );
$$;

create function public.shares_league_with(p_user_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.league_members a
    join public.league_members b on a.league_id = b.league_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user_id
  );
$$;

revoke execute on function
  public.is_league_member(uuid),
  public.shares_league_with(uuid)
  from public, anon;
grant execute on function
  public.is_league_member(uuid),
  public.shares_league_with(uuid)
  to authenticated;

-- Policies and grants -------------------------------------------------------

create policy leagues_select_member on public.leagues
  for select to authenticated
  using (public.is_league_member(id));

create policy league_members_select_member on public.league_members
  for select to authenticated
  using (public.is_league_member(league_id));

drop policy profiles_select_own on public.profiles;
create policy profiles_select_self_or_comember on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_league_with(id));

revoke all on table public.leagues, public.league_members from anon, authenticated;
grant select on table public.leagues, public.league_members to authenticated;

commit;
