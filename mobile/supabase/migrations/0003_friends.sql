-- FieldNotes mobile — 0003: friend streaks.
-- NOTE: the task brief named this 0002_friends.sql, but 0002_feedback.sql already exists, so this
-- ships as 0003 to preserve ordering. Apply with `supabase db push` (or paste into the SQL editor).
--
-- Social layer: two users who BOTH stay active on the same calendar day grow a shared streak.
-- Friendships are stored as TWO rows (one per direction) so the per-user RLS policy
-- (user_id = auth.uid()) stays trivial — each user only ever reads/writes rows they own.
-- Cross-row mutations (accepting an invite, bumping both sides, removing both sides) go through
-- SECURITY DEFINER RPCs so the symmetric row a user does NOT own can still be touched safely.

-- ── friends (one row per direction) ───────────────────────────────────────────
create table if not exists public.friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  friend_streak int not null default 0,
  -- ISO date (YYYY-MM-DD) the two were last active on the SAME day.
  last_both_active date,
  -- per-side "last active day" used by the streak math (set by touch_friend_activity).
  my_last_active date,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friends_user_idx on public.friends (user_id);

-- ── RLS — a user only sees/writes rows where they are the owner side ───────────
alter table public.friends enable row level security;
drop policy if exists own_select on public.friends;
drop policy if exists own_write  on public.friends;
create policy own_select on public.friends for select using (user_id = auth.uid());
create policy own_write  on public.friends for all    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── invite code → user id ─────────────────────────────────────────────────────
-- The client derives a code as upper(first 8 hex chars of the uuid, dashes stripped). This reverses
-- it. SECURITY DEFINER so it can scan auth.users without exposing the table to clients.
create or replace function public.user_for_code(code_in text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where upper(substr(replace(u.id::text, '-', ''), 1, 8)) = upper(code_in)
  limit 1;
$$;

-- ── accept_friend(code_in) → friend uuid ──────────────────────────────────────
-- Resolves the code, rejects self / duplicate, inserts BOTH direction rows. Returns the friend id.
create or replace function public.accept_friend(code_in text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then
    raise exception 'not_signed_in';
  end if;
  other := public.user_for_code(code_in);
  if other is null then
    raise exception 'not_found';
  end if;
  if other = me then
    raise exception 'self';
  end if;
  if exists (select 1 from public.friends where user_id = me and friend_id = other) then
    raise exception 'already';
  end if;
  insert into public.friends (user_id, friend_id) values (me, other)
    on conflict do nothing;
  insert into public.friends (user_id, friend_id) values (other, me)
    on conflict do nothing;
  return other;
end;
$$;

-- ── touch_friend_activity(day_in) ─────────────────────────────────────────────
-- Marks the caller active for `day_in` on every friendship, then — for each friend who is ALSO
-- active today — advances the SHARED streak (both rows kept in lock-step). A missed day resets the
-- pair's streak to 1 on the next shared-active day. SECURITY DEFINER so it can update the
-- reciprocal rows the caller doesn't own.
create or replace function public.touch_friend_activity(day_in date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  rec record;
begin
  if me is null then
    return;
  end if;
  -- Record my activity on all my outbound rows.
  update public.friends set my_last_active = day_in where user_id = me;

  -- For each friend who is also active today, settle the shared streak once.
  for rec in
    select f.friend_id, f.last_both_active
    from public.friends f
    join public.friends g on g.user_id = f.friend_id and g.friend_id = me
    where f.user_id = me
      and g.my_last_active = day_in            -- friend active today too
      and (f.last_both_active is null or f.last_both_active < day_in)  -- not yet settled today
  loop
    declare
      new_streak int;
    begin
      if rec.last_both_active = day_in - 1 then
        new_streak := (select friend_streak from public.friends where user_id = me and friend_id = rec.friend_id) + 1;
      else
        new_streak := 1;  -- first ever, or a gap → restart
      end if;
      update public.friends
        set friend_streak = new_streak, last_both_active = day_in
        where (user_id = me and friend_id = rec.friend_id)
           or (user_id = rec.friend_id and friend_id = me);
    end;
  end loop;
end;
$$;

-- ── remove_friend(friend_in) ──────────────────────────────────────────────────
-- Deletes BOTH direction rows. DEFINER so the reciprocal row (not owned by the caller) also goes.
create or replace function public.remove_friend(friend_in uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    return;
  end if;
  delete from public.friends
    where (user_id = me and friend_id = friend_in)
       or (user_id = friend_in and friend_id = me);
end;
$$;

grant execute on function public.user_for_code(text)        to authenticated;
grant execute on function public.accept_friend(text)        to authenticated;
grant execute on function public.touch_friend_activity(date) to authenticated;
grant execute on function public.remove_friend(uuid)        to authenticated;
