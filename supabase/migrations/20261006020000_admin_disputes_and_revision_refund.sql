-- A. Disputes never reached the admin: the disputes table's only SELECT policy
--    lets the brand or creator on the dispute read it, so the admin review
--    screen's query always came back empty. Rather than opening the table
--    (and the applications/campaigns/profiles joins the old query relied on)
--    to the admin, one admin-only function returns exactly what's needed to
--    judge a dispute, including the delivered video.
-- B. Edge functions need the admin's user id to send them a notification.
--    Only the service role may call that lookup.
-- C. Revision refund countdown: warnings sent at day 3 and day 6 of waiting
--    for a replacement video, tracked on the application. These columns are
--    server-only, so they're added to the application scope guard.

alter table public.applications
  add column if not exists revision_warned_3d_at timestamptz,
  add column if not exists revision_warned_6d_at timestamptz;

-- ---------- A. admin dispute list -------------------------------------------
create or replace function public.admin_open_disputes()
returns table (
  id uuid,
  application_id uuid,
  reason text,
  created_at timestamptz,
  brand_name text,
  creator_name text,
  campaign_name text,
  deliverable_url text,
  previous_deliverable_url text,
  revision_note text,
  revision_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'authenticated'
     or (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  return query
  select d.id, d.application_id, d.reason, d.created_at,
         coalesce(bp.name, 'Brand'), coalesce(cp.name, 'Creator'), coalesce(c.name, 'Campaign'),
         a.deliverable_url, a.previous_deliverable_url, a.revision_note, a.revision_count
  from public.disputes d
  join public.applications a on a.id = d.application_id
  join public.campaigns c on c.id = a.campaign_id
  left join public.brand_profiles bp on bp.id = d.brand_id
  left join public.creator_profiles cp on cp.id = d.creator_id
  where d.status = 'open'
  order by d.created_at asc;
end;
$$;

revoke execute on function public.admin_open_disputes() from public, anon;
grant execute on function public.admin_open_disputes() to authenticated;

-- ---------- B. admin id lookup (service role only) ---------------------------
create or replace function public.get_admin_user_id()
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where email = 'obaroikoyo@gmail.com' limit 1;
$$;

revoke execute on function public.get_admin_user_id() from public, anon, authenticated;
grant execute on function public.get_admin_user_id() to service_role;

-- ---------- C. scope guard: warning columns are server-only ------------------
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
        new.revision_count, new.revision_note, new.revision_requested_at, new.previous_deliverable_url,
        new.revision_warned_3d_at, new.revision_warned_6d_at)
       is distinct from
       (old.status, old.campaign_id, old.creator_id, old.message, old.platforms,
        old.payout_release_mode, old.responded_at,
        old.revision_count, old.revision_note, old.revision_requested_at, old.previous_deliverable_url,
        old.revision_warned_3d_at, old.revision_warned_6d_at) then
      raise exception 'Creators can only update their own delivery details on an application';
    end if;
  elsif auth.uid() = v_brand_id then
    if (new.campaign_id, new.creator_id, new.message,
        new.deliverable_url, new.deliverable_uploaded_at, new.payout_release_mode,
        new.revision_count, new.revision_note, new.revision_requested_at, new.previous_deliverable_url,
        new.revision_warned_3d_at, new.revision_warned_6d_at)
       is distinct from
       (old.campaign_id, old.creator_id, old.message,
        old.deliverable_url, old.deliverable_uploaded_at, old.payout_release_mode,
        old.revision_count, old.revision_note, old.revision_requested_at, old.previous_deliverable_url,
        old.revision_warned_3d_at, old.revision_warned_6d_at) then
      raise exception 'Brands cannot change the creator, campaign, pitch or delivery details on an application';
    end if;
  end if;

  return new;
end;
$$;

-- A new request restarts the countdown, so the warning flags reset with it.
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
         revision_requested_at = now(),
         revision_warned_3d_at = null,
         revision_warned_6d_at = null
   where id = p_application_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_app.creator_id, 'revision_requested', 'New Video Requested',
    'The brand asked for another video for "' || v_app.campaign_name || '": ' || v_note
      || ' Send it within 7 days, or this deal is refunded to the brand.',
    jsonb_build_object('campaign_id', v_app.campaign_id, 'application_id', v_app.id)
  );
end;
$$;

revoke execute on function public.request_deliverable_revision(uuid, text) from public, anon;
grant execute on function public.request_deliverable_revision(uuid, text) to authenticated;
