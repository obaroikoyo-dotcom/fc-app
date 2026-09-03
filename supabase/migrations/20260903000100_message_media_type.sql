-- Recorded permanently at send time (never cleared) - once media_expired_at
-- is set and video_url/image_url go to null, this is the only remaining
-- way to know whether the expired-media placeholder should say "photo" or
-- "video".
alter table public.messages add column if not exists media_type text;
