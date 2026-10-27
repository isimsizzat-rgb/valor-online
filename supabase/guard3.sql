-- Valor Online: save guard v3 (run once in Supabase → SQL Editor, after guard2.sql).
-- Keeps every v2 rule (diamonds, gold, level, +21 cap, bans, locked columns) and adds:
--   * material budgets: wings, Epik Taşı, Binek Taşı and mosaic gems may only grow at a believable
--     daily rate. Diamonds spent in the same save count as purchases and raise the allowance.
--   * power budget: combat power may grow about 25% per hour (bankable up to +150%), plus a flat
--     150,000 per hour (bankable up to 500,000) so new characters can grow freely.
-- When a save breaks a material or power rule, it is still stored (the player keeps playing), but the extra
-- materials are taken back (Epik Taşı and Binek Taşı cut to the allowance; wings and mosaic gems put back as
-- they were in the last save), the combat profile and power used by rankings and the arena stay at their last
-- accepted values, and the event is written to cheat_log (Admin → Hile kaydı). Testers marked "trusted" are never checked.
-- Also adds welfare_reference(): the top level of real players (hidden, trusted and banned accounts left out),
-- used by Refah so test accounts do not inflate everyone's EXP bonus.

alter table public.saves
  add column if not exists wing_budget   numeric not null default 6,
  add column if not exists epic_budget   numeric not null default 300,
  add column if not exists mstone_budget numeric not null default 1500,
  add column if not exists gem_budget    numeric not null default 6000,
  add column if not exists power_ratio_budget numeric not null default 1.5,
  add column if not exists power_abs_budget   numeric not null default 500000;

-- Count of a stacked bag item (by marketItemId).
create or replace function public.guard_stack(d jsonb, item text) returns numeric language sql immutable as $$
  select coalesce(sum(greatest(1, guard_num(e->>'count'))), 0)
  from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) e
  where e->>'marketItemId' = item;
$$;
-- Put the stacks of one bag item back to how they were in the old save.
create or replace function public.guard_restore_stack(d jsonb, o jsonb, item text) returns jsonb language sql immutable as $$
  select jsonb_set(d, '{state,inventory}',
    coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) with ordinality t(e, i)
              where coalesce(e->>'marketItemId', '') <> item), '[]'::jsonb)
    || coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(case when jsonb_typeof(o->'state'->'inventory') = 'array' then o->'state'->'inventory' else '[]'::jsonb end) with ordinality t(e, i)
                 where e->>'marketItemId' = item), '[]'::jsonb));
$$;

-- Wings in Sv.1 units (a Sv.n wing = 2^(n-1) Sv.1 wings). Equipped and bag copies are counted once.
create or replace function public.guard_wings(d jsonb) returns numeric language sql immutable as $$
  select (select coalesce(sum(power(2, greatest(1, least(10, guard_num(coalesce(e->>'wingLevel', e->>'level')))) - 1)), 0)
  from (
    select distinct on (coalesce(e->>'id', md5(e::text))) e
    from (
      select e from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) e
      union all
      select d->'state'->'equipped'->'Kanat' where jsonb_typeof(d->'state'->'equipped'->'Kanat') = 'object'
    ) a
    where coalesce(e->>'wingId', '') <> ''
  ) w)
  + guard_stack(d, 'wheelFashionBag');   -- each Fashion Çantası opens into one Sv.1 wing
$$;

create or replace function public.guard_mount_stones(d jsonb) returns numeric language sql immutable as $$
  select coalesce(sum(greatest(1, guard_num(e->>'count'))), 0)
  from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) e
  where e->>'marketItemId' = 'mountStone';
$$;

