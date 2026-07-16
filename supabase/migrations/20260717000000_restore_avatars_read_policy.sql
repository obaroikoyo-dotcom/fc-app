-- The avatars SELECT policy dropped in the previous migration turned out to
-- be load-bearing: avatar uploads use a fixed path per user (creators/{id}.ext)
-- with upsert:true, and Supabase Storage's upsert needs a SELECT to detect the
-- existing row before it can update it. Without that policy, re-uploads can't
-- see the old file, fall through to an INSERT, and fail on the unique
-- (bucket_id, name) constraint - breaking profile picture changes.
-- Avatars are meant to be public (shown on public profiles) anyway, so unlike
-- message-media this was never actually a sensitive-data exposure - restore it.
create policy "read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');
