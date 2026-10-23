-- Better notifications for price offers: they say who is asking, a counter-offer reads as a
-- counter-offer, and an answer says what was answered. Same two functions as
-- 20261021010000_chat_price_offers.sql with only the notification wording changed
-- (the sentences are mirrored in src/lib/priceNotices.ts, which the phone push messages
-- use, so keep the two in step). Safe to run on top of the old version.

-- ---------------------------------------------------------------------------
-- Offer a price (or answer someone's waiting offer with a different one)
-- ---------------------------------------------------------------------------
create or replace function public.propose_deal_price(p_application_id uuid, p_amount integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_current integer;
  v_other uuid;
  v_convo uuid;
  v_id uuid;
  v_name text;
  v_prev_by uuid;
  v_counter boolean;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise exception 'Enter a price between £1 and £100,000.';
  end if;

  select a.id, a.creator_id, a.status, a.campaign_id, c.brand_id, c.type, c.name as campaign_name,
         case when c.budget::text ~ '^[0-9]+(\.[0-9]+)?$' then round(c.budget::text::numeric)::integer else 0 end as budget
    into v_app
  from public.applications a join public.campaigns c on c.id = a.campaign_id
  where a.id = p_application_id
  for update of a;

  if not found or auth.uid() not in (v_app.creator_id, v_app.brand_id) then
    raise exception 'not authorized';
  end if;
  if v_app.type <> 'paid' then raise exception 'Only paid campaigns have a price to change.'; end if;
  if v_app.status in ('paid', 'funded', 'rejected', 'disputed') then
    raise exception 'The price is locked once a deal is paid or closed.';
  end if;
  if exists (
    select 1 from public.transactions t
    where t.campaign_id = v_app.campaign_id and t.creator_id = v_app.creator_id and t.status = 'completed'
  ) then
    raise exception 'The price is locked once a deal is paid or closed.';
  end if;

  -- Offers belong in the chat: the two of them must already be talking.
  select cv.id into v_convo from public.conversations cv
  where (cv.participant_1 = v_app.creator_id and cv.participant_2 = v_app.brand_id)
     or (cv.participant_1 = v_app.brand_id and cv.participant_2 = v_app.creator_id)
  limit 1;
  if v_convo is null then
    raise exception 'Start the conversation first, then agree a price in the chat.';
  end if;

  if (select count(*) from public.price_offers where application_id = p_application_id) >= 30 then
    raise exception 'There have been a lot of offers on this deal. Agree the price in the chat and go with the current one.';
  end if;

  select coalesce(
    (select o.amount from public.price_offers o
      where o.application_id = p_application_id and o.status = 'accepted'
      order by o.responded_at desc nulls last, o.created_at desc limit 1),
    v_app.budget
  ) into v_current;
  if p_amount = v_current then raise exception 'That is already the price for this deal.'; end if;

  -- Is this answering the other person's waiting offer with a different price?
  select o.proposed_by into v_prev_by from public.price_offers o
  where o.application_id = p_application_id and o.status = 'pending'
  limit 1;
  v_counter := v_prev_by is not null and v_prev_by <> auth.uid();

  -- A new offer replaces whatever was waiting (a counter-offer).
  update public.price_offers
     set status = 'replaced', responded_at = now()
   where application_id = p_application_id and status = 'pending';

  insert into public.price_offers (application_id, proposed_by, amount)
  values (p_application_id, auth.uid(), p_amount)
  returning id into v_id;

  select coalesce(
    (select cp.name from public.creator_profiles cp where cp.id = auth.uid()),
    (select bp.name from public.brand_profiles bp where bp.id = auth.uid()),
    'Someone'
  ) into v_name;

  v_other := case when auth.uid() = v_app.creator_id then v_app.brand_id else v_app.creator_id end;
  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_other, 'price_offer',
    case when v_counter then 'Counter offer' else 'New price offered' end,
    v_name || case when v_counter then ' countered with £' else ' offered £' end
      || to_char(p_amount, 'FM999,999') || ' for "' || v_app.campaign_name || '".',
    jsonb_build_object('campaign_id', v_app.campaign_id, 'application_id', v_app.id, 'conversation_id', v_convo)
  );

  return v_id;
end;
$$;

revoke execute on function public.propose_deal_price(uuid, integer) from public, anon;
grant execute on function public.propose_deal_price(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Answer an offer: the other person accepts or declines, the offerer can withdraw
-- ---------------------------------------------------------------------------
create or replace function public.answer_deal_price(p_offer_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer record;
  v_app record;
  v_app_id uuid;
  v_other uuid;
  v_convo uuid;
  v_new_status text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_action not in ('accept', 'decline', 'withdraw') then raise exception 'not authorized'; end if;

  -- Lock the deal first and the offer second, the same order propose_deal_price
  -- uses, so two people acting at once can't deadlock.
  select application_id into v_app_id from public.price_offers where id = p_offer_id;
  if v_app_id is null then raise exception 'not authorized'; end if;

  select a.id, a.creator_id, a.status, a.campaign_id, c.brand_id, c.name as campaign_name
    into v_app
  from public.applications a join public.campaigns c on c.id = a.campaign_id
  where a.id = v_app_id
  for update of a;

  if not found or auth.uid() not in (v_app.creator_id, v_app.brand_id) then
    raise exception 'not authorized';
  end if;

  select * into v_offer from public.price_offers where id = p_offer_id for update;
  if not found then raise exception 'not authorized'; end if;
  if v_offer.status <> 'pending' then raise exception 'This offer is no longer open.'; end if;

  if p_action = 'withdraw' then
    if auth.uid() <> v_offer.proposed_by then raise exception 'not authorized'; end if;
    v_new_status := 'withdrawn';
  else
    -- You can't answer your own offer.
    if auth.uid() = v_offer.proposed_by then raise exception 'not authorized'; end if;
    v_new_status := case when p_action = 'accept' then 'accepted' else 'declined' end;
  end if;

  if v_new_status = 'accepted' then
    if v_app.status in ('paid', 'funded', 'rejected', 'disputed')
       or exists (
         select 1 from public.transactions t
         where t.campaign_id = v_app.campaign_id and t.creator_id = v_app.creator_id and t.status = 'completed'
       ) then
      raise exception 'The price is locked once a deal is paid or closed.';
    end if;
    -- A payment that was started at the old price and is still open: let it
    -- finish or lapse before the price changes, so what is charged is always
    -- what was agreed.
    if exists (
      select 1 from public.transactions t
      where t.campaign_id = v_app.campaign_id and t.creator_id = v_app.creator_id
        and t.status = 'pending' and t.created_at > now() - interval '2 hours'
    ) then
      raise exception 'A payment is being set up for this deal. Try again in a few minutes.';
    end if;
  end if;

  update public.price_offers
     set status = v_new_status, responded_at = now()
   where id = p_offer_id;

  if v_new_status <> 'withdrawn' then
    v_other := v_offer.proposed_by;
    select cv.id into v_convo from public.conversations cv
    where (cv.participant_1 = v_app.creator_id and cv.participant_2 = v_app.brand_id)
       or (cv.participant_1 = v_app.brand_id and cv.participant_2 = v_app.creator_id)
    limit 1;
    select coalesce(
      (select cp.name from public.creator_profiles cp where cp.id = auth.uid()),
      (select bp.name from public.brand_profiles bp where bp.id = auth.uid()),
      'Someone'
    ) into v_name;
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_other, 'price_offer',
      case when v_new_status = 'accepted' then 'Price agreed' else 'Offer declined' end,
      case when v_new_status = 'accepted'
        then v_name || ' accepted £' || to_char(v_offer.amount, 'FM999,999') || ' for "' || v_app.campaign_name || '".'
        else v_name || ' declined your offer of £' || to_char(v_offer.amount, 'FM999,999') || ' for "' || v_app.campaign_name || '".'
      end,
      jsonb_build_object('campaign_id', v_app.campaign_id, 'application_id', v_app.id, 'conversation_id', v_convo)
    );
  end if;
end;
$$;

revoke execute on function public.answer_deal_price(uuid, text) from public, anon;
grant execute on function public.answer_deal_price(uuid, text) to authenticated;
