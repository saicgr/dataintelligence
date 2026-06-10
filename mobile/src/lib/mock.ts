/**
 * Self-serve MOCK INTERVIEW round (no human, fully automated).
 *
 * `buildMockDeck` assembles a short, mixed-format rapid-fire deck (6–8 cards) drawn from the
 * selected role's tracks, biased toward the user's weak/unseen cards via the SRS `weakness()`
 * signal. Pure: no store reads, no side effects — pass in role + progress, get a SessionCard[].
 *
 * `scoreMock` grades a finished round (correct/total + which ids were missed). This is the
 * timed-round sibling of the daily review: there is NO reveal/peek and no SRS rescheduling —
 * the screen just shows a score and routes missed cards to a weak-spot drill.
 */
import { bankForTrack, type SessionCard, tracksForRole } from './content';
import { type CardState, weakness } from './srs';

export const MOCK_MIN = 6;
export const MOCK_MAX = 8;

/** Kinds that have an unambiguous machine-gradable "correct" signal for a timed round. */
const GRADABLE = new Set<SessionCard['kind']>(['choice']);

/** A card is auto-gradable iff it's a single-correct MCQ (has options with exactly the `ok` flags). */
export function isGradable(card: SessionCard): boolean {
  return GRADABLE.has(card.kind) && Array.isArray(card.opts) && card.opts.some((o) => o.ok);
}

/** The index of the correct option for a gradable card (−1 if none / not gradable). */
export function correctIndex(card: SessionCard): number {
  if (!card.opts) return -1;
  return card.opts.findIndex((o) => o.ok);
}

/**
 * Build a 6–8 card mock round for `role`.
 *
 * Strategy: gather every unique card across the role's tracks, keep only auto-gradable MCQs
 * (a timed no-peek round needs an objective grade), then sort by `weakness()` (weak/unseen first)
 * with a touch of jitter so repeat rounds aren't identical. Mix formats/tracks by round-robining
 * across tracks so one topic can't dominate the deck.
 */
export function buildMockDeck(
  role: string,
  progress: Record<string, CardState>,
  now: number = Date.now(),
  /** Optional explicit card pool (company packs, My Tracks) — replaces the role's tracks. */
  pool?: SessionCard[]
): SessionCard[] {
  // Custom pool: one bucket, same gradable filter + weakest-first sort.
  if (pool) {
    const deck = pool
      .filter(isGradable)
      .sort(
        (a, b) =>
          weakness(progress[b.id], now) + Math.random() * 0.4 -
          (weakness(progress[a.id], now) + Math.random() * 0.4)
      )
      .slice(0, MOCK_MAX);
    return deck;
  }
  const tracks = tracksForRole(role).filter((t) => t.group === 'concept' || t.group === 'coding');

  // Per-track gradable pools, each pre-sorted weakest-first (+ jitter for variety).
  const seen = new Set<string>();
  const pools: SessionCard[][] = [];
  for (const t of tracks) {
    const trackPool = bankForTrack(t.slug)
      .filter((card) => {
        if (seen.has(card.id) || !isGradable(card)) return false;
        seen.add(card.id);
        return true;
      })
      .sort(
        (a, b) =>
          weakness(progress[b.id], now) + Math.random() * 0.4 -
          (weakness(progress[a.id], now) + Math.random() * 0.4)
      );
    if (trackPool.length) pools.push(trackPool);
  }

  // Round-robin across tracks so the deck spans topics rather than draining one track.
  const out: SessionCard[] = [];
  let depth = 0;
  while (out.length < MOCK_MAX && pools.some((p) => p.length > depth)) {
    for (const p of pools) {
      if (out.length >= MOCK_MAX) break;
      if (p.length > depth) out.push(p[depth]);
    }
    depth++;
  }
  return out.slice(0, Math.max(MOCK_MIN, Math.min(MOCK_MAX, out.length)));
}

export interface MockAnswer {
  id: string;
  /** Chosen option index, or null if the timer expired / skipped (counts as missed). */
  choice: number | null;
  correct: boolean;
}

export interface MockResult {
  total: number;
  correct: number;
  /** 0..1 fraction correct. */
  pct: number;
  missedIds: string[];
  /** A "good" round (>= 80%) → confetti + celebration copy. */
  passed: boolean;
}

/** Grade a finished round. Pure helper — does not touch the store. */
export function scoreMock(answers: MockAnswer[]): MockResult {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const missedIds = answers.filter((a) => !a.correct).map((a) => a.id);
  const pct = total ? correct / total : 0;
  return { total, correct, pct, missedIds, passed: pct >= 0.8 };
}

/** Seconds allotted per question in the rapid-fire round. */
export const MOCK_SECONDS_PER_Q = 20;
