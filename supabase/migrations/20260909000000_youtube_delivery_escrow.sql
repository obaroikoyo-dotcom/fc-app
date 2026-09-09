-- Extends the TikTok/Instagram-gated payout release pattern to YouTube -
-- a creator can also post their deliverable to YouTube (as a Short) and
-- have that confirmed live before payout releases. Same shape as
-- 20260907000000_instagram_delivery_escrow.sql for Instagram.
alter table public.social_connections drop constraint social_connections_platform_check;
alter table public.social_connections add constraint social_connections_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.social_posts_cache drop constraint social_posts_cache_platform_check;
alter table public.social_posts_cache add constraint social_posts_cache_platform_check
  check (platform in ('instagram', 'tiktok', 'youtube'));

alter table public.applications drop constraint applications_payout_release_mode_check;
alter table public.applications add constraint applications_payout_release_mode_check
  check (payout_release_mode in ('instant', 'tiktok_gated', 'instagram_gated', 'youtube_gated'));

alter table public.campaign_posts drop constraint campaign_posts_platform_check;
alter table public.campaign_posts add constraint campaign_posts_platform_check
  check (platform in ('tiktok', 'instagram', 'youtube'));

-- YouTube's upload API returns a video id immediately, but processing
-- (transcoding, virus/copyright checks) happens after - status is polled
-- against this id the same way Instagram's container id is polled.
alter table public.campaign_posts add column if not exists youtube_video_id text;
