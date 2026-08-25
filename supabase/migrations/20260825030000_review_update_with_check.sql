-- The "edit own review" UPDATE policies on brand_reviews/creator_reviews had
-- no WITH CHECK clause, which Postgres defaults to reusing USING - so a
-- reviewer could retarget which brand/campaign/creator their review claims
-- to be about after creation (rewriting brand_id/campaign_id/creator_id to
-- an unrelated pairing) without ever re-validating the "actually completed
-- a paid campaign with this specific party" relationship the INSERT policy
-- enforces. Re-running that same check against the proposed new row closes it.
alter policy "creator can edit own review" on public.brand_reviews
  with check (
    auth.uid() = creator_id
    and exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = brand_reviews.campaign_id
      and a.creator_id = auth.uid()
      and a.status = 'paid'
      and c.brand_id = brand_reviews.brand_id
    )
  );

alter policy "brand can edit own creator review" on public.creator_reviews
  with check (
    auth.uid() = brand_id
    and exists (
      select 1 from public.applications a
      join public.campaigns c on c.id = a.campaign_id
      where a.campaign_id = creator_reviews.campaign_id
      and a.creator_id = creator_reviews.creator_id
      and a.status = 'paid'
      and c.brand_id = auth.uid()
    )
  );
