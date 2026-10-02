-- Share Profile links were broken end to end: wrong domain in the link
-- itself, no SPA rewrite so any path but "/" 404s before JS even loads,
-- and - the part this migration fixes - even once both of those are fixed,
-- a logged-out visitor (the realistic case: someone clicking the link from
-- an Instagram bio who's never signed up) couldn't read the profile at
-- all, since creator_profiles/brand_profiles only ever granted SELECT to
-- `authenticated`. brand_profiles' sensitive columns are already locked
-- down to a safe list for both authenticated and anon (prior migration),
-- so this only needs a row policy - scoped to profile_visible, the same
-- toggle Settings already exposes as "Visibility: Control what others see".
create policy "Public can view visible creator profiles" on public.creator_profiles
  for select to anon
  using (profile_visible is distinct from false);

create policy "Public can view visible brand profiles" on public.brand_profiles
  for select to anon
  using (profile_visible is distinct from false);