-- Mosaic gems in Sv.1 units (4 gems merge into one: a Sv.n gem = 4^(n-1)); bag stacks plus gems set in items.
create or replace function public.guard_gems(d jsonb) returns numeric language sql immutable as $$
  select
    coalesce((select sum(guard_num(g->>'count') * power(4, greatest(1, least(10, guard_num(g->>'level'))) - 1))
              from jsonb_array_elements(case when jsonb_typeof(d->'state'->'gemInventory') = 'array' then d->'state'->'gemInventory' else '[]'::jsonb end) g), 0)
  + coalesce((select sum(power(4, greatest(1, least(10, guard_num(g->>'level'))) - 1))
              from (
                select distinct on (coalesce(e->>'id', md5(e::text))) e
                from (
                  select e from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) e
                  union all
                  select v from jsonb_each(case when jsonb_typeof(d->'state'->'equipped') = 'object' then d->'state'->'equipped' else '{}'::jsonb end) t(k, v)
                  where jsonb_typeof(v) = 'object'
                ) a
              ) items,
              jsonb_array_elements(case when jsonb_typeof(e->'gems') = 'array' then e->'gems' else '[]'::jsonb end) g
              where jsonb_typeof(g) = 'object'), 0)
  + guard_stack(d, 'mosaicStone') * 64;   -- an unopened Mozaik Taş Çantası can hold up to a Sv.4 gem
$$;

-- Corrections used when a material rule is broken.
create or replace function public.guard_set_mount_stones(d jsonb, n numeric) returns jsonb language sql immutable as $$
  select jsonb_set(d, '{state,inventory}',
    coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) with ordinality t(e, i)
              where coalesce(e->>'marketItemId', '') <> 'mountStone'), '[]'::jsonb)
    || case when n > 0 then jsonb_build_array(jsonb_build_object('id', 'mount-stone-guard', 'slot', 'Eşya', 'marketItemId', 'mountStone', 'name', 'Binek Taşı', 'count', n)) else '[]'::jsonb end);
$$;
-- Wings go back to the last save: wing items of the new save are replaced by the old ones, and the old equipped wing is kept.
create or replace function public.guard_restore_wings(d jsonb, o jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(
    jsonb_set(d, '{state,inventory}',
      coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) with ordinality t(e, i)
                where coalesce(e->>'wingId', '') = ''), '[]'::jsonb)
      || coalesce((select jsonb_agg(e order by i) from jsonb_array_elements(case when jsonb_typeof(o->'state'->'inventory') = 'array' then o->'state'->'inventory' else '[]'::jsonb end) with ordinality t(e, i)
                   where coalesce(e->>'wingId', '') <> ''), '[]'::jsonb)),
    '{state,equipped}',
    (case when jsonb_typeof(d->'state'->'equipped') = 'object' then d->'state'->'equipped' else '{}'::jsonb end) - 'Kanat'
      || case when jsonb_typeof(o->'state'->'equipped'->'Kanat') = 'object' then jsonb_build_object('Kanat', o->'state'->'equipped'->'Kanat') else '{}'::jsonb end);
$$;
-- Mosaic gems go back to the last save: the gem bag and the gems set in each item (matched by item id).
create or replace function public.guard_restore_gems(d jsonb, o jsonb) returns jsonb language sql immutable as $$
  with old_items as (
    select e->>'id' as id, e->'gems' as gems from jsonb_array_elements(case when jsonb_typeof(o->'state'->'inventory') = 'array' then o->'state'->'inventory' else '[]'::jsonb end) e
    union all
    select v->>'id', v->'gems' from jsonb_each(case when jsonb_typeof(o->'state'->'equipped') = 'object' then o->'state'->'equipped' else '{}'::jsonb end) t(k, v) where jsonb_typeof(v) = 'object'
  ), fix as (
    select case when jsonb_typeof(e) = 'object' and e ? 'gems'
                then jsonb_set(e, '{gems}', coalesce((select gems from old_items where id = e->>'id' and gems is not null limit 1), '[]'::jsonb))
                else e end as e, i
    from jsonb_array_elements(case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end) with ordinality t(e, i)
  )
  select jsonb_set(jsonb_set(jsonb_set(d,
    '{state,inventory}', coalesce((select jsonb_agg(e order by i) from fix), '[]'::jsonb)),
    '{state,equipped}', coalesce((select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' and v ? 'gems'
                                     then jsonb_set(v, '{gems}', coalesce((select gems from old_items where id = v->>'id' and gems is not null limit 1), '[]'::jsonb))
                                     else v end)
                                  from jsonb_each(case when jsonb_typeof(d->'state'->'equipped') = 'object' then d->'state'->'equipped' else '{}'::jsonb end) t(k, v)), '{}'::jsonb)),
    '{state,gemInventory}', case when jsonb_typeof(o->'state'->'gemInventory') = 'array' then o->'state'->'gemInventory' else '[]'::jsonb end);
