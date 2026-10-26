-- Valor Online: save guard (run once in Supabase → SQL Editor, after all the other SQL files).
-- Every save a player sends is checked against the previous one. Impossible jumps are cut back and logged.
-- Saves made from the SQL Editor (admin) and characters marked trusted (testers) are not checked.
alter table public.saves
  add column if not exists trusted        boolean     not null default false,
  add column if not exists guard_note     text,
  add column if not exists diamond_budget numeric     not null default 3000,
  add column if not exists level_budget   numeric     not null default 20,
  add column if not exists budget_at      timestamptz not null default now();

create table if not exists public.cheat_log (
  id         bigserial primary key,
  user_id    uuid,
  name       text,
  kind       text,
  old_value  numeric,
  new_value  numeric,
  allowed    numeric,
  created_at timestamptz not null default now()
);
alter table public.cheat_log enable row level security;
revoke all on public.cheat_log from anon, authenticated;

create or replace function public.guard_num(v text) returns numeric language sql immutable as $$
  select case when v ~ '^-?[0-9]+(\.[0-9]+)?$' then v::numeric else 0 end;
$$;

create or replace function public.saves_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hrs numeric; db numeric; lb numeric;
  od numeric; nd numeric; ol numeric; nl numeric; og numeric; ng numeric;
  notes text[] := '{}';
begin
  if auth.uid() is null then return new; end if;                 -- SQL Editor / admin
  if tg_op = 'UPDATE' then
    -- Columns players may never change themselves.
    new.user_id := old.user_id; new.username := old.username; new.trusted := old.trusted; new.hidden := old.hidden;
    new.created_at := old.created_at;
    if old.trusted then new.guard_note := null; new.diamond_budget := old.diamond_budget; new.level_budget := old.level_budget; return new; end if;
    hrs := greatest(0, extract(epoch from now() - old.budget_at) / 3600);
    db := least(3000, old.diamond_budget + hrs * 1000 / 24);
    lb := least(20, old.level_budget + hrs * 3);
    od := guard_num(old.data->'state'->>'diamonds'); nd := guard_num(new.data->'state'->>'diamonds');
    ol := greatest(1, guard_num(old.data->'state'->>'level')); nl := guard_num(new.data->'state'->>'level');
    og := guard_num(old.data->'state'->>'gold'); ng := guard_num(new.data->'state'->>'gold');
  else
    new.trusted := false; new.hidden := false;
    db := 3000; lb := 20; od := 0; nd := guard_num(new.data->'state'->>'diamonds'); ol := 1; nl := guard_num(new.data->'state'->>'level'); og := 0; ng := guard_num(new.data->'state'->>'gold');
    -- A new row may carry a character from before the server, within limits.
    if nd > 20000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds-start', 0, nd, 20000);
      new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(20000)); notes := notes || 'diamonds';
    end if;
    nd := 0; od := 0;                                            -- the start value is not charged to the budget
  end if;

  -- Diamonds: at most the budget (refills 1,000 a day, holds up to 3,000).
  if nd - od > db then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds', od, nd, od + db);
    new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(floor(od + db))); notes := notes || 'diamonds'; db := 0;
  else
    db := db - greatest(0, nd - od);
  end if;

  -- Level: never above 100, and at most the level budget (3 an hour, holds up to 20).
  if nl > 100 or (tg_op = 'UPDATE' and nl - ol > lb) then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'level', ol, nl, least(100, ol + floor(lb)));
    nl := least(100, case when tg_op = 'UPDATE' then ol + floor(lb) else nl end);
    new.data := jsonb_set(new.data, '{state,level}', to_jsonb(nl)); new.level := nl; notes := notes || 'level'; lb := 0;
  elsif tg_op = 'UPDATE' then
    lb := lb - greatest(0, nl - ol);
  end if;

  -- Gold: only an absurd amount is refused.
  if ng > 1000000000000 then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold', og, ng, og);
    new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(least(og, 1000000000000))); notes := notes || 'gold';
  end if;

  -- Arena wins come from the server's fight records, not from the save.
  if to_regclass('public.arena_log') is not null then
    execute 'select count(*) from public.arena_log where attacker = $1 and win' into new.arena_wins using new.user_id;
  end if;

  new.diamond_budget := db; new.level_budget := lb; new.budget_at := now();
  new.guard_note := case when cardinality(notes) > 0 then array_to_string(notes, ',') else null end;
  return new;
end; $$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves for each row execute function public.saves_guard();

-- Testers are not checked:
update public.saves set trusted = true where lower(name) = 'doom';
