-- ByteShards schema. Content is also shipped in lib/data/seed.ts (identical),
-- so the app runs keyless; this DB holds the live copy + user state.

-- ── enums ────────────────────────────────────────────────────────────────────
do $$ begin
  create type track as enum ('data_engineering','ai_engineering','core_skills');
exception when duplicate_object then null; end $$;
do $$ begin
  create type lvl as enum ('junior','mid','senior');
exception when duplicate_object then null; end $$;
do $$ begin
  create type risk as enum ('low','medium','high');
exception when duplicate_object then null; end $$;
do $$ begin
  create type conf as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

-- ── content tables ───────────────────────────────────────────────────────────
create table if not exists tools (
  id serial primary key,
  slug text unique not null,
  name text not null,
  icon text,
  track track not null,
  sort_order int default 0
);

create table if not exists categories (
  id serial primary key,
  tool_id int references tools(id) on delete cascade,
  level lvl not null,
  slug text not null,
  name text not null,
  icon text,
  description text,
  sort_order int default 0,
  is_expanded_by_default boolean default false,
  unique (tool_id, level, slug)
);

create table if not exists questions (
  id serial primary key,
  category_id int references categories(id) on delete cascade,
  tool_id int references tools(id) on delete cascade,
  level lvl not null,
  sort_order int default 0,
  question_text text not null,
  answer_structured text,
  explanation_deep text,
  interviewer_lens text,
  risk_level risk default 'medium',
  is_comparison boolean default false,
  comparison_tools jsonb,
  followup_chain jsonb,
  red_flags jsonb,
  alternate_phrasings jsonb,
  interview_contexts jsonb,
  asked_count int default 0,
  is_free_preview boolean default false
);

-- ── user + commerce tables ───────────────────────────────────────────────────
create table if not exists users (
  id uuid primary key references auth.users on delete cascade,
  email text,
  stripe_customer_id text,
  interview_date date,
  has_full_bundle boolean default false,
  practice_pro boolean default false,        -- Practice Pro subscription active
  practice_status text,                       -- stripe subscription status
  practice_period_end timestamptz,            -- current period end
  xp int default 0,
  streak int default 0,
  last_drill_at date,
  created_at timestamptz default now()
);

create table if not exists entitlements (
  user_id uuid references users(id) on delete cascade,
  tool_id int references tools(id) on delete cascade,
  level lvl not null,
  source text,
  granted_at timestamptz default now(),
  primary key (user_id, tool_id, level)
);

-- question_id references the bundle-shipped content catalog (stable ids in
-- lib/data/seed.ts), NOT the questions table — so user state works whether or
-- not the optional content mirror is populated.
create table if not exists user_progress (
  user_id uuid references users(id) on delete cascade,
  question_id int not null,
  practiced_at timestamptz,
  last_studied_at timestamptz,
  confidence conf,
  primary key (user_id, question_id)
);

create table if not exists interview_asks (
  user_id uuid references users(id) on delete cascade,
  question_id int not null,
  created_at timestamptz default now(),
  primary key (user_id, question_id)
);

create table if not exists simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  tool_id int references tools(id),
  level lvl,
  started_at timestamptz default now(),
  completed_at timestamptz,
  question_ids jsonb,
  responses jsonb
);

-- ── free tools ────────────────────────────────────────────────────────────────
create table if not exists jobs (
  id serial primary key,
  title text not null,
  company text,
  location text,
  level lvl,
  tools jsonb,
  url text unique,
  source text,
  posted_at date
);

create table if not exists salary_benchmarks (
  id serial primary key,
  role text,
  tool text,
  level lvl,
  region text,
  currency text,
  min int,
  median int,
  max int,
  year int
);

create table if not exists drills (
  id serial primary key,
  track track,
  tool_id int references tools(id),
  level lvl,
  prompt text,
  choices jsonb,
  correct_index int,
  explanation text,
  xp int default 10
);

-- ── increment helper for "I got asked this" ──────────────────────────────────
create or replace function bump_asked_count(qid int)
returns void language sql as $$
  update questions set asked_count = asked_count + 1 where id = qid;
$$;

-- ── new auth user → users row ─────────────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table users enable row level security;
alter table entitlements enable row level security;
alter table user_progress enable row level security;
alter table interview_asks enable row level security;
alter table simulation_sessions enable row level security;
alter table tools enable row level security;
alter table categories enable row level security;
alter table questions enable row level security;
alter table jobs enable row level security;
alter table salary_benchmarks enable row level security;
alter table drills enable row level security;

-- public read for content + free tools
do $$ begin
  create policy "public read tools" on tools for select using (true);
  create policy "public read categories" on categories for select using (true);
  create policy "public read questions" on questions for select using (true);
  create policy "public read jobs" on jobs for select using (true);
  create policy "public read salaries" on salary_benchmarks for select using (true);
  create policy "public read drills" on drills for select using (true);
exception when duplicate_object then null; end $$;

-- per-user policies
do $$ begin
  create policy "own user row" on users for all using (auth.uid() = id) with check (auth.uid() = id);
  create policy "own entitlements" on entitlements for select using (auth.uid() = user_id);
  create policy "own progress" on user_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "own asks" on interview_asks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  create policy "own sessions" on simulation_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
