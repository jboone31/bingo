-- Migration: 0010_draft_setup
-- F6: draft settings on the league (group count, pick timer), the start time, and the
-- groups the start creates. Settings can change only while pre_draft. Group rows are
-- written once, by the start (after it sets drafting), and never edited. Members of
-- the league read every group and its order; nobody writes them from a client.
begin;

alter table public.leagues
  add column group_count int not null default 1
    check (group_count between 1 and 10),
  add column pick_seconds int not null default 60
    check (pick_seconds between 10 and 900),
  add column draft_started_at timestamptz;

create function public.leagues_draft_settings_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if (new.group_count is distinct from old.group_count
      or new.pick_seconds is distinct from old.pick_seconds)
     and old.status <> 'pre_draft' then
    raise exception 'league_not_pre_draft';
  end if;
  return new;
end;
$$;

create trigger leagues_draft_settings_guard
  before update of group_count, pick_seconds on public.leagues
  for each row execute function public.leagues_draft_settings_guard();

create table public.draft_groups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  number int not null check (number between 1 and 10),
  created_at timestamptz not null default now(),
  constraint draft_groups_one_number unique (league_id, number),
  constraint draft_groups_league_id_id_key unique (league_id, id)
);

create table public.draft_group_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  position int not null check (position between 1 and 100),
  created_at timestamptz not null default now(),
  constraint draft_group_members_group_fkey
    foreign key (league_id, group_id)
    references public.draft_groups (league_id, id) on delete cascade,
  constraint draft_group_members_member_fkey
    foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  constraint draft_group_members_one_group unique (league_id, user_id),
  constraint draft_group_members_one_position unique (group_id, position)
);

create index draft_group_members_order_idx
  on public.draft_group_members (league_id, group_id, position);

alter table public.draft_groups enable row level security;
alter table public.draft_group_members enable row level security;

create policy draft_groups_select_member on public.draft_groups
  for select to authenticated
  using (public.is_league_member(league_id));

create policy draft_group_members_select_member on public.draft_group_members
  for select to authenticated
  using (public.is_league_member(league_id));

-- Insert only once the league is drafting with a start time (the start sets both
-- first). Never update. Delete only as part of the league cascade (row gone).
create function public.draft_groups_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  target_league uuid;
  league_status text;
  started timestamptz;
begin
  if tg_op = 'UPDATE' then
    raise exception 'draft_groups_immutable';
  end if;
  if tg_op = 'DELETE' then
    target_league := old.league_id;
  else
    target_league := new.league_id;
  end if;
  select status, draft_started_at into league_status, started
    from public.leagues where id = target_league;
  if tg_op = 'DELETE' then
    if league_status is not null then
      raise exception 'draft_groups_immutable';
    end if;
    return old;
  end if;
  if league_status is distinct from 'drafting' or started is null then
    raise exception 'league_not_drafting';
  end if;
  return new;
end;
$$;

create trigger draft_groups_guard
  before insert or update or delete on public.draft_groups
  for each row execute function public.draft_groups_guard();

-- Same rules for member rows, except a delete is also allowed when the membership is
-- already gone: deleting a user account cascades through league_members.
create function public.draft_group_members_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  league_status text;
  started timestamptz;
begin
  if tg_op = 'UPDATE' then
    raise exception 'draft_groups_immutable';
  end if;
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.league_members
       where league_id = old.league_id and user_id = old.user_id
    ) then
      raise exception 'draft_groups_immutable';
    end if;
    return old;
  end if;
  select status, draft_started_at into league_status, started
    from public.leagues where id = new.league_id;
  if league_status is distinct from 'drafting' or started is null then
    raise exception 'league_not_drafting';
  end if;
  return new;
end;
$$;

create trigger draft_group_members_guard
  before insert or update or delete on public.draft_group_members
  for each row execute function public.draft_group_members_guard();

revoke execute on function
  public.leagues_draft_settings_guard(),
  public.draft_groups_guard(),
  public.draft_group_members_guard()
  from public, anon, authenticated;

revoke all on table public.draft_groups, public.draft_group_members
  from anon, authenticated;
grant select on table public.draft_groups, public.draft_group_members
  to authenticated;

commit;
