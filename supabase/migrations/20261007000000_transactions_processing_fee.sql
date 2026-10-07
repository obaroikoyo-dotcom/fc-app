-- Enterprise brands pay no FlipCollab platform fee, but their card payment
-- carries a flat processing fee (2.5% + 20p of the budget) that is added to
-- the amount charged and stays in FlipCollab's Stripe balance to cover
-- Stripe's own fee. Recorded per transaction, separately from platform_fee
-- (FlipCollab's own revenue), so the two never get mixed up in reporting.
--
-- Run this BEFORE deploying the updated create-payment-intent function: the
-- function writes this column, and an insert into a column that doesn't exist
-- yet would fail every payment.

alter table public.transactions
  add column if not exists processing_fee integer not null default 0
  check (processing_fee >= 0);
