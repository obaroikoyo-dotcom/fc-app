-- notifications: the INSERT policy allowed literally anything
-- (WITH CHECK (true)) - any authenticated user could insert an arbitrary
-- notification row for any other user, with any type/title/body. Scope it
-- to the actual set of notification types the app generates.
drop policy if exists "Allow insert for authenticated users" on public.notifications;
create policy "Allow insert of known notification types"
  on public.notifications for insert
  with check (
    type in ('new_message', 'campaign_application', 'campaign_chatting', 'payment_received')
  );

-- transactions: this table is only ever inserted by the create-payment-intent
-- edge function, using the service role key (which bypasses RLS entirely).
-- No client-side code ever inserts here directly, so the client-facing
-- "always true" INSERT policy served no purpose except as an open door.
drop policy if exists "Authenticated users can insert transactions" on public.transactions;

-- Storage: avatars/campaign-pitches/message-media are public buckets, so
-- getPublicUrl() already serves any object by its exact known path with no
-- RLS check at all - these broad SELECT policies only ever added the
-- ability to LIST/browse every file in the bucket, which the app never
-- needs and shouldn't allow (message-media in particular holds private
-- chat videos between specific pairs of users).
drop policy if exists "read avatars" on storage.objects;
drop policy if exists "allow authenticated users to read message media" on storage.objects;
drop policy if exists "allow authenticated users to upload and read pitch 1shl9gx_1" on storage.objects;
