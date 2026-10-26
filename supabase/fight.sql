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
