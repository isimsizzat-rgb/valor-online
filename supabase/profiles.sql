-- Valor Online: player cards for chat (run once in Supabase → SQL Editor, after schema.sql).
-- Chat shows each sender's portrait (class + gender) and opens their profile in the Profil screen when the name is tapped.
-- Only public game information is returned: never usernames or e-mail, and from the save only what the
-- Profil screen shows (no bag, currencies, block list or logs).

-- Class and gender for up to 60 character names (chat avatars).
create or replace function public.player_looks(names text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', s.name, 'class', s.class,
           'gender', case when coalesce(s.profile->>'gender', s.data->'state'->>'gender') = 'female' then 'female' else 'male' end)), '[]'::jsonb)
  from saves s
  where auth.uid() is not null and s.class is not null and coalesce(s.name, '') <> ''
    and lower(s.name) in (select lower(n) from unnest(names[1:60]) n);
$$;

-- One player's public profile by character name: the same fields the ranking profile shows.
-- rank = position in the Savaş Gücü ranking (null for hidden accounts).
create or replace function public.player_card(n text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'name', s.name, 'class', s.class, 'level', s.level, 'power', s.power,
           'xp', coalesce((to_jsonb(s)->>'xp')::bigint, 0), 'spirit', coalesce((to_jsonb(s)->>'spirit')::bigint, 0),
           'fame', coalesce((to_jsonb(s)->>'fame')::bigint, 0), 'popularity', coalesce((to_jsonb(s)->>'popularity')::bigint, 0),
           'profile', to_jsonb(s)->'profile', 'is_me', s.user_id = auth.uid(),
           -- What the Profil screen needs to draw this character (equipment, mounts, guardians, astrology,
           -- technology...). The bag, currencies, block list, logs and other private or daily data are left out.
           'view', (s.data->'state') - array['inventory','gemInventory','gold','diamonds','logs','chatBlocked','titleChoice',
                     'welfareRef','guide','marketDailyPurchases','marketDailyDate','luckyWheelV1','questsV2','stageRun',
                     'adventureEnergy','adventureEnergyRegenAt','freeEntries','papers','stones','shards','mountSpiritFragments',
                     'mountCraftCards','worldBoss','hearts','supportV1'],
           'rank', case when coalesce((to_jsonb(s)->>'hidden')::boolean, false) then null
                        else 1 + (select count(*) from saves o where coalesce((to_jsonb(o)->>'hidden')::boolean, false) = false
                                  and o.class is not null and coalesce(o.name, '') <> '' and o.power > s.power) end)
  from saves s
  where auth.uid() is not null and s.class is not null and coalesce(s.name, '') <> '' and lower(s.name) = lower(btrim(coalesce(n, '')))
  limit 1;
$$;

revoke all on function public.player_looks(text[]), public.player_card(text) from public, anon;
grant execute on function public.player_looks(text[]), public.player_card(text) to authenticated;
