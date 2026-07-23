-- Creators pick which of their own recent videos/posts to feature on their
-- public profile (up to 5), rather than the app auto-picking the most recent
-- ones for them. social_posts_cache now holds everything fetched from the
-- provider (up to ~20), and `featured` marks which ones are actually shown
-- publicly.
alter table public.social_posts_cache add column featured boolean not null default false;

-- Public visibility is now scoped to featured posts only - the full fetched
-- set is for the owner's picker UI, not for public display.
drop policy if exists "anyone can view cached social posts" on public.social_posts_cache;
create policy "anyone can view featured social posts"
  on public.social_posts_cache for select
  using (featured = true);

create policy "owner can view all own cached social posts"
  on public.social_posts_cache for select
  using (auth.uid() = user_id);

create policy "owner can update own cached social posts"
  on public.social_posts_cache for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
