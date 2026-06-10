/**
 * Recall check (#1) — an objective correctness signal on flip cards, built ENTIRELY from
 * fields every card already has. Before revealing, the user picks "the senior take":
 *   · correct   = the card's own `fs` (senior tell)
 *   · trap      = the card's own `fj` (the authored junior misconception)
 *   · distractor = a sibling card's `fs` from the same track (deterministic pick)
 * Zero schema change, zero re-authoring, no runtime AI — pure string work at render time.
 */
import type { SessionCard } from './content';

export interface RecallCheck {
  prompt: string;
  opts: { t: string; ok: boolean }[];
}

/** Options longer than this read as paragraphs, not pills — skip the check. */
const MAX_LEN = 160;

/** FNV-1a 32-bit — deterministic per-card seed (same pattern as quests.ts). */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const usable = (s: string | undefined): s is string => !!s && s.trim().length > 0 && s.length <= MAX_LEN;

/**
 * Build the pre-reveal check for a flip card, or null when the card's tells don't
 * support one (missing, identical, or too long). `pool` (usually the session deck or
 * track bank) supplies the third-option distractor; with no usable sibling the check
 * degrades to 2 options — still a real signal.
 */
export function buildRecallCheck(card: SessionCard, pool: SessionCard[]): RecallCheck | null {
  if (card.kind !== 'flip') return null;
  if (!usable(card.fs) || !usable(card.fj)) return null;
  if (card.fs.trim() === card.fj.trim()) return null;

  const seed = hashSeed(card.id);
  const opts: { t: string; ok: boolean }[] = [
    { t: card.fs, ok: true },
    { t: card.fj, ok: false },
  ];

  // Distractor: a same-track sibling's senior tell (deterministic, never our own text).
  const siblings = pool.filter(
    (s) =>
      s.id !== card.id &&
      s.tk === card.tk &&
      usable(s.fs) &&
      s.fs.trim() !== card.fs.trim() &&
      s.fs.trim() !== card.fj.trim()
  );
  if (siblings.length > 0) {
    const pick = siblings[seed % siblings.length];
    opts.push({ t: pick.fs, ok: false });
  }

  // Deterministic order (seeded rotation) so the correct answer isn't always first.
  const rot = seed % opts.length;
  const shuffled = [...opts.slice(rot), ...opts.slice(0, rot)];

  return { prompt: 'Before you reveal — which is the senior take?', opts: shuffled };
}
