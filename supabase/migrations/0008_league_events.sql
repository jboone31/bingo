-- Migration: 0008_league_events
-- F5: an append-only, ordered event log per league. `seq` is a per-league counter
-- assigned while the league row is locked, so commit order equals seq order and
-- there are no gaps. Members read through RLS and subscribe through Realtime;
-- every write goes through append_league_event, which only the server role runs.
begin;
alter table public.leagues
  add column last_event_seq bigint not null default 0;
create table public.league_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  seq bigint not null check (seq > 0),
  type text not null check (type ~ '^[a-z][a-z_]{0,39}$'),
  payload jsonb not null default '{}'
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2000),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (league_id, seq)
);
alter table public.league_events enable row level security;
create policy league_events_select_member on public.league_events
  for select to authenticated
  using (public.is_league_member(league_id));
-- Append-only: rows are never edited. Delete is not blocked because the league
-- cascade must work; no client role has a delete grant.
create function public.league_events_immutable() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'league_events_immutable';
end;
$$;
create trigger league_events_immutable
  before update on public.league_events
  for each row execute function public.league_events_immutable();
-- Takes the league row lock through the counter update, so concurrent appenders
-- serialize and seq has no gaps. Returns the new seq.
create function public.append_league_event(
  p_league_id uuid,
  p_type text,
  p_payload jsonb,
  p_actor uuid
) returns bigint
  language plpgsql security definer set search_path = '' as $$
declare
  new_seq bigint;
begin
  update public.leagues
    set last_event_seq = last_event_seq + 1
    where id = p_league_id
    returning last_event_seq into new_seq;
  if new_seq is null then
    raise exception 'league_not_found';
  end if;
  insert into public.league_events (league_id, seq, type, payload, actor_id)
    values (p_league_id, new_seq, p_type, coalesce(p_payload, '{}'::jsonb), p_actor);
  return new_seq;
end;
$$;
revoke execute on function
  public.league_events_immutable(),
  public.append_league_event(uuid, text, jsonb, uuid)
  from public, anon, authenticated;
revoke all on table public.league_events from anon, authenticated;
grant select on table public.league_events to authenticated;
alter publication supabase_realtime add table public.league_events;
commit;
