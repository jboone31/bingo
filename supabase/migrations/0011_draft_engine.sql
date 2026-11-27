-- Migration: 0011_draft_engine
-- F7: the draft engine. Per-group clocks, append-only picks, and the engine as SQL
-- functions so routes (inside their transaction) and the pg_cron backstop share one
-- implementation. Every engine function runs under the league row lock (`for update`),
-- so concurrent callers serialize and each turn is decided once; unique constraints
-- back that up. Picked squares leave the group's queues, and the pool view hides them
-- from that group only. A pure TypeScript model of the same rules is in
-- lib/draft/engine.ts.
begin;

-- pg_cron must support seconds schedules (1.5 or later).
do $$
declare
  v int[];
begin
  select string_to_array(split_part(extversion, '-', 1), '.')::int[] into v
    from pg_extension where extname = 'pg_cron';
  if v is null or v < array[1, 5] then
    raise exception 'pg_cron 1.5 or later is required for the 5-second draft backstop';
  end if;
end;
$$;

-- League columns ------------------------------------------------------------

alter table public.leagues
  add column draft_completed_at timestamptz,
  add column dev_bots boolean not null default false,
  add constraint leagues_dev_bots_seed_only
    check (not dev_bots or seed_scenario is not null);

-- Tables -------------------------------------------------------------------

create table public.draft_clocks (
  group_id uuid primary key,
  league_id uuid not null,
  next_pick int not null default 1 check (next_pick >= 1),
  total_picks int not null check (total_picks between 25 and 2500 and total_picks % 25 = 0),
  turn_started_at timestamptz not null,
  deadline timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint draft_clocks_group_fkey foreign key (league_id, group_id)
    references public.draft_groups (league_id, id) on delete cascade,
  constraint draft_clocks_running_or_finished
    check ((finished_at is null) = (deadline is not null))
);
create index draft_clocks_league_idx on public.draft_clocks (league_id);
create index draft_clocks_due_idx on public.draft_clocks (deadline)
  where finished_at is null;

create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  group_id uuid not null,
  pick_number int not null check (pick_number >= 1),
  round int not null check (round between 1 and 25),
  user_id uuid not null,
  submission_id uuid not null,
  auto boolean not null,
  made_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint draft_picks_group_fkey foreign key (league_id, group_id)
    references public.draft_groups (league_id, id) on delete cascade,
  constraint draft_picks_submission_fkey foreign key (league_id, submission_id)
    references public.submissions (league_id, id) on delete cascade,
  constraint draft_picks_member_fkey foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  constraint draft_picks_one_per_number unique (group_id, pick_number),
  constraint draft_picks_one_per_square unique (group_id, submission_id)
);
create index draft_picks_league_idx
  on public.draft_picks (league_id, group_id, pick_number);
create index draft_picks_submission_idx
  on public.draft_picks (league_id, submission_id);

alter table public.draft_clocks enable row level security;
alter table public.draft_picks enable row level security;

create policy draft_clocks_select_member on public.draft_clocks
  for select to authenticated using (public.is_league_member(league_id));
create policy draft_picks_select_member on public.draft_picks
  for select to authenticated using (public.is_league_member(league_id));

-- Guards -------------------------------------------------------------------

create function public.draft_picks_immutable() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'draft_picks_immutable';
end;
$$;
create trigger draft_picks_immutable
  before update on public.draft_picks
  for each row execute function public.draft_picks_immutable();

-- Memberships are fixed once the draft starts; only the league cascade removes them
-- (the league row is already gone then).
create function public.league_members_guard_delete() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  league_status text;
begin
  select status into league_status from public.leagues where id = old.league_id;
  if league_status is not null and league_status <> 'pre_draft' then
    raise exception 'league_not_pre_draft';
  end if;
  return old;
end;
$$;
create trigger league_members_guard_delete
  before delete on public.league_members
  for each row execute function public.league_members_guard_delete();

-- Queues: editable while pre_draft and drafting (F7), read only once in_progress.
create or replace function public.queue_items_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  target_league uuid;
  league_status text;
  item_count int;
begin
  if tg_op = 'DELETE' then
    target_league := old.league_id;
  else
    target_league := new.league_id;
  end if;
  select status into league_status from public.leagues where id = target_league;
  if league_status is not null and league_status not in ('pre_draft', 'drafting') then
    raise exception 'league_not_pre_draft';
  end if;
  if tg_op = 'UPDATE' and (
    new.league_id <> old.league_id
    or new.user_id <> old.user_id
    or new.submission_id <> old.submission_id
  ) then
    raise exception 'queue_item_immutable';
  end if;
  if tg_op = 'INSERT' then
    select count(*) into item_count
      from public.queue_items
      where league_id = new.league_id and user_id = new.user_id;
    if item_count >= 200 then
      raise exception 'queue_full';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Group member rows: also allow the delete when the league row is already gone (the
-- league cascade), whatever order the cascade reaches the tables in.
create or replace function public.draft_group_members_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  league_status text;
  started timestamptz;
