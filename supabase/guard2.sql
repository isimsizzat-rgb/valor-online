-- Valor Online: save guard v2 (run once in Supabase → SQL Editor, after admin.sql and team.sql).
-- Replaces the v1 guard. In addition to v1 (diamonds, level, arena wins, locked columns):
--   * banned players cannot save at all
--   * gold has a budget too (refills 200 million a day, holds up to 500 million)
--   * equipment cannot be above +21
--   * the power shown in rankings is recomputed from the combat stats (it cannot be typed in separately)
--   * team rating is only changed by the team arena
--   * server functions (admin panel, team arena) are allowed to change these columns
alter table public.saves add column if not exists gold_budget numeric not null default 500000000;

-- Power from the combat stats, with the same weights as the game.
create or replace function public.guard_power(cls text, c jsonb) returns bigint language sql immutable as $$
  select round(
      guard_num(c->>'Saldırı') * case when cls = 'Büyücü' then 3 else 10 end
    + guard_num(c->>'Sihir') * case when cls = 'Büyücü' then 10 else 3 end
    + guard_num(c->>'Savunma') * 10 + guard_num(c->>'Sihir Savunma') * 10
    + guard_num(c->>'Can') * 3 + guard_num(c->>'Kritik') * 4 + guard_num(c->>'Bloke') * 4)::bigint;
$$;

-- Caps every item's +level at 21 (inventory and equipped).
create or replace function public.guard_items(d jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(jsonb_set(d,
    '{state,inventory}', coalesce((select jsonb_agg(case when guard_num(e->>'plus') > 21 then jsonb_set(e, '{plus}', '21') else e end order by i)
                                   from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) with ordinality as t(e, i)), '[]'::jsonb)),
    '{state,equipped}', coalesce((select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' and guard_num(v->>'plus') > 21 then jsonb_set(v, '{plus}', '21') else v end)
                                  from jsonb_each(case when jsonb_typeof(d->'state'->'equipped') = 'object' then d->'state'->'equipped' else '{}'::jsonb end) as t(k, v)), '{}'::jsonb));
$$;

create or replace function public.saves_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hrs numeric; db numeric; lb numeric; gb numeric;
  od numeric; nd numeric; ol numeric; nl numeric; og numeric; ng numeric;
  notes text[] := '{}';
begin
  if auth.uid() is null then return new; end if;                                  -- SQL Editor / admin
  if coalesce(current_setting('valor.server_write', true), '') = '1' then return new; end if;  -- admin panel, team arena
  if is_banned(new.user_id) then raise exception 'banned'; end if;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id; new.username := old.username; new.trusted := old.trusted; new.hidden := old.hidden;
    new.created_at := old.created_at; new.team_rating := old.team_rating; new.team_wins := old.team_wins;
    if old.trusted then new.guard_note := null; return new; end if;
    hrs := greatest(0, extract(epoch from now() - old.budget_at) / 3600);
    db := least(3000, old.diamond_budget + hrs * 1000 / 24);
    lb := least(20, old.level_budget + hrs * 3);
    gb := least(500000000, old.gold_budget + hrs * 200000000 / 24);
    od := guard_num(old.data->'state'->>'diamonds'); nd := guard_num(new.data->'state'->>'diamonds');
    ol := greatest(1, guard_num(old.data->'state'->>'level')); nl := guard_num(new.data->'state'->>'level');
    og := guard_num(old.data->'state'->>'gold'); ng := guard_num(new.data->'state'->>'gold');
  else
    new.trusted := false; new.hidden := false; new.team_rating := 1000; new.team_wins := 0;
    db := 3000; lb := 20; gb := 500000000; ol := 1; og := 0;
    nd := guard_num(new.data->'state'->>'diamonds'); nl := guard_num(new.data->'state'->>'level'); ng := guard_num(new.data->'state'->>'gold');
    if nd > 20000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds-start', 0, nd, 20000);
      new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(20000)); notes := notes || 'diamonds';
    end if;
    if ng > 50000000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold-start', 0, ng, 50000000);
      new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(50000000)); notes := notes || 'gold';
    end if;
    nd := 0; od := 0; ng := 0; og := 0;
  end if;

  if nd - od > db then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds', od, nd, od + db);
    new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(floor(od + db))); notes := notes || 'diamonds'; db := 0;
  else db := db - greatest(0, nd - od); end if;

  if ng - og > gb then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold', og, ng, og + gb);
    new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(floor(og + gb))); notes := notes || 'gold'; gb := 0;
  else gb := gb - greatest(0, ng - og); end if;

  if nl > 100 or (tg_op = 'UPDATE' and nl - ol > lb) then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'level', ol, nl, least(100, ol + floor(lb)));
    nl := least(100, case when tg_op = 'UPDATE' then ol + floor(lb) else nl end);
    new.data := jsonb_set(new.data, '{state,level}', to_jsonb(nl)); new.level := nl; notes := notes || 'level'; lb := 0;
  elsif tg_op = 'UPDATE' then lb := lb - greatest(0, nl - ol); end if;

  if jsonb_path_exists(new.data, '$.state.inventory[*] ? (@.plus > 21)') or jsonb_path_exists(new.data, '$.state.equipped.* ? (@.plus > 21)') then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'item-plus', null, null, 21);
    new.data := guard_items(new.data); notes := notes || 'items';
  end if;

  if new.combat is not null then new.power := guard_power(new.class, new.combat); end if;

  if to_regclass('public.arena_log') is not null then
    execute 'select count(*) from public.arena_log where attacker = $1 and win' into new.arena_wins using new.user_id;
  end if;

  new.diamond_budget := db; new.level_budget := lb; new.gold_budget := gb; new.budget_at := now();
  new.guard_note := case when cardinality(notes) > 0 then array_to_string(notes, ',') else null end;
  return new;
end; $$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves for each row execute function public.saves_guard();
