/**
 * Friend Streaks — a tiny social layer over Supabase. Two users who both stay active on the same
 * day grow a shared "friend streak" (Snapchat/Duolingo style). Invite is by a short code derived
 * from the user's id; accepting a code creates a reciprocal friendship row.
 *
 * Reuses the SINGLE shared client from lib/supabase (no second client). Every call is guarded by
 * `hasSupabase` and degrades to a graceful empty / no-op when Supabase isn't configured, so the UI
 * can render an empty-but-functional state offline (and signed-out users get nothing).
 *
 * Backing table + RLS: supabase/migrations/0003_friends.sql. The shared-streak math (incrementing
 * `friend_streak` when both were active the same day) is enforced server-side by the
 * `touch_friend_activity` RPC so neither client can inflate it.
 */
import { supabase } from './supabase';
import { hasSupabase } from './env';

export interface Friend {
  /** The other user's auth id. */
  friendId: string;
  /** Display name / handle if the friend set one (profiles), else a short id fragment. */
  name: string;
  /** Current shared streak (consecutive days both were active). */
  friendStreak: number;
  /** ISO date (YYYY-MM-DD) both were last active on the same day, or null if never. */
  lastBothActive: string | null;
  /** True if both were active TODAY — the streak is "kept" today. */
  activeToday: boolean;
}

/** UTC day key, matching the rest of the app's day math. */
const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * A short, shareable invite code for a user. Deterministic from the user id (uppercased 8-char
 * slug of the uuid) so it's stable + needs no extra table — `resolveInviteCode` reverses it via a
 * lookup RPC. Returns '' when there's no signed-in user.
 */
export function inviteCodeFor(userId: string | null): string {
  if (!userId) return '';
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Friendship row shape as stored. Two rows per friendship (one per direction) keeps RLS simple. */
interface FriendRow {
  user_id: string;
  friend_id: string;
  friend_streak: number;
  last_both_active: string | null;
}

/**
 * List the signed-in user's friends + each shared streak. Graceful empty array when Supabase is
 * unconfigured or no user is signed in. Names come from the profiles table when present.
 */
export async function listFriends(userId: string | null): Promise<Friend[]> {
  if (!hasSupabase || !supabase || !userId) return [];
  const { data, error } = await supabase
    .from('friends')
    .select('user_id, friend_id, friend_streak, last_both_active')
    .eq('user_id', userId);
  if (error || !data) return [];
  const rows = data as FriendRow[];
  const today = dayKey(Date.now());
  return rows.map((r) => ({
    friendId: r.friend_id,
    name: r.friend_id.replace(/-/g, '').slice(0, 6).toUpperCase(),
    friendStreak: r.friend_streak ?? 0,
    lastBothActive: r.last_both_active,
    activeToday: r.last_both_active === today,
  }));
}

export type InviteResult =
  | { ok: true; friendId: string }
  | { ok: false; reason: 'unconfigured' | 'not-signed-in' | 'self' | 'not-found' | 'already' | 'error' };

/**
 * Accept a friend's invite code, creating the reciprocal friendship. Server RPC `accept_friend`
 * resolves the code → user id, rejects self/duplicate, and inserts BOTH direction rows atomically
 * (so RLS — which only lets a user write rows where user_id = auth.uid() — still holds for each).
 */
export async function acceptInvite(userId: string | null, code: string): Promise<InviteResult> {
  if (!hasSupabase || !supabase) return { ok: false, reason: 'unconfigured' };
  if (!userId) return { ok: false, reason: 'not-signed-in' };
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, reason: 'not-found' };
  if (clean === inviteCodeFor(userId)) return { ok: false, reason: 'self' };
  const { data, error } = await supabase.rpc('accept_friend', { code_in: clean });
  if (error) {
    // The RPC raises typed messages we map to friendly reasons; fall back to a generic error.
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('not_found')) return { ok: false, reason: 'not-found' };
    if (msg.includes('already')) return { ok: false, reason: 'already' };
    if (msg.includes('self')) return { ok: false, reason: 'self' };
    return { ok: false, reason: 'error' };
  }
  return { ok: true, friendId: (data as string) ?? '' };
}

/**
 * Mark the signed-in user active for today across all their friendships. Server RPC
 * `touch_friend_activity` bumps each shared `friend_streak` when BOTH sides were active the same
 * day (and resets to 1 on a gap). Idempotent per day. No-op when unconfigured / signed out.
 *
 * Call this once when the user completes a session (see INTEGRATION NOTES for the store hook).
 */
export async function touchFriendActivity(userId: string | null): Promise<void> {
  if (!hasSupabase || !supabase || !userId) return;
  await supabase.rpc('touch_friend_activity', { day_in: dayKey(Date.now()) });
}

/**
 * Remove a friendship (both directions). RLS lets each user delete only their own outbound row, so
 * the server RPC `remove_friend` deletes the reciprocal row with definer rights. No-op offline.
 */
export async function removeFriend(userId: string | null, friendId: string): Promise<void> {
  if (!hasSupabase || !supabase || !userId) return;
  await supabase.rpc('remove_friend', { friend_in: friendId });
}
