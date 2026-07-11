-- Snapshot the payer's billing address on each escrow payment so it's readable
-- directly on the transactions row (who paid, and their address) without a join.
alter table public.transactions
  add column if not exists billing_name text,
  add column if not exists billing_address_line1 text,
  add column if not exists billing_address_line2 text,
  add column if not exists billing_city text,
  add column if not exists billing_state text,
  add column if not exists billing_postal_code text,
  add column if not exists billing_country text;
