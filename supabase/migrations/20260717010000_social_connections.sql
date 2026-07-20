-- Lets creators link Instagram/TikTok so their public profile can show a
-- handful of their actual recent posts, instead of just a plain text link.
--
-- Two tables, split by sensitivity:
-- - social_connections holds OAuth tokens - private, only the owner (and
--   the service role, used by the edge functions that refresh tokens/posts)
--   should ever read these rows.
-- - social_posts_cache holds just the public post metadata (thumbnail,
--   caption, link) that gets refreshed periodically from the provider's
--   API using the stored token - this is exactly what the creator is
--   choosing to display publicly, so it's readable by anyone.

create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  platform_user_id text not null,
  username text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.social_connections enable row level security;

create policy "owner can view own social connections"
  on public.social_connections for select
  using (auth.uid() = user_id);

create policy "owner can delete own social connections"
  on public.social_connections for delete
  using (auth.uid() = user_id);

-- Inserts/updates happen only via edge functions using the service role
-- key (which bypasses RLS), since the OAuth token exchange requires a
-- client secret that must never reach the browser.

create table public.social_posts_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok')),
  post_id text not null,
  post_url text not null,
  thumbnail_url text not null,
  caption text,
  posted_at timestamptz,
  cached_at timestamptz not null default now(),
  unique (user_id, platform, post_id)
);

alter table public.social_posts_cache enable row level security;

create policy "anyone can view cached social posts"
  on public.social_posts_cache for select
  using (true);

create index social_posts_cache_user_platform_idx
  on public.social_posts_cache (user_id, platform, posted_at desc);
