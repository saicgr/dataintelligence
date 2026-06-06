-- FieldNotes mobile — 0002: per-card reactions (save / like / dislike).
-- Local AsyncStorage is the source of truth for signed-out users; this table is the
-- signed-in cross-device backup. Mirrors the card_progress shape + RLS exactly.

create table if not exists public.card_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  saved boolean not null default false,
  feedback text check (feedback in ('like', 'dislike')),
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

alter table public.card_feedback enable row level security;
drop policy if exists own_select on public.card_feedback;
drop policy if exists own_write  on public.card_feedback;
create policy own_select on public.card_feedback for select using (user_id = auth.uid());
create policy own_write  on public.card_feedback for all    using (user_id = auth.uid()) with check (user_id = auth.uid());
