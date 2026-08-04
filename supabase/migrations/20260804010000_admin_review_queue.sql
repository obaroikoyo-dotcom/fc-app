-- Minimal admin concept: no profiles.role = 'admin' value, just a single
-- hardcoded email checked via auth.jwt(). Mutations go through security
-- definer RPCs (rather than broad admin UPDATE policies on brand_profiles/
-- verification_requests/reports) so the admin surface can't be widened by
-- accident later - each RPC does exactly one reviewed action.

create policy "admin can view all verification requests"
  on public.verification_requests for select
  using ((auth.jwt() ->> 'email') = 'obaroikoyo@gmail.com');

create or replace function public.approve_verification_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_brand_id uuid;
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  select brand_id into target_brand_id from public.verification_requests where id = target_request_id;
  if target_brand_id is null then
    raise exception 'verification request not found';
  end if;

  update public.verification_requests set status = 'approved', reviewed_at = now() where id = target_request_id;
  update public.brand_profiles set verified = true where id = target_brand_id;
end;
$$;

grant execute on function public.approve_verification_request(uuid) to authenticated;

create or replace function public.reject_verification_request(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  update public.verification_requests set status = 'rejected', reviewed_at = now() where id = target_request_id;
end;
$$;

grant execute on function public.reject_verification_request(uuid) to authenticated;

-- Reports predate tracked migrations, so its RLS state is whatever's live -
-- this just adds an admin-read policy on top of it (additive/permissive,
-- can't remove existing access).
alter table public.reports add column if not exists status text not null default 'open' check (status in ('open', 'resolved'));

create policy "admin can view all reports"
  on public.reports for select
  using ((auth.jwt() ->> 'email') = 'obaroikoyo@gmail.com');

create or replace function public.resolve_report(target_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  update public.reports set status = 'resolved' where id = target_report_id;
end;
$$;

grant execute on function public.resolve_report(uuid) to authenticated;
