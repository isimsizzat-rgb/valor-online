-- Valor Online: arena against real players (run once in Supabase → SQL Editor, after rankings.sql).
alter table public.saves
  add column if not exists combat     jsonb,
  add column if not exists arena_wins integer not null default 0;
create index if not exists saves_arena_wins_idx on public.saves (arena_wins desc);

-- One row per arena fight. Players can read fights they attacked in or defended.
create table if not exists public.arena_log (
  id            bigserial primary key,
  attacker      uuid not null references auth.users(id) on delete cascade,
  defender      uuid not null references auth.users(id) on delete cascade,
  attacker_name text,
  defender_name text,
  win           boolean not null,          -- attacker won
  draw          boolean not null default false,
  rounds        integer,
  created_at    timestamptz not null default now()
);
create index if not exists arena_log_defender_idx on public.arena_log (defender, created_at desc);
create index if not exists arena_log_attacker_idx on public.arena_log (attacker, created_at desc);
alter table public.arena_log enable row level security;
drop policy if exists "arena_log_read_own" on public.arena_log;
create policy "arena_log_read_own" on public.arena_log for select to authenticated
  using ((select auth.uid()) in (attacker, defender));
revoke all on public.arena_log from anon;
grant select on public.arena_log to authenticated;

-- Rivals closest to my power (other visible players with a saved combat profile).
create or replace function public.arena_rivals(lim integer default 15)
returns table(id uuid, name text, class text, level integer, power bigint, arena_wins integer, combat jsonb, profile jsonb)
language sql stable security definer set search_path = public as $$
  with me as (select coalesce(power, 0) as p from public.saves where user_id = auth.uid())
  select s.user_id, s.name, s.class, s.level, s.power, s.arena_wins, s.combat, s.profile
  from public.saves s, me
  where s.user_id <> auth.uid() and not s.hidden and s.combat is not null
    and coalesce(s.name, '') <> '' and s.class is not null
  order by abs(s.power - me.p), s.power desc
  limit least(greatest(coalesce(lim, 15), 1), 30);
$$;

-- Records a finished fight. At most 10 fights per player per day (Türkiye time).
create or replace function public.arena_report(target uuid, won boolean, was_draw boolean, fight_rounds integer)
returns text language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  day_start timestamptz := (date_trunc('day', now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';
begin
  if me is null or target is null or target = me then return 'invalid'; end if;
  if not exists (select 1 from public.saves where user_id = target) then return 'invalid'; end if;
  if (select count(*) from public.arena_log where attacker = me and created_at >= day_start) >= 10 then return 'limit'; end if;
  insert into public.arena_log (attacker, defender, attacker_name, defender_name, win, draw, rounds)
  values (me, target,
          (select name from public.saves where user_id = me),
          (select name from public.saves where user_id = target),
          coalesce(won, false) and not coalesce(was_draw, false), coalesce(was_draw, false), fight_rounds);
  return 'ok';
end;
$$;

-- Arena wins ranking and my position in it.
create or replace function public.arena_top(lim integer default 10)
returns table(rank bigint, name text, class text, level integer, arena_wins integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.arena_wins desc, s.level desc, s.name), s.name, s.class, s.level, s.arena_wins, s.user_id = auth.uid()
  from public.saves s
  where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
  order by 1 limit least(greatest(coalesce(lim, 10), 1), 50);
$$;
create or replace function public.arena_my_rank()
returns bigint language sql stable security definer set search_path = public as $$
  select case when me.hidden or me.class is null then null
         else 1 + (select count(*) from public.saves s where not s.hidden and coalesce(s.name, '') <> '' and s.class is not null
                   and s.user_id <> me.user_id and s.arena_wins > me.arena_wins) end
  from public.saves me where me.user_id = auth.uid();
$$;

revoke all on function public.arena_rivals(integer) from public;
revoke all on function public.arena_report(uuid, boolean, boolean, integer) from public;
revoke all on function public.arena_top(integer) from public;
revoke all on function public.arena_my_rank() from public;
grant execute on function public.arena_rivals(integer) to authenticated;
grant execute on function public.arena_report(uuid, boolean, boolean, integer) to authenticated;
grant execute on function public.arena_top(integer) to authenticated;
grant execute on function public.arena_my_rank() to authenticated;
