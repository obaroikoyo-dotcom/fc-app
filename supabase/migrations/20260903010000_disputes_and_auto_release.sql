-- Disputes: a brand can flag a delivered-but-unreleased deal within the
-- same 7-day window auto-release runs on, pausing that timer until an
-- admin actually reviews it. Money never leaves FlipCollab's own balance
-- until release, so refunding a disputed deal before that point is clean -
-- nothing has to be clawed back from a creator's payout.
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  brand_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'refunded', 'resolved_paid')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  admin_notes text
);

alter table public.disputes enable row level security;

drop policy if exists "Participants can view their own dispute" on public.disputes;
create policy "Participants can view their own dispute"
  on public.disputes for select
  using (auth.uid() = brand_id or auth.uid() = creator_id);

-- No insert/update policies for anon/authenticated - raising and resolving
-- disputes both go through edge functions (service role), which verify the
-- caller is the actual brand on that application, or the admin, before
-- writing anything.

alter table public.applications add column if not exists disputed_at timestamptz;
