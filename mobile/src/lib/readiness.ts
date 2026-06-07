/**
 * Interview Readiness Score (plan #17): one north-star number per role.
 *
 * readiness = average over the role's cards of (0.6·mastery + 0.4·P(recall)), with unseen cards = 0.
 * Because P(recall) decays with elapsed time, the score *slides down* when you stop reviewing — the
 * spaced-repetition state made visible as loss aversion, the thing that pulls people back.
 */
import { bankForTrack } from './content';
import { ROLE_TRACKS } from './roles';
import { CardState, pRecall, strength } from './srs';

/** 0..1 readiness for a role across all its tracks (coverage is baked in: unseen cards score 0). */
export function readinessForRole(role: string, progress: Record<string, CardState>, now: number): number {
  const tracks = ROLE_TRACKS[role] ?? [];
  let total = 0;
  let sum = 0;
  for (const slug of tracks) {
    for (const card of bankForTrack(slug)) {
      total++;
      const st = progress[card.id];
      if (st && st.reps > 0) sum += 0.6 * strength(st) + 0.4 * pRecall(st, now);
    }
  }
  return total ? sum / total : 0;
}

/** A short, honest label for a readiness fraction (0..1). */
export function readinessLabel(r: number): string {
  if (r >= 0.8) return 'Interview-ready';
  if (r >= 0.55) return 'Almost there';
  if (r >= 0.3) return 'Building up';
  if (r > 0) return 'Just started';
  return 'Not started';
}