begin
  if tg_op = 'UPDATE' then
    raise exception 'draft_groups_immutable';
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.leagues where id = old.league_id)
       and exists (
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

-- Engine -------------------------------------------------------------------

-- Position on the clock for 1-based pick p in a group of `size` (snake order).
create function public.draft_on_clock(p_pick int, p_size int) returns int
  language sql immutable set search_path = '' as $$
  select case
    when ((p_pick - 1) / p_size) % 2 = 0 then ((p_pick - 1) % p_size) + 1
    else p_size - ((p_pick - 1) % p_size)
  end;
$$;

-- The user on the clock in a group, or null when it is finished.
create function public.draft_clock_user(p_group uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.user_id
    from public.draft_clocks c
    join public.draft_group_members m
      on m.group_id = c.group_id
     and m.position = public.draft_on_clock(c.next_pick, c.total_picks / 25)
   where c.group_id = p_group and c.finished_at is null;
$$;

-- The reserved seed identity, same rule as isSeedUser in lib/dev/seedIdentity.ts.
create function public.is_seed_user(p_user uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
     where id = p_user
       and email ~ '^seed-player-[0-9]{3}@bingo-seed\.test$'
       and raw_user_meta_data ->> 'seed' = 'true'
  );
$$;

-- One clock per group of a started league. Skips groups that already have one.
create function public.create_draft_clocks(p_league uuid) returns void
  language sql security definer set search_path = '' as $$
  insert into public.draft_clocks
    (group_id, league_id, total_picks, turn_started_at, deadline)
  select g.id, g.league_id, 25 * count(m.id), l.draft_started_at,
         l.draft_started_at + make_interval(secs => l.pick_seconds)
    from public.draft_groups g
    join public.leagues l on l.id = g.league_id
    join public.draft_group_members m on m.group_id = g.id
   where g.league_id = p_league
     and not exists (select 1 from public.draft_clocks c where c.group_id = g.id)
   group by g.id, g.league_id, l.draft_started_at, l.pick_seconds;
$$;

-- The league is complete when every clock is finished. F10 adds board generation here.
create function public.draft_complete_if_done(p_league uuid) returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  group_total int;
begin
  if not exists (
    select 1 from public.leagues where id = p_league and status = 'drafting'
  ) then
    return false;
  end if;
  if exists (
    select 1 from public.draft_clocks
     where league_id = p_league and finished_at is null
  ) then
    return false;
  end if;
  select count(*) into group_total from public.draft_clocks where league_id = p_league;
  if group_total = 0 then
    return false;
  end if;
  update public.leagues
     set status = 'in_progress', draft_completed_at = now()
   where id = p_league;
  perform public.append_league_event(
    p_league, 'draft_completed', jsonb_build_object('groups', group_total), null);
  return true;
end;
$$;

-- Record the current pick of a group. The caller holds the league lock and has
-- checked the rules. `p_basis` is when the next turn's clock starts.
create function public.draft_record_pick(
  p_group uuid,
  p_submission uuid,
  p_auto boolean,
  p_basis timestamptz
) returns int
  language plpgsql security definer set search_path = '' as $$
declare
  c public.draft_clocks%rowtype;
  group_size int;
  picker uuid;
  pick_round int;
  seconds int;
  group_no int;
  done boolean;
  new_deadline timestamptz;
  next_user uuid;
  picker_name text;
  next_name text;
  square_text text;
begin
  select * into c from public.draft_clocks where group_id = p_group for update;
  if not found or c.finished_at is not null then
    raise exception 'draft_not_running';
  end if;
  group_size := c.total_picks / 25;
  pick_round := ((c.next_pick - 1) / group_size) + 1;
  select m.user_id into picker from public.draft_group_members m
   where m.group_id = p_group
     and m.position = public.draft_on_clock(c.next_pick, group_size);
  select pick_seconds into seconds from public.leagues where id = c.league_id;
  select number into group_no from public.draft_groups where id = p_group;

  insert into public.draft_picks
    (league_id, group_id, pick_number, round, user_id, submission_id, auto)
  values (c.league_id, p_group, c.next_pick, pick_round, picker, p_submission, p_auto);

  -- The square leaves the queue of everyone in this group (not other groups).
  delete from public.queue_items q
   using public.draft_group_members m
   where m.group_id = p_group
     and q.league_id = c.league_id
     and q.user_id = m.user_id
     and q.submission_id = p_submission;

  done := c.next_pick + 1 > c.total_picks;
  if done then
    update public.draft_clocks
       set next_pick = next_pick + 1, turn_started_at = p_basis,
           deadline = null, finished_at = now()
     where group_id = p_group;
  else
    new_deadline := p_basis + make_interval(secs => seconds);
    update public.draft_clocks
       set next_pick = next_pick + 1, turn_started_at = p_basis,
           deadline = new_deadline
     where group_id = p_group;
    next_user := public.draft_clock_user(p_group);
  end if;

  select left(coalesce(nullif(btrim(display_name), ''), 'Someone'), 60)
    into picker_name from public.profiles where id = picker;
  select left(coalesce(nullif(btrim(display_name), ''), 'Someone'), 60)
    into next_name from public.profiles where id = next_user;
  select left(text, 200) into square_text from public.submissions where id = p_submission;

  perform public.append_league_event(
    c.league_id,
    'pick_made',
    jsonb_build_object(
      'group', group_no,
      'round', pick_round,
      'pickNumber', c.next_pick,
      'userId', picker,
      'name', coalesce(picker_name, 'Someone'),
      'submissionId', p_submission,
      'text', coalesce(square_text, ''),
      'auto', p_auto,
      'next', case when done then null else jsonb_build_object(
        'pickNumber', c.next_pick + 1,
        'userId', next_user,
        'name', coalesce(next_name, 'Someone'),
        'deadline', new_deadline
      ) end
    ),
    case when p_auto then null else picker end
  );
  if done then
    perform public.append_league_event(
      c.league_id, 'group_finished', jsonb_build_object('group', group_no), null);
  end if;
  perform public.draft_complete_if_done(c.league_id);
  return c.next_pick;
end;
$$;

-- What an auto-pick takes: the top queued square not yet picked in the group, else a
-- random square from the pool not yet picked in the group.
create function public.draft_auto_choice(p_group uuid) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  league uuid;
  picker uuid;
  choice uuid;
begin
  select league_id into league from public.draft_clocks where group_id = p_group;
  picker := public.draft_clock_user(p_group);
  select q.submission_id into choice
    from public.queue_items q
   where q.league_id = league and q.user_id = picker
     and not exists (
       select 1 from public.draft_picks p
        where p.group_id = p_group and p.submission_id = q.submission_id)
   order by q.position
   limit 1;
  if choice is null then
    select s.id into choice
      from public.submissions s
     where s.league_id = league
       and not exists (
         select 1 from public.draft_picks p
          where p.group_id = p_group and p.submission_id = s.id)
     order by random()
     limit 1;
  end if;
  if choice is null then
    raise exception 'pool_exhausted';
  end if;
  return choice;
end;
$$;

-- Auto-pick every due turn in the league until none is due. A turn is due when its
-- deadline has passed, or (dev bots) a seed player is on the clock. Returns the number
-- of auto-picks. Safe to call at any time and from several callers at once.
create function public.settle_league(p_league uuid) returns int
  language plpgsql security definer set search_path = '' as $$
declare
  league_status text;
  bots boolean;
  c public.draft_clocks%rowtype;
  made int := 0;
begin
  select status, dev_bots into league_status, bots
    from public.leagues where id = p_league for update;
  if not found or league_status <> 'drafting' then
    return 0;
  end if;
  loop
    select * into c
      from public.draft_clocks dc
     where dc.league_id = p_league
       and dc.finished_at is null
       and (dc.deadline <= now()
            or (bots and public.is_seed_user(public.draft_clock_user(dc.group_id))))
     order by dc.deadline
     limit 1;
    exit when not found;
    perform public.draft_record_pick(
      c.group_id, public.draft_auto_choice(c.group_id), true, least(c.deadline, now()));
    made := made + 1;
  end loop;
  return made;
end;
$$;

-- A manual pick by p_user for pick number p_pick. Settles first. Returns 'picked' or
-- 'already_picked' (an exact repeat); raises a reason for a refusal.
create function public.draft_pick(
  p_league uuid,
  p_user uuid,
  p_submission uuid,
  p_pick int
) returns text
  language plpgsql security definer set search_path = '' as $$
declare
  league_status text;
  my_group uuid;
  c public.draft_clocks%rowtype;
  earlier public.draft_picks%rowtype;
begin
  perform public.settle_league(p_league);
  select status into league_status from public.leagues where id = p_league for update;
  select group_id into my_group from public.draft_group_members
   where league_id = p_league and user_id = p_user;
  if my_group is not null then
    select * into earlier from public.draft_picks
     where group_id = my_group and pick_number = p_pick;
    if found and earlier.user_id = p_user and earlier.submission_id = p_submission
       and not earlier.auto then
      return 'already_picked';
    end if;
  end if;
  if league_status is distinct from 'drafting' or my_group is null then
    raise exception 'draft_not_running';
  end if;
  select * into c from public.draft_clocks where group_id = my_group for update;
  if not found or c.finished_at is not null then
    raise exception 'draft_not_running';
  end if;
  if public.draft_clock_user(my_group) is distinct from p_user then
    raise exception 'not_your_turn';
  end if;
  if p_pick <> c.next_pick then
    raise exception 'stale_pick';
  end if;
  if not exists (
    select 1 from public.submissions where id = p_submission and league_id = p_league
  ) then
    raise exception 'submission_not_found';
  end if;
  if exists (
    select 1 from public.draft_picks
     where group_id = my_group and submission_id = p_submission
  ) then
    raise exception 'square_taken';
  end if;
  perform public.draft_record_pick(my_group, p_submission, false, now());
  return 'picked';
end;
$$;

-- The pg_cron entry point: settle every drafting league with something due. Each
-- league is settled in its own subtransaction, so one failure does not stop the rest.
create function public.settle_due_drafts() returns int
  language plpgsql security definer set search_path = '' as $$
declare
  r record;
  total int := 0;
begin
  for r in
    select l.id
      from public.leagues l
     where l.status = 'drafting'
       and (l.dev_bots or exists (
         select 1 from public.draft_clocks c
          where c.league_id = l.id and c.finished_at is null and c.deadline <= now()))
       for update of l skip locked
  loop
    begin
      total := total + public.settle_league(r.id);
    exception when others then
      raise warning 'settle_league % failed: %', r.id, sqlerrm;
    end;
  end loop;
  return total;
end;
$$;

-- Dev seeding only: force n auto-picks in each group, regardless of deadlines.
create function public.dev_draft_advance(p_league uuid, p_picks int) returns int
  language plpgsql security definer set search_path = '' as $$
declare
  g record;
  i int;
  made int := 0;
begin
  perform 1 from public.leagues
   where id = p_league and status = 'drafting' and seed_scenario is not null
     for update;
  if not found then
    raise exception 'not_a_seed_draft';
  end if;
  for g in
    select c.group_id from public.draft_clocks c
     where c.league_id = p_league order by c.group_id
  loop
    for i in 1 .. p_picks loop
      exit when exists (
        select 1 from public.draft_clocks
         where group_id = g.group_id and finished_at is not null);
      perform public.draft_record_pick(
        g.group_id, public.draft_auto_choice(g.group_id), true, now());
      made := made + 1;
    end loop;
  end loop;
  return made;
end;
$$;

revoke execute on function
  public.draft_picks_immutable(),
  public.league_members_guard_delete(),
  public.draft_on_clock(int, int),
  public.draft_clock_user(uuid),
  public.is_seed_user(uuid),
  public.create_draft_clocks(uuid),
  public.draft_complete_if_done(uuid),
  public.draft_record_pick(uuid, uuid, boolean, timestamptz),
  public.draft_auto_choice(uuid),
  public.settle_league(uuid),
  public.draft_pick(uuid, uuid, uuid, int),
  public.settle_due_drafts(),
  public.dev_draft_advance(uuid, int)
  from public, anon, authenticated;

-- Pool views: while drafting, hide squares picked in the caller's group ------

create view public.available_submissions with (security_invoker = true) as
  select s.*
    from public.submissions s
   where not exists (
     select 1
       from public.draft_picks p
       join public.draft_group_members m on m.group_id = p.group_id
       join public.leagues l on l.id = p.league_id
      where p.league_id = s.league_id
        and p.submission_id = s.id
        and m.user_id = (select auth.uid())
        and l.status = 'drafting'
   );

create view public.available_pool_categories with (security_invoker = true) as
  select league_id,
         lower(category) as key,
         min(category) as label,
         count(*)::int as count
    from public.available_submissions
   group by league_id, lower(category);

-- Grants -------------------------------------------------------------------

revoke all on table public.draft_clocks, public.draft_picks,
  public.available_submissions, public.available_pool_categories
  from anon, authenticated;
grant select on table public.draft_clocks, public.draft_picks,
  public.available_submissions, public.available_pool_categories
  to authenticated;

-- Backfill: leagues started before F7 get a clock starting now -----------------

insert into public.draft_clocks (group_id, league_id, total_picks, turn_started_at, deadline)
select g.id, g.league_id, 25 * count(m.id), now(),
       now() + make_interval(secs => l.pick_seconds)
  from public.draft_groups g
  join public.leagues l on l.id = g.league_id and l.status = 'drafting'
  join public.draft_group_members m on m.group_id = g.id
 where not exists (select 1 from public.draft_clocks c where c.group_id = g.id)
 group by g.id, g.league_id, l.pick_seconds;

-- Backstop schedule ----------------------------------------------------------

do $$
begin
  if exists (select 1 from cron.job where jobname = 'bingo_draft_settle') then
    perform cron.unschedule('bingo_draft_settle');
  end if;
  perform cron.schedule(
    'bingo_draft_settle', '5 seconds', 'select public.settle_due_drafts()');
end;
$$;

commit;
