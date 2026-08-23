-- Backs Stripe Connect creator payouts. Stripe (already a licensed payment
-- institution) does identity verification and executes the actual payout -
-- FlipCollab never touches bank details or acts as a money remitter itself.
-- FK to auth.users (not profiles) so onboarding can start before a creator
-- profile is complete, same rationale as social_connections.
create table public.creator_stripe_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  country text not null,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_stripe_accounts enable row level security;

create policy "owner can view own stripe account"
  on public.creator_stripe_accounts for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for clients - every write happens via
-- edge functions using the service-role key, since creating/reading Stripe
-- Connect accounts requires the platform's secret key.
