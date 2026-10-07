-- Security hardening found in the 7 October re-audit.
--
-- 1. social_posts_cache: the owner's UPDATE policy let a creator rewrite ANY
--    column of their own cached posts - post_url, thumbnail, caption and the
--    follower_count that other people see on their profile. Only the edge
--    functions (service role) should write those; the app only ever updates
--    `featured`. A column REVOKE does nothing against a table-level GRANT, so
--    the table-level privilege is revoked and just `featured` is granted back.
--    (The row policy still limits it to the owner's own rows.)
--
-- 2. applications: nothing stopped a creator having two applications on the
--    same campaign (a double tap, or calling the API directly). Several
--    payment steps look up "the" application for a creator and campaign and
--    break if there are two. The unique index is only created if no duplicates
--    exist yet; otherwise it tells you and does nothing, so it can't fail.

revoke update on public.social_posts_cache from authenticated, anon;
grant update (featured) on public.social_posts_cache to authenticated;

do $$
begin
  if exists (
    select 1 from public.applications
    group by campaign_id, creator_id
    having count(*) > 1
  ) then
    raise notice 'Duplicate applications exist (same creator, same campaign). Resolve them, then run this file again to add the unique index.';
  else
    create unique index if not exists applications_one_per_creator_per_campaign
      on public.applications (campaign_id, creator_id);
  end if;
end
$$;
