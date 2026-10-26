-- Valor Online: cloud saves (run once in Supabase → SQL Editor).
-- One row per player. Row level security: a player can only read and write their own row.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  data       jsonb not null,
  rev        integer not null default 1,
  name       text,
  class      text,
  level      integer not null default 1,
  power      bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves_select_own" on public.saves;
drop policy if exists "saves_insert_own" on public.saves;
drop policy if exists "saves_update_own" on public.saves;
create policy "saves_select_own" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves_insert_own" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves_update_own" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

-- Keeps rankings fast later (level / power ordering).
create index if not exists saves_level_idx on public.saves (level desc);
create index if not exists saves_power_idx on public.saves (power desc);
-- Valor Online: unique character names (run once in Supabase → SQL Editor, after schema.sql).
-- Names are compared case-insensitively ("DooM" blocks "doom").
create unique index if not exists saves_name_unique
  on public.saves (lower(name)) where coalesce(name, '') <> '';

-- Reserves a name for the signed-in player's row. Returns 'ok', 'taken' or 'invalid'.
create or replace function public.claim_character_name(new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n text := btrim(coalesce(new_name, ''));
begin
  if auth.uid() is null then return 'invalid'; end if;
  if char_length(n) < 3 or char_length(n) > 20 or n !~ '^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$' then return 'invalid'; end if;
  if exists (select 1 from public.saves where lower(name) = lower(n) and user_id <> auth.uid()) then return 'taken'; end if;
  update public.saves set name = n where user_id = auth.uid();
  if not found then return 'invalid'; end if;
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

revoke all on function public.claim_character_name(text) from public, anon;
grant execute on function public.claim_character_name(text) to authenticated;
-- Valor Online: sign in with the character name (run once in Supabase → SQL Editor).
-- Returns the login username of the character with this name, or null.
create or replace function public.login_username_for(character_name text)
returns text language sql stable security definer set search_path = public as $$
  select username from public.saves
  where coalesce(name, '') <> '' and lower(name) = lower(btrim(character_name))
  limit 1;
$$;
revoke all on function public.login_username_for(text) from public;
grant execute on function public.login_username_for(text) to anon, authenticated;
-- Valor Online: real rankings (run once in Supabase → SQL Editor).
alter table public.saves
  add column if not exists xp      bigint  not null default 0,
  add column if not exists spirit  bigint  not null default 0,
  add column if not exists fame    bigint  not null default 0,
  add column if not exists profile jsonb,
  add column if not exists hidden  boolean not null default false;  -- hidden = left out of rankings (test characters)

create index if not exists saves_xp_idx     on public.saves (xp desc);
create index if not exists saves_spirit_idx on public.saves (spirit desc);
create index if not exists saves_fame_idx   on public.saves (fame desc);

-- Top players for one ranking: kind = 'power' | 'xp' | 'spirit' | 'fame'. Usernames are never returned.
create or replace function public.leaderboard(kind text, lim integer default 50)
returns table(rank bigint, name text, class text, level integer, power bigint, xp bigint, spirit bigint, fame bigint, profile jsonb, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by
           case kind when 'xp' then s.xp when 'spirit' then s.spirit when 'fame' then s.fame else s.power end desc,
           s.level desc, s.name) as rank,
         s.name, s.class, s.level, s.power, s.xp, s.spirit, s.fame, s.profile,
         s.user_id = auth.uid() as is_me
  from public.saves s
  where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  order by rank
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

-- The signed-in player's position in one ranking (null when hidden or without a character).
create or replace function public.my_rank(kind text)
returns bigint
language sql stable security definer set search_path = public as $$
  with me as (
    select user_id, hidden, class, name,
           case kind when 'xp' then xp when 'spirit' then spirit when 'fame' then fame else power end as v
    from public.saves where user_id = auth.uid()
  )
  select case when me.hidden or me.class is null or coalesce(me.name, '') = '' then null
         else 1 + (select count(*) from public.saves s
                   where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null and s.user_id <> me.user_id
                     and (case kind when 'xp' then s.xp when 'spirit' then s.spirit when 'fame' then s.fame else s.power end) > me.v)
         end
  from me;
$$;

revoke all on function public.leaderboard(text, integer) from public;
revoke all on function public.my_rank(text) from public;
grant execute on function public.leaderboard(text, integer) to authenticated;
grant execute on function public.my_rank(text) to authenticated;
-- Valor Online: arena against real players (run once in Supabase → SQL Editor, after rankings.sql).
alter table public.saves
  add column if not exists combat     jsonb,
  add column if not exists arena_wins integer not null default 0;
create index if not exists saves_arena_wins_idx on public.saves (arena_wins desc);

-- One row per arena fight. Players can read fights they attacked in or defended.
create table if not exists public.arena_log (
  id            bigserial primary key,
  attacker      uuid not null references auth.users(id) on delete cascade,
  defender      uuid not null references auth.users(id) on delete cascade,
  attacker_name text,
  defender_name text,
  win           boolean not null,          -- attacker won
  draw          boolean not null default false,
  rounds        integer,
  created_at    timestamptz not null default now()
);
create index if not exists arena_log_defender_idx on public.arena_log (defender, created_at desc);
create index if not exists arena_log_attacker_idx on public.arena_log (attacker, created_at desc);
alter table public.arena_log enable row level security;
drop policy if exists "arena_log_read_own" on public.arena_log;
create policy "arena_log_read_own" on public.arena_log for select to authenticated
  using ((select auth.uid()) in (attacker, defender));
revoke all on public.arena_log from anon;
grant select on public.arena_log to authenticated;

-- Rivals closest to my power (other visible players with a saved combat profile).
create or replace function public.arena_rivals(lim integer default 15)
returns table(id uuid, name text, class text, level integer, power bigint, arena_wins integer, combat jsonb, profile jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select coalesce(power, 0) as p from public.saves where user_id = auth.uid())
  select s.user_id, s.name, s.class, s.level, s.power, s.arena_wins, s.combat, s.profile
  from public.saves s, me
  where s.user_id <> auth.uid() and not s.hidden and s.combat is not null
    and coalesce(s.name, '') <> '' and s.class is not null
  order by abs(s.power - me.p), s.power desc
  limit least(greatest(coalesce(lim, 15), 1), 30);
$$;

-- Records a finished fight. At most 10 fights per player per day (Türkiye time).
create or replace function public.arena_report(target uuid, won boolean, was_draw boolean, fight_rounds integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  day_start timestamptz := (date_trunc('day', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';
begin
  if me is null or target is null or target = me then return 'invalid'; end if;
  if not exists (select 1 from public.saves where user_id = target) then return 'invalid'; end if;
  if (select count(*) from public.arena_log where attacker = me and created_at >= day_start) >= 10 then return 'limit'; end if;
  insert into public.arena_log (attacker, defender, attacker_name, defender_name, win, draw, rounds)
  values (me, target,
          (select name from public.saves where user_id = me),
          (select name from public.saves where user_id = target),
          coalesce(won, false) and not coalesce(was_draw, false), coalesce(was_draw, false), fight_rounds);
  return 'ok';
end;
$$;

-- Arena wins ranking and my position in it.
create or replace function public.arena_top(lim integer default 10)
returns table(rank bigint, name text, class text, level integer, arena_wins integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.arena_wins desc, s.level desc, s.name), s.name, s.class, s.level, s.arena_wins, s.user_id = auth.uid()
  from public.saves s
  where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  order by 1 limit least(greatest(coalesce(lim, 10), 1), 50);
$$;
create or replace function public.arena_my_rank()
returns bigint language sql stable security definer set search_path = public as $$
  select case when me.hidden or me.class is null then null
         else 1 + (select count(*) from public.saves s where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
                   and s.user_id <> me.user_id and s.arena_wins > me.arena_wins) end
  from public.saves me where me.user_id = auth.uid();
$$;

revoke all on function public.arena_rivals(integer) from public;
revoke all on function public.arena_report(uuid, boolean, boolean, integer) from public;
revoke all on function public.arena_top(integer) from public;
revoke all on function public.arena_my_rank() from public;
grant execute on function public.arena_rivals(integer) to authenticated;
grant execute on function public.arena_report(uuid, boolean, boolean, integer) to authenticated;
grant execute on function public.arena_top(integer) to authenticated;
grant execute on function public.arena_my_rank() to authenticated;
-- Valor Online: real guilds (run once in Supabase → SQL Editor, after schema.sql).
-- All guild changes go through the functions below; the tables themselves are not directly readable or writable.
create table if not exists public.guilds (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  leader     uuid not null references auth.users(id) on delete cascade,
  level      integer not null default 1,
  progress   bigint  not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists guilds_name_unique on public.guilds (lower(name));

create table if not exists public.guild_members (
  user_id   uuid primary key references auth.users(id) on delete cascade,   -- one guild per player
  guild_id  uuid not null references public.guilds(id) on delete cascade,
  role      text not null default 'member',                                 -- 'leader' | 'member'
  donated   bigint not null default 0,
  joined_at timestamptz not null default now()
);
create index if not exists guild_members_guild_idx on public.guild_members (guild_id);

create table if not exists public.guild_requests (
  guild_id   uuid not null references public.guilds(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create table if not exists public.guild_donations (
  id         bigserial primary key,
  guild_id   uuid not null references public.guilds(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists guild_donations_guild_idx on public.guild_donations (guild_id, created_at desc);

alter table public.guilds          enable row level security;
alter table public.guild_members   enable row level security;
alter table public.guild_requests  enable row level security;
alter table public.guild_donations enable row level security;
revoke all on public.guilds, public.guild_members, public.guild_requests, public.guild_donations from anon, authenticated;

-- Gold needed to go from level l to l+1 (same table as the game).
create or replace function public.guild_cost(l integer) returns bigint language sql immutable as $$
  select (array[0,500000,1500000,3000000,6000000,12000000,25000000,50000000,75000000,100000000]::bigint[])[l + 1];
$$;
create or replace function public.guild_week_start() returns timestamptz language sql stable as $$
  select (date_trunc('week', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';
$$;

-- Create a guild. start_level/start_progress only carry over a guild made before the server existed.
create or replace function public.guild_create(gname text, start_level integer default 1, start_progress bigint default 0)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text := btrim(coalesce(gname, '')); lv integer := least(greatest(coalesce(start_level, 1), 1), 10); gid uuid;
begin
  if me is null then return 'invalid'; end if;
  if exists (select 1 from guild_members where user_id = me) then return 'already'; end if;
  if char_length(n) < 3 or char_length(n) > 30 or n !~ '^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$' then return 'invalid'; end if;
  insert into guilds (name, leader, level, progress)
  values (n, me, lv, case when lv >= 10 then 0 else least(greatest(coalesce(start_progress, 0), 0), guild_cost(lv) - 1) end)
  returning id into gid;
  insert into guild_members (user_id, guild_id, role) values (me, gid, 'leader');
  delete from guild_requests where user_id = me;
  return 'ok';
exception when unique_violation then return 'taken';
end; $$;

-- Everything the guild screen needs in one call.
create or replace function public.guild_info()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); m guild_members%rowtype; g guilds%rowtype; ws timestamptz := guild_week_start();
begin
  select * into m from guild_members where user_id = me;
  if not found then
    return jsonb_build_object('guild', null, 'my_requests',
      coalesce((select jsonb_agg(jsonb_build_object('guild_id', r.guild_id, 'name', gg.name)) from guild_requests r join guilds gg on gg.id = r.guild_id where r.user_id = me), '[]'::jsonb));
  end if;
  select * into g from guilds where id = m.guild_id;
  return jsonb_build_object(
    'guild', jsonb_build_object('id', g.id, 'name', g.name, 'level', g.level, 'progress', g.progress, 'leader', g.leader),
    'role', m.role,
    'members', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', gm.user_id, 'role', gm.role, 'donated', gm.donated,
        'weekly', coalesce((select sum(d.amount) from guild_donations d where d.guild_id = g.id and d.user_id = gm.user_id and d.created_at >= ws), 0),
        'name', s.name, 'class', s.class, 'level', s.level, 'power', s.power) order by s.power desc nulls last)
      from guild_members gm left join saves s on s.user_id = gm.user_id where gm.guild_id = g.id), '[]'::jsonb),
    'requests', case when m.role = 'leader' then coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', r.user_id, 'name', s.name, 'class', s.class, 'level', s.level, 'power', s.power) order by r.created_at)
      from guild_requests r left join saves s on s.user_id = r.user_id where r.guild_id = g.id), '[]'::jsonb) else '[]'::jsonb end);
end; $$;

-- Guilds to browse or join (optionally filtered by name).
create or replace function public.guild_list(search text default '', lim integer default 30)
returns table(id uuid, name text, level integer, members integer, power bigint, leader_name text, requested boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.level, count(gm.user_id)::integer, coalesce(sum(s.power), 0)::bigint,
         (select name from saves where user_id = g.leader),
         exists (select 1 from guild_requests r where r.guild_id = g.id and r.user_id = auth.uid())
  from guilds g join guild_members gm on gm.guild_id = g.id left join saves s on s.user_id = gm.user_id
  where coalesce(search, '') = '' or g.name ilike '%' || search || '%'
  group by g.id
  order by coalesce(sum(s.power), 0) desc
  limit least(greatest(coalesce(lim, 30), 1), 50);
$$;

-- Guild power ranking (sum of members' combat power).
create or replace function public.guild_ranking(lim integer default 50)
returns table(rank bigint, id uuid, name text, level integer, members integer, power bigint, is_mine boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by coalesce(sum(s.power), 0) desc, g.name), g.id, g.name, g.level, count(gm.user_id)::integer,
         coalesce(sum(s.power), 0)::bigint, g.id = (select guild_id from guild_members where user_id = auth.uid())
  from guilds g join guild_members gm on gm.guild_id = g.id left join saves s on s.user_id = gm.user_id
  group by g.id order by 1 limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

create or replace function public.guild_members_of(gid uuid)
returns table(name text, class text, level integer, power bigint, role text)
language sql stable security definer set search_path = public as $$
  select s.name, s.class, s.level, s.power, gm.role from guild_members gm left join saves s on s.user_id = gm.user_id
  where gm.guild_id = gid order by s.power desc nulls last;
$$;

create or replace function public.guild_request(gid uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from guilds where id = gid) then return 'invalid'; end if;
  if exists (select 1 from guild_members where user_id = me) then return 'already'; end if;
  if (select count(*) from guild_members where guild_id = gid) >= 30 then return 'full'; end if;
  if (select count(*) from guild_requests where user_id = me) >= 5 then return 'too_many'; end if;
  insert into guild_requests (guild_id, user_id) values (gid, me) on conflict do nothing;
  return 'ok';
end; $$;

create or replace function public.guild_cancel_request(gid uuid)
returns text language sql security definer set search_path = public as $$
  delete from guild_requests where guild_id = gid and user_id = auth.uid(); select 'ok'::text;
$$;

-- Leader accepts or rejects a join request.
create or replace function public.guild_answer(target uuid, accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid;
begin
  select guild_id into gid from guild_members where user_id = me and role = 'leader';
  if gid is null then return 'not_leader'; end if;
  if not exists (select 1 from guild_requests where guild_id = gid and user_id = target) then return 'invalid'; end if;
  if not accept then delete from guild_requests where guild_id = gid and user_id = target; return 'ok'; end if;
  if exists (select 1 from guild_members where user_id = target) then delete from guild_requests where user_id = target; return 'already'; end if;
  if (select count(*) from guild_members where guild_id = gid) >= 30 then return 'full'; end if;
  insert into guild_members (user_id, guild_id, role) values (target, gid, 'member');
  delete from guild_requests where user_id = target;
  return 'ok';
end; $$;

create or replace function public.guild_kick(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid;
begin
  select guild_id into gid from guild_members where user_id = me and role = 'leader';
  if gid is null then return 'not_leader'; end if;
  if target = me then return 'invalid'; end if;
  delete from guild_members where user_id = target and guild_id = gid;
  return case when found then 'ok' else 'invalid' end;
end; $$;

-- Leave the guild. A leader hands over to the strongest member; the last member closes the guild.
create or replace function public.guild_leave()
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m guild_members%rowtype; heir uuid;
begin
  select * into m from guild_members where user_id = me;
  if not found then return 'invalid'; end if;
  delete from guild_members where user_id = me;
  if m.role = 'leader' then
    select gm.user_id into heir from guild_members gm left join saves s on s.user_id = gm.user_id
      where gm.guild_id = m.guild_id order by s.power desc nulls last limit 1;
    if heir is null then delete from guilds where id = m.guild_id; return 'closed'; end if;
    update guild_members set role = 'leader' where user_id = heir;
    update guilds set leader = heir where id = m.guild_id;
  end if;
  return 'ok';
end; $$;

-- Donate gold: levels the guild up through the cost table.
create or replace function public.guild_donate(amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; g guilds%rowtype;
begin
  select guild_id into gid from guild_members where user_id = me;
  if gid is null or amount is null or amount <= 0 or amount > 1000000000000 then return jsonb_build_object('status', 'invalid'); end if;
  select * into g from guilds where id = gid for update;
  if g.level >= 10 then return jsonb_build_object('status', 'max'); end if;
  g.progress := g.progress + amount;
  while g.level < 10 and g.progress >= guild_cost(g.level) loop g.progress := g.progress - guild_cost(g.level); g.level := g.level + 1; end loop;
  if g.level >= 10 then g.progress := 0; end if;
  update guilds set level = g.level, progress = g.progress where id = gid;
  update guild_members set donated = donated + amount where user_id = me;
  insert into guild_donations (guild_id, user_id, amount) values (gid, me, amount);
  return jsonb_build_object('status', 'ok', 'level', g.level, 'progress', g.progress);
end; $$;

create or replace function public.guild_rename(new_name text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; n text := btrim(coalesce(new_name, ''));
begin
  select guild_id into gid from guild_members where user_id = me and role = 'leader';
  if gid is null then return 'not_leader'; end if;
  if char_length(n) < 3 or char_length(n) > 30 or n !~ '^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$' then return 'invalid'; end if;
  update guilds set name = n where id = gid;
  return 'ok';
exception when unique_violation then return 'taken';
end; $$;

do $$ declare f text; begin
  foreach f in array array['guild_create(text,integer,bigint)','guild_info()','guild_list(text,integer)','guild_ranking(integer)','guild_members_of(uuid)',
    'guild_request(uuid)','guild_cancel_request(uuid)','guild_answer(uuid,boolean)','guild_kick(uuid)','guild_leave()','guild_donate(bigint)','guild_rename(text)']
  loop execute 'revoke all on function public.' || f || ' from public'; execute 'grant execute on function public.' || f || ' to authenticated'; end loop;
end $$;
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
-- Valor Online: save guard (run once in Supabase → SQL Editor, after all the other SQL files).
-- Every save a player sends is checked against the previous one. Impossible jumps are cut back and logged.
-- Saves made from the SQL Editor (admin) and characters marked trusted (testers) are not checked.
alter table public.saves
  add column if not exists trusted        boolean     not null default false,
  add column if not exists guard_note     text,
  add column if not exists diamond_budget numeric     not null default 3000,
  add column if not exists level_budget   numeric     not null default 20,
  add column if not exists budget_at      timestamptz not null default now();

create table if not exists public.cheat_log (
  id         bigserial primary key,
  user_id    uuid,
  name       text,
  kind       text,
  old_value  numeric,
  new_value  numeric,
  allowed    numeric,
  created_at timestamptz not null default now()
);
alter table public.cheat_log enable row level security;
revoke all on public.cheat_log from anon, authenticated;

create or replace function public.guard_num(v text) returns numeric language sql immutable as $$
  select case when v ~ '^-?[0-9]+(\.[0-9]+)?$' then v::numeric else 0 end;
$$;

create or replace function public.saves_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hrs numeric; db numeric; lb numeric;
  od numeric; nd numeric; ol numeric; nl numeric; og numeric; ng numeric;
  notes text[] := '{}';
begin
  if auth.uid() is null then return new; end if;                 -- SQL Editor / admin
  if tg_op = 'UPDATE' then
    -- Columns players may never change themselves.
    new.user_id := old.user_id; new.username := old.username; new.trusted := old.trusted; new.hidden := old.hidden;
    new.created_at := old.created_at;
    if old.trusted then new.guard_note := null; new.diamond_budget := old.diamond_budget; new.level_budget := old.level_budget; return new; end if;
    hrs := greatest(0, extract(epoch from now() - old.budget_at) / 3600);
    db := least(3000, old.diamond_budget + hrs * 1000 / 24);
    lb := least(20, old.level_budget + hrs * 3);
    od := guard_num(old.data->'state'->>'diamonds'); nd := guard_num(new.data->'state'->>'diamonds');
    ol := greatest(1, guard_num(old.data->'state'->>'level')); nl := guard_num(new.data->'state'->>'level');
    og := guard_num(old.data->'state'->>'gold'); ng := guard_num(new.data->'state'->>'gold');
  else
    new.trusted := false; new.hidden := false;
    db := 3000; lb := 20; od := 0; nd := guard_num(new.data->'state'->>'diamonds'); ol := 1; nl := guard_num(new.data->'state'->>'level'); og := 0; ng := guard_num(new.data->'state'->>'gold');
    -- A new row may carry a character from before the server, within limits.
    if nd > 20000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds-start', 0, nd, 20000);
      new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(20000)); notes := notes || 'diamonds';
    end if;
    nd := 0; od := 0;                                            -- the start value is not charged to the budget
  end if;

  -- Diamonds: at most the budget (refills 1,000 a day, holds up to 3,000).
  if nd - od > db then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds', od, nd, od + db);
    new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(floor(od + db))); notes := notes || 'diamonds'; db := 0;
  else
    db := db - greatest(0, nd - od);
  end if;

  -- Level: never above 100, and at most the level budget (3 an hour, holds up to 20).
  if nl > 100 or (tg_op = 'UPDATE' and nl - ol > lb) then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'level', ol, nl, least(100, ol + floor(lb)));
    nl := least(100, case when tg_op = 'UPDATE' then ol + floor(lb) else nl end);
    new.data := jsonb_set(new.data, '{state,level}', to_jsonb(nl)); new.level := nl; notes := notes || 'level'; lb := 0;
  elsif tg_op = 'UPDATE' then
    lb := lb - greatest(0, nl - ol);
  end if;

  -- Gold: only an absurd amount is refused.
  if ng > 1000000000000 then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold', og, ng, og);
    new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(least(og, 1000000000000))); notes := notes || 'gold';
  end if;

  -- Arena wins come from the server's fight records, not from the save.
  if to_regclass('public.arena_log') is not null then
    execute 'select count(*) from public.arena_log where attacker = $1 and win' into new.arena_wins using new.user_id;
  end if;

  new.diamond_budget := db; new.level_budget := lb; new.budget_at := now();
  new.guard_note := case when cardinality(notes) > 0 then array_to_string(notes, ',') else null end;
  return new;
end; $$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves for each row execute function public.saves_guard();

-- Testers are not checked:
update public.saves set trusted = true where lower(name) = 'doom';
-- Valor Online: password recovery codes (run once in Supabase → SQL Editor).
-- A player creates a one-time recovery code in the profile; with it they can set a new password
-- on the login screen. Only a hash of the code is stored.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.recovery_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code_hash  text not null,
  created_at timestamptz not null default now(),
  tries      integer not null default 0,
  tried_at   timestamptz
);
alter table public.recovery_codes enable row level security;
revoke all on public.recovery_codes from anon, authenticated;

-- New code for the signed-in player (replaces the old one). Shown once: XXXX-XXXX-XXXX.
create or replace function public.recovery_new()
returns text language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid(); alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; raw text := ''; i integer;
begin
  if me is null then return null; end if;
  for i in 1..12 loop raw := raw || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1); end loop;
  insert into recovery_codes (user_id, code_hash) values (me, crypt(raw, gen_salt('bf')))
    on conflict (user_id) do update set code_hash = excluded.code_hash, created_at = now(), tries = 0, tried_at = null;
  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
end; $$;

-- When the signed-in player's code was made (null = no code).
create or replace function public.recovery_status()
returns timestamptz language sql stable security definer set search_path = public as $$
  select created_at from recovery_codes where user_id = auth.uid();
$$;

-- Set a new password with the code. Login name or character name both work. 5 wrong tries lock it for an hour.
create or replace function public.recovery_reset(login text, code text, new_password text)
returns text language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid; r recovery_codes%rowtype; c text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select user_id into uid from public.saves where lower(username) = lower(btrim(login)) limit 1;
  if uid is null then select user_id into uid from public.saves where coalesce(name, '') <> '' and lower(name) = lower(btrim(login)) limit 1; end if;
  if uid is null then return 'wrong'; end if;
  select * into r from recovery_codes where user_id = uid for update;
  if not found then return 'wrong'; end if;
  if r.tries >= 5 and r.tried_at > now() - interval '1 hour' then return 'locked'; end if;
  if crypt(c, r.code_hash) <> r.code_hash then
    update recovery_codes set tries = case when r.tried_at < now() - interval '1 hour' then 1 else r.tries + 1 end, tried_at = now() where user_id = uid;
    return 'wrong';
  end if;
  if char_length(coalesce(new_password, '')) < 8 or char_length(new_password) > 72 then return 'weak'; end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() where id = uid;
  delete from recovery_codes where user_id = uid;   -- one use; the player makes a new code afterwards
  return 'ok';
end; $$;

revoke all on function public.recovery_new() from public;
revoke all on function public.recovery_status() from public;
revoke all on function public.recovery_reset(text, text, text) from public;
grant execute on function public.recovery_new() to authenticated;
grant execute on function public.recovery_status() to authenticated;
grant execute on function public.recovery_reset(text, text, text) to anon, authenticated;
-- Valor Online: shared news feed (run once in Supabase → SQL Editor).
create table if not exists public.news (
  id         bigserial primary key,
  kind       text not null check (kind in ('epic', 'wheel-mount', 'anniversary-mount')),
  user_id    uuid not null references auth.users(id) on delete cascade,
  player     text not null,
  item       text not null,
  created_at timestamptz not null default now()
);
create index if not exists news_created_idx on public.news (created_at desc);
alter table public.news enable row level security;
drop policy if exists "news_read" on public.news;
create policy "news_read" on public.news for select to authenticated using (true);
revoke all on public.news from anon;
grant select on public.news to authenticated;

-- Adds a news line for the signed-in player (at most one every 3 seconds and 40 an hour).
create or replace function public.news_add(kind text, item text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text; it text := left(btrim(coalesce(item, '')), 80);
begin
  if me is null or kind not in ('epic', 'wheel-mount', 'anniversary-mount') or it = '' then return 'invalid'; end if;
  select name into n from saves where user_id = me;
  if coalesce(n, '') = '' then return 'invalid'; end if;
  if exists (select 1 from news where user_id = me and created_at > now() - interval '3 seconds') then return 'slow'; end if;
  if (select count(*) from news where user_id = me and created_at > now() - interval '1 hour') >= 40 then return 'slow'; end if;
  insert into news (kind, user_id, player, item) values (kind, me, n, it);
  return 'ok';
end; $$;
revoke all on function public.news_add(text, text) from public;
grant execute on function public.news_add(text, text) to authenticated;
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
-- Valor Online: real Team Arena rooms (run once in Supabase → SQL Editor, after arena.sql).
-- Open 12:00–13:00 and 18:00–19:00 (Türkiye). Rooms hold 3. The leader starts the fight; the result is stored
-- on the room and every member's screen plays it. Members who stop polling for 45 seconds leave the room.
alter table public.saves
  add column if not exists team_rating integer not null default 1000,
  add column if not exists team_wins   integer not null default 0;

create table if not exists public.team_rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  pass_hash   text,
  leader      uuid not null references auth.users(id) on delete cascade,
  result      jsonb,
  result_id   integer not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.team_room_members (
  user_id   uuid primary key references auth.users(id) on delete cascade,   -- one room per player
  room_id   uuid not null references public.team_rooms(id) on delete cascade,
  joined_at timestamptz not null default now(),
  seen_at   timestamptz not null default now()
);
create index if not exists team_room_members_room_idx on public.team_room_members (room_id);
create table if not exists public.team_invites (
  room_id    uuid not null references public.team_rooms(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  from_name  text,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create table if not exists public.team_fights (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  room_id    uuid,
  win        boolean,
  draw       boolean,
  created_at timestamptz not null default now()
);
create index if not exists team_fights_user_idx on public.team_fights (user_id, created_at desc);
alter table public.team_rooms enable row level security;
alter table public.team_room_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.team_fights enable row level security;
revoke all on public.team_rooms, public.team_room_members, public.team_invites, public.team_fights from anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.team_open() returns boolean language sql stable as $$
  select extract(hour from now() at time zone 'Europe/Istanbul') in (12, 18);
$$;
create or replace function public.team_day_start() returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';
$$;

-- Removes players who stopped polling, empty rooms, and rooms when the arena closes. Hands leadership on.
create or replace function public.team_cleanup() returns void language plpgsql security definer set search_path = public as $$
begin
  if not team_open() then delete from team_rooms; return; end if;
  delete from team_room_members where seen_at < now() - interval '45 seconds';
  delete from team_rooms r where not exists (select 1 from team_room_members m where m.room_id = r.id);
  update team_rooms r set leader = (select m.user_id from team_room_members m where m.room_id = r.id order by m.joined_at limit 1)
    where not exists (select 1 from team_room_members m where m.room_id = r.id and m.user_id = r.leader);
  delete from team_invites where created_at < now() - interval '10 minutes';
end; $$;

-- Open rooms (not full) and my pending invites.
create or replace function public.team_lobby()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform team_cleanup();
  return jsonb_build_object(
    'open', team_open(),
    'rooms', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
      select jsonb_build_object('id', r.id, 'name', r.name, 'locked', r.pass_hash is not null,
             'leader_name', (select name from saves where user_id = r.leader),
             'members', (select count(*) from team_room_members m where m.room_id = r.id), 'created_at', r.created_at) as x
      from team_rooms r where (select count(*) from team_room_members m where m.room_id = r.id) < 3 limit 30) t), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('room_id', i.room_id, 'room_name', r.name, 'from_name', i.from_name))
      from team_invites i join team_rooms r on r.id = i.room_id where i.user_id = auth.uid()), '[]'::jsonb),
    'used', (select count(*) from team_fights where user_id = auth.uid() and created_at >= team_day_start()),
    'rating', (select team_rating from saves where user_id = auth.uid()));
end; $$;

create or replace function public.team_create(rname text, pass text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid(); rid uuid; n text := left(btrim(coalesce(rname, '')), 24);
begin
  perform team_cleanup();
  if me is null or not team_open() then return 'closed'; end if;
  if exists (select 1 from team_room_members where user_id = me) then return 'already'; end if;
  if n = '' then n := coalesce((select name from saves where user_id = me), 'Oyuncu') || ' Odası'; end if;
  insert into team_rooms (name, pass_hash, leader)
  values (n, case when coalesce(btrim(pass), '') <> '' then crypt(left(btrim(pass), 12), gen_salt('bf')) end, me) returning id into rid;
  insert into team_room_members (user_id, room_id) values (me, rid);
  delete from team_invites where user_id = me;
  return 'ok';
end; $$;

create or replace function public.team_join(rid uuid, pass text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare me uuid := auth.uid(); r team_rooms%rowtype; invited boolean;
begin
  perform team_cleanup();
  if me is null or not team_open() then return 'closed'; end if;
  if exists (select 1 from team_room_members where user_id = me) then return 'already'; end if;
  select * into r from team_rooms where id = rid for update;
  if not found then return 'gone'; end if;
  if (select count(*) from team_room_members where room_id = rid) >= 3 then return 'full'; end if;
  invited := exists (select 1 from team_invites where room_id = rid and user_id = me);
  if r.pass_hash is not null and not invited and crypt(coalesce(btrim(pass), ''), r.pass_hash) <> r.pass_hash then return 'wrong_password'; end if;
  insert into team_room_members (user_id, room_id) values (me, rid);
  delete from team_invites where user_id = me;
  return 'ok';
end; $$;

create or replace function public.team_leave()
returns text language plpgsql security definer set search_path = public as $$
begin delete from team_room_members where user_id = auth.uid(); perform team_cleanup(); return 'ok'; end; $$;

create or replace function public.team_kick(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from team_rooms where leader = auth.uid();
  if rid is null or target = auth.uid() then return 'not_leader'; end if;
  delete from team_room_members where user_id = target and room_id = rid;
  return 'ok';
end; $$;

create or replace function public.team_decline(rid uuid)
returns text language sql security definer set search_path = public as $$
  delete from team_invites where room_id = rid and user_id = auth.uid(); select 'ok'::text;
$$;

-- Players seen in the last 10 minutes who are not in a room (for invites).
create or replace function public.team_invite_candidates()
returns table(user_id uuid, name text, class text, level integer, power bigint)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.name, s.class, s.level, s.power from saves s
  where s.user_id <> auth.uid() and not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
    and s.updated_at > now() - interval '10 minutes'
    and not exists (select 1 from team_room_members m where m.user_id = s.user_id)
  order by s.updated_at desc limit 20;
$$;

create or replace function public.team_invite(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select id into rid from team_rooms where leader = auth.uid();
  if rid is null then return 'not_leader'; end if;
  if (select count(*) from team_room_members where room_id = rid) >= 3 then return 'full'; end if;
  if exists (select 1 from team_room_members where user_id = target) then return 'busy'; end if;
  insert into team_invites (room_id, user_id, from_name) values (rid, target, (select name from saves where user_id = auth.uid()))
    on conflict (room_id, user_id) do update set created_at = now();
  return 'ok';
end; $$;

-- My room (members with their combat profiles), refreshed every few seconds; also keeps me in the room.
create or replace function public.team_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid;
begin
  update team_room_members set seen_at = now() where user_id = me returning room_id into rid;
  perform team_cleanup();
  select room_id into rid from team_room_members where user_id = me;
  if rid is null then return jsonb_build_object('room', null, 'open', team_open()); end if;
  return jsonb_build_object('open', team_open(), 'room', (select jsonb_build_object(
    'id', r.id, 'name', r.name, 'locked', r.pass_hash is not null, 'leader', r.leader, 'result', r.result, 'result_id', r.result_id,
    'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', s.name, 'class', s.class, 'level', s.level,
                 'power', s.power, 'combat', s.combat, 'profile', s.profile,
                 'left', 15 - (select count(*) from team_fights f where f.user_id = m.user_id and f.created_at >= team_day_start()))
                 order by m.joined_at)
               from team_room_members m join saves s on s.user_id = m.user_id where m.room_id = r.id))
    from team_rooms r where r.id = rid));
end; $$;

-- Random rival players with a combat profile (not matched by power), never anyone from my room.
create or replace function public.team_rivals(n integer)
returns table(user_id uuid, name text, class text, level integer, power bigint, combat jsonb, profile jsonb)
language sql volatile security definer set search_path = public as $$
  select s.user_id, s.name, s.class, s.level, s.power, s.combat, s.profile from saves s
  where not s.hidden and s.combat is not null and coalesce(s.name, '') <> '' and s.class is not null
    and s.user_id not in (select m.user_id from team_room_members m where m.room_id = (select room_id from team_room_members where user_id = auth.uid()))
  order by random() limit least(greatest(coalesce(n, 3), 1), 3);
$$;

-- The leader stores the finished fight. Each member gets one fight counted, rating ±, and the result plays for all.
create or replace function public.team_report(fight jsonb, won boolean, was_draw boolean)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid; m record; delta integer;
begin
  if not team_open() then return 'closed'; end if;
  select id into rid from team_rooms where leader = me;
  if rid is null then return 'not_leader'; end if;
  for m in select tm.user_id, s.name from team_room_members tm join saves s on s.user_id = tm.user_id where tm.room_id = rid loop
    if (select count(*) from team_fights f where f.user_id = m.user_id and f.created_at >= team_day_start()) >= 15 then return 'limit:' || coalesce(m.name, ''); end if;
  end loop;
  delta := case when won and not was_draw then 20 when was_draw then 0 else -15 end;
  perform set_config('valor.server_write', '1', true);   -- lets the save guard accept these rating changes
  insert into team_fights (user_id, room_id, win, draw) select tm.user_id, rid, won and not was_draw, was_draw from team_room_members tm where tm.room_id = rid;
  update saves s set team_rating = greatest(0, s.team_rating + delta), team_wins = s.team_wins + case when won and not was_draw then 1 else 0 end
    where s.user_id in (select tm.user_id from team_room_members tm where tm.room_id = rid);
  update team_rooms set result = fight, result_id = result_id + 1 where id = rid;
  return 'ok';
end; $$;

create or replace function public.team_top(lim integer default 10)
returns table(rank bigint, name text, class text, level integer, team_rating integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.team_rating desc, s.team_wins desc, s.name), s.name, s.class, s.level, s.team_rating, s.user_id = auth.uid()
  from saves s where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  order by 1 limit least(greatest(coalesce(lim, 10), 1), 50);
$$;
create or replace function public.team_my_rank()
returns bigint language sql stable security definer set search_path = public as $$
  select 1 + (select count(*) from saves s where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
              and s.user_id <> me.user_id and s.team_rating > me.team_rating)
  from saves me where me.user_id = auth.uid();
$$;

do $$ declare f text; begin
  foreach f in array array['team_lobby()','team_create(text,text)','team_join(uuid,text)','team_leave()','team_kick(uuid)','team_decline(uuid)',
    'team_invite_candidates()','team_invite(uuid)','team_state()','team_rivals(integer)','team_report(jsonb,boolean,boolean)','team_top(integer)','team_my_rank()']
  loop execute 'revoke all on function public.' || f || ' from public'; execute 'grant execute on function public.' || f || ' to authenticated'; end loop;
  execute 'revoke all on function public.team_cleanup() from public, anon, authenticated';
end $$;
-- Valor Online: admin panel and bans (run once in Supabase → SQL Editor, after the other files).
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.bans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  until      timestamptz,                 -- null = permanent
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.bans enable row level security;
revoke all on public.admins, public.bans from anon, authenticated;

-- DooM is the admin. Add more with: insert into public.admins select user_id from public.saves where lower(name) = 'isim';
insert into public.admins (user_id) select user_id from public.saves where lower(name) = 'doom' on conflict do nothing;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
create or replace function public.is_banned(uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bans where user_id = uid and (until is null or until > now()));
$$;

-- What the game asks right after sign-in.
create or replace function public.my_status() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('admin', is_admin(),
    'ban', (select jsonb_build_object('until', until, 'reason', reason) from bans where user_id = auth.uid() and (until is null or until > now())));
$$;

-- Banned players cannot send chat messages.
create or replace function public.chat_ban_check() returns trigger language plpgsql security definer set search_path = public as $$
begin if is_banned(new.user_id) then raise exception 'banned'; end if; return new; end; $$;
drop trigger if exists chat_ban_check on public.chat_messages;
create trigger chat_ban_check before insert on public.chat_messages for each row execute function public.chat_ban_check();

-- ---------- Admin functions (every one checks is_admin()) ----------
create or replace function public.admin_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'players', (select count(*) from saves where class is not null),
    'active_today', (select count(*) from saves where updated_at > now() - interval '24 hours'),
    'online', (select count(*) from saves where updated_at > now() - interval '10 minutes'),
    'guilds', (select count(*) from guilds),
    'bans', (select count(*) from bans where until is null or until > now()),
    'cheats_today', (select count(*) from cheat_log where created_at > now() - interval '24 hours'));
end; $$;

create or replace function public.admin_find(q text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(x) from (
    select jsonb_build_object('user_id', s.user_id, 'username', s.username, 'name', s.name, 'class', s.class, 'level', s.level, 'power', s.power,
      'diamonds', public.guard_num(s.data->'state'->>'diamonds'), 'gold', public.guard_num(s.data->'state'->>'gold'),
      'updated_at', s.updated_at, 'hidden', s.hidden, 'trusted', s.trusted,
      'muted', (select coalesce(until::text, 'kalıcı') from chat_mutes m where m.user_id = s.user_id and (m.until is null or m.until > now())),
      'banned', (select coalesce(until::text, 'kalıcı') from bans b where b.user_id = s.user_id and (b.until is null or b.until > now())),
      'cheats', (select count(*) from cheat_log c where c.user_id = s.user_id)) as x
    from saves s
    where coalesce(q, '') = '' or s.name ilike '%' || q || '%' or s.username ilike '%' || q || '%'
    order by s.updated_at desc limit 30) t), '[]'::jsonb);
end; $$;

-- Give (or take, with a negative amount) diamonds and gold. The player's next start loads the new save.
create or replace function public.admin_grant(uid uuid, add_diamonds bigint, add_gold bigint) returns text
language plpgsql security definer set search_path = public as $$
declare s saves%rowtype;
begin
  if not is_admin() then return 'not_admin'; end if;
  select * into s from saves where user_id = uid for update;
  if not found then return 'invalid'; end if;
  perform set_config('valor.server_write', '1', true);
  update saves set
    data = jsonb_set(jsonb_set(data, '{state,diamonds}', to_jsonb(greatest(0, guard_num(data->'state'->>'diamonds') + coalesce(add_diamonds, 0)))),
                     '{state,gold}', to_jsonb(greatest(0, guard_num(data->'state'->>'gold') + coalesce(add_gold, 0)))),
    rev = rev + 1, updated_at = now()
  where user_id = uid;
  return 'ok';
end; $$;

create or replace function public.admin_flag(uid uuid, flag text, val boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return 'not_admin'; end if;
  perform set_config('valor.server_write', '1', true);
  if flag = 'hidden' then update saves set hidden = val where user_id = uid;
  elsif flag = 'trusted' then update saves set trusted = val where user_id = uid;
  else return 'invalid'; end if;
  return 'ok';
end; $$;

create or replace function public.admin_mute(uid uuid, hours integer, why text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return 'not_admin'; end if;
  if hours = 0 then delete from chat_mutes where user_id = uid; return 'ok'; end if;
  insert into chat_mutes (user_id, until, reason) values (uid, case when hours is null then null else now() + make_interval(hours => hours) end, why)
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
  return 'ok';
end; $$;

create or replace function public.admin_ban(uid uuid, hours integer, why text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then return 'not_admin'; end if;
  if uid = auth.uid() then return 'invalid'; end if;
  if hours = 0 then delete from bans where user_id = uid; return 'ok'; end if;
  insert into bans (user_id, until, reason) values (uid, case when hours is null then null else now() + make_interval(hours => hours) end, why)
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, created_at = now();
  return 'ok';
end; $$;

create or replace function public.admin_reset_password(uid uuid, new_password text) returns text
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not is_admin() then return 'not_admin'; end if;
  if char_length(coalesce(new_password, '')) < 8 or char_length(new_password) > 72 then return 'weak'; end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf')), updated_at = now() where id = uid;
  return case when found then 'ok' else 'invalid' end;
end; $$;

create or replace function public.admin_cheat_log(lim integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'id')::bigint desc) from (
    select jsonb_build_object('id', id, 'user_id', user_id, 'name', name, 'kind', kind, 'old', old_value, 'new', new_value, 'allowed', allowed, 'at', created_at) as x
    from cheat_log order by id desc limit least(greatest(coalesce(lim, 50), 1), 200)) t), '[]'::jsonb);
end; $$;

create or replace function public.admin_chat(lim integer default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'id')::bigint desc) from (
    select jsonb_build_object('id', id, 'user_id', user_id, 'channel', channel, 'name', name, 'body', body, 'at', created_at) as x
    from chat_messages order by id desc limit least(greatest(coalesce(lim, 50), 1), 200)) t), '[]'::jsonb);
