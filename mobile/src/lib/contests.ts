/**
 * Live weekly contest (plan GAP 5). A synchronous event layered on the existing league infra:
 * each ISO week is one contest. Users play a timed round (reusing mock.ts), submit their BEST
 * score (0..100), and see a ranked board. Reuses leagues' weekKey/daysLeftInWeek + Leaderboard
 * types + rankBoard so <LeagueBoard/> renders the standings unchanged (score maps onto the xp field).
 *
 * Backing store: contest_scores + submit_contest_score / contest_leaderboard RPCs
 * (supabase/migrations/0007_contests.sql). All IO is guarded by `supabase`; offline/unconfigured
 * falls back to a believable seeded board so the screen always renders.
 */
import { type Leaderboard, type LeagueRow, LEAGUE_SIZE, rankBoard, weekKey } from './leagues';
import { supabase } from './supabase';

export { daysLeftInWeek, weekKey } from './leagues';

const SEED = [
  'Priya R.', 'Marcus T.', 'Wei Chen', 'Dana K.', 'Omar S.', 'Lena M.', 'Raj P.', 'Sofia G.',
  'Tomas V.', 'Aisha N.', 'Jordan L.', 'Yuki H.', 'Carlos M.', 'Nadia F.', 'Ethan B.', 'Mei L.',
];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
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

/** Seeded local board with believable contest scores (55..100), the user slotted by their score. */
function localContestBoard(myScore: number, displayName: string, week: string, myId: string): Leaderboard {
  const rng = mulberry32(hashStr(week) ^ 0x51ed2701);
  const others: LeagueRow[] = SEED.slice(0, LEAGUE_SIZE - 1).map((name) => ({
    userId: `seed:${name}`,
    displayName: name,
    xp: 55 + Math.round(rng() * 45),
    rank: 0,
    isMe: false,
  }));
  const me: LeagueRow = { userId: myId, displayName, xp: Math.max(0, Math.min(100, Math.round(myScore))), rank: 0, isMe: true };
  return rankBoard([...others, me], week, false);
}

/** Submit the user's contest score for the week. Server keeps the best. No-op offline / signed out. */
export async function submitContestScore(
  userId: string | null,
  score: number,
  displayName = 'You',
  week: string = weekKey()
): Promise<void> {
  if (!supabase || !userId) return;
  try {
    await supabase.rpc('submit_contest_score', {
      week_in: week,
      score_in: Math.max(0, Math.min(100, Math.round(score))),
      name_in: displayName,
    });
  } catch {
    /* never block the round on a sync failure */
  }
}

interface RawScore {
  user_id: string;
  display_name: string | null;
  score: number;
}

/** Fetch this week's contest board. Falls back to a seeded local board when unavailable. */
export async function fetchContestBoard(
  userId: string | null,
  myScore: number,
  displayName = 'You',
  week: string = weekKey()
): Promise<Leaderboard> {
  const myId = userId ?? 'me:local';
  if (!supabase) return localContestBoard(myScore, displayName, week, myId);
  try {
    const { data, error } = await supabase.rpc('contest_leaderboard', { week });
    if (error || !data || (data as RawScore[]).length === 0) {
      return localContestBoard(myScore, displayName, week, myId);
    }
    const rows: LeagueRow[] = (data as RawScore[]).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name || 'Anon',
      xp: r.score,
      rank: 0,
      isMe: !!userId && r.user_id === userId,
    }));
    if (userId && !rows.some((r) => r.isMe)) {
      rows.push({ userId, displayName, xp: Math.max(0, Math.round(myScore)), rank: 0, isMe: true });
    }
    return rankBoard(rows, week, true);
  } catch {
    return localContestBoard(myScore, displayName, week, myId);
  }
}
