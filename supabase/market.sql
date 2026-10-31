-- Valor Online: Genel Pazar (player market) for unbound talismans. Run after hearts.sql / guard3.sql.
-- A talisman that has never been equipped ("bağdaştırılmadı") can be listed at a fixed price by level.
-- Every write touches only the caller's own save, guarded by expected_rev, so no other device is
-- interrupted: the seller's earnings wait in market_proceeds until the seller collects them.
-- Prices (diamonds): Sv.1 100 · 250 · 600 · 1.400 · 3.000 · 6.000 · 12.000 · 24.000 · 48.000 · Sv.10 96.000.
-- A 10% market tax is kept back from the seller's share. Sales are anonymous: names are stored for admins
-- only and never returned to players.
begin;

create table if not exists public.market_listings (
  id bigserial primary key,
  seller uuid not null references public.saves(user_id) on delete cascade,
  seller_name text not null default '',
  item jsonb not null,
  level integer not null check (level between 1 and 10),
  color integer not null default 0,
  ttype text not null default '',
  price integer not null check (price > 0),
  status text not null default 'open' check (status in ('open','sold','cancelled')),
  buyer uuid,
  buyer_name text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists market_listings_open_idx on public.market_listings (status, created_at desc);
create index if not exists market_listings_seller_idx on public.market_listings (seller, status);

create table if not exists public.market_proceeds (
  user_id uuid primary key references public.saves(user_id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  total bigint not null default 0
);

alter table public.market_listings enable row level security;
alter table public.market_proceeds enable row level security;
revoke all on public.market_listings, public.market_proceeds from public, anon, authenticated;

create or replace function public.market_price(lvl integer) returns integer language sql immutable as $$
  select (array[100,250,600,1400,3000,6000,12000,24000,48000,96000])[greatest(1, least(10, lvl))];
$$;

-- A talisman is sellable only if its shape and rolled values are possible in the game.
create or replace function public.market_talisman_ok(it jsonb) returns boolean language plpgsql immutable as $$
declare stats text[]; n integer; c integer; lvl integer; mx numeric; k text; v numeric;
begin
  if jsonb_typeof(it) <> 'object' or it->>'slot' <> 'Tılsım' then return false; end if;
  if coalesce((it->>'talismanBound')::boolean, false) then return false; end if;
  stats := case it->>'talismanType'
    when 'X' then array['atk','def'] when 'Y' then array['atk','mdef'] when 'Z' then array['matk','mdef'] when 'T' then array['matk','def']
    when 'K' then array['atk','def','mdef','hp'] when 'L' then array['matk','def','mdef','hp'] when 'P' then array['atk','def','hp'] when 'O' then array['matk','mdef','hp']
    else null end;
  if stats is null or jsonb_typeof(it->'talismanRolls') <> 'object' then return false; end if;
  c := (it->>'talismanColor')::integer; lvl := (it->>'talismanLevel')::integer;
  if c is null or c not between 0 and 3 or lvl is null or lvl not between 1 and 10 then return false; end if;
  n := array_length(stats, 1);
  if (select count(*) from jsonb_object_keys(it->'talismanRolls')) <> n then return false; end if;
  foreach k in array stats loop
    if jsonb_typeof(it->'talismanRolls'->k) <> 'number' then return false; end if;
    v := (it->'talismanRolls'->>k)::numeric;
    mx := round((array[5000,7500,10000,15000])[c + 1] * 2.0 / n) * (case when k = 'hp' then 3 else 1 end);
    if v < 0 or v > mx then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

create or replace function public.market_list(item_id text, expected_rev integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s saves%rowtype; inv jsonb; idx integer; it jsonb; lvl integer; lid bigint;
begin
  if me is null then raise exception 'Oturum gerekli'; end if;
  if public.is_banned(me) then raise exception 'Hesap engelli'; end if;
  select * into s from saves where user_id = me for update;
  if not found or s.class is null then raise exception 'Önce karakter oluştur'; end if;
  if s.rev <> expected_rev then raise exception 'Kayıt değişti. Güncel kaydı yükle'; end if;
  if (select count(*) from market_listings where seller = me and status = 'open') >= 20 then raise exception 'En fazla 20 ilan açabilirsin'; end if;
  inv := case when jsonb_typeof(s.data->'state'->'inventory') = 'array' then s.data->'state'->'inventory' else '[]'::jsonb end;
  select i - 1, e into idx, it from jsonb_array_elements(inv) with ordinality t(e, i) where e->>'id' = item_id limit 1;
  if idx is null then raise exception 'Tılsım çantanda bulunamadı'; end if;
  if jsonb_typeof(s.data->'state'->'talismanSlots') = 'array' and (s.data->'state'->'talismanSlots') ? item_id then raise exception 'Takılı tılsım satılamaz'; end if;
  if not market_talisman_ok(it) then raise exception 'Bu tılsım pazarda satılamaz (bağdaştırılmış ya da geçersiz)'; end if;
  lvl := (it->>'talismanLevel')::integer;
  perform set_config('valor.server_write', '1', true);
  update saves set data = jsonb_set(data, '{state,inventory}', inv - idx), rev = rev + 1, updated_at = now() where user_id = me;
  insert into market_listings (seller, seller_name, item, level, color, ttype, price)
    values (me, coalesce(s.name, ''), it, lvl, (it->>'talismanColor')::integer, it->>'talismanType', market_price(lvl)) returning id into lid;
  return jsonb_build_object('id', lid, 'rev', s.rev + 1, 'price', market_price(lvl));
end $$;

create or replace function public.market_cancel(listing_id bigint, expected_rev integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l market_listings%rowtype; s saves%rowtype; inv jsonb;
begin
  if me is null then raise exception 'Oturum gerekli'; end if;
  select * into l from market_listings where id = listing_id and seller = me for update;
  if not found then raise exception 'İlan bulunamadı'; end if;
  if l.status <> 'open' then raise exception 'İlan artık açık değil'; end if;
  select * into s from saves where user_id = me for update;
  if s.rev <> expected_rev then raise exception 'Kayıt değişti. Güncel kaydı yükle'; end if;
  inv := case when jsonb_typeof(s.data->'state'->'inventory') = 'array' then s.data->'state'->'inventory' else '[]'::jsonb end;
  perform set_config('valor.server_write', '1', true);
  update saves set data = jsonb_set(data, '{state,inventory}', inv || jsonb_build_array(l.item)), rev = rev + 1, updated_at = now() where user_id = me;
  update market_listings set status = 'cancelled', closed_at = now() where id = l.id;
  return jsonb_build_object('rev', s.rev + 1);
end $$;

create or replace function public.market_buy(listing_id bigint, expected_rev integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l market_listings%rowtype; s saves%rowtype; inv jsonb; dia bigint;
begin
  if me is null then raise exception 'Oturum gerekli'; end if;
  if public.is_banned(me) then raise exception 'Hesap engelli'; end if;
  select * into l from market_listings where id = listing_id for update;
  if not found or l.status <> 'open' then raise exception 'Bu tılsım az önce satıldı ya da ilandan kaldırıldı'; end if;
  if l.seller = me then raise exception 'Kendi ilanını satın alamazsın'; end if;
  select * into s from saves where user_id = me for update;
  if not found or s.class is null then raise exception 'Önce karakter oluştur'; end if;
  if s.rev <> expected_rev then raise exception 'Kayıt değişti. Güncel kaydı yükle'; end if;
  dia := coalesce(guard_num(s.data->'state'->>'diamonds'), 0)::bigint;
  if dia < l.price then raise exception 'Yeterli elmasın yok'; end if;
  inv := case when jsonb_typeof(s.data->'state'->'inventory') = 'array' then s.data->'state'->'inventory' else '[]'::jsonb end;
  perform set_config('valor.server_write', '1', true);
  update saves set data = jsonb_set(jsonb_set(data, '{state,diamonds}', to_jsonb(dia - l.price)), '{state,inventory}', inv || jsonb_build_array(l.item)),
    rev = rev + 1, updated_at = now() where user_id = me;
  update market_listings set status = 'sold', buyer = me, buyer_name = coalesce(s.name, ''), closed_at = now() where id = l.id;
  insert into market_proceeds (user_id, balance, total) values (l.seller, floor(l.price * 0.9), floor(l.price * 0.9))
    on conflict (user_id) do update set balance = market_proceeds.balance + excluded.balance, total = market_proceeds.total + excluded.total;
  return jsonb_build_object('rev', s.rev + 1, 'diamonds', dia - l.price);
end $$;

create or replace function public.market_claim(expected_rev integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s saves%rowtype; b bigint; dia bigint;
begin
  if me is null then raise exception 'Oturum gerekli'; end if;
  select * into s from saves where user_id = me for update;
  if not found then raise exception 'Kayıt bulunamadı'; end if;
  if s.rev <> expected_rev then raise exception 'Kayıt değişti. Güncel kaydı yükle'; end if;
  select balance into b from market_proceeds where user_id = me for update;
  if coalesce(b, 0) <= 0 then raise exception 'Toplanacak kazanç yok'; end if;
  dia := coalesce(guard_num(s.data->'state'->>'diamonds'), 0)::bigint;
  perform set_config('valor.server_write', '1', true);
  update saves set data = jsonb_set(data, '{state,diamonds}', to_jsonb(dia + b)), rev = rev + 1, updated_at = now() where user_id = me;
  update market_proceeds set balance = 0 where user_id = me;
  return jsonb_build_object('rev', s.rev + 1, 'diamonds', dia + b, 'claimed', b);
end $$;

create or replace function public.market_browse() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'item', item, 'level', level, 'color', color, 'type', ttype,
    'price', price, 'mine', seller = auth.uid(), 'at', created_at) order by created_at desc), '[]'::jsonb)
  from (select * from market_listings where status = 'open' order by created_at desc limit 300) l;
$$;

create or replace function public.market_mine() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'proceeds', coalesce((select balance from market_proceeds where user_id = auth.uid()), 0),
    'open', (select count(*) from market_listings where seller = auth.uid() and status = 'open'),
    'sold', coalesce((select jsonb_agg(jsonb_build_object('item', item, 'price', price, 'at', closed_at) order by closed_at desc)
             from (select * from market_listings where seller = auth.uid() and status = 'sold' order by closed_at desc limit 20) x), '[]'::jsonb));
$$;

revoke all on function public.market_list(text, integer), public.market_cancel(bigint, integer), public.market_buy(bigint, integer),
  public.market_claim(integer), public.market_browse(), public.market_mine() from public, anon;
grant execute on function public.market_list(text, integer), public.market_cancel(bigint, integer), public.market_buy(bigint, integer),
  public.market_claim(integer), public.market_browse(), public.market_mine() to authenticated;
commit;
