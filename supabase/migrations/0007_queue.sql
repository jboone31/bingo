-- Migration: 0007_queue
-- F4: each member's private queue of squares they want. An item can only point at a
-- submission in the same league, and only for a member of that league; both are
-- enforced by composite foreign keys that cascade, so removing a submission, a
-- member or a league removes the matching queue items. Authenticated users get a
-- select policy that matches the owner only; every write goes through a server route.
begin;

-- Lets queue_items reference a submission AND prove it belongs to the same league.
alter table public.submissions
  add constraint submissions_league_id_id_key unique (league_id, id);

create table public.queue_items (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  user_id uuid not null,
  submission_id uuid not null,
  position integer not null check (position >= 1),
  created_at timestamptz not null default now(),
  constraint queue_items_member_fkey
    foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  constraint queue_items_submission_fkey
    foreign key (league_id, submission_id)
    references public.submissions (league_id, id) on delete cascade,
  constraint queue_items_one_per_submission
    unique (league_id, user_id, submission_id),
  -- Deferred so a reorder can rewrite every position in one statement.
  constraint queue_items_one_per_position
    unique (league_id, user_id, position) deferrable initially deferred
);

create index queue_items_owner_idx
  on public.queue_items (user_id, league_id, position);
create index queue_items_submission_idx
  on public.queue_items (league_id, submission_id);

alter table public.queue_items enable row level security;

create policy queue_items_select_own on public.queue_items
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Triggers ------------------------------------------------------------------

-- Queue changes are allowed only while the league is pre_draft (F7 will extend this
-- to the draft). A missing league row means the league is being deleted and this is
-- the cascade, which is allowed. At most 200 items per member.
create function public.queue_items_guard() returns trigger
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
  if league_status is not null and league_status <> 'pre_draft' then
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

create trigger queue_items_guard
  before insert or update or delete on public.queue_items
  for each row execute function public.queue_items_guard();

revoke execute on function public.queue_items_guard()
  from public, anon, authenticated;

-- Category summary ----------------------------------------------------------

-- Distinct categories ignoring case, with counts, for the pool filter. security_invoker
-- makes the view obey submissions' RLS, so only league members see a league's rows.
create view public.pool_categories with (security_invoker = true) as
  select league_id,
         lower(category) as key,
         min(category) as label,
         count(*)::int as count
  from public.submissions
  group by league_id, lower(category);

-- Grants --------------------------------------------------------------------

revoke all on table public.queue_items from anon, authenticated;
grant select on table public.queue_items to authenticated;
revoke all on table public.pool_categories from anon, authenticated;
grant select on table public.pool_categories to authenticated;

commit;
