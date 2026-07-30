-- Lets a creator's deliverable video be posted to TikTok (by either the
-- creator or the brand) and have FlipCollab detect when it's actually
-- live, instead of just trusting a manual "I posted it" claim.
--
-- payout_release_mode stays 'instant' by default - the existing pay flow
-- (charge + immediately mark paid) is completely unchanged unless a deal
-- specifically opts into 'tiktok_gated', where paying charges the card and
-- holds the transaction until a creator-posted video is confirmed live.
alter table public.applications add column deliverable_url text;
alter table public.applications add column deliverable_uploaded_at timestamptz;
alter table public.applications add column payout_release_mode text not null default 'instant'
  check (payout_release_mode in ('instant', 'tiktok_gated'));

-- One row per post attempt - either party can post the same deliverable
-- to their own connected TikTok account. Brand posts are only ever
-- allowed once the creator has actually been paid (enforced in the app,
-- not here, since it depends on the same application's current status).
create table public.campaign_posts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  posted_by_user_id uuid not null references auth.users(id) on delete cascade,
  posted_by_role text not null check (posted_by_role in ('creator', 'brand')),
  platform text not null default 'tiktok' check (platform in ('tiktok')),
  tiktok_publish_id text,
  post_url text,
  status text not null default 'processing' check (status in ('processing', 'published', 'failed')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.campaign_posts enable row level security;

create policy "creator can view own campaign posts"
  on public.campaign_posts for select
  using (
    auth.uid() = posted_by_user_id
    or exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.id = campaign_posts.application_id
      and (a.creator_id = auth.uid() or c.brand_id = auth.uid())
    )
  );

-- Inserts/updates happen only via edge functions using the service role
-- key, since posting requires the poster's stored access token (never
-- exposed to the client) and status updates come from polling TikTok's
-- own API, not a user action.
