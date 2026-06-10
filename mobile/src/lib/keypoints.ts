/**
 * Key-point extraction + coverage scoring (#16) — the offline "did I nail it?" engine.
 * Pure TS, runs at card load, no runtime AI:
 *   · extractKeyPoints — the card's rubric when authored, else salient short phrases
 *     mined from the answer + senior tell (rare/technical tokens win).
 *   · coverage — keyword-hit check of free text against the points (single source of
 *     truth; ScenarioView's auto-tick uses this too).
 *   · suggestRating — coverage ratio → suggested SRS grade (same thresholds app-wide).
 */
import type { SessionCard } from './content';
import type { Rating } from './srs';

const STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'allow', 'allows', 'almost', 'along', 'already',
  'also', 'always', 'among', 'another', 'answer', 'anything', 'around', 'because', 'been', 'before',
  'being', 'below', 'between', 'both', 'cannot', 'could', 'doesn', 'doing', 'during', 'each',
  'either', 'enough', 'every', 'first', 'following', 'further', 'getting', 'gives', 'going', 'have',
  'having', 'here', 'instead', 'into', 'itself', 'just', 'keep', 'keeps', 'large', 'like', 'likely',
  'long', 'made', 'make', 'makes', 'many', 'means', 'might', 'more', 'most', 'much', 'must', 'need',
  'needs', 'never', 'often', 'only', 'other', 'others', 'over', 'rather', 'really', 'same', 'should',
  'since', 'small', 'some', 'something', 'still', 'such', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'thing', 'things', 'this', 'those', 'through', 'under', 'until', 'used',
  'uses', 'using', 'usually', 'very', 'want', 'well', 'were', 'what', 'when', 'where', 'which',
  'while', 'will', 'with', 'within', 'without', 'would', 'your',
]);

const wordsOf = (s: string): string[] => s.match(/[A-Za-z][\w.-]{2,}/g) ?? [];
/** Code-ish tokens (flags, dotted paths, snake/kebab case, digits, CamelCase) carry extra signal. */
const codeish = (w: string): boolean => /[._\-0-9]/.test(w) || /[a-z][A-Z]/.test(w);

/**
 * Salient key points for a card. Rubric (human-authored) wins; otherwise mine the answer +
 * senior tell for the clauses holding the rarest technical tokens, trimmed to short phrases.
 */
export function extractKeyPoints(card: SessionCard, max = 6): string[] {
  if (card.rubric?.length) return card.rubric.slice(0, max);
  const corpus = `${card.a ?? ''} ${card.fs ?? ''}`.trim();
  if (!corpus) return [];

  // Term frequency over the whole corpus → rarity = 1/tf.
  const tf: Record<string, number> = {};
  for (const w of wordsOf(corpus)) {
    const k = w.toLowerCase();
    tf[k] = (tf[k] ?? 0) + 1;
  }

  const wordScore = (w: string): number => {
    const k = w.toLowerCase();
    if (w.length < 5 || STOPWORDS.has(k)) return 0;
    return (1 / (tf[k] ?? 1)) * (codeish(w) ? 1.6 : 1);
  };

  const clauses = corpus
    .split(/[.;!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => wordsOf(s).length >= 3);

  const scored = clauses.map((clause, order) => {
    const ws = wordsOf(clause);
    const score = ws.reduce((sum, w) => sum + wordScore(w), 0) / Math.sqrt(ws.length);
    return { clause, ws, score, order };
  });
  scored.sort((a, b) => b.score - a.score);

  const points: string[] = [];
  const seen = new Set<string>();
  for (const { clause, ws } of scored) {
    if (points.length >= max) break;
    // Trim long clauses to a ~8-word window around the strongest token.
    let phrase = clause;
    if (ws.length > 9) {
      let bestIdx = 0;
      let best = -1;
      ws.forEach((w, i) => {
        const sc = wordScore(w);
        if (sc > best) {
          best = sc;
          bestIdx = i;
        }
      });
      const start = Math.max(0, bestIdx - 3);
      phrase = ws.slice(start, start + 8).join(' ');
    }
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(phrase);
  }
  // Stable presentation order: as they appear in the answer, not by score.
  const orderOf = (p: string) => corpus.toLowerCase().indexOf(p.split(' ')[0]?.toLowerCase() ?? '');
  return points.sort((a, b) => orderOf(a) - orderOf(b));
}

/** Which points the free text covers — keyword-hit ≥ min(2, kws) per point (offline, adjustable). */
export function coverage(text: string, points: string[]): boolean[] {
  const txt = text.toLowerCase();
  if (!txt.trim()) return points.map(() => false);
  return points.map((item) => {
    const kws = item.toLowerCase().match(/[a-z][a-z-]{4,}/g) ?? [];
    if (!kws.length) return false;
    const hits = kws.filter((k) => txt.includes(k)).length;
    return hits >= Math.min(2, kws.length);
  });
}

/** Coverage ratio → suggested SRS grade (one source of truth for every recall surface). */
export function suggestRating(ratio: number): Rating {
  return ratio >= 1 ? 'easy' : ratio >= 0.6 ? 'good' : 'again';
}
