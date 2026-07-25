-- Lets the profile show the real follower count from the connected
-- account instead of trusting whatever number the creator typed in.
-- Denormalized onto social_posts_cache (same reasoning as username) since
-- that's the table other visitors can actually read - social_connections
-- itself is owner-only by RLS.
alter table public.social_connections add column follower_count integer;
alter table public.social_posts_cache add column follower_count integer;
