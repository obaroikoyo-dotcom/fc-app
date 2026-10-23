-- The admin review screen's "Read chat" on a dispute failed with
--   "structure of query does not match function result type".
-- admin_dispute_chat promised its time column as timestamptz, but messages.created_at is a
-- plain timestamp (no time zone) that holds UTC, so Postgres refused to return it. Nothing had
-- ever run this function until the first real dispute.
--
-- Same function, same checks, same permissions as 20261006030000_creator_disputes_and_admin_chat.sql;
-- the only change is that the time is given its zone (UTC, which is how the app already reads it).
-- Safe to run on top of the old version.

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
           case when m.sender_id = v_brand then 'brand' when m.sender_id = v_creator then 'creator' else 'other' end as sender_role,
           m.text,
           (m.created_at at time zone 'UTC') as created_at,
           m.video_url, m.image_url, (m.deleted_at is not null) as deleted
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
