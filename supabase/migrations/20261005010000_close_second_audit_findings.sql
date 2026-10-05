-- Second security audit. Everything below was confirmed against the live
-- policies/grants, not assumed.
--
-- A. applications INSERT never checked status, and the money guard only fires
--    on UPDATE - a creator could insert an application that is already 'paid'
--    and use it to leave fake reviews / inflate their completed-campaigns stat.
-- B. Anyone in a chat could send a message starting "Payment secured!" or
--    "Chat Opened!" and the app renders it as its own trusted system card.
-- C. "Participants can mark received messages read" lets a participant UPDATE
--    any column of the OTHER party's messages (text, media, sender) - evidence
--    tampering in a dispute. The client only ever updates read_at.
-- D. conversations UPDATE let a participant swap participant_1/participant_2.
-- E. social_connections access/refresh tokens were SELECT-able from the
--    browser by their owner; the app never reads them client-side, and a
--    long-lived YouTube/TikTok token should not be reachable from an XSS.
-- F. Many SECURITY DEFINER functions were executable by anon via the default
--    PUBLIC grant. set_app_secret has no caller check at all.

-- ---------- A: applications INSERT -------------------------------------------
create or replace function public.force_application_insert_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    new.status := 'pending';
    new.payout_release_mode := 'instant';
    new.responded_at := null;
    new.disputed_at := null;
    new.deliverable_url := null;
    new.deliverable_uploaded_at := null;
    new.reminder_sent_at := null;
    new.media_deleted := false;
    new.media_delete_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_force_insert_defaults on public.applications;
create trigger applications_force_insert_defaults
  before insert on public.applications
  for each row execute function public.force_application_insert_defaults();

-- ---------- B + C: messages --------------------------------------------------
create or replace function public.guard_messages_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  -- NOT current_user: inside SECURITY DEFINER that is always the owner
  -- (postgres), which silently turns every guard off. The JWT role is the
  -- real signal: anon/authenticated = a client, service_role = our edge
  -- functions, null = direct SQL (dashboard/migrations).
  v_role text := coalesce(auth.role(), '');
  v_client boolean := coalesce(auth.role(), '') in ('anon', 'authenticated');
  v_other uuid;
begin
  if tg_op = 'UPDATE' then
    -- From the client, the only legitimate change is marking a message read.
    if v_client then
      if (new.conversation_id, new.sender_id, new.text, new.video_url, new.image_url, new.media_type,
          new.media_expired_at, new.media_removed_reason, new.deleted_at, new.edited_at, new.created_at)
         is distinct from
         (old.conversation_id, old.sender_id, old.text, old.video_url, old.image_url, old.media_type,
          old.media_expired_at, old.media_removed_reason, old.deleted_at, old.edited_at, old.created_at) then
        raise exception 'Messages can only be marked read from the client';
      end if;
    end if;
    -- Nobody (including the edit-message function) may turn an ordinary
    -- message into a system card by editing its text.
    if v_role <> '' and new.text is distinct from old.text
       and (new.text like 'Payment secured!%' or new.text like 'Chat Opened!%')
       and not (coalesce(old.text, '') like 'Payment secured!%' or coalesce(old.text, '') like 'Chat Opened!%') then
      raise exception 'System messages cannot be created by editing';
    end if;
    return new;
  end if;

  -- INSERT: system cards must be backed by a real deal between the two people.
  if v_client and new.text is not null
     and (new.text like 'Payment secured!%' or new.text like 'Chat Opened!%') then
    select case when participant_1 = new.sender_id then participant_2 else participant_1 end
      into v_other from conversations where id = new.conversation_id;

    if new.text like 'Payment secured!%' then
      if not exists (
        select 1 from applications a join campaigns c on c.id = a.campaign_id
        where c.brand_id = new.sender_id and a.creator_id = v_other and a.status in ('funded', 'paid')
      ) then
        raise exception 'No funded deal exists for this conversation';
      end if;
    else
      if not exists (
        select 1 from applications a join campaigns c on c.id = a.campaign_id
        where c.brand_id = new.sender_id and a.creator_id = v_other
      ) then
        raise exception 'Only a brand with an application from this creator can open a campaign chat';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_write_guard on public.messages;
