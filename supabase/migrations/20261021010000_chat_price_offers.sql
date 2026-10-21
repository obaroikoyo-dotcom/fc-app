-- Changing a deal's price inside the chat.
--
-- A brand or a creator can offer a different price for one deal; the other person
-- accepts or declines. Only once it is accepted does the deal's price change, and
-- only for that one deal: the campaign's own budget (what Explore and the Market
-- tab show) is never touched. Fees are worked out on the agreed price the same way
-- as on the budget (create-payment-intent does that - it reads the accepted offer).
--
-- Nothing here can be written straight from the browser. Offers are made and
-- answered through the two functions below, which check who is asking, that the
-- deal is still open, and that the price is sane. The price is locked once a deal
-- is paid, disputed or closed.

create table if not exists public.price_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount between 1 and 100000), -- whole pounds, like the campaign budget
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'replaced')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- One open offer per deal: a new offer replaces the one before it.
create unique index if not exists price_offers_one_pending
  on public.price_offers (application_id) where status = 'pending';
create index if not exists price_offers_application_idx
  on public.price_offers (application_id, created_at desc);

alter table public.price_offers enable row level security;

drop policy if exists "Deal parties can read offers" on public.price_offers;
create policy "Deal parties can read offers" on public.price_offers
  for select to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.id = price_offers.application_id
        and (a.creator_id = auth.uid() or c.brand_id = auth.uid())
    )
  );

-- No insert/update/delete policies on purpose, and no table grants for writing either.
revoke all on public.price_offers from anon, authenticated;
grant select on public.price_offers to authenticated;

-- Live updates in the chat.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'price_offers'
  ) then
    alter publication supabase_realtime add table public.price_offers;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Offer a price
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

  -- A new offer replaces whatever was waiting (a counter-offer).
  update public.price_offers
     set status = 'replaced', responded_at = now()
   where application_id = p_application_id and status = 'pending';

  insert into public.price_offers (application_id, proposed_by, amount)
  values (p_application_id, auth.uid(), p_amount)
  returning id into v_id;

  v_other := case when auth.uid() = v_app.creator_id then v_app.brand_id else v_app.creator_id end;
  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_other, 'price_offer', 'New price offered',
    'A new price of £' || p_amount || ' was offered for "' || v_app.campaign_name || '". Open the chat to accept or decline.',
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
    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_other, 'price_offer',
      case when v_new_status = 'accepted' then 'Price agreed' else 'Price offer declined' end,
      case when v_new_status = 'accepted'
        then 'Your offer of £' || v_offer.amount || ' for "' || v_app.campaign_name || '" was accepted.'
        else 'Your offer of £' || v_offer.amount || ' for "' || v_app.campaign_name || '" was declined.'
      end,
      jsonb_build_object('campaign_id', v_app.campaign_id, 'application_id', v_app.id, 'conversation_id', v_convo)
    );
  end if;
end;
$$;

revoke execute on function public.answer_deal_price(uuid, text) from public, anon;
grant execute on function public.answer_deal_price(uuid, text) to authenticated;
