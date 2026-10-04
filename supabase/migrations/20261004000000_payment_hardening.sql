-- Payment hardening.
--
-- 1. Only one open transaction per deal. create-payment-intent checks for an
--    existing pending/completed row and then creates one, which two
--    simultaneous "Pay" clicks could both pass - each creating its own live
--    PaymentIntent. This index makes the second insert fail, and the function
--    then cancels its orphaned PaymentIntent.
--
--    If this migration fails with a duplicate-key error, some deal already has
--    two open rows. Find them with:
--      select campaign_id, creator_id, count(*) from transactions
--      where status in ('pending','completed') group by 1,2 having count(*) > 1;
--    Resolve those by hand first; don't delete payment rows blindly.
create unique index if not exists transactions_one_open_per_deal
  on public.transactions (campaign_id, creator_id)
  where status in ('pending', 'completed');

-- 2. Payout and refund states can only be set by server code. Browsers hold
--    the anon/authenticated roles and must never be able to mark a deal "paid"
--    (which the platform treats as "creator was paid") or "refunded"/"disputed"
--    without the matching Stripe movement. Edge functions use the service role,
--    and the SQL editor runs as postgres, so both still work.
create or replace function public.guard_application_money_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('paid', 'refunded', 'disputed')
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Payment status % can only be set by the server', new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists applications_guard_money_status on public.applications;
create trigger applications_guard_money_status
  before update on public.applications
  for each row execute function public.guard_application_money_status();