end; $$;

create or replace function public.admin_delete_message(mid bigint) returns text
language plpgsql security definer set search_path = public as $$
begin if not is_admin() then return 'not_admin'; end if; delete from chat_messages where id = mid; return 'ok'; end; $$;

do $$ declare f text; begin
  foreach f in array array['my_status()','admin_stats()','admin_find(text)','admin_grant(uuid,bigint,bigint)','admin_flag(uuid,text,boolean)',
    'admin_mute(uuid,integer,text)','admin_ban(uuid,integer,text)','admin_reset_password(uuid,text)','admin_cheat_log(integer)','admin_chat(integer)','admin_delete_message(bigint)']
  loop execute 'revoke all on function public.' || f || ' from public'; execute 'grant execute on function public.' || f || ' to authenticated'; end loop;
  execute 'revoke all on function public.is_admin() from public'; execute 'grant execute on function public.is_admin() to authenticated';
  execute 'revoke all on function public.is_banned(uuid) from public';
end $$;
-- Valor Online: save guard v2 (run once in Supabase → SQL Editor, after admin.sql and team.sql).
-- Replaces the v1 guard. In addition to v1 (diamonds, level, arena wins, locked columns):
--   * banned players cannot save at all
--   * gold has a budget too (refills 200 million a day, holds up to 500 million)
--   * equipment cannot be above +21
--   * the power shown in rankings is recomputed from the combat stats (it cannot be typed in separately)
--   * team rating is only changed by the team arena
--   * server functions (admin panel, team arena) are allowed to change these columns
alter table public.saves add column if not exists gold_budget numeric not null default 500000000;

