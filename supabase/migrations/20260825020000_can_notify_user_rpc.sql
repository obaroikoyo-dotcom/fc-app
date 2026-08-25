-- Backs send-push's relationship check: previously any authenticated caller
-- could push arbitrary content to any user_id with only "some session
-- exists" checked. This returns true only if the caller and target share an
-- applications/campaigns relationship (either direction) or are the two
-- participants of a conversation - the same shapes notify_user's own
-- per-type checks recognize, collapsed into one boolean since send-push
-- doesn't carry a notification `type` to discriminate on.
create or replace function public.can_notify_user(target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.applications a join public.campaigns c on c.id = a.campaign_id
    where (a.creator_id = auth.uid() and c.brand_id = target_user_id)
       or (a.creator_id = target_user_id and c.brand_id = auth.uid())
  )
  or exists (
    select 1 from public.conversations co
    where (co.participant_1 = auth.uid() and co.participant_2 = target_user_id)
       or (co.participant_2 = auth.uid() and co.participant_1 = target_user_id)
  );
$$;

grant execute on function public.can_notify_user(uuid) to authenticated;
