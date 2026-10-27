-- Valor Online: friends and blocking (run once in Supabase → SQL Editor, after schema.sql and names.sql).
-- Includes the online/offline status (presence.sql); running this file alone is enough.
-- Players are addressed by character name (names are unique, case-insensitive). Everything goes through
-- the functions below; players cannot read or write the tables directly.
--   friend_request(name)        send a request (accepts at once if that player already asked you)
--   friend_answer(name, accept) accept or decline an incoming request
--   friend_cancel(name)         take back a request you sent
--   friend_remove(name)         end a friendship (removed for both players)
--   player_block(name)          block: ends friendship and requests, they cannot send you requests
--   player_unblock(name)        lift a block
--   social_state()              friends, incoming and outgoing requests, blocked players
-- Each player can have at most 50 friends and 50 pending outgoing requests.

create table if not exists public.friend_links (
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
create table if not exists public.friend_requests (
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create index if not exists friend_requests_to_idx on public.friend_requests (to_id);
create table if not exists public.player_blocks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);
alter table public.friend_links enable row level security;
alter table public.friend_requests enable row level security;
alter table public.player_blocks enable row level security;
revoke all on public.friend_links, public.friend_requests, public.player_blocks from anon, authenticated;

-- Character name → player id (only players with a created character).
create or replace function public.social_find(n text) returns uuid
language sql stable security definer set search_path = public as $$
  select user_id from saves where lower(name) = lower(btrim(coalesce(n, ''))) and coalesce(name, '') <> '' and class is not null limit 1;
$$;
revoke all on function public.social_find(text) from public, anon, authenticated;

create or replace function public.friend_request(target text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := public.social_find(target);
begin
  if me is null then return 'invalid'; end if;
  if t is null then return 'not_found'; end if;
  if t = me then return 'self'; end if;
  if exists (select 1 from player_blocks where user_id = me and blocked_id = t) then return 'you_blocked'; end if;
  if exists (select 1 from player_blocks where user_id = t and blocked_id = me) then return 'unavailable'; end if;
  if exists (select 1 from friend_links where user_id = me and friend_id = t) then return 'already'; end if;
  if exists (select 1 from friend_requests where from_id = t and to_id = me) then
    if (select count(*) from friend_links where user_id = me) >= 50 then return 'my_limit'; end if;
    if (select count(*) from friend_links where user_id = t) >= 50 then return 'their_limit'; end if;
    delete from friend_requests where (from_id = t and to_id = me) or (from_id = me and to_id = t);
    insert into friend_links (user_id, friend_id) values (me, t), (t, me) on conflict do nothing;
    return 'accepted';
  end if;
  if exists (select 1 from friend_requests where from_id = me and to_id = t) then return 'pending'; end if;
  if (select count(*) from friend_links where user_id = me) >= 50 then return 'my_limit'; end if;
  if (select count(*) from friend_requests where from_id = me) >= 50 then return 'too_many'; end if;
  insert into friend_requests (from_id, to_id) values (me, t);
  return 'sent';
end; $$;

create or replace function public.friend_answer(target text, accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := public.social_find(target);
begin
  if me is null or t is null then return 'invalid'; end if;
  if not exists (select 1 from friend_requests where from_id = t and to_id = me) then return 'no_request'; end if;
  if accept then
    if (select count(*) from friend_links where user_id = me) >= 50 then return 'my_limit'; end if;
    if (select count(*) from friend_links where user_id = t) >= 50 then return 'their_limit'; end if;
  end if;
  delete from friend_requests where (from_id = t and to_id = me) or (from_id = me and to_id = t);
  if accept then
    insert into friend_links (user_id, friend_id) values (me, t), (t, me) on conflict do nothing;
    return 'accepted';
  end if;
  return 'declined';
end; $$;

create or replace function public.friend_cancel(target text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := public.social_find(target);
begin
  if me is null or t is null then return 'invalid'; end if;
  delete from friend_requests where from_id = me and to_id = t;
  return 'ok';
end; $$;

create or replace function public.friend_remove(target text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := public.social_find(target);
begin
  if me is null or t is null then return 'invalid'; end if;
  delete from friend_links where (user_id = me and friend_id = t) or (user_id = t and friend_id = me);
  return 'ok';
end; $$;

create or replace function public.player_block(target text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := public.social_find(target);
begin
  if me is null then return 'invalid'; end if;
  if t is null then return 'not_found'; end if;
  if t = me then return 'self'; end if;
  if (select count(*) from player_blocks where user_id = me) >= 200 then return 'too_many'; end if;
  insert into player_blocks (user_id, blocked_id) values (me, t) on conflict do nothing;
  delete from friend_links where (user_id = me and friend_id = t) or (user_id = t and friend_id = me);
  delete from friend_requests where (from_id = me and to_id = t) or (from_id = t and to_id = me);
  return 'ok';
end; $$;

create or replace function public.player_unblock(target text) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := public.social_find(target);
begin
  if me is null or t is null then return 'invalid'; end if;
  delete from player_blocks where user_id = me and blocked_id = t;
  return 'ok';
end; $$;

-- Everything the Social screen shows. seen = the player's last cloud save (about when they last played).
create or replace function public.social_state() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level, 'power', s.power, 'seen', s.updated_at) order by s.power desc)
                         from friend_links f join saves s on s.user_id = f.friend_id where f.user_id = auth.uid()), '[]'),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level, 'power', s.power, 'at', r.created_at) order by r.created_at desc)
                          from friend_requests r join saves s on s.user_id = r.from_id where r.to_id = auth.uid()), '[]'),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level, 'at', r.created_at) order by r.created_at desc)
                          from friend_requests r join saves s on s.user_id = r.to_id where r.from_id = auth.uid()), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class, 'level', s.level) order by b.created_at desc)
                         from player_blocks b join saves s on s.user_id = b.blocked_id where b.user_id = auth.uid()), '[]')
  );
$$;

revoke all on function public.friend_request(text), public.friend_answer(text, boolean), public.friend_cancel(text),
  public.friend_remove(text), public.player_block(text), public.player_unblock(text), public.social_state() from public, anon;
grant execute on function public.friend_request(text), public.friend_answer(text, boolean), public.friend_cancel(text),
  public.friend_remove(text), public.player_block(text), public.player_unblock(text), public.social_state() to authenticated;

-- Online status (same as presence.sql, included so this one file sets up everything).
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
