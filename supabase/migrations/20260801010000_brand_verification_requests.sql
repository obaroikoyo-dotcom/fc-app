-- Manual escalation path for brands the automatic email-domain check
-- doesn't cover (e.g. a real but unregistered/informal business using a
-- personal email, or one that just wants a human to take a look). No
-- admin UI yet - review happens directly against this table (Supabase
-- Table Editor or a query), then approving just sets
-- brand_profiles.verified = true directly, same as every other path.
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brand_profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.verification_requests enable row level security;

create policy "brand can view own verification requests"
  on public.verification_requests for select
  using (auth.uid() = brand_id);

create policy "brand can create own verification request"
  on public.verification_requests for insert
  with check (auth.uid() = brand_id);
