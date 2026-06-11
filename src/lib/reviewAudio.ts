/**
 * Review Mode (audio) — shared constants + the eligibility filter.
 *
 * Review Mode reads a track's Q&A aloud for hands-free commute review. Only cards that
 * make sense SPOKEN qualify: a real prose answer, no code panels (expo-speech would read
 * syntax aloud), no tap-interactive formats. Ineligible cards are skipped silently.
 */
import type { SessionCard } from './content';
import { sanitize } from './tts';

/** Silence between the spoken question and the spoken answer — the "think it through" recall
 *  pause. ONE tunable constant; never hardcode this in the player. */
export const PAUSE_DURATION_MS = 8000;
/** Breather between the answer ending and the next card's question. */
export const CARD_GAP_MS = 1500;

/** Interactive formats that can't be reviewed by ear (they're tap-the-panel exercises). */
const INTERACTIVE_KINDS = new Set(['order', 'evidence', 'diag', 'match', 'querybuild', 'classify']);

/** True when this single card can be read aloud. */
export function isAudioEligible(card: SessionCard): boolean {
  if (INTERACTIVE_KINDS.has(card.kind)) return false;
  if (card.code?.length || card.lines?.length) return false; // code panels — never speak code
  // Requires a real answer AFTER markdown stripping ('choice' cards have no `a`, so they drop here).
  if (!card.a || sanitize(card.a).length === 0) return false;
  return true;
}

/** The speakable subset of a card list, original order preserved. */
export function audioEligible(cards: SessionCard[]): SessionCard[] {
  return cards.filter(isAudioEligible);
}
