-- Migration: 0009_league_events_actor_null
-- F5 fix: league_events.actor_id is `on delete set null`, which Postgres runs as an
-- UPDATE, so the immutability trigger from 0008 blocked deleting any user who had
-- authored an event. Allow exactly that change (actor_id to null) and nothing else.
begin;
create or replace function public.league_events_immutable() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if old.actor_id is not null
     and new.actor_id is null
     and new.id = old.id
     and new.league_id = old.league_id
     and new.seq = old.seq
     and new.type = old.type
     and new.payload = old.payload
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'league_events_immutable';
end;
$$;
commit;
