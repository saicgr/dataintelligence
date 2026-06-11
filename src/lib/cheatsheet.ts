/**
 * Cheat-sheet builder (Pro) — renders a studied track as a print-ready recap page:
 * per seen card, the QUESTION + extracted key points + the junior/senior tell pair.
 * Deliberately NOT the full Q&A: the sheet is a completion artifact for last-minute
 * review, not an exportable copy of the content bank. "Export till here" falls out of
 * the seen-cards filter — you export exactly as far as you've drilled.
 */
import { bankForTrack, type SessionCard, trackBySlug } from './content';
import { extractKeyPoints } from './keypoints';
import type { CardState } from './srs';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface CheatSheet {
  html: string;
  /** Cards included (seen at least once). */
  included: number;
  /** Total cards in the track bank. */
  total: number;
}

/** Build the sheet for a track from real progress. Returns null when nothing was studied yet. */
export function buildCheatSheet(slug: string, progress: Record<string, CardState>): CheatSheet | null {
  const track = trackBySlug(slug);
  const bank = bankForTrack(slug);
  if (!track) return null;
  return buildCheatSheetFromCards(track.name, bank, progress);
}

/** Sheet for an arbitrary card pool (company packs, My Tracks, JD prep, mistakes) — same
 *  seen-cards-only, key-points-not-full-answers contract as the track sheet. */
export function buildCheatSheetFromCards(
  title: string,
  bank: SessionCard[],
  progress: Record<string, CardState>
): CheatSheet | null {
  if (bank.length === 0) return null;
  const seen = bank.filter((c) => (progress[c.id]?.reps ?? 0) > 0);
  if (seen.length === 0) return null;

  const items = seen
    .map((card) => {
      const points = extractKeyPoints(card, 4);
      return `
      <section class="card">
        <h3>${esc(card.q)}</h3>
        ${points.length ? `<ul>${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
        <p class="tells"><span class="fj">Junior tell: ${esc(card.fj)}</span><br/>
        <span class="fs">Senior tell: ${esc(card.fs)}</span></p>
      </section>`;
    })
    .join('\n');

  const date = new Date().toISOString().slice(0, 10);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${esc(title)} — ByteShards cheat sheet</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1d23; margin: 28px; }
    header { border-bottom: 3px solid #f76707; padding-bottom: 10px; margin-bottom: 18px; }
    h1 { font-size: 20px; margin: 0; }
    .meta { color: #687078; font-size: 11px; margin-top: 4px; }
    .card { break-inside: avoid; border-left: 3px solid #f76707; padding: 2px 0 2px 12px; margin-bottom: 14px; }
    h3 { font-size: 13px; margin: 0 0 6px; }
    ul { margin: 0 0 6px; padding-left: 18px; }
    li { font-size: 11.5px; line-height: 1.45; margin-bottom: 2px; }
    .tells { font-size: 10.5px; line-height: 1.5; margin: 0; }
    .fj { color: #c0392b; }
    .fs { color: #1a7f4e; font-weight: 600; }
    footer { margin-top: 22px; color: #687078; font-size: 10px; text-align: center; }
    @media print { body { margin: 12px; } }
  </style></head><body>
  <header>
    <h1>${esc(title)} — interview cheat sheet</h1>
    <div class="meta">${seen.length} of ${bank.length} cards studied · exported ${date} · ByteShards</div>
  </header>
  ${items}
  <footer>Key points &amp; senior tells from your studied cards — full answers live in the app.</footer>
  </body></html>`;

  return { html, included: seen.length, total: bank.length };
}
