-- Valor Online: shared Castle War (run once in Supabase → SQL Editor, after guilds.sql).
-- War sessions: Monday, Wednesday, Friday 21:00–21:15 (Türkiye). Session id = the date, 'YYYY-MM-DD'.
create table if not exists public.castle_hits (
  session    text   not null,
  user_id    uuid   not null references auth.users(id) on delete cascade,
  guild_id   uuid   not null,
  guild_name text,
  name       text,
  class      text,
  power      bigint not null default 0,
  score      bigint not null default 0,
  hits       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (session, user_id)
);
create index if not exists castle_hits_guild_idx on public.castle_hits (session, guild_id);
alter table public.castle_hits enable row level security;
revoke all on public.castle_hits from anon, authenticated;

create or replace function public.castle_open_session() returns text language sql stable as $$
  select case when extract(isodow from t) in (1, 3, 5) and extract(hour from t) = 21 and extract(minute from t) < 16
              then to_char(t, 'YYYY-MM-DD') end
  from (select now() at time zone 'Europe/Istanbul' as t) x;
$$;
create or replace function public.castle_session_end(sess text) returns timestamptz language sql stable as $$
  select (sess::date + time '21:15') at time zone 'Europe/Istanbul';
$$;

-- Adds my damage since the last report to my guild. Damage is capped by my power.
create or replace function public.castle_hit(sess text, dmg bigint, hit_count integer)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s saves%rowtype; gid uuid; gname text; prev castle_hits%rowtype; secs numeric; cap numeric;
begin
  if me is null or sess is null or sess <> castle_open_session() then return 'closed'; end if;
  if dmg is null or dmg <= 0 or hit_count is null or hit_count <= 0 then return 'invalid'; end if;
  select gm.guild_id, g.name into gid, gname from guild_members gm join guilds g on g.id = gm.guild_id where gm.user_id = me;
  if gid is null then return 'no_guild'; end if;
  select * into s from saves where user_id = me;
  if not found then return 'invalid'; end if;
  select * into prev from castle_hits where session = sess and user_id = me for update;
  secs := least(60, greatest(1, extract(epoch from now() - coalesce(prev.updated_at, now() - interval '10 seconds'))));
  cap := (greatest(coalesce(s.power, 0), 1) / 20.0 + 10) * 1.5 * (secs + 2);
  if dmg > cap then dmg := floor(cap); end if;
  hit_count := least(hit_count, ceil(secs + 2)::integer);
  insert into castle_hits (session, user_id, guild_id, guild_name, name, class, power, score, hits, updated_at)
  values (sess, me, gid, gname, s.name, s.class, coalesce(s.power, 0), dmg, hit_count, now())
  on conflict (session, user_id) do update
    set guild_id = excluded.guild_id, guild_name = excluded.guild_name, name = excluded.name, class = excluded.class,
        power = excluded.power, score = castle_hits.score + excluded.score, hits = castle_hits.hits + excluded.hits, updated_at = now();
  return 'ok';
end; $$;

-- Guild scores and top 10 players for one session. After the session ends it also carries my reward place.
create or replace function public.castle_board(sess text)
returns jsonb language sql stable security definer set search_path = public as $$
  with g as (
    select guild_id, max(guild_name) as name, sum(score) as score, sum(hits) as hits, max(updated_at) as updated_at
    from castle_hits where session = sess and score > 0 group by guild_id
  ), ranked as (select *, row_number() over (order by score desc, updated_at) as rank from g),
  mine as (select guild_id from castle_hits where session = sess and user_id = auth.uid() and score > 0)
  select jsonb_build_object(
    'ended', now() >= castle_session_end(sess),
    'guilds', coalesce((select jsonb_agg(jsonb_build_object('id', guild_id, 'name', name, 'score', score, 'hits', hits, 'rank', rank) order by rank) from ranked), '[]'::jsonb),
    'players', coalesce((select jsonb_agg(p order by (p->>'score')::bigint desc) from (
        select jsonb_build_object('name', name, 'guild_name', guild_name, 'class', class, 'power', power, 'score', score, 'hits', hits, 'me', user_id = auth.uid()) as p
        from castle_hits where session = sess and score > 0 order by score desc, updated_at limit 10) t), '[]'::jsonb),
    'mine', (select jsonb_build_object('guild_id', r.guild_id, 'rank', r.rank) from ranked r join mine m on m.guild_id = r.guild_id));
$$;

-- The guild holding the castle: winner of the latest finished war, until the next war ends.
create or replace function public.castle_owner()
returns jsonb language sql stable security definer set search_path = public as $$
  with last as (
    select session from castle_hits where now() >= castle_session_end(session) group by session order by session desc limit 1
  ), winner as (
    select h.guild_id, max(h.guild_name) as name, sum(h.score) as score, max(h.updated_at) as at
    from castle_hits h join last l on l.session = h.session where h.score > 0 group by h.guild_id order by sum(h.score) desc, max(h.updated_at) limit 1
  ), until as (
    select ((l.session::date + n) + time '21:15') at time zone 'Europe/Istanbul' as t
    from last l, generate_series(1, 7) n where extract(isodow from l.session::date + n) in (1, 3, 5) order by n limit 1
  )
  select case when (select t from until) > now() then jsonb_build_object(
    'id', w.guild_id, 'name', w.name, 'session', (select session from last),
    'from', castle_session_end((select session from last)), 'until', (select t from until)) end
  from winner w;
$$;

revoke all on function public.castle_hit(text, bigint, integer) from public;
revoke all on function public.castle_board(text) from public;
revoke all on function public.castle_owner() from public;
grant execute on function public.castle_hit(text, bigint, integer) to authenticated;
grant execute on function public.castle_board(text) to authenticated;
grant execute on function public.castle_owner() to authenticated;
