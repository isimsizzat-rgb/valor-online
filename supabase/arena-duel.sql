-- Valor Online: turn-based arena duels (run after fight.sql). One live duel per attacker; the
-- arena-fight Edge Function (service role) is the only reader/writer. Results still go to arena_log
-- through srv_arena_store when the duel ends, so the 10-a-day limit and defense history are unchanged.
create table if not exists public.arena_duels (
  attacker uuid primary key references auth.users(id) on delete cascade,
  target uuid not null references auth.users(id) on delete cascade,
  foe jsonb not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.arena_duels enable row level security;
revoke all on public.arena_duels from public, anon, authenticated;
