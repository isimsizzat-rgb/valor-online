-- Valor Online: ranking titles in chat (run once in Supabase → SQL Editor, after chat.sql and rankings.sql).
-- The #1 player of a ranking holds its title and may wear it in chat: "[En Güçlü Lord] Doom".
--   power → En Güçlü Lord · xp → Savaş Tanrısı · spirit → Binek Tanrısı · fame → Krallığın Şöhreti
-- The game sends the title the player picked; the server stores it only if the player is #1 right now.
alter table public.chat_messages add column if not exists tag text;

drop function if exists public.chat_send(text, text);
create or replace function public.chat_send(ch text, msg text, tag text default null)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b text := btrim(regexp_replace(coalesce(msg, ''), '\s+', ' ', 'g')); s saves%rowtype; gid uuid;
        k text; t text := null;
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
  k := case tag when 'En Güçlü Lord' then 'power' when 'Savaş Tanrısı' then 'xp'
                when 'Binek Tanrısı' then 'spirit' when 'Krallığın Şöhreti' then 'fame' end;
  if k is not null and public.my_rank(k) = 1 then t := tag; end if;
  insert into chat_messages (channel, user_id, name, class, level, body, tag) values (ch, me, s.name, s.class, s.level, b, t);
  return 'ok';
end; $$;
revoke all on function public.chat_send(text, text, text) from public;
grant execute on function public.chat_send(text, text, text) to authenticated;
