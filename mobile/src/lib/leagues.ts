/**
 * Weekly Leagues + Leaderboard (Duolingo-style, senior-flavored tiers).
 *
 * Two halves:
 *  1. Pure helpers — tier math + ISO-week bucketing (no IO; safe everywhere).
 *  2. Supabase-backed IO — fetch the weekly board + upsert this user's weekly XP,
 *     all guarded by `hasSupabase`. When Supabase isn't configured we synthesize a
 *     believable local-only board (the real user dropped into seeded placeholders)
 *     so <LeagueBoard/> always has rows to render.
 *
 * Backing store: a `league_scores` table (user_id, week, xp, display_name) and a
 * `weekly_leaderboard(week text)` RPC that returns the top scorers for a week.
 * See supabase/migrations/0001_leagues.sql.
 */
import { supabase } from './supabase';

/** Senior-flavored ladder, low → high. A user's tier is derived from their RANK on the board. */
export type Tier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Staff' | 'Principal';

export const TIERS: readonly Tier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Staff', 'Principal'] as const;

export interface TierMeta {
  tier: Tier;
  /** Short emoji badge for the chip. */
  emoji: string;
  /** Theme palette key to color the badge with (resolved in the UI via useTheme). */
  colorKey: 'muted' | 'navy' | 'warn' | 'accentInk' | 'success' | 'danger';
  blurb: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  Bronze: { tier: 'Bronze', emoji: '🥉', colorKey: 'muted', blurb: 'Warming up' },
  Silver: { tier: 'Silver', emoji: '🥈', colorKey: 'navy', blurb: 'Building reps' },
  Gold: { tier: 'Gold', emoji: '🥇', colorKey: 'warn', blurb: 'Consistent' },
  Platinum: { tier: 'Platinum', emoji: '💎', colorKey: 'accentInk', blurb: 'Sharp' },
  Staff: { tier: 'Staff', emoji: '⭐', colorKey: 'success', blurb: 'Elite reps' },
  Principal: { tier: 'Principal', emoji: '🏆', colorKey: 'danger', blurb: 'Top of the league' },
};

/** How many ranked players the league shows at once (one "league" cohort). */
export const LEAGUE_SIZE = 30;
/** Top N this week get PROMOTED to the next tier. */
export const PROMOTE_COUNT = 5;
/** Bottom N this week get RELEGATED to the previous tier. */
export const RELEGATE_COUNT = 5;

export interface LeagueRow {
  userId: string;
  displayName: string;
  xp: number;
  /** 1-based rank within the league cohort (assigned by fetchLeaderboard after sorting). */
  rank: number;
  /** True for the signed-in / local user so the UI can highlight their row. */
  isMe: boolean;
}

export interface Leaderboard {
  week: string;
  rows: LeagueRow[];
  /** The current user's row (may be absent if they have no score yet). */
  me: LeagueRow | null;
  /** Whether these rows came from Supabase (true) or the local fallback (false). */
  live: boolean;
}

// ────────────────────────────── pure helpers ──────────────────────────────

const DAY = 86_400_000;

/**
 * ISO-8601 week key, e.g. "2026-W23". Weeks start Monday. Stable across timezones
 * because we bucket by UTC date — every device computes the same key for "this week".
 */
export function weekKey(ms: number = Date.now()): string {
  const d = new Date(ms);
  // Shift to the nearest Thursday (ISO weeks are defined by the Thursday they contain).
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7; // Sun=0 → 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Whole days remaining until the current ISO week rolls over (Monday 00:00 UTC). At least 0. */
export function daysLeftInWeek(ms: number = Date.now()): number {
  const d = new Date(ms);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  // Next Monday 00:00 UTC.
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + (8 - day));
  return Math.max(0, Math.ceil((next.getTime() - ms) / DAY));
}

/**
 * Map a 1-based rank within a LEAGUE_SIZE cohort to a tier. Higher ranks (rank 1 = top)
 * sit in the higher tiers. This is a presentational mapping for the board — true
 * promotion/relegation across real tiers is server logic, but this gives every row a
 * believable badge.
 */
export function tierForRank(rank: number, leagueSize: number = LEAGUE_SIZE): Tier {
  const n = Math.max(1, leagueSize);
  // Slice the cohort into TIERS.length bands; rank 1 → top tier.
  const bands = TIERS.length;
  const band = Math.min(bands - 1, Math.floor(((rank - 1) / n) * bands));
  return TIERS[bands - 1 - band];
}

/** Tier reached after this week resolves (promotion zone bumps up, relegation zone drops). */
export function nextWeekTier(rank: number, leagueSize: number = LEAGUE_SIZE): Tier {
  const cur = tierForRank(rank, leagueSize);
  const i = TIERS.indexOf(cur);
  if (rank <= PROMOTE_COUNT) return TIERS[Math.min(TIERS.length - 1, i + 1)];
  if (rank > leagueSize - RELEGATE_COUNT) return TIERS[Math.max(0, i - 1)];
  return cur;
}

