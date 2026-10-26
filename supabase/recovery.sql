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
