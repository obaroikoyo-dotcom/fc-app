-- Full "delete for everyone" (text + media, distinct from the automatic
-- retention policy's media-only cleanup, which must never touch text) and
-- message editing, restricted server-side to messages the recipient
-- hasn't read yet - not just hidden client-side.
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists edited_at timestamptz;
