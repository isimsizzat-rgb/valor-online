-- Valor Online: turn-based Team Arena (run after team.sql and arena-duel.sql). While a room fights, the
-- live duel lives here; the arena-fight Edge Function (service role) is the only reader/writer. The finished
-- fight is stored through srv_team_store exactly like before (limits, rating, result for every member).
create table if not exists public.team_duels (
  room_id    uuid primary key references public.team_rooms(id) on delete cascade,
  state      jsonb not null,
  meta       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_duels enable row level security;
revoke all on public.team_duels from public, anon, authenticated;

-- team_state also says whether the room is in a live duel, so every member opens the fight screen.
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
    'duel', exists(select 1 from team_duels d where d.room_id = r.id),
    'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', s.name, 'class', s.class, 'level', s.level,
                 'power', s.power, 'combat', s.combat, 'profile', s.profile,
                 'left', 15 - (select count(*) from team_fights f where f.user_id = m.user_id and f.created_at >= team_day_start()))
                 order by m.joined_at)
               from team_room_members m join saves s on s.user_id = m.user_id where m.room_id = r.id))
    from team_rooms r where r.id = rid));
end; $$;
