-- FieldNotes mobile — 0008: per-card issue reports (#7).
-- Manual-first content-quality loop: users flag inaccurate/outdated/typo/unclear cards
-- (or offer a better answer); the founder reviews rows in Studio. Insert-only from the
-- app; no statuses, no triage UI.

create table if not exists public.card_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  category text not null check (category in ('inaccurate', 'outdated', 'typo', 'unclear', 'alt-answer')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.card_reports enable row level security;
drop policy if exists own_insert on public.card_reports;
drop policy if exists own_select on public.card_reports;
create policy own_insert on public.card_reports for insert with check (user_id = auth.uid());
create policy own_select on public.card_reports for select using (user_id = auth.uid());
