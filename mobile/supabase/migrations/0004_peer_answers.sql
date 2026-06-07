-- FieldNotes mobile — 0003: anonymized peer answers (community data moat).
-- Players write their scenario answer; a few highly-rated anonymized answers are
-- shown back to everyone after they submit. NO user identity is stored on the row —
-- we deliberately omit any user_id/auth.uid() column so a leaked read can never be
-- tied to a person. Moderation/quality is handled by votes + the is_hidden flag.

create table if not exists public.scenario_answers (
  id uuid primary key default gen_random_uuid(),
  card_id text not null,
  body text not null,
  votes int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  -- length guard so the table can't be stuffed with junk; trims abuse surface.
  constraint scenario_answers_body_len check (char_length(btrim(body)) between 1 and 2000)
);

create index if not exists scenario_answers_card_idx
  on public.scenario_answers (card_id, votes desc, created_at desc)
  where is_hidden = false;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Anyone (anon or authenticated) may READ visible answers and may INSERT a new one.
-- No UPDATE/DELETE policy → rows are immutable from the client. Vote increments go
-- through the SECURITY DEFINER vote_scenario_answer() RPC below, never a raw update,
-- so a client can't rewrite someone's body or unhide a moderated row.
alter table public.scenario_answers enable row level security;

drop policy if exists peer_select on public.scenario_answers;
drop policy if exists peer_insert on public.scenario_answers;

create policy peer_select on public.scenario_answers
  for select
  using (is_hidden = false);

create policy peer_insert on public.scenario_answers
  for insert
  with check (
    char_length(btrim(body)) between 1 and 2000
    and votes = 0
    and is_hidden = false
  );

-- ── top answers RPC ───────────────────────────────────────────────────────────
-- Returns at most `lim` highly-rated, visible answers for a card. Plain SQL (runs
-- as caller) — the RLS select policy already scopes it to visible rows, and no
-- identity column exists to leak. Exposed to anon + authenticated.
create or replace function public.top_peer_answers(card_in text, lim int default 3)
returns table (id uuid, body text, votes int, created_at timestamptz)
language sql
stable
set search_path = public
as $$
  select a.id, a.body, a.votes, a.created_at
  from public.scenario_answers a
  where a.card_id = card_in and a.is_hidden = false
  order by a.votes desc, a.created_at desc
  limit greatest(1, least(coalesce(lim, 3), 10));
$$;

grant execute on function public.top_peer_answers(text, int) to anon, authenticated;

-- ── vote RPC ──────────────────────────────────────────────────────────────────
-- Single-direction upvote. SECURITY DEFINER so it can bump `votes` even though the
-- table grants no client UPDATE. Returns the new vote count. (Per-user dedupe of
-- votes is intentionally left to a future table; this keeps anon participation.)
create or replace function public.vote_scenario_answer(answer_in uuid)
returns int
language sql
security definer
set search_path = public
as $$
  update public.scenario_answers
  set votes = votes + 1
  where id = answer_in and is_hidden = false
  returning votes;
$$;

grant execute on function public.vote_scenario_answer(uuid) to anon, authenticated;
