-- The applications UPDATE policy lets the creator OR the brand update any
-- column on the row. Nothing stopped a creator from setting their own
-- status to 'paid', or repointing campaign_id/creator_id/payout_release_mode.
-- Enforce per-role column scope in a trigger: creators may only change their
-- delivery fields, brands may not repoint the deal itself. Service-role
-- functions (no auth.uid()) are unaffected, so payments and releases still
-- go through the normal server paths.
create or replace function public.enforce_application_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_id uuid;
begin
  if auth.uid() is null then
    return new;
  end if;

  select brand_id into v_brand_id from campaigns where id = old.campaign_id;

  if auth.uid() = old.creator_id then
    if (new.status, new.campaign_id, new.creator_id, new.message, new.platforms,
        new.payout_release_mode, new.responded_at)
       is distinct from
       (old.status, old.campaign_id, old.creator_id, old.message, old.platforms,
        old.payout_release_mode, old.responded_at) then
      raise exception 'Creators can only update their own delivery details on an application';
    end if;
  elsif auth.uid() = v_brand_id then
    if (new.campaign_id, new.creator_id, new.message)
       is distinct from
       (old.campaign_id, old.creator_id, old.message) then
      raise exception 'Brands cannot change the creator, campaign, or pitch on an application';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_scope_guard on public.applications;
create trigger applications_scope_guard
  before update on public.applications
  for each row execute function public.enforce_application_update_scope();
