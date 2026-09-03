-- Without this, Postgres only includes primary-key columns (just `id`) in
-- the "old row" data sent for DELETE events over realtime - the client
-- needs message_id/user_id/emoji from that payload to know which reaction
-- to remove from the other participant's screen, so a reaction being
-- un-reacted (re-clicking the same emoji) was deleting correctly in the
-- database but silently failing to propagate live to the other side.
alter table public.message_reactions replica identity full;
