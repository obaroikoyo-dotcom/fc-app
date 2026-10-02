-- Three confirmed data-exposure/integrity issues found auditing the payment
-- path, none related to the share-link bug that surfaced them:
--
-- 1. brand_profiles' "Anyone can view brand profiles" policy has no row
--    restriction (qual: true) and RLS only filters rows, not columns - so
--    any signed-in user could already run
--    `select stripe_customer_id, stripe_payment_method_id, card_last4,
--    billing_address_line1, ... from brand_profiles` for ANY brand, not
--    just their own. Column-level REVOKE closes this regardless of which
--    row policy lets a row through. The brand's own saved-card display
--    (Messages.tsx, "use saved card ending in 1234") is the one legitimate
--    client read of card_last4/card_brand/stripe_payment_method_id - a
--    SECURITY DEFINER function lets that one case through without
--    re-opening the columns to everyone else's row.
--
-- 2. applications' SELECT policy was `auth.uid() is not null` - any logged
--    in user, not just the creator or brand on that specific application -
--    could read every application on the platform: pitch messages,
--    deliverable video URLs before they're ever paid for, budgets. Narrowed
--    to mirror the UPDATE policy's existing scoping.
--
-- 3. transactions' "Brands can update own transactions" policy let a brand
--    directly set stripe_transfer_id to any non-null value on their own
--    transaction row, with no column restriction. releasePayoutForApplication
--    treats a non-null stripe_transfer_id as "already paid out" and flips
--    applications.status to "paid" without ever creating a real Stripe
--    Transfer - a brand could use this to make the system believe a
--    creator was paid when they never were. Nothing in the app actually
--    uses this policy (grep confirms zero client-side writes to
--    transactions - every real write goes through an edge function on the
--    service-role key, which bypasses RLS entirely), so it's dropped
--    outright rather than narrowed.

revoke select (
  stripe_customer_id, stripe_subscription_id, stripe_payment_method_id,
  card_last4, card_brand,
  billing_address_line1, billing_address_line2, billing_city, billing_state,
  billing_postal_code, billing_country
) on public.brand_profiles from authenticated, anon;

create or replace function public.get_own_saved_card()
returns table (stripe_payment_method_id text, card_last4 text, card_brand text)
language sql
security definer
set search_path = public
as $$
  select stripe_payment_method_id, card_last4, card_brand
  from brand_profiles
  where id = auth.uid();
$$;
grant execute on function public.get_own_saved_card() to authenticated;

drop policy if exists "read applications" on public.applications;
create policy "read applications" on public.applications for select to authenticated
using (
  auth.uid() = creator_id
  or auth.uid() = (select brand_id from campaigns where campaigns.id = applications.campaign_id)
);

drop policy if exists "Brands can update own transactions" on public.transactions;
