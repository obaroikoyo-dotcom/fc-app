-- notify_user's payment_received/campaign_chatting branch only checked that
-- SOME application existed between the caller's campaign and the target
-- creator, with no status constraint - unlike the sibling
-- application_reminder branch, which does require status = 'pending'. That
-- meant a brand with any (even still-pending or rejected) application could
-- fire a fake "Payment Received" notification with fully attacker-controlled
-- title/body, which Messages.tsx renders as a dedicated "you got paid"
-- popup - potentially tricking a creator into delivering content before
-- being paid. payment_received now requires a real funded/paid application,
-- matching what actually gates that notification in the legitimate flow.
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
    if not exists (
      select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = (notif_data->>'campaign_id')::uuid
        and a.creator_id = auth.uid() and c.brand_id = target_user_id
    ) then raise exception 'not authorized'; end if;

  elsif notif_type = 'campaign_chatting' then
    if not exists (
      select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = (notif_data->>'campaign_id')::uuid
        and a.creator_id = target_user_id and c.brand_id = auth.uid()
    ) then raise exception 'not authorized'; end if;

  elsif notif_type = 'payment_received' then
    if not exists (
      select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = (notif_data->>'campaign_id')::uuid
        and a.creator_id = target_user_id and c.brand_id = auth.uid()
        and a.status in ('funded', 'paid')
    ) then raise exception 'not authorized'; end if;

  elsif notif_type = 'new_message' then
    if not exists (
      select 1 from public.conversations co
      where co.id = (notif_data->>'conversation_id')::uuid
        and ((co.participant_1 = auth.uid() and co.participant_2 = target_user_id)
          or (co.participant_2 = auth.uid() and co.participant_1 = target_user_id))
    ) then raise exception 'not authorized'; end if;

  elsif notif_type = 'application_reminder' then
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
