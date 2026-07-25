-- Lets a creator connect TikTok/Instagram during onboarding, before the
-- profiles/creator_profiles rows exist (those aren't created until the
-- final "Finish" step). auth.users already exists the moment sign-up/OTP
-- verification succeeds, so point the FK there instead.
alter table public.social_connections drop constraint social_connections_user_id_fkey;
alter table public.social_connections add constraint social_connections_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.social_posts_cache drop constraint social_posts_cache_user_id_fkey;
alter table public.social_posts_cache add constraint social_posts_cache_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
