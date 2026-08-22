-- Backs application-level rate limiting for the Supabase Edge Functions
-- (supabase/functions/*), since they're independent Deno deployments with
-- no shared gateway to enforce limits centrally. Counters live here instead
-- of in-memory because edge functions have no persistent process between
-- invocations.
create table if not exists public.rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- No policies: only accessed via the security definer function below, called
-- by edge functions using the service role key.

-- Atomically increments the counter for the current fixed window and reports
-- whether the caller is still within budget. The insert/on-conflict is a
-- single row-locking statement so concurrent invocations can't race past
-- the limit.
create or replace function public.check_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (bucket_key, window_start, request_count)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set request_count = rate_limits.request_count + 1
  returning request_count into v_count;

  -- Opportunistic cleanup instead of a scheduled job - cheap to skip on
  -- most calls, keeps the table from growing unbounded.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

revoke all on public.rate_limits from public, anon, authenticated;
