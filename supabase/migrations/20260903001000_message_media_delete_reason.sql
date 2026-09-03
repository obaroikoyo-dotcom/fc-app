-- Distinguishes "sender deleted this on purpose" from "auto-expired per the
-- retention policy" so the chat placeholder can word each one correctly.
alter table public.messages add column if not exists media_removed_reason text;
