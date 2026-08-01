-- Lightweight "Verified" signal for brands: true when their signup email
-- isn't one of the common free/personal providers (i.e. it's a real
-- company domain). Cheap to compute, easy to fake with any owned domain,
-- but filters out the laziest fake signups - a stronger check (Stripe
-- business verification) can raise the bar on top of this later without
-- needing a new column.
alter table public.brand_profiles add column verified boolean not null default false;

-- Backfill existing brands so this doesn't only apply going forward.
update public.brand_profiles bp
set verified = true
from public.profiles p
where p.id = bp.id
  and p.email is not null
  and lower(split_part(p.email, '@', 2)) not in (
    'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','hotmail.com','outlook.com',
    'live.com','msn.com','icloud.com','me.com','mac.com','aol.com','protonmail.com',
    'proton.me','mail.com','gmx.com','yandex.com','zoho.com','qq.com','163.com','hey.com'
  );
