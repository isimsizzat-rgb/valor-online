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