-- Power from the combat stats, with the same weights as the game.
create or replace function public.guard_power(cls text, c jsonb) returns bigint language sql immutable as $$
  select round(
      guard_num(c->>'Saldırı') * case when cls = 'Büyücü' then 3 else 10 end
    + guard_num(c->>'Sihir') * case when cls = 'Büyücü' then 10 else 3 end
    + guard_num(c->>'Savunma') * 10 + guard_num(c->>'Sihir Savunma') * 10
    + guard_num(c->>'Can') * 3 + guard_num(c->>'Kritik') * 4 + guard_num(c->>'Bloke') * 4)::bigint;
$$;

-- Caps every item's +level at 21 (inventory and equipped).
create or replace function public.guard_items(d jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(jsonb_set(d,
    '{state,inventory}', coalesce((select jsonb_agg(case when guard_num(e->>'plus') > 21 then jsonb_set(e, '{plus}', '21') else e end order by i)
                                   from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) with ordinality as t(e, i)), '[]'::jsonb)),
    '{state,equipped}', coalesce((select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' and guard_num(v->>'plus') > 21 then jsonb_set(v, '{plus}', '21') else v end)
                                  from jsonb_each(case when jsonb_typeof(d->'state'->'equipped') = 'object' then d->'state'->'equipped' else '{}'::jsonb end) as t(k, v)), '{}'::jsonb));
