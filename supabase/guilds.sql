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
