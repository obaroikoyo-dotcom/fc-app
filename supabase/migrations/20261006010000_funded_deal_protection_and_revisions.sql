-- 1. Once a deal is funded, the brand can no longer make it disappear.
--    Status changes out of funded were already blocked by the money guard, but
--    two side doors were open: deleting the campaign (which takes the
--    creator's application with it) and blocking the creator (which hides the
--    chat they deliver in). Both are refused from the app while any funded or
--    disputed deal exists. Service-role paths (admin tools, account deletion
--    which has its own escrow check) are unaffected.
-- 2. "Request another video": a brand can send a funded deal back for a new
--    deliverable, up to 2 times, with a note. Done through one RPC so the
--    app can't edit the deliverable/revision columns directly (a brand
--    clearing deliverable_uploaded_at by hand could otherwise stall the
--    7-day auto-release forever).

alter table public.applications
  add column if not exists revision_count int not null default 0,
  add column if not exists revision_note text,
  add column if not exists revision_requested_at timestamptz,
  add column if not exists previous_deliverable_url text;

-- ---------- campaign delete guard -------------------------------------------
create or replace function public.guard_campaign_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and exists (
       select 1 from public.applications a
       where a.campaign_id = old.id and a.status in ('funded', 'disputed')
     ) then
    raise exception 'This campaign has a funded deal in progress. Release or resolve it before deleting the campaign.';
  end if;
  return old;
end;
$$;

drop trigger if exists campaigns_delete_guard on public.campaigns;
create trigger campaigns_delete_guard
  before delete on public.campaigns
  for each row execute function public.guard_campaign_delete();

-- ---------- block guard -----------------------------------------------------
create or replace function public.guard_block_active_deal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and exists (
       select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
       where a.status in ('funded', 'disputed')
         and ((c.brand_id = new.blocker_id and a.creator_id = new.blocked_id)
           or (a.creator_id = new.blocker_id and c.brand_id = new.blocked_id))
     ) then
    raise exception 'You can''t block someone while a funded deal with them is in progress.';
  end if;
  return new;
end;
$$;

drop trigger if exists blocks_active_deal_guard on public.blocks;
create trigger blocks_active_deal_guard
  before insert on public.blocks
  for each row execute function public.guard_block_active_deal();

-- ---------- applications scope guard (adds the delivery/revision columns) ----
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
  if coalesce(current_setting('app.bypass_application_lock', true), '') = 'true' then
    return new;
  end if;

  select brand_id into v_brand_id from campaigns where id = old.campaign_id;

  if auth.uid() = old.creator_id then
    if (new.status, new.campaign_id, new.creator_id, new.message, new.platforms,
        new.payout_release_mode, new.responded_at,
        new.revision_count, new.revision_note, new.revision_requested_at, new.previous_deliverable_url)
       is distinct from
       (old.status, old.campaign_id, old.creator_id, old.message, old.platforms,
        old.payout_release_mode, old.responded_at,
        old.revision_count, old.revision_note, old.revision_requested_at, old.previous_deliverable_url) then
      raise exception 'Creators can only update their own delivery details on an application';
    end if;
  elsif auth.uid() = v_brand_id then
    if (new.campaign_id, new.creator_id, new.message,
        new.deliverable_url, new.deliverable_uploaded_at, new.payout_release_mode,
        new.revision_count, new.revision_note, new.revision_requested_at, new.previous_deliverable_url)
       is distinct from
       (old.campaign_id, old.creator_id, old.message,
        old.deliverable_url, old.deliverable_uploaded_at, old.payout_release_mode,
        old.revision_count, old.revision_note, old.revision_requested_at, old.previous_deliverable_url) then
      raise exception 'Brands cannot change the creator, campaign, pitch or delivery details on an application';
    end if;
  end if;

  return new;
end;
$$;

-- ---------- request another video -------------------------------------------
create or replace function public.request_deliverable_revision(p_application_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if length(v_note) < 3 or length(v_note) > 500 then
    raise exception 'Tell the creator what to change (3-500 characters).';
  end if;

  select a.id, a.creator_id, a.campaign_id, a.status, a.deliverable_url, a.revision_count, c.brand_id, c.name as campaign_name
    into v_app
  from public.applications a join public.campaigns c on c.id = a.campaign_id
  where a.id = p_application_id
  for update of a;

  if not found or v_app.brand_id <> auth.uid() then raise exception 'not authorized'; end if;
  if v_app.status <> 'funded' then raise exception 'Another video can only be requested while the deal is funded.'; end if;
  if v_app.deliverable_url is null then raise exception 'There is no deliverable to send back yet.'; end if;
  if v_app.revision_count >= 2 then
    raise exception 'You''ve used both revision requests. Release the payment or raise a dispute.';
  end if;

  perform set_config('app.bypass_application_lock', 'true', true);
  update public.applications
     set previous_deliverable_url = deliverable_url,
         deliverable_url = null,
         deliverable_uploaded_at = null,
         revision_count = revision_count + 1,
         revision_note = v_note,
         revision_requested_at = now()
   where id = p_application_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_app.creator_id, 'revision_requested', 'New Video Requested',
    'The brand asked for another video for "' || v_app.campaign_name || '": ' || v_note,
    jsonb_build_object('campaign_id', v_app.campaign_id, 'application_id', v_app.id)
  );
end;
$$;

revoke execute on function public.request_deliverable_revision(uuid, text) from public, anon;
grant execute on function public.request_deliverable_revision(uuid, text) to authenticated;
revoke execute on function public.guard_campaign_delete() from public, anon, authenticated;
revoke execute on function public.guard_block_active_deal() from public, anon, authenticated;
