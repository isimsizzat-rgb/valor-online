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
-- A gift can be limited to players who received another gift before a moment (used to make up for a lost gift).
alter table public.gifts add column if not exists only_if_claimed text;
alter table public.gifts add column if not exists only_before timestamptz;
alter table public.gift_claims add column if not exists client_version integer;
alter table public.gifts enable row level security;
alter table public.gift_claims enable row level security;
revoke all on public.gifts, public.gift_claims from anon, authenticated;

-- Can this player receive this gift (active, not received yet, and any extra condition met)?
create or replace function public.gift_open_for(gid text, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from gifts g
    where g.id = gid and g.active and uid is not null
      and not exists (select 1 from gift_claims c where c.user_id = uid and c.gift_id = g.id)
      and (g.only_if_claimed is null or exists (
            select 1 from gift_claims c where c.user_id = uid and c.gift_id = g.only_if_claimed
              and (g.only_before is null or c.claimed_at < g.only_before))));
$$;
revoke all on function public.gift_open_for(text, uuid) from public, anon, authenticated;

-- Active gifts the signed-in player has not received yet.
create or replace function public.gift_pending() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'diamonds', g.diamonds, 'gold', g.gold) order by g.created_at), '[]'::jsonb)
  from gifts g
  where gift_open_for(g.id, auth.uid());
$$;

-- Receive one gift. Returns {status:'ok', diamonds, gold, rev} or {status:'claimed'|'inactive'|'no_character'|'banned'|'invalid'}.
-- rev is the save's new revision: the game adopts it so its next upload does not look like a conflict.
-- v is the game's gift code version. Version 1 only knew diamonds: it would add them locally and then upload
-- its old gold over the server's, so gifts with gold are refused to it ('update_needed') until it reloads.
drop function if exists public.gift_claim(text);
create or replace function public.gift_claim(gift text, v integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g gifts%rowtype; r integer;
begin
  if me is null then return jsonb_build_object('status', 'invalid'); end if;
  select * into g from gifts where id = gift;
  if not found or not g.active then return jsonb_build_object('status', 'inactive'); end if;
  if g.gold > 0 and coalesce(v, 1) < 2 then return jsonb_build_object('status', 'update_needed'); end if;
  if not gift_open_for(g.id, me) then return jsonb_build_object('status', 'claimed'); end if;
  if not exists (select 1 from saves where user_id = me and class is not null and coalesce(name, '') <> '') then
    return jsonb_build_object('status', 'no_character');
  end if;
  if is_banned(me) then return jsonb_build_object('status', 'banned'); end if;
  insert into gift_claims (user_id, gift_id, client_version) values (me, g.id, v) on conflict do nothing;
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

revoke all on function public.gift_pending(), public.gift_claim(text, integer) from public, anon;
grant execute on function public.gift_pending(), public.gift_claim(text, integer) to authenticated;

-- Test gifts for everyone, existing and new players.
insert into gifts (id, diamonds) values ('test-5000', 5000) on conflict (id) do nothing;
insert into gifts (id, diamonds, gold) values ('test-100k', 100000, 100000000) on conflict (id) do update set active = true;
-- Make-up gift: players who received test-100k with the old game version (before this file was run again)
-- lost its 100,000,000 gold. They get the gold once more; players who receive test-100k from now on do not.
insert into gifts (id, gold, only_if_claimed, only_before) values ('test-100k-altin', 100000000, 'test-100k', now()) on conflict (id) do nothing;
