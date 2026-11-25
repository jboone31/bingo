-- Migration: 0006_submissions
-- F3: the submission pool. Duplicates are allowed: every submission has its own
-- unique id and nothing is unique on text. Each add or upload records a
-- submission_imports row keyed by a client request id, so a repeat is harmless.
-- Writes go through server routes; authenticated users get select only.
begin;

create table public.submission_imports (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  request_id uuid not null,
  row_count integer not null check (row_count >= 0),
  created_at timestamptz not null default now(),
  unique (league_id, request_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  league_id uuid not null references public.leagues (id) on delete cascade,
  import_id uuid references public.submission_imports (id) on delete set null,
  text text not null
    check (text = btrim(text) and char_length(text) between 1 and 200),
  submitter text not null default ''
    check (submitter = btrim(submitter) and char_length(submitter) <= 60),
  category text not null default ''
    check (category = btrim(category) and char_length(category) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_league_seq_idx on public.submissions (league_id, seq);

alter table public.submissions enable row level security;
alter table public.submission_imports enable row level security;

-- Triggers ------------------------------------------------------------------

-- The pool can change only while the league is pre_draft. A missing league row
-- means the league is being deleted and this is the cascade, which is allowed.
create function public.submissions_guard() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  target_league uuid;
  league_status text;
begin
  if tg_op = 'DELETE' then
    target_league := old.league_id;
  else
    target_league := new.league_id;
  end if;
  if tg_op = 'UPDATE' and (new.league_id <> old.league_id or new.id <> old.id) then
    raise exception 'submission_immutable';
  end if;
  select status into league_status from public.leagues where id = target_league;
  if league_status is not null and league_status <> 'pre_draft' then
    raise exception 'league_not_pre_draft';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger submissions_guard
  before insert or update or delete on public.submissions
  for each row execute function public.submissions_guard();

create function public.submissions_touch() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger submissions_touch
  before update on public.submissions
  for each row execute function public.submissions_touch();

-- One count per statement, so a 5,000-row import stays cheap.
create function public.submissions_cap() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1
    from public.submissions s
    where s.league_id in (select distinct league_id from inserted)
    group by s.league_id
    having count(*) > 5000
  ) then
    raise exception 'pool_full';
  end if;
  return null;
end;
$$;

create trigger submissions_cap
  after insert on public.submissions
  referencing new table as inserted
  for each statement execute function public.submissions_cap();

revoke execute on function
  public.submissions_guard(),
  public.submissions_touch(),
  public.submissions_cap()
  from public, anon, authenticated;

-- Policies and grants -------------------------------------------------------

create policy submissions_select_member on public.submissions
  for select to authenticated
  using (public.is_league_member(league_id));

revoke all on table public.submissions, public.submission_imports
  from anon, authenticated;
grant select on table public.submissions to authenticated;

commit;
