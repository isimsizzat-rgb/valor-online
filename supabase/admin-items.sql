-- Valor Online: admin panel "Eşya Ver" (run once in Supabase → SQL Editor, after admin.sql).
-- ops: a list of gifts built by the admin panel:
--   {"kind":"item","item":{...}}                          equipment item → inventory
--   {"kind":"stack","id":"petFood","name":"Pet Yemi","count":10,"description":"…"}   bag stack (adds to an existing one)
--   {"kind":"stone","level":4,"count":3}                  luck stones
--   {"kind":"gem","type":"Saldırı","level":5,"count":2}   mosaic gems
--   {"kind":"dukat","count":500}                          Castle War currency
create or replace function public.admin_give(uid uuid, ops jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare d jsonb; op jsonb; inv jsonb; idx integer; k text; n bigint; gems jsonb;
begin
  if not is_admin() then return 'not_admin'; end if;
  select data into d from saves where user_id = uid for update;
  if d is null or jsonb_typeof(ops) <> 'array' then return 'invalid'; end if;
  for op in select * from jsonb_array_elements(ops) loop
    k := op->>'kind'; n := greatest(0, coalesce((op->>'count')::bigint, 1));
    inv := case when jsonb_typeof(d->'state'->'inventory') = 'array' then d->'state'->'inventory' else '[]'::jsonb end;
    if k = 'item' and jsonb_typeof(op->'item') = 'object' then
      d := jsonb_set(d, '{state,inventory}', inv || jsonb_build_array(op->'item'));
    elsif k = 'stack' and coalesce(op->>'id', '') <> '' then
      select i - 1 into idx from jsonb_array_elements(inv) with ordinality as t(e, i) where e->>'marketItemId' = op->>'id' limit 1;
      if idx is null then
        d := jsonb_set(d, '{state,inventory}', inv || jsonb_build_array(jsonb_build_object(
          'id', 'gear-admin-' || replace(gen_random_uuid()::text, '-', ''), 'slot', 'Eşya', 'marketItemId', op->>'id',
          'name', coalesce(op->>'name', op->>'id'), 'count', n, 'description', coalesce(op->>'description', ''))));
      else
        d := jsonb_set(d, array['state','inventory',idx::text,'count'], to_jsonb(guard_num(inv->idx->>'count') + n));
      end if;
    elsif k = 'stone' then
      d := jsonb_set(d, '{state,stones}', coalesce(d->'state'->'stones', '{}'::jsonb)
           || jsonb_build_object(least(8, greatest(1, (op->>'level')::integer))::text, guard_num(d->'state'->'stones'->>least(8, greatest(1, (op->>'level')::integer))::text) + n));
    elsif k = 'gem' then
      gems := case when jsonb_typeof(d->'state'->'gemInventory') = 'array' then d->'state'->'gemInventory' else '[]'::jsonb end;
      select i - 1 into idx from jsonb_array_elements(gems) with ordinality as t(e, i) where e->>'type' = op->>'type' and (e->>'level')::integer = (op->>'level')::integer limit 1;
      if idx is null then d := jsonb_set(d, '{state,gemInventory}', gems || jsonb_build_array(jsonb_build_object('type', op->>'type', 'level', (op->>'level')::integer, 'count', n)));
      else d := jsonb_set(d, array['state','gemInventory',idx::text,'count'], to_jsonb(guard_num(gems->idx->>'count') + n)); end if;
    elsif k = 'dukat' then
      d := jsonb_set(d, '{state,castleV1}', coalesce(d->'state'->'castleV1', jsonb_build_object(
             'playerId', 'castle-player-admin-' || replace(gen_random_uuid()::text, '-', ''), 'medallions', 0,
             'sessions', '{}'::jsonb, 'memberships', '[]'::jsonb, 'lastAttack', 0))
           || jsonb_build_object('medallions', guard_num(d->'state'->'castleV1'->>'medallions') + n));
    end if;
    idx := null;
  end loop;
  perform set_config('valor.server_write', '1', true);
  update saves set data = d, rev = rev + 1, updated_at = now() where user_id = uid;
  return 'ok';
end; $$;
revoke all on function public.admin_give(uuid, jsonb) from public;
grant execute on function public.admin_give(uuid, jsonb) to authenticated;
