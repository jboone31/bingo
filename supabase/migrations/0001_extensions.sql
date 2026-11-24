-- Migration: 0001_extensions
-- Foundation: database extensions the app depends on.
--
-- pg_cron drives the draft timer backstop (a seconds-level sweep that settles
-- expired picks when no client is connected). It is enabled in the Supabase
-- dashboard (Database -> Extensions); this migration makes the dependency
-- explicit and fails loudly if it is missing, rather than silently leaving the
-- backstop out.
--
-- Migration files own their own transaction (`begin; ... commit;`). The runner
-- (scripts/apply-migrations.mjs) records each file in schema_migrations.

begin;

do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise exception
      'pg_cron is not available. Enable it in the Supabase dashboard (Database -> Extensions) and re-run.';
  end if;
  create extension if not exists pg_cron;
end;
$$;

commit;
