-- Creator-side mirror of 20260801020000_brand_track_record.sql: brands
-- leaving reviews for creators, plus an aggregate stats RPC. Response time
-- doesn't make sense in this direction (creators don't accept/reject
-- applications), so the equivalent reliability signal here is turnaround
-- time - how long a creator takes to deliver once accepted.

create table public.creator_reviews (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (brand_id, campaign_id)
);

alter table public.creator_reviews enable row level security;

create policy "anyone can view creator reviews"
  on public.creator_reviews for select
  using (true);

-- Only the brand that actually paid out a creator on that exact campaign
-- can review it, and only once (unique constraint above).
create policy "brand can review a creator after a paid campaign"
  on public.creator_reviews for insert
  with check (
    auth.uid() = brand_id
    and exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = creator_reviews.campaign_id
      and a.creator_id = creator_reviews.creator_id
      and a.status = 'paid'
      and c.brand_id = auth.uid()
    )
  );

create policy "brand can edit own creator review"
  on public.creator_reviews for update
  using (auth.uid() = brand_id);

create policy "brand can delete own creator review"
  on public.creator_reviews for delete
  using (auth.uid() = brand_id);

create or replace function public.get_creator_track_record(target_creator_id uuid)
returns table (
  completed_campaigns bigint,
  avg_turnaround_hours numeric,
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
      where a.creator_id = target_creator_id and a.status = 'paid'
    ) as completed_campaigns,
    (
      select avg(extract(epoch from (a.deliverable_uploaded_at - a.responded_at)) / 3600.0)
      from public.applications a
      where a.creator_id = target_creator_id
      and a.deliverable_uploaded_at is not null
      and a.responded_at is not null
    ) as avg_turnaround_hours,
    (
      select avg(r.rating)::numeric from public.creator_reviews r where r.creator_id = target_creator_id
    ) as avg_rating,
    (
      select count(*) from public.creator_reviews r where r.creator_id = target_creator_id
    ) as review_count;
$$;

grant execute on function public.get_creator_track_record(uuid) to authenticated, anon;
