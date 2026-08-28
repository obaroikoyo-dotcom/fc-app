-- Backs the payment-correctness fixes: the webhook needs to know which
-- release mode a payment intended (to reconcile applications.status even if
-- the client-side update never lands), and brand_profiles needs a real
-- cancel-at-period-end flag since the UI already reads one that never
-- existed in any tracked migration - turns out it already existed live
-- (added directly in the dashboard at some point, same schema-drift
-- pattern found elsewhere in this project), so this has to be idempotent
-- rather than assume either column is new.
alter table public.transactions add column if not exists payout_release_mode text;
alter table public.brand_profiles add column if not exists subscription_cancel_at_period_end boolean not null default false;
