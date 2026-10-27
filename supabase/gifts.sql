-- Valor Online: server gifts (run once in Supabase → SQL Editor, after schema.sql and guard3.sql).
-- Every account gets each active gift (diamonds and/or gold) once: players who already have a character get it the next time
-- they open the game, new players right after creating their character. The diamonds are added on the
-- server, so the save guard does not cut them.
--   Add a gift:        insert into gifts (id, diamonds, gold) values ('some-name', 1000, 0);
--   Stop giving one:   update gifts set active = false where id = 'test-5000';
--   Who received it:   select count(*) from gift_claims where gift_id = 'test-5000';
create table if not exists public.gifts (
  id         text primary key,
  diamonds   integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.gift_claims (
  user_id    uuid not null references auth.users(id) on delete cascade,
  gift_id    text not null references public.gifts(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, gift_id)
);
-- Gold arrived later; this also updates a gifts table created by the first version of this file.
alter table public.gifts add column if not exists gold bigint not null default 0;
alter table public.gifts alter column diamonds set default 0;
alter table public.gifts drop constraint if exists gifts_diamonds_check;
alter table public.gifts drop constraint if exists gifts_amount_check;
alter table public.gifts add constraint gifts_amount_check
  check (diamonds >= 0 and diamonds <= 10000000 and gold >= 0 and gold <= 100000000000 and diamonds + gold > 0);
alter table public.gifts enable row level security;
alter table public.gift_claims enable row level security;
revoke all on public.gifts, public.gift_claims from anon, authenticated;

-- Active gifts the signed-in player has not received yet.
create or replace function public.gift_pending() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'diamonds', g.diamonds, 'gold', g.gold) order by g.created_at), '[]'::jsonb)
  from gifts g
  where g.active and auth.uid() is not null
    and not exists (select 1 from gift_claims c where c.user_id = auth.uid() and c.gift_id = g.id);
$$;

-- Receive one gift. Returns {status:'ok', diamonds, gold, rev} or {status:'claimed'|'inactive'|'no_character'|'banned'|'invalid'}.
-- rev is the save's new revision: the game adopts it so its next upload does not look like a conflict.
create or replace function public.gift_claim(gift text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g gifts%rowtype; r integer;
begin
  if me is null then return jsonb_build_object('status', 'invalid'); end if;
  select * into g from gifts where id = gift;
  if not found or not g.active then return jsonb_build_object('status', 'inactive'); end if;
  if not exists (select 1 from saves where user_id = me and class is not null and coalesce(name, '') <> '') then
    return jsonb_build_object('status', 'no_character');
  end if;
  if is_banned(me) then return jsonb_build_object('status', 'banned'); end if;
  insert into gift_claims (user_id, gift_id) values (me, g.id) on conflict do nothing;
  if not found then return jsonb_build_object('status', 'claimed'); end if;
  perform set_config('valor.server_write', '1', true);   -- the save guard lets this server change through
  update saves
     set data = jsonb_set(jsonb_set(data,
                  '{state,diamonds}', to_jsonb(guard_num(data->'state'->>'diamonds') + g.diamonds)),
                  '{state,gold}', to_jsonb(guard_num(data->'state'->>'gold') + g.gold)),
         rev = rev + 1, updated_at = now()
   where user_id = me
  returning rev into r;
  return jsonb_build_object('status', 'ok', 'diamonds', g.diamonds, 'gold', g.gold, 'rev', r);
end; $$;

revoke all on function public.gift_pending(), public.gift_claim(text) from public, anon;
grant execute on function public.gift_pending(), public.gift_claim(text) to authenticated;

-- Test gifts for everyone, existing and new players.
insert into gifts (id, diamonds) values ('test-5000', 5000) on conflict (id) do nothing;
insert into gifts (id, diamonds, gold) values ('test-100k', 100000, 100000000) on conflict (id) do update set active = true;
