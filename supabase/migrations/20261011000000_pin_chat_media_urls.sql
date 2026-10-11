-- Chat photos and videos were saved as whatever web address the browser sent, so
-- a modified client could post a message that makes the other person's phone
-- load a picture or video from any website (tracking, or content nobody
-- uploaded). guard_messages_write already stops fake system cards and edits to
-- other people's messages. It now also requires a new message's media link to
-- be a file the app itself stored for this conversation and this sender:
--   https://<storage host>/<conversation id>/<sender id>_<number>.<ext>
-- The storage host is the one r2-presigned-url records in app_secrets
-- (r2_public_host). Until that has been recorded the host part is skipped and
-- only the path shape is checked, so nothing breaks during the switch-over.
-- Everything else in the function is unchanged from
-- 20261005010000_close_second_audit_findings.sql.

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
  v_host text;
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

  -- INSERT: photo and video links must be files this app stored for this
  -- conversation and this sender.
  if v_client and (new.video_url is not null or new.image_url is not null) then
    select value into v_host from public.app_secrets where key = 'r2_public_host';

    if new.video_url is not null and (
         new.video_url !~ ('^https://[^?#]+/' || new.conversation_id::text || '/' || new.sender_id::text || '_[0-9]+\.[A-Za-z0-9]+$')
         or (v_host is not null and not starts_with(lower(new.video_url), 'https://' || lower(v_host) || '/'))
       ) then
      raise exception 'Videos must be uploaded through the app';
    end if;

    if new.image_url is not null and (
         new.image_url !~ ('^https://[^?#]+/' || new.conversation_id::text || '/' || new.sender_id::text || '_[0-9]+\.[A-Za-z0-9]+$')
         or (v_host is not null and not starts_with(lower(new.image_url), 'https://' || lower(v_host) || '/'))
       ) then
      raise exception 'Photos must be uploaded through the app';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_messages_write() from public, anon, authenticated;
