-- moderation.ts's listUsers() ran a raw, unfiltered profiles select with no
-- check inside the query itself - the only gate was a client-side email
-- comparison one layer up in AdminReview.tsx. Any authenticated user could
-- run the same query directly (devtools/raw REST) and dump every user's
-- email + moderation status. This moves the read behind the same
-- security definer admin-check pattern already used for the write side
-- (admin_set_account_status).
create or replace function public.admin_list_users()
returns table (
  id uuid,
  role text,
  email text,
  account_status text,
  status_reason text,
  creator_name text,
  creator_avatar_url text,
  brand_name text,
  brand_logo_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (auth.jwt() ->> 'email') is distinct from 'obaroikoyo@gmail.com' then
    raise exception 'not authorized';
  end if;

  return query
  select p.id, p.role, p.email, p.account_status, p.status_reason,
         cp.name, cp.avatar_url, bp.name, bp.logo_url
  from public.profiles p
  left join public.creator_profiles cp on cp.id = p.id
  left join public.brand_profiles bp on bp.id = p.id;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
