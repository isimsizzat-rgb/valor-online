-- Fix for "Sunucu hatası (403)" in chat: run once in Supabase → SQL Editor.
-- The read rule asks a helper for the player's guild (players cannot read guild_members themselves).
create or replace function public.my_guild_id() returns uuid
language sql stable security definer set search_path = public as $$
  select guild_id from public.guild_members where user_id = auth.uid();
$$;
revoke all on function public.my_guild_id() from public;
grant execute on function public.my_guild_id() to authenticated;
drop policy if exists "chat_read" on public.chat_messages;
create policy "chat_read" on public.chat_messages for select to authenticated using (
  channel = 'world' or channel = 'guild:' || (select public.my_guild_id())::text
);
