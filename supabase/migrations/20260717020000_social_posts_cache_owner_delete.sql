-- Lets a creator's own disconnect action also clear their cached posts from
-- public display immediately, instead of leaving stale posts visible until
-- the next refresh overwrites them.
create policy "owner can delete own cached social posts"
  on public.social_posts_cache for delete
  using (auth.uid() = user_id);
