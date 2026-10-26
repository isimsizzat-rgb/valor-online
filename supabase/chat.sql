-- Valor Online: world and guild chat (run once in Supabase → SQL Editor, after guilds.sql).
create table if not exists public.chat_messages (
  id         bigserial primary key,
  channel    text not null,              -- 'world' or 'guild:<guild id>'
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  class      text,
  level      integer,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on public.chat_messages (channel, id desc);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at desc);

-- Players read the world channel and their own guild's channel. Writing only happens through chat_send().
alter table public.chat_messages enable row level security;
drop policy if exists "chat_read" on public.chat_messages;
create policy "chat_read" on public.chat_messages for select to authenticated using (
  channel = 'world'
  or channel = 'guild:' || (select guild_id::text from public.guild_members where user_id = (select auth.uid()))
);
revoke all on public.chat_messages from anon;
grant select on public.chat_messages to authenticated;

-- Players muted by the admin (insert a row here to mute, delete it to unmute).
create table if not exists public.chat_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until   timestamptz,                  -- null = until removed
  reason  text
);
alter table public.chat_mutes enable row level security;
revoke all on public.chat_mutes from anon, authenticated;

-- Send a message: 1–200 characters, at most one every 3 seconds and 15 per minute.
create or replace function public.chat_send(ch text, msg text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b text := btrim(regexp_replace(coalesce(msg, ''), '\s+', ' ', 'g')); s saves%rowtype; gid uuid;
begin
  if me is null then return 'invalid'; end if;
  if char_length(b) < 1 or char_length(b) > 200 then return 'invalid'; end if;
  select * into s from saves where user_id = me;
  if not found or coalesce(s.name, '') = '' then return 'no_character'; end if;
  if exists (select 1 from chat_mutes where user_id = me and (until is null or until > now())) then return 'muted'; end if;
  if ch = 'world' then null;
  elsif ch like 'guild:%' then
    select guild_id into gid from guild_members where user_id = me;
    if gid is null or ch <> 'guild:' || gid::text then return 'not_member'; end if;
  else return 'invalid'; end if;
  if exists (select 1 from chat_messages where user_id = me and created_at > now() - interval '3 seconds') then return 'slow'; end if;
  if (select count(*) from chat_messages where user_id = me and created_at > now() - interval '1 minute') >= 15 then return 'slow'; end if;
  insert into chat_messages (channel, user_id, name, class, level, body) values (ch, me, s.name, s.class, s.level, b);
  return 'ok';
end; $$;
revoke all on function public.chat_send(text, text) from public;
grant execute on function public.chat_send(text, text) to authenticated;

-- Housekeeping: keeps the last 30 days of messages. Run by hand now and then (or schedule it).
create or replace function public.chat_cleanup() returns void language sql security definer set search_path = public as $$
  delete from chat_messages where created_at < now() - interval '30 days';
$$;
revoke all on function public.chat_cleanup() from public, anon, authenticated;
