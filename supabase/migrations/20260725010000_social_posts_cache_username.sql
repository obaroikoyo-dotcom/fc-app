-- Lets the public profile display the verified platform username next to
-- featured posts. social_connections (which already stores it) is
-- owner-only by RLS, so it can't be read by other visitors - denormalize
-- the username onto social_posts_cache instead, which is already
-- publicly readable for featured rows.
alter table public.social_posts_cache add column username text;
