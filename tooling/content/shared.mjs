// Shared helpers for the content tooling. Plain Node ESM, zero app imports.
// The FreshCard shape is the canonical one in mobile/src/lib/fresh.ts — keep in sync.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DRAFTS_DIR = join(HERE, 'drafts');
export const PUBLISHED_DIR = join(HERE, 'drafts', 'published');
export const OUT_DIR = join(HERE, 'out');

const DAY = 86_400_000;
const VALID_TK = ['spark', 'kafka', 'rag', 'sql', 'dbt', 'sysd', 'eval'];
const VALID_DOMAIN = ['ai', 'de'];

export const REQUIRED = ['tk', 'tool', 'domain', 'q', 'a', 'fj', 'fs', 'sourceUrl', 'sourceLabel'];

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/** Fill id/publishedAt/verifyBy/origin. verifyBy defaults to +90 days so stale facts auto-retire. */
export function assignDefaults(card, { origin = 'manual', now = Date.now(), verifyDays = 90 } = {}) {
  return {
    id: card.id || `fresh-${slugify(card.tool)}-${slugify(card.q).slice(0, 24)}`,
    ...card,
    publishedAt: card.publishedAt || iso(now),
    verifyBy: card.verifyBy || iso(now + verifyDays * DAY),
    origin,
  };
}