$$;

create or replace function public.saves_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hrs numeric; db numeric; lb numeric; gb numeric;
  od numeric; nd numeric; ol numeric; nl numeric; og numeric; ng numeric;
  notes text[] := '{}';
begin
  if auth.uid() is null then return new; end if;                                  -- SQL Editor / admin
  if coalesce(current_setting('valor.server_write', true), '') = '1' then return new; end if;  -- admin panel, team arena
  if is_banned(new.user_id) then raise exception 'banned'; end if;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.username := old.username; new.trusted := old.trusted; new.hidden := old.hidden;
    new.created_at := old.created_at; new.team_rating := old.team_rating; new.team_wins := old.team_wins;
    if old.trusted then new.guard_note := null; return new; end if;
    hrs := greatest(0, extract(epoch from now() - old.budget_at) / 3600);
    db := least(3000, old.diamond_budget + hrs * 1000 / 24);
    lb := least(20, old.level_budget + hrs * 3);
    gb := least(500000000, old.gold_budget + hrs * 200000000 / 24);
    od := guard_num(old.data->'state'->>'diamonds'); nd := guard_num(new.data->'state'->>'diamonds');
    ol := greatest(1, guard_num(old.data->'state'->>'level')); nl := guard_num(new.data->'state'->>'level');
    og := guard_num(old.data->'state'->>'gold'); ng := guard_num(new.data->'state'->>'gold');
  else
    new.trusted := false; new.hidden := false; new.team_rating := 1000; new.team_wins := 0;
    db := 3000; lb := 20; gb := 500000000; ol := 1; og := 0;
    nd := guard_num(new.data->'state'->>'diamonds'); nl := guard_num(new.data->'state'->>'level'); ng := guard_num(new.data->'state'->>'gold');
    if nd > 20000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds-start', 0, nd, 20000);
      new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(20000)); notes := notes || 'diamonds';
    end if;
    if ng > 50000000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold-start', 0, ng, 50000000);
      new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(50000000)); notes := notes || 'gold';
    end if;
    nd := 0; od := 0; ng := 0; og := 0;
  end if;

  if nd - od > db then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds', od, nd, od + db);
    new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(floor(od + db))); notes := notes || 'diamonds'; db := 0;
  else db := db - greatest(0, nd - od); end if;

  if ng - og > gb then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold', og, ng, og + gb);
    new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(floor(og + gb))); notes := notes || 'gold'; gb := 0;
  else gb := gb - greatest(0, ng - og); end if;

  if nl > 100 or (tg_op = 'UPDATE' and nl - ol > lb) then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'level', ol, nl, least(100, ol + floor(lb)));
    nl := least(100, case when tg_op = 'UPDATE' then ol + floor(lb) else nl end);
    new.data := jsonb_set(new.data, '{state,level}', to_jsonb(nl)); new.level := nl; notes := notes || 'level'; lb := 0;
  elsif tg_op = 'UPDATE' then lb := lb - greatest(0, nl - ol); end if;

  if jsonb_path_exists(new.data, '$.state.inventory[*] ? (@.plus > 21)') or jsonb_path_exists(new.data, '$.state.equipped.* ? (@.plus > 21)') then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'item-plus', null, null, 21);
    new.data := guard_items(new.data); notes := notes || 'items';
  end if;

  if new.combat is not null then new.power := guard_power(new.class, new.combat); end if;

  if to_regclass('public.arena_log') is not null then
    execute 'select count(*) from public.arena_log where attacker = $1 and win' into new.arena_wins using new.user_id;
  end if;

  new.diamond_budget := db; new.level_budget := lb; new.gold_budget := gb; new.budget_at := now();
  new.guard_note := case when cardinality(notes) > 0 then array_to_string(notes, ',') else null end;
  return new;
