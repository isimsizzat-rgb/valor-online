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
