/** Lightweight SM-2-style spaced-repetition scheduler. */

export type Rating = 'again' | 'good' | 'easy';

export interface CardState {
  ease: number; // ease factor
  interval: number; // days
  reps: number;
  lapses: number;
  due: number; // epoch ms
}

const DAY = 86_400_000;

export function initCard(): CardState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: 0 };
}

export function schedule(prev: CardState | undefined, rating: Rating, now: number): CardState {
  const s = prev ?? initCard();
  if (rating === 'again') {
    return {
      ease: Math.max(1.3, s.ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: s.lapses + 1,
      due: now + 10 * 60_000, // ~10 min
    };
  }
  const reps = s.reps + 1;
  let interval: number;
  if (rating === 'easy') {
    interval = reps <= 1 ? 4 : Math.round((s.interval || 1) * s.ease * 1.3);
  } else {
    interval = reps <= 1 ? 1 : Math.round((s.interval || 1) * s.ease);
  }
  const ease = rating === 'easy' ? s.ease + 0.15 : s.ease;
  return { ease, interval, reps, lapses: s.lapses, due: now + interval * DAY };
}

/** Human label for the next due time (used on the rate buttons). */
export function dueLabel(rating: Rating): string {
  return { again: 'in <10 min', good: 'in 2 days', easy: 'in 5 days' }[rating];
}

/** How many cards come due within the next `days` days (the "N due tomorrow" hook). */
export function dueWithin(progress: Record<string, CardState>, now: number, days: number): number {
  let n = 0;
  for (const id in progress) {
    const due = progress[id].due;
    if (due > now && due <= now + days * DAY) n++;
  }
  return n;
}

// ── Adaptive selection ("smart scheduling" / Birdbrain-style) ───────────────

/** 0..1 estimate of how well-known a card is (mastery). */
export function strength(s: CardState | undefined): number {
  if (!s || s.reps === 0) return 0;
  const repScore = Math.min(1, s.reps / 6);
  const easeScore = Math.min(1, Math.max(0, (s.ease - 1.3) / (3.0 - 1.3)));
  const lapsePenalty = Math.min(0.6, s.lapses * 0.15);
  return Math.max(0, Math.min(1, 0.5 * repScore + 0.5 * easeScore - lapsePenalty));
}

/** Birdbrain-style P(recall) right now from interval vs elapsed time (exponential forgetting). */
export function pRecall(s: CardState | undefined, now: number): number {
  if (!s || s.reps === 0) return 0;
  const interval = Math.max(0.25, s.interval || 1); // days
  const lastReviewed = s.due - interval * DAY;
  const elapsedDays = Math.max(0, (now - lastReviewed) / DAY);
  return Math.pow(2, -elapsedDays / interval); // ~0.5 at the due moment
}

/** Higher = weaker / more worth drilling. Drives weak-spot ordering + adaptive review. */
export function weakness(s: CardState | undefined, now: number): number {
  if (!s || s.reps === 0) return 0.5; // unseen = neutral
  return s.lapses + (1 - strength(s)) + (1 - pRecall(s, now));
}
