-- Valor Online: sign in with the character name (run once in Supabase → SQL Editor).
-- Returns the login username of the character with this name, or null.
create or replace function public.login_username_for(character_name text)
returns text language sql stable security definer set search_path = public as $$
  select username from public.saves
  where coalesce(name, '') <> '' and lower(name) = lower(btrim(character_name))
  limit 1;
$$;
revoke all on function public.login_username_for(text) from public;
grant execute on function public.login_username_for(text) to anon, authenticated;