$$;

create or replace function public.saves_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hrs numeric; db numeric; lb numeric; gb numeric;
  od numeric; nd numeric; ol numeric; nl numeric; og numeric; ng numeric;
  spent numeric;
  wb numeric; eb numeric; mb numeric; gemb numeric; pr numeric; pa numeric;
  ow numeric; nw numeric; oe numeric; ne numeric; om numeric; nm numeric; ogem numeric; ngem numeric;
  op numeric; np numeric; grow numeric; use_abs numeric;
  hold boolean := false;
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
    wb := least(6, old.wing_budget + hrs * 2 / 24);
    eb := least(300, old.epic_budget + hrs * 150 / 24);
    mb := least(1500, old.mstone_budget + hrs * 600 / 24);
    gemb := least(6000, old.gem_budget + hrs * 3000 / 24);
    pr := least(1.5, old.power_ratio_budget + hrs * 0.25);
    pa := least(500000, old.power_abs_budget + hrs * 150000);
    od := guard_num(old.data->'state'->>'diamonds'); nd := guard_num(new.data->'state'->>'diamonds');
    ol := greatest(1, guard_num(old.data->'state'->>'level')); nl := guard_num(new.data->'state'->>'level');
    og := guard_num(old.data->'state'->>'gold'); ng := guard_num(new.data->'state'->>'gold');
  else
    new.trusted := false; new.hidden := false; new.team_rating := 1000; new.team_wins := 0;
    db := 3000; lb := 20; gb := 500000000;
    wb := 6; eb := 300; mb := 1500; gemb := 6000; pr := 1.5; pa := 500000;
    ol := 1; og := 0;
    nd := guard_num(new.data->'state'->>'diamonds'); nl := guard_num(new.data->'state'->>'level'); ng := guard_num(new.data->'state'->>'gold');
    if nd > 20000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds-start', 0, nd, 20000);
      new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(20000)); notes := array_append(notes, 'diamonds');
    end if;
    if ng > 50000000 then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold-start', 0, ng, 50000000);
      new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(50000000)); notes := array_append(notes, 'gold');
    end if;
    nd := 0; od := 0; ng := 0; og := 0;
  end if;

  -- v2: diamonds, gold, level
  if nd - od > db then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'diamonds', od, nd, od + db);
    new.data := jsonb_set(new.data, '{state,diamonds}', to_jsonb(floor(od + db))); notes := array_append(notes, 'diamonds'); db := 0;
  else db := db - greatest(0, nd - od); end if;

  if ng - og > gb then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'gold', og, ng, og + gb);
    new.data := jsonb_set(new.data, '{state,gold}', to_jsonb(floor(og + gb))); notes := array_append(notes, 'gold'); gb := 0;
  else gb := gb - greatest(0, ng - og); end if;

  if nl > 100 or (tg_op = 'UPDATE' and nl - ol > lb) then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'level', ol, nl, least(100, ol + floor(lb)));
    nl := least(100, case when tg_op = 'UPDATE' then ol + floor(lb) else nl end);
    new.data := jsonb_set(new.data, '{state,level}', to_jsonb(nl)); new.level := nl; notes := array_append(notes, 'level'); lb := 0;
  elsif tg_op = 'UPDATE' then lb := lb - greatest(0, nl - ol); end if;

  if jsonb_path_exists(new.data, '$.state.inventory[*] ? (@.plus > 21)') or jsonb_path_exists(new.data, '$.state.equipped.* ? (@.plus > 21)') then
    insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'item-plus', null, null, 21);
    new.data := guard_items(new.data); notes := array_append(notes, 'items');
  end if;

  -- v3: materials and power (updates only; a new row has nothing to compare with)
  if tg_op = 'UPDATE' then
    spent := greatest(0, od - guard_num(new.data->'state'->>'diamonds'));   -- diamonds spent in this save buy materials
    ow := guard_wings(old.data); nw := guard_wings(new.data);
    oe := guard_num(old.data->'state'->>'shards'); ne := guard_num(new.data->'state'->>'shards');
    om := guard_mount_stones(old.data); nm := guard_mount_stones(new.data);
    ogem := guard_gems(old.data); ngem := guard_gems(new.data);
    wb := wb + spent / 999; eb := eb + spent / 40; mb := mb + spent / 10; gemb := gemb + spent * 16 / 120;

    if nw - ow > wb then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'wings', ow, nw, ow + floor(wb));
      notes := array_append(notes, 'wings'); hold := true; wb := 0; new.data := guard_restore_stack(guard_restore_wings(new.data, old.data), old.data, 'wheelFashionBag');
    else wb := wb - greatest(0, nw - ow); end if;
    if ne - oe > eb then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'epic-stones', oe, ne, oe + floor(eb));
      notes := array_append(notes, 'epic'); hold := true; new.data := jsonb_set(new.data, '{state,shards}', to_jsonb(floor(oe + eb))); eb := 0;
    else eb := eb - greatest(0, ne - oe); end if;
    if nm - om > mb then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'mount-stones', om, nm, om + floor(mb));
      notes := array_append(notes, 'mount-stones'); hold := true; new.data := guard_set_mount_stones(new.data, floor(om + mb)); mb := 0;
    else mb := mb - greatest(0, nm - om); end if;
    if ngem - ogem > gemb then
      insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'mosaic', ogem, ngem, ogem + floor(gemb));
      notes := array_append(notes, 'mosaic'); hold := true; gemb := 0; new.data := guard_restore_stack(guard_restore_gems(new.data, old.data), old.data, 'mosaicStone');
    else gemb := gemb - greatest(0, ngem - ogem); end if;
    wb := least(wb, 6); eb := least(eb, 300); mb := least(mb, 1500); gemb := least(gemb, 6000);

    if new.combat is not null and old.combat is not null and not hold then
      op := greatest(1, coalesce(old.power, 0)); np := guard_power(new.class, new.combat); grow := np - op;
      if grow > op * pr + pa then
        insert into cheat_log (user_id, name, kind, old_value, new_value, allowed) values (new.user_id, new.name, 'power', op, np, floor(op * (1 + pr) + pa));
        notes := array_append(notes, 'power'); hold := true; pr := 0; pa := 0;
      elsif grow > 0 then
        use_abs := least(pa, grow); pa := pa - use_abs; pr := greatest(0, pr - (grow - use_abs) / op);
      end if;
    end if;
  end if;

  if hold then
    -- Rankings and the arena keep the last accepted strength until the budgets refill.
    new.combat := old.combat; new.power := old.power;
  elsif new.combat is not null then
    new.power := guard_power(new.class, new.combat);
  end if;

  if to_regclass('public.arena_log') is not null then
    execute 'select count(*) from public.arena_log where attacker = $1 and win' into new.arena_wins using new.user_id;
  end if;

  new.diamond_budget := db; new.level_budget := lb; new.gold_budget := gb;
  new.wing_budget := wb; new.epic_budget := eb; new.mstone_budget := mb; new.gem_budget := gemb;
  new.power_ratio_budget := pr; new.power_abs_budget := pa; new.budget_at := now();
  new.guard_note := case when cardinality(notes) > 0 then array_to_string(notes, ',') else null end;
  return new;
end; $$;

drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before insert or update on public.saves for each row execute function public.saves_guard();

-- Refah reference: highest level among real players (hidden, trusted/test and banned accounts are left out).
create or replace function public.welfare_reference() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(max(level), 1)::integer from saves
  where not hidden and not trusted and class is not null and coalesce(name, '') <> '' and not is_banned(user_id);
$$;
revoke all on function public.welfare_reference() from public, anon;
grant execute on function public.welfare_reference() to authenticated;
