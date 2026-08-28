-- Backs the payment-correctness fixes: the webhook needs to know which
-- release mode a payment intended (to reconcile applications.status even if
-- the client-side update never lands), and brand_profiles needs a real
-- cancel-at-period-end flag since the UI already reads one that never
-- existed as a column.
alter table public.transactions add column payout_release_mode text;
alter table public.brand_profiles add column subscription_cancel_at_period_end boolean not null default false;
