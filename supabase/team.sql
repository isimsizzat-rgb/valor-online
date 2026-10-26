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
