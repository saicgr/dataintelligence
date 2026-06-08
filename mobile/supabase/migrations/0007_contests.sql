-- FieldNotes mobile — 0007: live weekly contest.
--
-- A synchronous event the async leagues lack: each ISO week IS one contest (no separate scheduler).
-- The contest runs all week; the board finalizes when the week rolls over (Mon 00:00 UTC) and a new
-- one begins — the client shows daysLeftInWeek() as the countdown. contest_scores holds ONE row per
-- (user, week) with that user's BEST timed-round score (0..100). RLS mirrors league_scores: a user
-- reads/writes only their own row; the cross-user board is exposed through a SECURITY DEFINER RPC.

create table if not exists public.contest_scores (
  user_id      uuid not null references auth.users (id) on delete cascade,
  week         text not null,                       -- ISO week key, e.g. '2026-W23' (== contest id)
  score        integer not null default 0 check (score >= 0 and score <= 100),
  display_name text not null default 'Anon',
  updated_at   timestamptz not null default now(),
  primary key (user_id, week)
);

create index if not exists contest_scores_week_score_idx
  on public.contest_scores (week, score desc);

alter table public.contest_scores enable row level security;
drop policy if exists own_select on public.contest_scores;
drop policy if exists own_write  on public.contest_scores;
create policy own_select on public.contest_scores for select using (user_id = auth.uid());
create policy own_write  on public.contest_scores for all    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- submit_contest_score: upsert keeping the user's BEST score for the week (a replay can only improve).
-- SECURITY DEFINER + writes auth.uid() so it can't be spoofed; clamps to 0..100.
create or replace function public.submit_contest_score(week_in text, score_in int, name_in text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.contest_scores (user_id, week, score, display_name)
  values (auth.uid(), week_in, greatest(0, least(100, score_in)), coalesce(nullif(name_in, ''), 'You'))
  on conflict (user_id, week) do update
    set score = greatest(public.contest_scores.score, excluded.score),
        display_name = excluded.display_name,
        updated_at = now();
end;
$$;

-- contest_leaderboard(week): ranked board for a given ISO week, safe columns only, capped to 30.
create or replace function public.contest_leaderboard(week text)
returns table (user_id uuid, display_name text, score integer, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.user_id,
    s.display_name,
    s.score,
    (row_number() over (order by s.score desc, s.updated_at asc))::int as rank
  from public.contest_scores s
  where s.week = contest_leaderboard.week
  order by s.score desc, s.updated_at asc
  limit 30;
$$;

grant execute on function public.submit_contest_score(text, int, text) to authenticated;
grant execute on function public.contest_leaderboard(text) to anon, authenticated;
