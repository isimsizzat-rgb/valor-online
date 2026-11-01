-- Valor Online: Team Arena invites from anywhere in the game (run after team.sql).
-- While the arena is open the game calls team_ping(busy) every few seconds: it marks the player online and
-- whether they are busy (in a stage, adventure, dungeon, boss or another fight), and returns fresh invites so
-- an "X seni takıma davet etti · Evet / Hayır" pop-up can open wherever the player is.
-- The invite list shows every online player who is not in a room; busy players cannot be invited.
create table if not exists public.team_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  busy    boolean not null default false,
  seen_at timestamptz not null default now()
);
alter table public.team_presence enable row level security;
revoke all on public.team_presence from public, anon, authenticated;

create or replace function public.team_ping(busy boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return jsonb_build_object('invites', '[]'::jsonb); end if;
  insert into team_presence (user_id, busy, seen_at) values (me, coalesce(team_ping.busy, false), now())
    on conflict (user_id) do update set busy = excluded.busy, seen_at = now();
  if not team_open() or exists (select 1 from team_room_members where user_id = me) then
    return jsonb_build_object('open', team_open(), 'invites', '[]'::jsonb);
  end if;
  return jsonb_build_object('open', true, 'invites', coalesce((
    select jsonb_agg(jsonb_build_object('room_id', i.room_id, 'room_name', r.name, 'from_name', i.from_name,
             'members', (select count(*) from team_room_members m where m.room_id = r.id), 'at', (extract(epoch from i.created_at) * 1000)::bigint)
           order by i.created_at desc)
    from team_invites i join team_rooms r on r.id = i.room_id
    where i.user_id = me and i.created_at > now() - interval '60 seconds'
      and (select count(*) from team_room_members m where m.room_id = r.id) < 3), '[]'::jsonb));
end; $$;

-- Every online player (pinged in the last 20 s) who is not in a room, busy ones flagged.
create or replace function public.team_online_players()
returns table(user_id uuid, name text, class text, level integer, power bigint, busy boolean)
language sql stable security definer set search_path = public as $$
  select s.user_id, s.name, s.class, s.level, s.power, p.busy from team_presence p join saves s on s.user_id = p.user_id
  where p.seen_at > now() - interval '20 seconds' and s.user_id <> auth.uid() and not s.hidden
    and coalesce(s.name, '') <> '' and s.class is not null
    and not exists (select 1 from team_room_members m where m.user_id = s.user_id)
  order by p.busy, s.level desc, s.name limit 60;
$$;

create or replace function public.team_invite(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare rid uuid; p team_presence%rowtype;
begin
  select id into rid from team_rooms where leader = auth.uid();
  if rid is null then return 'not_leader'; end if;
  if (select count(*) from team_room_members where room_id = rid) >= 3 then return 'full'; end if;
  if exists (select 1 from team_room_members where user_id = target) then return 'busy'; end if;
  select * into p from team_presence where user_id = target;
  if not found or p.seen_at < now() - interval '20 seconds' then return 'offline'; end if;
  if p.busy then return 'target_busy'; end if;
  insert into team_invites (room_id, user_id, from_name) values (rid, target, (select name from saves where user_id = auth.uid()))
    on conflict (room_id, user_id) do update set created_at = now(), from_name = excluded.from_name;
  return 'ok';
end; $$;

revoke all on function public.team_ping(boolean), public.team_online_players(), public.team_invite(uuid) from public, anon;
grant execute on function public.team_ping(boolean), public.team_online_players(), public.team_invite(uuid) to authenticated;
