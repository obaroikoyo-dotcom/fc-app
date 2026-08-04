-- Brand "track record" trust signals: how long a brand takes to respond to
-- applications, how many collaborations they've actually completed, and
-- reviews left by creators who got paid out on a campaign with them.

alter table public.applications add column responded_at timestamptz;

create table public.brand_reviews (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (creator_id, campaign_id)
);

alter table public.brand_reviews enable row level security;

-- Reviews are a public trust signal, same as social_posts_cache.
create policy "anyone can view brand reviews"
  on public.brand_reviews for select
  using (true);

-- Only a creator who was actually paid out on that exact campaign, by that
-- exact brand, can leave a review for it - and only once (unique constraint
-- above covers re-submission, this covers "is this a real completed job").
create policy "creator can review a brand after a paid campaign"
  on public.brand_reviews for insert
  with check (
    auth.uid() = creator_id
    and exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = brand_reviews.campaign_id
      and a.creator_id = auth.uid()
      and a.status = 'paid'
      and c.brand_id = brand_reviews.brand_id
    )
  );

create policy "creator can edit own review"
  on public.brand_reviews for update
  using (auth.uid() = creator_id);

create policy "creator can delete own review"
  on public.brand_reviews for delete
  using (auth.uid() = creator_id);

-- Aggregate stats only (no raw application/message rows leave this
-- function), so it's safe to run as security definer and expose to anyone -
-- a creator sizing up a brand shouldn't need to already be a participant in
-- that brand's applications to see how responsive/reliable they are.
create or replace function public.get_brand_track_record(target_brand_id uuid)
returns table (
  completed_campaigns bigint,
  avg_response_hours numeric,
  avg_rating numeric,
  review_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    (
      select count(distinct a.campaign_id)
      from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where c.brand_id = target_brand_id and a.status = 'paid'
    ) as completed_campaigns,
    (
      select avg(extract(epoch from (a.responded_at - a.created_at)) / 3600.0)
      from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where c.brand_id = target_brand_id and a.responded_at is not null
    ) as avg_response_hours,
    (
      select avg(r.rating)::numeric from public.brand_reviews r where r.brand_id = target_brand_id
    ) as avg_rating,
    (
      select count(*) from public.brand_reviews r where r.brand_id = target_brand_id
    ) as review_count;
$$;

grant execute on function public.get_brand_track_record(uuid) to authenticated, anon;
