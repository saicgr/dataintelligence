/**
 * Interview Readiness Score (plan #17): one north-star number per role.
 *
 * readiness = average over the role's cards of (0.6·mastery + 0.4·P(recall)), with unseen cards = 0.
 * Because P(recall) decays with elapsed time, the score *slides down* when you stop reviewing — the
 * spaced-repetition state made visible as loss aversion, the thing that pulls people back.
 */
import { bankForTrack, trackBySlug } from './content';
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

/* ── Multi-axis readiness (#9) — the same score, bucketed into what interviews actually test ── */

export type Axis = 'concepts' | 'handson' | 'sysdesign' | 'behavioral';
export const AXIS_LABEL: Record<Axis, string> = {
  concepts: 'Concepts',
  handson: 'Hands-on',
  sysdesign: 'System design',
  behavioral: 'Behavioral',
};
const AXIS_ORDER: Axis[] = ['concepts', 'handson', 'sysdesign', 'behavioral'];

/** Track slug → axis: explicit overrides first, then the track's Learn-path group.
 *  Exported for the Autopilot's weakest-axis boost. */
export function axisForTrack(slug: string): Axis {
  if (slug === 'sysd' || slug === 'architecture') return 'sysdesign';
  const group = trackBySlug(slug)?.group;
  if (group === 'coding' || group === 'oncall' || group === 'deploy') return 'handson';
  if (group === 'behavioral' || group === 'craft') return 'behavioral';
  return 'concepts';
}

/** Per-axis readiness for a role — same 0.6·mastery + 0.4·P(recall) pass, bucketed by axis. */
export function readinessAxes(
  role: string,
  progress: Record<string, CardState>,
  now: number
): { axis: Axis; label: string; value: number; total: number }[] {
  const tracks = ROLE_TRACKS[role] ?? [];
  const sum: Record<Axis, number> = { concepts: 0, handson: 0, sysdesign: 0, behavioral: 0 };
  const total: Record<Axis, number> = { concepts: 0, handson: 0, sysdesign: 0, behavioral: 0 };
  for (const slug of tracks) {
    const axis = axisForTrack(slug);
    for (const card of bankForTrack(slug)) {
      total[axis]++;
      const st = progress[card.id];
      if (st && st.reps > 0) sum[axis] += 0.6 * strength(st) + 0.4 * pRecall(st, now);
    }
  }
  return AXIS_ORDER.filter((a) => total[a] > 0).map((a) => ({
    axis: a,
    label: AXIS_LABEL[a],
    value: sum[a] / total[a],
    total: total[a],
  }));
}

/** A short, honest label for a readiness fraction (0..1). */
export function readinessLabel(r: number): string {
  if (r >= 0.8) return 'Interview-ready';
  if (r >= 0.55) return 'Almost there';
  if (r >= 0.3) return 'Building up';
  if (r > 0) return 'Just started';
  return 'Not started';
}
