-- Valor Online: shared news feed (run once in Supabase → SQL Editor).
create table if not exists public.news (
  id         bigserial primary key,
  kind       text not null check (kind in ('epic', 'wheel-mount', 'anniversary-mount')),
  user_id    uuid not null references auth.users(id) on delete cascade,
  player     text not null,
  item       text not null,
  created_at timestamptz not null default now()
);
create index if not exists news_created_idx on public.news (created_at desc);
alter table public.news enable row level security;
drop policy if exists "news_read" on public.news;
create policy "news_read" on public.news for select to authenticated using (true);
revoke all on public.news from anon;
grant select on public.news to authenticated;

-- Adds a news line for the signed-in player (at most one every 3 seconds and 40 an hour).
create or replace function public.news_add(kind text, item text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text; it text := left(btrim(coalesce(item, '')), 80);
begin
  if me is null or kind not in ('epic', 'wheel-mount', 'anniversary-mount') or it = '' then return 'invalid'; end if;
  select name into n from saves where user_id = me;
  if coalesce(n, '') = '' then return 'invalid'; end if;
  if exists (select 1 from news where user_id = me and created_at > now() - interval '3 seconds') then return 'slow'; end if;
  if (select count(*) from news where user_id = me and created_at > now() - interval '1 hour') >= 40 then return 'slow'; end if;
  insert into news (kind, user_id, player, item) values (kind, me, n, it);
  return 'ok';
end; $$;
revoke all on function public.news_add(text, text) from public;
grant execute on function public.news_add(text, text) to authenticated;
