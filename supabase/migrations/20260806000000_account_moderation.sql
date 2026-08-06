-- Lets the admin suspend/ban/reactivate an account instead of the only
-- option being outright deletion. Enforcement is app-level (App.tsx blocks
-- the whole UI for a non-active account on load) rather than an auth-provider
-- session revoke, which keeps this to a single migration + RPC instead of a
-- new edge function.
alter table public.profiles add column account_status text not null default 'active' check (account_status in ('active', 'suspended', 'banned'));
alter table public.profiles add column status_reason text;
alter table public.profiles add column status_updated_at timestamptz;

create or replace function public.admin_set_account_status(target_user_id uuid, new_status text, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;
  if new_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid status';
  end if;

  update public.profiles
  set account_status = new_status, status_reason = reason, status_updated_at = now()
  where id = target_user_id;
end;
$$;

grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
