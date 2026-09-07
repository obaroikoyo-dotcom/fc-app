-- Extends the TikTok-gated payout release pattern (20260730000000) to
-- Instagram - a creator can now also post their deliverable to Instagram
-- (as a Reel) and have that confirmed live before payout releases, using
-- the same social_connections row already created by the existing
-- Instagram OAuth connect flow.
alter table public.applications drop constraint applications_payout_release_mode_check;
alter table public.applications add constraint applications_payout_release_mode_check
  check (payout_release_mode in ('instant', 'tiktok_gated', 'instagram_gated'));

alter table public.campaign_posts drop constraint campaign_posts_platform_check;
alter table public.campaign_posts add constraint campaign_posts_platform_check
  check (platform in ('tiktok', 'instagram'));

-- Instagram's Content Publishing API is a create-container-then-publish
-- flow (unlike TikTok's single publish_id) - the container id has to be
-- tracked separately while status is polled before the actual publish call.
alter table public.campaign_posts add column if not exists ig_container_id text;
