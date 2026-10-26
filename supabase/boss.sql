-- Valor Online: shared world boss damage ranking (run once in Supabase → SQL Editor).
create table if not exists public.boss_damage (
  session    text   not null,                 -- 'YYYY-MM-DD-10' or 'YYYY-MM-DD-20' (Türkiye time)
  user_id    uuid   not null references auth.users(id) on delete cascade,
  name       text,
  class      text,
  damage     bigint not null default 0,
  hits       integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (session, user_id)
);
create index if not exists boss_damage_rank_idx on public.boss_damage (session, damage desc);
alter table public.boss_damage enable row level security;
revoke all on public.boss_damage from anon, authenticated;

-- The session that is open right now (null outside 10:00–10:15 and 20:00–20:15, with one minute of grace).
create or replace function public.boss_open_session() returns text language sql stable as $$
  select case when extract(hour from t) in (10, 20) and extract(minute from t) < 16
              then to_char(t, 'YYYY-MM-DD') || '-' || to_char(t, 'HH24') end
  from (select now() at time zone 'Europe/Istanbul' as t) x;
$$;

-- Adds damage dealt since the last report. At most one hit per second at (power + level*4) × 2.
create or replace function public.boss_hit(sess text, dmg bigint, hit_count integer)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s saves%rowtype; prev boss_damage%rowtype; secs numeric; cap numeric;
begin
  if me is null or sess is null or sess <> boss_open_session() then return 'closed'; end if;
  if dmg is null or dmg <= 0 or hit_count is null or hit_count <= 0 then return 'invalid'; end if;
  select * into s from saves where user_id = me;
  if not found or coalesce(s.name, '') = '' then return 'invalid'; end if;
  select * into prev from boss_damage where session = sess and user_id = me for update;
  secs := least(60, greatest(1, extract(epoch from now() - coalesce(prev.updated_at, now() - interval '10 seconds'))));
  cap := (greatest(coalesce(s.power, 0), 1) + coalesce(s.level, 1) * 4) * 2 * (secs + 2);
  if dmg > cap then dmg := floor(cap); end if;
  hit_count := least(hit_count, ceil(secs + 2)::integer);
  insert into boss_damage (session, user_id, name, class, damage, hits, updated_at)
  values (sess, me, s.name, s.class, dmg, hit_count, now())
  on conflict (session, user_id) do update
    set damage = boss_damage.damage + excluded.damage, hits = boss_damage.hits + excluded.hits,
        name = excluded.name, class = excluded.class, updated_at = now();
  return 'ok';
end; $$;

-- Ranking for one session: top 10, my place, everyone's total damage and number of players.
create or replace function public.boss_board(sess text)
returns jsonb language sql stable security definer set search_path = public as $$
  with r as (select name, class, damage, user_id, row_number() over (order by damage desc, updated_at) as rank from boss_damage where session = sess)
  select jsonb_build_object(
    'top', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'name', name, 'class', class, 'damage', damage, 'me', user_id = auth.uid()) order by rank) from r where rank <= 10), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', rank, 'damage', damage) from r where user_id = auth.uid()),
    'total', (select coalesce(sum(damage), 0) from r),
    'players', (select count(*) from r));
$$;

revoke all on function public.boss_hit(text, bigint, integer) from public;
revoke all on function public.boss_board(text) from public;
grant execute on function public.boss_hit(text, bigint, integer) to authenticated;
grant execute on function public.boss_board(text) to authenticated;
