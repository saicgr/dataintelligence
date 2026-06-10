/**
 * Readiness report (Pro) — a print-ready PDF snapshot of where you stand:
 * overall readiness + label, the 4 axis bars, percentile vs this week's league,
 * the 60-day trend line, and the 3 focus tracks the Autopilot ranking would attack next.
 * Same export pipeline as the cheat sheets (lib/exportPdf.ts).
 */
import { rankFocusTracks } from './autopilot';
import { readinessAxes, readinessForRole, readinessLabel } from './readiness';
import { roleByKey } from './roles';
import type { RoleKey } from './roles';
import type { CardState } from './srs';
import type { LeagueSnapshot } from './store';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface ReadinessReportInputs {
  role: RoleKey;
  progress: Record<string, CardState>;
  trend: { day: string; value: number }[];
  league: LeagueSnapshot | null;
  jdGapTracks: string[];
  targetCompanyKey: string | null;
  now?: number;
}

/** SVG polyline for the trend (0..1 values → small sparkline). */
function trendSvg(trend: { day: string; value: number }[]): string {
  if (trend.length < 2) return '';
  const W = 520;
  const H = 80;
  const pts = trend
    .map((t, i) => `${((i / (trend.length - 1)) * (W - 8) + 4).toFixed(1)},${(H - 6 - t.value * (H - 14)).toFixed(1)}`)
    .join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${pts}" fill="none" stroke="#f76707" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

export function buildReadinessReport(inp: ReadinessReportInputs): string {
  const now = inp.now ?? Date.now();
  const r = readinessForRole(inp.role, inp.progress, now);
  const pct = Math.round(r * 100);
  const axes = readinessAxes(inp.role, inp.progress, now);
  const roleName = roleByKey(inp.role)?.name ?? inp.role;
  const date = new Date(now).toISOString().slice(0, 10);

  // "Top N%" of this week's league board (rank 1 of 100 → top 1%).
  const topPct = inp.league && inp.league.size > 1 ? Math.max(1, Math.round((inp.league.rank / inp.league.size) * 100)) : null;

  const focus = rankFocusTracks(inp.role, inp.progress, inp.jdGapTracks, inp.targetCompanyKey, now).slice(0, 3);

  const axisRows = axes
    .map(
      (a) => `
      <div class="axis">
        <div class="axis-head"><span>${esc(a.label)}</span><span>${Math.round(a.value * 100)}%</span></div>
        <div class="bar"><div class="fill" style="width:${Math.round(a.value * 100)}%"></div></div>
      </div>`
    )
    .join('');

  const trendBlock =
    inp.trend.length >= 2
      ? `<h2>Trend · last ${inp.trend.length} active days</h2>${trendSvg(inp.trend)}
         <p class="meta">${esc(inp.trend[0].day)} → ${esc(inp.trend[inp.trend.length - 1].day)} ·
         ${Math.round(inp.trend[0].value * 100)}% → ${Math.round(inp.trend[inp.trend.length - 1].value * 100)}%</p>`
      : '';

  const focusBlock = focus.length
    ? `<h2>Where the next hour pays most</h2><ol>${focus
        .map((f) => `<li><strong>${esc(f.name)}</strong> — ${Math.round(f.readiness * 100)}% ready${f.isGap ? ' · ⚠️ JD gap' : ''}</li>`)
        .join('')}</ol>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>${esc(roleName)} readiness — FieldNotes</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1d23; margin: 28px; max-width: 560px; }
    header { border-bottom: 3px solid #f76707; padding-bottom: 10px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0; }
    h2 { font-size: 13px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #687078; }
    .meta { color: #687078; font-size: 11px; margin-top: 4px; }
    .score { font-size: 44px; font-weight: 800; margin: 8px 0 0; }
    .label { font-size: 14px; font-weight: 700; color: #1a7f4e; }
    .axis { margin-bottom: 9px; }
    .axis-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 3px; }
    .bar { height: 9px; border-radius: 999px; background: #e8ebee; overflow: hidden; }
    .fill { height: 100%; background: #f76707; border-radius: 999px; }
    ol { padding-left: 18px; } li { font-size: 12.5px; line-height: 1.6; }
    .pctile { font-size: 12.5px; }
    footer { margin-top: 22px; color: #687078; font-size: 10px; text-align: center; }
  </style></head><body>
  <header>
    <h1>${esc(roleName)} — interview readiness</h1>
    <div class="meta">exported ${date} · FieldNotes</div>
  </header>
  <div class="score">${pct}%</div>
  <div class="label">${esc(readinessLabel(r))}</div>
  ${topPct != null ? `<p class="pctile">🏆 Top <strong>${topPct}%</strong> of this week's league (#${inp.league!.rank} of ${inp.league!.size}, ${esc(inp.league!.tier)})</p>` : ''}
  <h2>By axis</h2>
  ${axisRows}
  ${trendBlock}
  ${focusBlock}
  <footer>Readiness = mastery + recall probability across your role's cards — it decays if you stop reviewing.</footer>
  </body></html>`;
}