export type Zone = 'promote' | 'relegate' | 'hold';
export function zoneForRank(rank: number, leagueSize: number = LEAGUE_SIZE): Zone {
  if (rank <= PROMOTE_COUNT) return 'promote';
  if (rank > leagueSize - RELEGATE_COUNT) return 'relegate';
  return 'hold';
}

// ───────────────────────────── local fallback ─────────────────────────────

const SEED_NAMES = [
  'Priya R.', 'Marcus T.', 'Wei Chen', 'Dana K.', 'Omar S.', 'Lena M.', 'Raj P.', 'Sofia G.',
  'Tomas V.', 'Aisha N.', 'Jordan L.', 'Yuki H.', 'Carlos M.', 'Nadia F.', 'Ethan B.', 'Mei L.',
  'Ivan D.', 'Grace O.', 'Hassan A.', 'Bianca C.', 'Kofi A.', 'Elena S.', 'Diego R.', 'Hana K.',
  'Leo W.', 'Farah Z.', 'Noah P.', 'Zara Q.', 'Sam I.',
];

/** A simple deterministic PRNG so the seeded board is stable within a given week. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a believable local-only board: seeded placeholders sized to LEAGUE_SIZE with the
 * real user slotted in at a plausible position based on their weekly XP. Deterministic per
 * (week, myXp) so the screen doesn't reshuffle on every render.
 */
export function localBoard(myXp: number, displayName: string, week: string, myUserId: string): Leaderboard {
  const rng = mulberry32(hashStr(week) ^ 0x9e3779b9);
  const others: LeagueRow[] = SEED_NAMES.slice(0, LEAGUE_SIZE - 1).map((name) => ({
    userId: `seed:${name}`,
    displayName: name,
    // Spread XP across a believable weekly range; some above the user, some below.
    xp: Math.round(40 + rng() * 760),
    rank: 0,
    isMe: false,
  }));
  const me: LeagueRow = { userId: myUserId, displayName, xp: Math.max(0, Math.round(myXp)), rank: 0, isMe: true };
  return rankBoard([...others, me], week, false);
}

// ────────────────────────────── ranking ──────────────────────────────

/** Sort by XP desc (stable name tiebreak), assign 1-based ranks, mark `me`, cap to LEAGUE_SIZE. */
export function rankBoard(rows: LeagueRow[], week: string, live: boolean): Leaderboard {
  const sorted = [...rows].sort((a, b) => b.xp - a.xp || a.displayName.localeCompare(b.displayName));
  const ranked = sorted.slice(0, LEAGUE_SIZE).map((r, i) => ({ ...r, rank: i + 1 }));
  const me = ranked.find((r) => r.isMe) ?? null;
  return { week, rows: ranked, me, live };
}

// ────────────────────────────── Supabase IO ──────────────────────────────

/** Upsert the signed-in user's cumulative weekly XP. No-op when Supabase isn't configured. */
export async function upsertWeeklyXp(
  userId: string,
  xp: number,
  displayName = 'You',
  week: string = weekKey()
): Promise<void> {
  if (!supabase || !userId) return;
  await supabase
    .from('league_scores')
    .upsert(
      { user_id: userId, week, xp: Math.max(0, Math.round(xp)), display_name: displayName },
      { onConflict: 'user_id,week' }
    );
}

interface RawScore {
  user_id: string;
  display_name: string | null;
  xp: number;
}

/**
 * Fetch the current week's leaderboard. Reads the `weekly_leaderboard(week)` RPC (a ranked
 * view of league_scores). Falls back to the local seeded board whenever Supabase is absent or
 * the query errors / returns nothing, so the UI always renders.
 */
export async function fetchLeaderboard(
  userId: string | null,
  myXp: number,
  displayName = 'You',
  week: string = weekKey()
): Promise<Leaderboard> {
  const myId = userId ?? 'me:local';
  if (!supabase) return localBoard(myXp, displayName, week, myId);

  try {
    const { data, error } = await supabase.rpc('weekly_leaderboard', { week: week });
    if (error || !data || (data as RawScore[]).length === 0) {
      return localBoard(myXp, displayName, week, myId);
    }
    const rows: LeagueRow[] = (data as RawScore[]).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name || 'Anon',
      xp: r.xp,
      rank: 0,
      isMe: !!userId && r.user_id === userId,
    }));
    // Ensure the current user appears even if the RPC capped them out of the top slice.
    if (userId && !rows.some((r) => r.isMe)) {
      rows.push({ userId, displayName, xp: Math.max(0, Math.round(myXp)), rank: 0, isMe: true });
    }
    return rankBoard(rows, week, true);
  } catch {
    return localBoard(myXp, displayName, week, myId);
  }
}
