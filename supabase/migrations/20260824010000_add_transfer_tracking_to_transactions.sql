-- Lets release-payout create a Stripe Transfer tied to the specific charge's
-- funds (source_transaction) instead of the platform's general balance, and
-- record what happened without an extra Stripe round-trip at release time.
alter table public.transactions add column stripe_charge_id text;
alter table public.transactions add column stripe_transfer_id text;
alter table public.transactions add column payout_released_at timestamptz;
