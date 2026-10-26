-- Valor Online: cloud saves (run once in Supabase → SQL Editor).
-- One row per player. Row level security: a player can only read and write their own row.
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  data       jsonb not null,
  rev        integer not null default 1,
  name       text,
  class      text,
  level      integer not null default 1,
  power      bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "saves_select_own" on public.saves;
drop policy if exists "saves_insert_own" on public.saves;
drop policy if exists "saves_update_own" on public.saves;
create policy "saves_select_own" on public.saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves_insert_own" on public.saves for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves_update_own" on public.saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

-- Keeps rankings fast later (level / power ordering).
create index if not exists saves_level_idx on public.saves (level desc);
create index if not exists saves_power_idx on public.saves (power desc);
-- Valor Online: unique character names (run once in Supabase → SQL Editor, after schema.sql).
-- Names are compared case-insensitively ("DooM" blocks "doom").
create unique index if not exists saves_name_unique
  on public.saves (lower(name)) where coalesce(name, '') <> '';

-- Reserves a name for the signed-in player's row. Returns 'ok', 'taken' or 'invalid'.
create or replace function public.claim_character_name(new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n text := btrim(coalesce(new_name, ''));
begin
  if auth.uid() is null then return 'invalid'; end if;
  if char_length(n) < 3 or char_length(n) > 20 or n !~ '^[a-zA-ZğüşöçıİĞÜŞÖÇ0-9_ ]+$' then return 'invalid'; end if;
  if exists (select 1 from public.saves where lower(name) = lower(n) and user_id <> auth.uid()) then return 'taken'; end if;
  update public.saves set name = n where user_id = auth.uid();
  if not found then return 'invalid'; end if;
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

revoke all on function public.claim_character_name(text) from public, anon;
grant execute on function public.claim_character_name(text) to authenticated;
-- Valor Online: sign in with the character name (run once in Supabase → SQL Editor).
-- Returns the login username of the character with this name, or null.
create or replace function public.login_username_for(character_name text)
returns text language sql stable security definer set search_path = public as $$
  select username from public.saves
  where coalesce(name, '') <> '' and lower(name) = lower(btrim(character_name))
  limit 1;
$$;
revoke all on function public.login_username_for(text) from public;
grant execute on function public.login_username_for(text) to anon, authenticated;
-- Valor Online: real rankings (run once in Supabase → SQL Editor).
alter table public.saves
  add column if not exists xp      bigint  not null default 0,
  add column if not exists spirit  bigint  not null default 0,
  add column if not exists fame    bigint  not null default 0,
  add column if not exists profile jsonb,
  add column if not exists hidden  boolean not null default false;  -- hidden = left out of rankings (test characters)

create index if not exists saves_xp_idx     on public.saves (xp desc);
create index if not exists saves_spirit_idx on public.saves (spirit desc);
create index if not exists saves_fame_idx   on public.saves (fame desc);

-- Top players for one ranking: kind = 'power' | 'xp' | 'spirit' | 'fame'. Usernames are never returned.
create or replace function public.leaderboard(kind text, lim integer default 50)
returns table(rank bigint, name text, class text, level integer, power bigint, xp bigint, spirit bigint, fame bigint, profile jsonb, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by
           case kind when 'xp' then s.xp when 'spirit' then s.spirit when 'fame' then s.fame else s.power end desc,
           s.level desc, s.name) as rank,
         s.name, s.class, s.level, s.power, s.xp, s.spirit, s.fame, s.profile,
         s.user_id = auth.uid() as is_me
  from public.saves s
  where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  order by rank
  limit least(greatest(coalesce(lim, 50), 1), 100);
$$;

-- The signed-in player's position in one ranking (null when hidden or without a character).
create or replace function public.my_rank(kind text)
returns bigint
language sql stable security definer set search_path = public as $$
  with me as (
    select user_id, hidden, class, name,
           case kind when 'xp' then xp when 'spirit' then spirit when 'fame' then fame else power end as v
    from public.saves where user_id = auth.uid()
  )
  select case when me.hidden or me.class is null or coalesce(me.name, '') = '' then null
         else 1 + (select count(*) from public.saves s
                   where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null and s.user_id <> me.user_id
                     and (case kind when 'xp' then s.xp when 'spirit' then s.spirit when 'fame' then s.fame else s.power end) > me.v)
         end
  from me;
$$;

revoke all on function public.leaderboard(text, integer) from public;
revoke all on function public.my_rank(text) from public;
grant execute on function public.leaderboard(text, integer) to authenticated;
grant execute on function public.my_rank(text) to authenticated;
