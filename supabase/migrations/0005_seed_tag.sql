-- Migration: 0005_seed_tag
-- F2.5: dev tools tag the leagues they create so reset removes only those.
-- Null for every real league. No policy change: the existing select policy covers it.
begin;

alter table public.leagues add column seed_scenario text;

create index leagues_seed_scenario_idx
  on public.leagues (seed_scenario) where seed_scenario is not null;

commit;
