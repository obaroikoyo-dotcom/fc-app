-- Creator disputes + admin can read the chat on a dispute.
--
-- 1. A creator can now dispute too: when a brand sends a funded deal back for
--    another video and the creator thinks that's unreasonable. The dispute
--    pauses the auto-refund countdown and goes to the admin like any other.
--    Raised through the raise-dispute edge function (service role), which
--    sets disputes.raised_by.
-- 2. When a brand disputes a delivery, the creator can add their side once
--    (respond_to_dispute) so the admin isn't hearing only one party.
-- 3. The admin review screen could not read chats at all. admin_dispute_chat
--    returns the conversation between the two parties on one specific
--    dispute - not arbitrary chats - and only to the admin.

alter table public.disputes
  add column if not exists raised_by text not null default 'brand' check (raised_by in ('brand', 'creator')),
  add column if not exists creator_response text,
  add column if not exists creator_responded_at timestamptz;

-- ---------- creator's side of a brand dispute --------------------------------
create or replace function public.respond_to_dispute(p_dispute_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_d record;
  v_response text := btrim(coalesce(p_response, ''));
  v_admin uuid;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if length(v_response) < 3 or length(v_response) > 1000 then
    raise exception 'Tell us your side (3-1000 characters).';
  end if;

  select d.id, d.creator_id, d.status, d.raised_by, d.creator_response, d.application_id
    into v_d
  from public.disputes d
  where d.id = p_dispute_id
  for update;

  if not found or v_d.creator_id <> auth.uid() then raise exception 'not authorized'; end if;
  if v_d.status <> 'open' then raise exception 'This dispute has already been resolved.'; end if;
  if v_d.raised_by <> 'brand' then raise exception 'You raised this dispute, so your reason is already on it.'; end if;
  if v_d.creator_response is not null then raise exception 'You have already sent your response.'; end if;

  update public.disputes
     set creator_response = v_response, creator_responded_at = now()
   where id = p_dispute_id;

  select id into v_admin from auth.users where email = 'obaroikoyo@gmail.com' limit 1;
  if v_admin is not null then
    insert into public.notifications (user_id, type, title, body, data)
    values (v_admin, 'dispute_response', 'Creator Responded to a Dispute',
            left(v_response, 140), jsonb_build_object('application_id', v_d.application_id));
  end if;
end;
$$;

revoke execute on function public.respond_to_dispute(uuid, text) from public, anon;
grant execute on function public.respond_to_dispute(uuid, text) to authenticated;

-- ---------- admin dispute list (now includes who raised it + the response) ---
drop function if exists public.admin_open_disputes();
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
  revision_count int,
  raised_by text,
  creator_response text
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
         a.deliverable_url, a.previous_deliverable_url, a.revision_note, a.revision_count,
         d.raised_by, d.creator_response
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

-- ---------- admin reads the chat for one dispute ----------------------------
create or replace function public.admin_dispute_chat(p_application_id uuid)
returns table (
  id uuid,
  sender_id uuid,
  sender_role text,
  text text,
  created_at timestamptz,
  video_url text,
  image_url text,
  deleted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand uuid;
  v_creator uuid;
begin
  if auth.role() <> 'authenticated'
     or (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  -- Only for an application that actually has a dispute on it.
  select d.brand_id, d.creator_id into v_brand, v_creator
  from public.disputes d
  where d.application_id = p_application_id
  order by d.created_at desc
  limit 1;
  if not found then raise exception 'no dispute for this application'; end if;

  return query
  select * from (
    select m.id, m.sender_id,
           case when m.sender_id = v_brand then 'brand' when m.sender_id = v_creator then 'creator' else 'other' end,
           m.text, m.created_at, m.video_url, m.image_url, (m.deleted_at is not null)
    from public.messages m
    join public.conversations co on co.id = m.conversation_id
    where (co.participant_1 = v_brand and co.participant_2 = v_creator)
       or (co.participant_1 = v_creator and co.participant_2 = v_brand)
    order by m.created_at desc
    limit 300
  ) recent
  order by recent.created_at asc;
end;
$$;

revoke execute on function public.admin_dispute_chat(uuid) from public, anon;
grant execute on function public.admin_dispute_chat(uuid) to authenticated;
