/**
 * On-device code judge — shared contract (plan GAP 1). Grading is deterministic output-match
 * (NOT AI), so it honors the "no runtime AI" moat. Each language has its own runner:
 *   - sql.ts      → expo-sqlite, offline & synchronous (sql.web.ts: async API — the sync
 *                   web path needs SharedArrayBuffer/cross-origin isolation, async doesn't)
 *   - pyodide.tsx → Pyodide-in-WebView for python + pyspark (pyodide.web.tsx: Pyodide
 *                   on the page — no WebView on web); needs the runner mounted
 */
import type { Rating } from '../srs';

export interface JudgeResult {
  /** True iff the user's output canonically matched `expected`. */
  ok: boolean;
  /** The user's normalized output (for the actual-vs-expected diff panel). */
  actual?: string;
  /** A runtime/compile error message, if execution failed. */
  error?: string;
}

/**
 * Canonical form for comparison: trim each line, drop blank lines, collapse runs of spaces.
 * Both the judged output and the authored `expected` are normalized through this.
 */
export function normalize(s: string): string {
  return s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l.length > 0)
    .join('\n')
    .trim();
}

/** Serialize result rows (array of value-arrays) to the canonical 'a|b\nc|d' form. */
export function serializeRows(rows: unknown[][]): string {
  return rows.map((r) => r.map((v) => (v == null ? '' : String(v))).join('|')).join('\n');
}

/** Map a judged pass/fail (+ whether hints were used) to an SRS rating. */
export function ratingFor(ok: boolean, usedHints: boolean): Rating {
  if (!ok) return 'again';
  return usedHints ? 'good' : 'easy';
}
