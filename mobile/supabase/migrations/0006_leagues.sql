-- FieldNotes mobile — 0005: weekly leagues + leaderboard.
-- (Spec called this "0001_leagues.sql"; renamed to 0005 so it sequences AFTER the existing
--  0001_init … 0004 migrations — a second 0001 would never apply on an initialized DB.)
--
-- league_scores stores ONE row per (user, ISO-week) holding that user's cumulative weekly XP.
-- The client upserts it (see src/lib/leagues.ts upsertWeeklyXp) and reads a ranked slice via
-- the weekly_leaderboard(week) RPC. RLS mirrors card_progress / card_feedback: a user may only
-- read & write their OWN row. Cross-user reads happen ONLY through the SECURITY DEFINER RPC,
-- which exposes display_name + xp (no user emails / private data) for the current week's board.

create table if not exists public.league_scores (
  user_id      uuid not null references auth.users (id) on delete cascade,
  week         text not null,                       -- ISO week key, e.g. '2026-W23'
  xp           integer not null default 0 check (xp >= 0),
  display_name text not null default 'Anon',
  updated_at   timestamptz not null default now(),
  primary key (user_id, week)
);

-- Fast "top scorers this week" scans for the RPC.
create index if not exists league_scores_week_xp_idx
  on public.league_scores (week, xp desc);

alter table public.league_scores enable row level security;
drop policy if exists own_select on public.league_scores;
drop policy if exists own_write  on public.league_scores;
-- A user can read & write only their own score row directly. The leaderboard itself is read
-- through the SECURITY DEFINER RPC below (so no broad cross-user SELECT policy is needed).
create policy own_select on public.league_scores for select using (user_id = auth.uid());
create policy own_write  on public.league_scores for all    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- weekly_leaderboard(week): ranked board for a given ISO week. SECURITY DEFINER so it can read
-- across users despite RLS, while only ever returning the safe columns (name + xp + rank).
-- Capped to the league cohort size (30) — matches LEAGUE_SIZE in src/lib/leagues.ts.
create or replace function public.weekly_leaderboard(week text)
returns table (user_id uuid, display_name text, xp integer, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.user_id,
    s.display_name,
    s.xp,
    (row_number() over (order by s.xp desc, s.display_name asc))::int as rank
  from public.league_scores s
  where s.week = weekly_leaderboard.week
  order by s.xp desc, s.display_name asc
  limit 30;
$$;

grant execute on function public.weekly_leaderboard(text) to anon, authenticated;
