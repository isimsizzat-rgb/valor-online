-- Valor Online: Team Arena matchmaking (run after team.sql, team-duel.sql and fight.sql).
-- The leader searches for up to 60 seconds; two rooms searching at the same time are matched (same size first)
-- and fight each other live. Nobody else searching = "Takım bulunamadı" (no more fights against offline players).
-- The live fight stays in team_duels under the host room; guest_room is the other team's room.
alter table public.team_rooms
  add column if not exists searching_at   timestamptz,   -- refreshed by the leader's search poll
  add column if not exists search_started timestamptz,
  add column if not exists match_host     uuid,          -- set on the guest room between matching and the duel row
  add column if not exists match_at       timestamptz;
alter table public.team_duels add column if not exists guest_room uuid references public.team_rooms(id) on delete set null;
create unique index if not exists team_duels_guest_idx on public.team_duels (guest_room) where guest_room is not null;

-- team_state: the duel flag also covers the guest team, and members can see that their leader is searching.
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
    'duel', exists(select 1 from team_duels d where d.room_id = r.id or d.guest_room = r.id),
    'searching', coalesce(r.searching_at > now() - interval '8 seconds', false),
    'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', s.name, 'class', s.class, 'level', s.level,
                 'power', s.power, 'combat', s.combat, 'profile', s.profile,
                 'left', 15 - (select count(*) from team_fights f where f.user_id = m.user_id and f.created_at >= team_day_start()))
                 order by m.joined_at)
               from team_room_members m join saves s on s.user_id = m.user_id where m.room_id = r.id))
    from team_rooms r where r.id = rid));
end; $$;

-- One search step for the leader (called every ~2 s by the arena-fight function).
-- status: waiting | pending (matched, duel being created) | in_duel | timeout | matched (+ both teams) | context errors
create or replace function public.srv_team_search(leader uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ctx jsonb; rid uuid; r team_rooms%rowtype; o record; octx jsonb; mine integer;
begin
  ctx := srv_team_context(leader);
  if ctx->>'status' <> 'ok' then return ctx; end if;
  rid := (ctx->>'room')::uuid;
  perform pg_advisory_xact_lock(hashtext('valor_team_match'));   -- one match at a time, so two leaders cannot pick each other twice
  if exists (select 1 from team_duels d where d.room_id = rid or d.guest_room = rid) then return jsonb_build_object('status', 'in_duel'); end if;
  select * into r from team_rooms where id = rid for update;
  if r.match_host is not null and r.match_at > now() - interval '20 seconds' then return jsonb_build_object('status', 'pending'); end if;
  if r.searching_at is null or r.searching_at < now() - interval '10 seconds' or r.search_started is null then r.search_started := now(); end if;
  if now() - r.search_started > interval '62 seconds' then
    update team_rooms set searching_at = null, search_started = null where id = rid;
    return jsonb_build_object('status', 'timeout');
  end if;
  update team_rooms set searching_at = now(), search_started = r.search_started, match_host = null, match_at = null where id = rid;
  mine := jsonb_array_length(ctx->'members');
  for o in
    select t.id, t.leader from team_rooms t
    where t.id <> rid and t.searching_at > now() - interval '8 seconds'
      and (t.match_host is null or t.match_at < now() - interval '20 seconds')
      and not exists (select 1 from team_duels d where d.room_id = t.id or d.guest_room = t.id)
    order by abs((select count(*) from team_room_members m where m.room_id = t.id) - mine), t.search_started
  loop
    octx := srv_team_context(o.leader);
    continue when octx->>'status' <> 'ok';
    update team_rooms set searching_at = null, search_started = null, match_host = rid, match_at = now() where id = o.id;
    update team_rooms set searching_at = null, search_started = null where id = rid;
    return jsonb_build_object('status', 'matched', 'room', rid, 'members', ctx->'members', 'guest', o.id, 'guest_members', octx->'members');
  end loop;
  return jsonb_build_object('status', 'waiting', 'since', (extract(epoch from r.search_started) * 1000)::bigint);
end; $$;

create or replace function public.srv_team_cancel(leader uuid)
returns text language sql security definer set search_path = public as $$
  update team_rooms set searching_at = null, search_started = null where team_rooms.leader = srv_team_cancel.leader;
  select 'ok'::text;
$$;

revoke all on function public.srv_team_search(uuid), public.srv_team_cancel(uuid) from public, anon, authenticated;
grant execute on function public.srv_team_search(uuid), public.srv_team_cancel(uuid) to service_role;