/** Schema validation (required fields + enum sanity + future verifyBy). */
export function validateCard(card) {
  const errors = [];
  for (const k of REQUIRED) if (!card[k] || String(card[k]).trim() === '') errors.push(`missing ${k}`);
  if (card.tk && !VALID_TK.includes(card.tk)) errors.push(`tk '${card.tk}' not in ${VALID_TK.join('/')}`);
  if (card.domain && !VALID_DOMAIN.includes(card.domain)) errors.push(`domain must be ai|de`);
  if (card.sourceUrl && !/^https?:\/\//.test(card.sourceUrl)) errors.push('sourceUrl must be http(s)');
  if (card.verifyBy && Date.parse(card.verifyBy) <= Date.now()) errors.push('verifyBy is not in the future');
  return { ok: errors.length === 0, errors };
}

export function ensureDirs() {
  for (const d of [DRAFTS_DIR, PUBLISHED_DIR, OUT_DIR]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

export function writeDraft(card) {
  ensureDirs();
  const path = join(DRAFTS_DIR, `${card.id}.json`);
  writeFileSync(path, JSON.stringify(card, null, 2));
  return path;
}

export function readDrafts() {
  ensureDirs();
  return readdirSync(DRAFTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: join(DRAFTS_DIR, f), card: JSON.parse(readFileSync(join(DRAFTS_DIR, f), 'utf8')) }));
}

export function readJSON(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export { iso, slugify };

// ── Lessons (richer diagnostic/coding card kinds) ─────────────────────────────
// Canonical shape lives in mobile/src/lib/lessons.ts (LessonCard). Lessons are the
// `order|evidence|diag|match|querybuild|choice` cards grouped into Path units by `track`.
// They ship via the SAME manifest/OTA path as fresh cards (publish.mjs emits lessons-vN.json
// + sets manifest.lessonsUrl). Author drafts in drafts/lessons/ — human approves at publish.

export const LESSONS_DRAFTS_DIR = join(DRAFTS_DIR, 'lessons');
export const LESSONS_PUBLISHED_DIR = join(LESSONS_DRAFTS_DIR, 'published');
const VALID_KINDS = ['order', 'evidence', 'diag', 'match', 'querybuild', 'choice', 'classify'];
const REQUIRED_LESSON = ['track', 'id', 'kind', 'tk', 'tool', 'tag', 'q', 'fj', 'fs'];

const isPerm = (arr, n) =>
  Array.isArray(arr) && arr.length === n && [...arr].sort((a, b) => a - b).every((v, i) => v === i);

/** Structural validation per card kind (token positions valid, ≥1 accepted solution, etc.). */
export function validateLesson(card) {
  const e = [];
  for (const k of REQUIRED_LESSON) if (!card[k] || String(card[k]).trim() === '') e.push(`missing ${k}`);
  if (card.tk && !VALID_TK.includes(card.tk)) e.push(`tk '${card.tk}' not in ${VALID_TK.join('/')}`);
  if (card.kind && !VALID_KINDS.includes(card.kind)) e.push(`kind '${card.kind}' not in ${VALID_KINDS.join('/')}`);
  if (card.verifyBy && Date.parse(card.verifyBy) <= Date.now()) e.push('verifyBy is not in the future');

  if (card.kind === 'order') {
    const o = card.order;
    if (!o?.rows?.length) e.push('order.rows required');
    else if (!Array.isArray(o.accepted) || !o.accepted.length) e.push('order.accepted needs ≥1 ordering');
    else if (!o.accepted.every((seq) => isPerm(seq, o.rows.length)))
      e.push('each order.accepted must be a permutation of the row indices');
  } else if (card.kind === 'evidence') {
    const ev = card.evidence;
    if (!ev?.panel) e.push('evidence.panel required');
    if (!Array.isArray(ev?.tells) || !ev.tells.length) e.push('evidence.tells needs ≥1 tell');
    if (!ev?.cause?.some((o) => o.ok)) e.push('evidence.cause needs a correct option');
  } else if (card.kind === 'match') {
    const m = card.match;
    const hasBlank = Array.isArray(m?.blank) && m.blank.some((o) => o.ok);
    const hasAsm = Array.isArray(m?.bank) && Array.isArray(m?.acceptedSeqs) && m.acceptedSeqs.length > 0;
    if (!hasBlank && !hasAsm) e.push('match needs blank (with a correct chip) or bank+acceptedSeqs');
    if (Array.isArray(m?.bank) && Array.isArray(m?.acceptedSeqs)) {
      const need = Math.max(-1, ...m.bank.map((t) => t.pos)) + 1;
      if (!m.acceptedSeqs.every((seq) => Array.isArray(seq) && seq.length === need))
        e.push(`match.acceptedSeqs entries must each have ${need} positions`);
    }
  } else if (card.kind === 'querybuild') {
    const qb = card.querybuild;
    if (!qb?.setup?.expected) e.push('querybuild.setup.expected required (show-the-result)');
    if (!Array.isArray(qb?.assemble?.bank) || !qb.assemble.bank.length) e.push('querybuild.assemble.bank required');
    if (!Array.isArray(qb?.acceptedSeqs) || !qb.acceptedSeqs.length)
      e.push('querybuild.acceptedSeqs needs ≥1 accepted solution');
    if (!qb?.webx?.problemId) e.push('querybuild.webx.problemId required (web cross-sell)');
  } else if (card.kind === 'diag') {
    const d = card.diag;
    if (!Array.isArray(d?.steps) || !d.steps.length) e.push('diag.steps required');
    else
      d.steps.forEach((s, i) => {
        if (!s.why) e.push(`diag.steps[${i}].why required`);
        if (s.kind === 'evidence') {
          if (!s.panel) e.push(`diag.steps[${i}] (evidence) needs a panel`);
          if (!Array.isArray(s.tells)) e.push(`diag.steps[${i}] (evidence) needs tells`);
        } else if (['inspect', 'infer', 'fix', 'verify'].includes(s.kind)) {
          if (!s.opts?.some((o) => o.ok)) e.push(`diag.steps[${i}] (${s.kind}) needs a correct opt`);
        } else {
          e.push(`diag.steps[${i}] has unknown kind '${s.kind}'`);
        }
      });
  } else if (card.kind === 'choice') {
    if (!card.opts?.some((o) => o.ok)) e.push('choice needs a correct opt');
  }
  return { ok: e.length === 0, errors: e };
}

export function ensureLessonDirs() {
  for (const d of [LESSONS_DRAFTS_DIR, LESSONS_PUBLISHED_DIR]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/** Pending lesson drafts (skips the template + any _-prefixed scratch files). */
export function readLessonDrafts() {
  ensureLessonDirs();
  return readdirSync(LESSONS_DRAFTS_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'lesson.template.json' && !f.startsWith('_'))
    .map((f) => ({ file: join(LESSONS_DRAFTS_DIR, f), card: JSON.parse(readFileSync(join(LESSONS_DRAFTS_DIR, f), 'utf8')) }));
}
