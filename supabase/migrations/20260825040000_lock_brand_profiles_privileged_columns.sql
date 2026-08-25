-- is_enterprise (0% platform fees) and verified (trust badge) must only
-- ever be set by trusted server-side code (create-subscription, once Stripe
-- confirms a real active subscription; approve_verification_request for the
-- separate manual verification flow) - never by a brand editing their own
-- profile. RLS's WITH CHECK alone can't express this (it only ever sees the
-- proposed new row, not the old one), so this uses a trigger instead, which
-- can compare old/new directly and fires regardless of which RLS policy let
-- the UPDATE through.
--
-- auth.role() reflects the ORIGINAL caller's JWT claim (set once per
-- request by PostgREST), not the escalated role a security definer function
-- runs as - so it correctly identifies create-subscription's service-role
-- write, but would NOT distinguish approve_verification_request's update
-- (invoked over the admin's own "authenticated" session) from an ordinary
-- client update. That function gets an explicit, transaction-scoped bypass
-- flag instead of relying on role introspection for it.
create or replace function public.lock_brand_profiles_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role'
     and coalesce(current_setting('app.bypass_brand_profiles_lock', true), '') <> 'true' then
    new.is_enterprise := old.is_enterprise;
    new.verified := old.verified;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_brand_profiles_privileged_columns on public.brand_profiles;
create trigger lock_brand_profiles_privileged_columns
  before update on public.brand_profiles
  for each row
  execute function public.lock_brand_profiles_privileged_columns();

-- Re-defined to set the bypass flag (transaction-local via set_config's
-- is_local=true, so it can't leak to any other query on a pooled
-- connection) immediately before its own verified = true write.
create or replace function public.approve_verification_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_brand_id uuid;
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  select brand_id into target_brand_id from public.verification_requests where id = target_request_id;
  if target_brand_id is null then
    raise exception 'verification request not found';
  end if;

  update public.verification_requests set status = 'approved', reviewed_at = now() where id = target_request_id;
  perform set_config('app.bypass_brand_profiles_lock', 'true', true);
  update public.brand_profiles set verified = true where id = target_brand_id;
end;
$$;
