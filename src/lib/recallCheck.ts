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
  opts: { t: string; ok: boolean; why?: string }[];
}

/** Options longer than this read as paragraphs, not pills — skip the check.
 *  240 covers ~81% of the banks (avg senior tell ≈ 193 chars); 160 covered only 29%. */
const MAX_LEN = 240;

/** FNV-1a 32-bit — deterministic per-card seed (same pattern as quests.ts). */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Grader-rubric tells ("Explains X…", "Describes Y without mentioning Z…") read as a rubric,
 * not as something a candidate would SAY — rendering them as quiz options looks broken.
 * Conservative opener list on purpose: noun-led tells that happen to look like verbs
 * ("References are syntactic sugar…", "Maps in Go are iterated…") must stay usable, and a
 * missed rubric tell merely degrades to the plain Reveal button. The content itself is being
 * rewritten to spoken style; this guard covers stragglers and future OTA cards.
 */
const RUBRIC_OPENER =
  /^(Explains|Describes|Distinguishes|Mentions|Identifies|Lists|Demonstrates|Recognizes|Articulates|Highlights|Recommends|Proposes|Compares|Contrasts|Cites|Outlines|Quantifies|Acknowledges|Anticipates|Discusses|Emphasizes|Evaluates|Glosses|Ignores|Justifies|Leverages|Misses|Omits|Overlooks|Prioritizes|Summarizes|Vaguely|Correctly|Confuses|Walks through|Calls out|Fails to|Says ['"‘“])/;

const usable = (s: string | undefined): s is string =>
  !!s && s.trim().length > 0 && s.length <= MAX_LEN && !RUBRIC_OPENER.test(s.trim());

/**
 * Build the pre-reveal check for a flip card, or null when the card's tells don't
 * support one (missing, identical, or too long). `pool` (usually the session deck or
 * track bank) supplies the third-option distractor; with no usable sibling the check
 * degrades to 2 options — still a real signal.
 */
export function buildRecallCheck(card: SessionCard, pool: SessionCard[]): RecallCheck | null {
  if (card.kind !== 'flip') return null;

  // Preferred path: authored recall options (one ok:true + plausible-wrong, each with `why`).
  // These are real ANSWERS to the question, so the check actually tests the question — and the
  // wrong options carry an explanation the player shows on reveal.
  if (card.recall && card.recall.length >= 2) {
    const ok = card.recall.filter((o) => o.ok).length;
    if (ok === 1) {
      const s = hashSeed(card.id);
      const rot = s % card.recall.length;
      const shuffled = [...card.recall.slice(rot), ...card.recall.slice(0, rot)];
      return { prompt: 'Which answer holds up?', opts: shuffled };
    }
  }

  // Legacy fallback (cards not yet rewritten): fs = correct, fj = trap, sibling fs = distractor.
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

  // No role-words ("senior") in the prompt — the gap between the options should speak for
  // itself; the user just picks the one that holds up.
  return { prompt: 'Which answer holds up?', opts: shuffled };
}
