-- Locks the function's search_path so it can't be tricked by a
-- session-level search_path change into resolving "campaigns" or "applications"
-- to an attacker-created object in another schema.
alter function public.increment_applications(uuid) set search_path = public;
