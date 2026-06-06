-- FieldNotes mobile — initial schema.
-- Apply with:  supabase db push   (or paste into the SQL editor in the dashboard)
-- Every per-user table is RLS-scoped to auth.uid(). Account is optional; rows only
-- exist for signed-in users (signed-out state lives on-device in AsyncStorage).

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text,
  created_at timestamptz not null default now()
);

-- ── entitlements (one-time purchase mirror; receipt is source of truth) ───────
create table if not exists public.entitlements (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  platform text,
  receipt jsonb,
  purchased_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ── card_progress (SM-2 state per card) ───────────────────────────────────────
create table if not exists public.card_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  ease real not null default 2.5,
  interval_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  due_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- ── attempts (analytics / weak-spots) ─────────────────────────────────────────
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  kind text,
  correct boolean,
  rated text,
  ts timestamptz not null default now()
);

-- ── user_stats (streak / xp) ──────────────────────────────────────────────────
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  streak int not null default 0,
  longest_streak int not null default 0,
  xp int not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- ── debriefs (post-interview reflection; powers the flywheel) ─────────────────
create table if not exists public.debriefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text,
  company_norm text generated always as (lower(trim(company))) stored,
  level text,
  outcome text,
  topics text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists debriefs_company_idx on public.debriefs (company_norm);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.entitlements  enable row level security;
alter table public.card_progress enable row level security;
alter table public.attempts      enable row level security;
alter table public.user_stats    enable row level security;
alter table public.debriefs      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','entitlements','card_progress','attempts','user_stats','debriefs']
  loop
    execute format('drop policy if exists own_select on public.%I', t);
    execute format('drop policy if exists own_write  on public.%I', t);
    -- profiles keys on id; the rest key on user_id
    if t = 'profiles' then
      execute 'create policy own_select on public.profiles for select using (id = auth.uid())';
      execute 'create policy own_write  on public.profiles for all    using (id = auth.uid()) with check (id = auth.uid())';
    else
      execute format('create policy own_select on public.%I for select using (user_id = auth.uid())', t);
      execute format('create policy own_write  on public.%I for all    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    end if;
  end loop;
end $$;

-- ── most-asked-at-company (privacy threshold: only surfaces at >= 20 debriefs) ─
-- SECURITY DEFINER so it aggregates across all users WITHOUT exposing any single
-- row. Returns nothing for a company until at least 20 people have debriefed it.
create or replace function public.most_asked(company_in text)
returns table (topic text, n int)
language sql
security definer
set search_path = public
as $$
  with norm as (select lower(trim(company_in)) as cn)
  select t.topic, count(*)::int as n
  from public.debriefs d, norm, unnest(d.topics) as t(topic)
  where d.company_norm = norm.cn and norm.cn <> ''
  group by t.topic
  having (select count(*) from public.debriefs d2, norm where d2.company_norm = norm.cn) >= 20
  order by n desc;
$$;

grant execute on function public.most_asked(text) to anon, authenticated;