create trigger messages_write_guard
  before insert or update on public.messages
  for each row execute function public.guard_messages_write();

-- ---------- D: conversations participants are immutable ----------------------
create or replace function public.guard_conversation_participants()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and (new.participant_1, new.participant_2) is distinct from (old.participant_1, old.participant_2) then
    raise exception 'Conversation participants cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_participants_guard on public.conversations;
create trigger conversations_participants_guard
  before update on public.conversations
  for each row execute function public.guard_conversation_participants();

-- ---------- E: social tokens never readable from the browser -----------------
-- Table-level GRANT can't be narrowed with a column REVOKE (verified earlier
-- on brand_profiles), so revoke the table grant and re-grant safe columns.
-- DELETE is a separate privilege and keeps working; edge functions use the
-- service role and are unaffected.
revoke select on public.social_connections from authenticated, anon;
grant select (id, user_id, platform, platform_user_id, username, expires_at, connected_at, follower_count)
  on public.social_connections to authenticated;

-- ---------- F: SECURITY DEFINER functions are not for logged-out callers -----
revoke execute on function public.set_app_secret(text, text) from public, anon, authenticated;
grant execute on function public.set_app_secret(text, text) to service_role;

revoke execute on function public.guard_application_money_status() from public, anon, authenticated;
revoke execute on function public.lock_brand_profiles_privileged_columns() from public, anon, authenticated;
revoke execute on function public.force_application_insert_defaults() from public, anon, authenticated;
revoke execute on function public.guard_messages_write() from public, anon, authenticated;
revoke execute on function public.guard_conversation_participants() from public, anon, authenticated;

-- Signed-in only (each already checks identity internally; this just removes
-- the logged-out attack surface).
revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_set_account_status(uuid, text, text) from public, anon;
revoke execute on function public.approve_verification_request(uuid) from public, anon;
revoke execute on function public.reject_verification_request(uuid) from public, anon;
revoke execute on function public.resolve_report(uuid) from public, anon;
revoke execute on function public.notify_user(uuid, text, text, text, jsonb) from public, anon;
revoke execute on function public.can_notify_user(uuid) from public, anon;
revoke execute on function public.get_own_saved_card() from public, anon;
revoke execute on function public.get_unread_notification_count(uuid) from public, anon;
-- get_creator_track_record / get_brand_track_record stay public on purpose:
-- shared profile links show them to logged-out visitors.

-- ---------- G: the application money guard that never fired -----------------
-- The guard already in production tested `current_user not in ('postgres',...)`
-- inside a SECURITY DEFINER function, where current_user is always the owner -
-- so it never blocked anything (proven: a creator could set their own
-- application to 'paid', a brand to 'refunded'). Rebuilt on the JWT role.
-- 'funded' is now server-only too: the Stripe webhook already sets it the
-- moment a charge is confirmed, and letting the browser claim "funded" let a
-- brand fake escrow and collect a creator's work without ever paying.
create or replace function public.guard_application_money_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and new.status is distinct from old.status then
    if new.status in ('funded', 'paid', 'refunded', 'disputed') then
      raise exception 'Payment status % can only be set by the server', new.status;
    end if;
    if old.status in ('funded', 'paid', 'refunded', 'disputed') then
      raise exception 'A funded or settled deal cannot be changed from the app';
    end if;
  end if;
  return new;
end;
$$;

-- ---------- H: brand_profiles - nobody grants themselves Enterprise ----------
-- UPDATE was already reverted for is_enterprise/verified, but INSERT was wide
-- open: a new brand could create its profile with is_enterprise = true (0%
-- platform fees, forever) and verified = true. Stripe identifiers are also
-- server-owned. The approve_verification_request bypass flag is preserved.
create or replace function public.lock_brand_profiles_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and coalesce(current_setting('app.bypass_brand_profiles_lock', true), '') <> 'true' then
    if tg_op = 'INSERT' then
      new.is_enterprise := false;
      new.verified := false;
      new.stripe_customer_id := null;
      new.stripe_subscription_id := null;
      new.stripe_payment_method_id := null;
      new.card_last4 := null;
      new.card_brand := null;
      new.subscription_cancel_at_period_end := false;
    else
      new.is_enterprise := old.is_enterprise;
      new.verified := old.verified;
      new.stripe_customer_id := old.stripe_customer_id;
      new.stripe_subscription_id := old.stripe_subscription_id;
      new.stripe_payment_method_id := old.stripe_payment_method_id;
      new.card_last4 := old.card_last4;
      new.card_brand := old.card_brand;
      new.subscription_cancel_at_period_end := old.subscription_cancel_at_period_end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_brand_profiles_privileged_columns on public.brand_profiles;
