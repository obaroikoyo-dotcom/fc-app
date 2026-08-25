-- The notifications INSERT policy only ever checked the `type` enum value,
-- never who the notification was actually for - any authenticated user
-- could plant a notification (including "payment_received") aimed at any
-- other user, with attacker-controlled title/body/data. Legitimate use is
-- inherently cross-user though (a brand notifies a creator, etc.), so the
-- fix isn't "you can only notify yourself" - it's "you must have a real,
-- verifiable relationship to the person you're notifying, matching the
-- specific notification type". This mirrors the security definer pattern
-- already used for admin actions (resolve_report, admin_set_account_status).
create or replace function public.notify_user(
  target_user_id uuid,
  notif_type text,
  notif_title text,
  notif_body text,
  notif_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if notif_type = 'campaign_application' then
    -- creator notifying the brand of a new application
    if not exists (
      select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = (notif_data->>'campaign_id')::uuid
        and a.creator_id = auth.uid() and c.brand_id = target_user_id
    ) then raise exception 'not authorized'; end if;

  elsif notif_type in ('campaign_chatting', 'payment_received') then
    -- brand notifying the creator on their own campaign
    if not exists (
      select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = (notif_data->>'campaign_id')::uuid
        and a.creator_id = target_user_id and c.brand_id = auth.uid()
    ) then raise exception 'not authorized'; end if;

  elsif notif_type = 'new_message' then
    -- either participant of a shared conversation notifying the other
    if not exists (
      select 1 from public.conversations co
      where co.id = (notif_data->>'conversation_id')::uuid
        and ((co.participant_1 = auth.uid() and co.participant_2 = target_user_id)
          or (co.participant_2 = auth.uid() and co.participant_1 = target_user_id))
    ) then raise exception 'not authorized'; end if;

  elsif notif_type = 'application_reminder' then
    -- creator nudging the brand about their own still-pending application
    if not exists (
      select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = (notif_data->>'campaign_id')::uuid
        and a.creator_id = auth.uid() and c.brand_id = target_user_id and a.status = 'pending'
    ) then raise exception 'not authorized'; end if;

  else
    raise exception 'unknown notification type';
  end if;

  insert into public.notifications (user_id, type, title, body, data)
  values (target_user_id, notif_type, notif_title, notif_body, notif_data);
end;
$$;

grant execute on function public.notify_user(uuid, text, text, text, jsonb) to authenticated;

drop policy if exists "Allow insert of known notification types" on public.notifications;
create policy "no direct client inserts"
  on public.notifications for insert
  with check (false);
