-- Valor Online: online / offline status for friends (run once in Supabase → SQL Editor, after friends.sql — friends.sql already contains it).
-- While the game is open it calls social_ping() once a minute; a player counts as online if the last
-- ping (or cloud save) is less than 3 minutes old. Friends are listed online first.
alter table public.saves add column if not exists last_active timestamptz;

create or replace function public.social_ping() returns void
language sql security definer set search_path = public as $$
  update saves set last_active = now() where user_id = auth.uid();
$$;
revoke all on function public.social_ping() from public, anon;
grant execute on function public.social_ping() to authenticated;

create or replace function public.social_state() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'class', x.class, 'level', x.level, 'power', x.power, 'seen', x.seen, 'online', x.seen > now() - interval '3 minutes')
                                          order by (x.seen > now() - interval '3 minutes') desc, x.power desc)
                         from (select s.name, s.class, s.level, s.power, greatest(s.last_active, s.updated_at) as seen
                               from friend_links f join saves s on s.user_id = f.friend_id where f.user_id = auth.uid()) x), '[]'),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level, 'power', s.power, 'at', r.created_at) order by r.created_at desc)
                          from friend_requests r join saves s on s.user_id = r.from_id where r.to_id = auth.uid()), '[]'),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level, 'at', r.created_at) order by r.created_at desc)
                          from friend_requests r join saves s on s.user_id = r.to_id where r.from_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level) order by b.created_at desc)
                         from player_blocks b join saves s on s.user_id = b.blocked_id where b.user_id = auth.uid()), '[]')
  );
$$;
revoke all on function public.social_state() from public, anon;
grant execute on function public.social_state() to authenticated;
