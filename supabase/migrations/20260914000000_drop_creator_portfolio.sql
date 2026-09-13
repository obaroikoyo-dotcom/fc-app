-- Portfolio feature removed - drop the columns it added. Nothing else
-- referenced them (feature was reverted the same day it shipped, before
-- any creator could have set a slug).
drop index if exists creator_profiles_portfolio_slug_key;
alter table creator_profiles drop column if exists portfolio_slug;
alter table creator_profiles drop column if exists portfolio_sections;
