-- Schedules r2-scheduled-cleanup to run every 15 minutes. pg_cron runs
-- inside Postgres, which has no visibility into an edge function's own
-- environment variables - this table is the bridge that lets the cron
-- job's HTTP call carry the same shared secret the function checks
-- against, without that secret ever appearing in a committed migration
-- file (it's synced in from the function's own env at call time, see
-- r2-scheduled-cleanup's bootstrap step).
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
-- Deliberately no policies - inaccessible via the API (anon/authenticated
-- roles), reachable only by security definer functions and the cron job
-- itself (which runs with the privileges of the role that scheduled it).

create or replace function public.set_app_secret(p_key text, p_value text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_secrets (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
$$;
grant execute on function public.set_app_secret(text, text) to service_role;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'r2-media-cleanup',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://otbcvpgtxxidgtbxgzpo.supabase.co/functions/v1/r2-scheduled-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', (select value from public.app_secrets where key = 'cleanup_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