end; $$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves for each row execute function public.saves_guard();
-- Valor Online: server-side arena fights (run once in Supabase → SQL Editor, AFTER deploying the arena-fight
-- Edge Function, and after arena.sql, team.sql, admin.sql). Only the Edge Function (service role) may call
-- the srv_ functions; the old routes where the player's device reported its own result are closed.

-- Solo: both fighters' combat profiles, if the fight is allowed (10 a day, visible target, not banned).
create or replace function public.srv_arena_context(attacker uuid, target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a saves%rowtype; t saves%rowtype; day_start timestamptz := (date_trunc('day', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';
begin
  if attacker is null or target is null or attacker = target then return jsonb_build_object('status', 'invalid'); end if;
  if is_banned(attacker) then return jsonb_build_object('status', 'banned'); end if;
  select * into a from saves where user_id = attacker;
  select * into t from saves where user_id = target;
  if a.combat is null or a.class is null or t.combat is null or t.class is null or t.hidden then return jsonb_build_object('status', 'invalid'); end if;
  if (select count(*) from arena_log where arena_log.attacker = srv_arena_context.attacker and created_at >= day_start) >= 10 then return jsonb_build_object('status', 'limit'); end if;
  return jsonb_build_object('status', 'ok',
    'me', jsonb_build_object('name', a.name, 'class', a.class, 'level', a.level, 'combat', a.combat),
    'foe', jsonb_build_object('name', t.name, 'class', t.class, 'level', t.level, 'combat', t.combat, 'gender', t.profile->>'gender'));
end; $$;

create or replace function public.srv_arena_store(attacker uuid, target uuid, won boolean, was_draw boolean, fight_rounds integer)
returns text language plpgsql security definer set search_path = public as $$
declare day_start timestamptz := (date_trunc('day', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';
begin
  if (select count(*) from arena_log l where l.attacker = srv_arena_store.attacker and l.created_at >= day_start) >= 10 then return 'limit'; end if;
  insert into arena_log (attacker, defender, attacker_name, defender_name, win, draw, rounds)
  values (attacker, target, (select name from saves where user_id = attacker), (select name from saves where user_id = target),
          coalesce(won, false) and not coalesce(was_draw, false), coalesce(was_draw, false), fight_rounds);
  return 'ok';
end; $$;

-- Team: the leader's room and members with their combat profiles (all must have fights left today).
create or replace function public.srv_team_context(leader uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rid uuid; m record;
begin
  perform team_cleanup();
  if not team_open() then return jsonb_build_object('status', 'closed'); end if;
  if is_banned(leader) then return jsonb_build_object('status', 'banned'); end if;
  select id into rid from team_rooms where team_rooms.leader = srv_team_context.leader;
  if rid is null then return jsonb_build_object('status', 'not_leader'); end if;
  for m in select s.name from team_room_members tm join saves s on s.user_id = tm.user_id
           where tm.room_id = rid and (select count(*) from team_fights f where f.user_id = tm.user_id and f.created_at >= team_day_start()) >= 15 loop
    return jsonb_build_object('status', 'limit:' || coalesce(m.name, ''));
  end loop;
  return jsonb_build_object('status', 'ok', 'room', rid, 'members', (select jsonb_agg(jsonb_build_object(
      'user_id', s.user_id, 'name', s.name, 'class', s.class, 'level', s.level, 'combat', s.combat, 'gender', s.profile->>'gender') order by (tm.user_id = srv_team_context.leader) desc, tm.joined_at)
    from team_room_members tm join saves s on s.user_id = tm.user_id where tm.room_id = rid));
end; $$;

create or replace function public.srv_team_rivals(room uuid, n integer)
returns table(user_id uuid, name text, class text, level integer, combat jsonb, gender text)
language sql volatile security definer set search_path = public as $$
  select s.user_id, s.name, s.class, s.level, s.combat, s.profile->>'gender' from saves s
  where not s.hidden and s.combat is not null and coalesce(s.name, '') <> '' and s.class is not null
    and s.user_id not in (select m.user_id from team_room_members m where m.room_id = srv_team_rivals.room)
  order by random() limit least(greatest(coalesce(n, 3), 1), 3);
$$;

create or replace function public.srv_team_store(room uuid, fight jsonb, won boolean, was_draw boolean)
returns text language plpgsql security definer set search_path = public as $$
declare delta integer := case when won and not was_draw then 20 when was_draw then 0 else -15 end;
begin
  if not team_open() then return 'closed'; end if;
  perform set_config('valor.server_write', '1', true);
  insert into team_fights (user_id, room_id, win, draw)
    select tm.user_id, room, won and not was_draw, was_draw from team_room_members tm where tm.room_id = srv_team_store.room;
  update saves s set team_rating = greatest(0, s.team_rating + delta), team_wins = s.team_wins + case when won and not was_draw then 1 else 0 end
    where s.user_id in (select tm.user_id from team_room_members tm where tm.room_id = srv_team_store.room);
  update team_rooms set result = fight, result_id = result_id + 1 where id = srv_team_store.room;
  return 'ok';
end; $$;

do $$ declare f text; begin
  foreach f in array array['srv_arena_context(uuid,uuid)','srv_arena_store(uuid,uuid,boolean,boolean,integer)','srv_team_context(uuid)','srv_team_rivals(uuid,integer)','srv_team_store(uuid,jsonb,boolean,boolean)']
  loop execute 'revoke all on function public.' || f || ' from public, anon, authenticated'; execute 'grant execute on function public.' || f || ' to service_role'; end loop;
  -- Close the old routes where the player's own device reported the result.
  execute 'revoke all on function public.arena_report(uuid, boolean, boolean, integer) from public, anon, authenticated';
  execute 'revoke all on function public.team_report(jsonb, boolean, boolean) from public, anon, authenticated';
end $$;
