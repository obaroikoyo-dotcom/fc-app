-- Read receipts: track when the other participant has seen a message,
-- so the sender can see an Instagram-style "Seen" indicator.
alter table public.messages
  add column if not exists read_at timestamptz;

alter table public.messages enable row level security;

drop policy if exists "Participants can mark received messages read" on public.messages;
create policy "Participants can mark received messages read"
  on public.messages for update
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  )
  with check (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

-- Message reactions: one reaction per user per message (Instagram-style -
-- double-tap sets/toggles a heart, a small picker allows other emoji).
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.message_reactions enable row level security;

drop policy if exists "Participants can view reactions" on public.message_reactions;
create policy "Participants can view reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_reactions.message_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

drop policy if exists "Participants can add their own reaction" on public.message_reactions;
create policy "Participants can add their own reaction"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_reactions.message_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

drop policy if exists "Users can update their own reaction" on public.message_reactions;
create policy "Users can update their own reaction"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own reaction" on public.message_reactions;
create policy "Users can delete their own reaction"
  on public.message_reactions for delete
  using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