create trigger lock_brand_profiles_privileged_columns
  before insert or update on public.brand_profiles
  for each row execute function public.lock_brand_profiles_privileged_columns();

-- ---------- I: profiles - role and moderation status are not self-service ----
-- A banned user could set account_status back to 'active' (every ban was
-- bypassable) and anyone could rewrite their own role. The app never updates
-- profiles from the client; admin_set_account_status is the one legitimate
-- writer, so it opts in with a transaction-local bypass flag.
create or replace function public.guard_profiles_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated')
     and coalesce(current_setting('app.bypass_profile_lock', true), '') <> 'true' then
    new.role := old.role;
    new.account_status := old.account_status;
    new.status_reason := old.status_reason;
    new.status_updated_at := old.status_updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_privileged_columns_guard on public.profiles;
create trigger profiles_privileged_columns_guard
  before update on public.profiles
  for each row execute function public.guard_profiles_privileged_columns();

create or replace function public.admin_set_account_status(target_user_id uuid, new_status text, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;
  if new_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid status';
  end if;

  perform set_config('app.bypass_profile_lock', 'true', true);
  update public.profiles
  set account_status = new_status, status_reason = reason, status_updated_at = now()
  where id = target_user_id;
end;
$$;

-- ---------- J: campaigns - no bait-and-switch, no transfers ------------------
-- A brand could rewrite the budget after a creator applied (or was funded) and
-- reassign a campaign to another brand. Not a feature the app uses: the only
-- client campaign updates are asset uploads and updated_at.
create or replace function public.guard_campaign_updates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if new.brand_id is distinct from old.brand_id then
      raise exception 'A campaign cannot be transferred to another brand';
    end if;
    if new.budget is distinct from old.budget
       and exists (select 1 from applications where campaign_id = old.id) then
      raise exception 'The budget cannot be changed once creators have applied';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_update_guard on public.campaigns;
create trigger campaigns_update_guard
  before update on public.campaigns
  for each row execute function public.guard_campaign_updates();

-- ---------- K: media URLs must be files we actually stored -------------------
-- tiktok-post-video and youtube-post-content download whatever URL is in
-- applications.deliverable_url, and a creator could write that column
-- directly: point it at an internal address (SSRF) or at someone else's
-- upload and re-post it as their own. Legitimate values are always
-- deliverables/<application_id>_<timestamp>.<ext> (and pitches/<creator>_
-- <campaign>_<timestamp>.<ext> for pitch videos), https only, no query string.
create or replace function public.guard_application_media_urls()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if new.deliverable_url is not null
       and (tg_op = 'INSERT' or new.deliverable_url is distinct from old.deliverable_url)
       and new.deliverable_url !~ ('^https://[^?#]+/deliverables/' || new.id::text || '_[0-9]+\.[A-Za-z0-9]+$') then
      raise exception 'Deliverables must be uploaded through the app';
    end if;
    if new.video_url is not null
       and (tg_op = 'INSERT' or new.video_url is distinct from old.video_url)
       and new.video_url !~ ('^https://[^?#]+/pitches/' || new.creator_id::text || '_' || new.campaign_id::text || '_[0-9]+\.[A-Za-z0-9]+$') then
      raise exception 'Pitch videos must be uploaded through the app';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_media_url_guard on public.applications;
create trigger applications_media_url_guard
  before insert or update on public.applications
  for each row execute function public.guard_application_media_urls();

revoke execute on function public.guard_profiles_privileged_columns() from public, anon, authenticated;
revoke execute on function public.guard_campaign_updates() from public, anon, authenticated;
revoke execute on function public.guard_application_media_urls() from public, anon, authenticated;
