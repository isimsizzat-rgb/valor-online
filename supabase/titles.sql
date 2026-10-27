-- Valor Online: ranking titles and popularity (run once in Supabase → SQL Editor, after chat.sql, rankings.sql and guilds.sql).
-- Titles (only one holder each, value must be above 0):
--   Savaş Gücü #1 → En Güçlü Lord · Şöhret #1 → Savaş Tanrısı · Binek Ruhu #1 → Binek Tanrısı
--   Popülerlik #1 → En Popüler Lord · leader of the #1 guild (Birlik Sıralaması) → Birlik Tanrısı
-- A holder picks one in the profile; chat shows it before the nick: "[En Güçlü Lord] Doom".
-- chat_send keeps the tag only if the sender holds it at that moment.

-- Popularity is raised by other players (gift items), never by the player's own save upload.
alter table public.saves add column if not exists popularity bigint not null default 0;
create index if not exists saves_popularity_idx on public.saves (popularity desc);

-- Rankings: kind = 'power' | 'xp' | 'spirit' | 'fame' | 'popularity'.
drop function if exists public.leaderboard(text, integer);
create or replace function public.leaderboard(kind text, lim integer default 50)
returns table(rank bigint, name text, class text, level integer, power bigint, xp bigint, spirit bigint, fame bigint, popularity bigint, profile jsonb, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by
           case kind when 'xp' then s.xp when 'spirit' then s.spirit when 'fame' then s.fame when 'popularity' then s.popularity else s.power end desc,
           s.level desc, s.name) as rank,
         s.name, s.class, s.level, s.power, s.xp, s.spirit, s.fame, s.popularity, s.profile,
         s.user_id = auth.uid() as is_me
  from public.saves s
  where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  order by rank
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

create or replace function public.my_rank(kind text)
returns bigint
language sql stable security definer set search_path = public as $$
  with me as (
    select user_id, hidden, class, name,
           case kind when 'xp' then xp when 'spirit' then spirit when 'fame' then fame when 'popularity' then popularity else power end as v
    from public.saves where user_id = auth.uid()
  )
  select case when me.hidden or me.class is null or coalesce(me.name, '') = '' then null
         else 1 + (select count(*) from public.saves s
                   where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null and s.user_id <> me.user_id
                     and (case kind when 'xp' then s.xp when 'spirit' then s.spirit when 'fame' then s.fame when 'popularity' then s.popularity else s.power end) > me.v)
         end
  from me;
$$;
revoke all on function public.leaderboard(text, integer) from public;
revoke all on function public.my_rank(text) from public;
grant execute on function public.leaderboard(text, integer) to authenticated;
grant execute on function public.my_rank(text) to authenticated;

-- Titles the signed-in player holds right now. Ties go to the player listed first in the ranking.
create or replace function public.my_titles()
returns text[]
language sql stable security definer set search_path = public as $$
  with vis as (
    select * from public.saves s where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  ), tops as (
    select 'En Güçlü Lord' as title, (select user_id from vis where power > 0 order by power desc, level desc, name limit 1) as holder
    union all select 'Savaş Tanrısı', (select user_id from vis where fame > 0 order by fame desc, level desc, name limit 1)
    union all select 'Binek Tanrısı', (select user_id from vis where spirit > 0 order by spirit desc, level desc, name limit 1)
    union all select 'En Popüler Lord', (select user_id from vis where popularity > 0 order by popularity desc, level desc, name limit 1)
    union all select 'Birlik Tanrısı', (
      select g.leader from public.guilds g
      left join public.guild_members gm on gm.guild_id = g.id
      left join public.saves s on s.user_id = gm.user_id
      group by g.id, g.leader, g.name
      having coalesce(sum(s.power), 0) > 0
      order by coalesce(sum(s.power), 0) desc, g.name limit 1)
  )
  select coalesce(array_agg(title order by title), '{}') from tops where holder = auth.uid();
$$;
revoke all on function public.my_titles() from public;
grant execute on function public.my_titles() to authenticated;

-- Chat: the worn title is stored with the message.
alter table public.chat_messages add column if not exists tag text;

drop function if exists public.chat_send(text, text);
create or replace function public.chat_send(ch text, msg text, tag text default null)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b text := btrim(regexp_replace(coalesce(msg, ''), '\s+', ' ', 'g')); s saves%rowtype; gid uuid;
        t text := null;
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
  if tag is not null and tag = any(public.my_titles()) then t := tag; end if;
  insert into chat_messages (channel, user_id, name, class, level, body, tag) values (ch, me, s.name, s.class, s.level, b, t);
  return 'ok';
end; $$;
revoke all on function public.chat_send(text, text, text) from public;
grant execute on function public.chat_send(text, text, text) to authenticated;
