// Deterministic hard-reject gate (code, not model) + dedup vs the shipped 302 + pending drafts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLISHED_DIR, readDrafts } from './shared.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = join(HERE, '..', '..', 'mobile', 'src', 'lib', 'generated');

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Questions already in the app (the 302) + anything pending, for dedup. */
export function loadCorpus() {
  const set = new Set();
  if (existsSync(GENERATED_DIR)) {
    for (const f of readdirSync(GENERATED_DIR).filter((x) => x.endsWith('.json'))) {
      try {
        for (const c of JSON.parse(readFileSync(join(GENERATED_DIR, f), 'utf8'))) set.add(norm(c.q));
      } catch {
        /* skip unreadable */
      }
    }
  }
  for (const { card } of readDrafts()) set.add(norm(card.q));
  if (existsSync(PUBLISHED_DIR)) {
    for (const f of readdirSync(PUBLISHED_DIR).filter((x) => x.endsWith('.json'))) {
      try {
        set.add(norm(JSON.parse(readFileSync(join(PUBLISHED_DIR, f), 'utf8')).q));
      } catch {
        /* skip */
      }
    }
  }
  return set;
}

export function isDuplicate(card, corpus) {
  return corpus.has(norm(card.q));
}

/**
 * Hard gate for auto-authored cards: every claim must be ENTAILED AND its quote must be
 * literally present in the source (backstop against a hallucinated supporting quote).
 */
export function hardGate({ claims, verdicts, sourceText }) {
  const reasons = [];
  const src = norm(sourceText);
  claims.forEach((c, i) => {
    const v = verdicts[i]?.verdict;
    if (v !== 'ENTAILED') reasons.push(`claim "${c.value}" → ${v || 'no verdict'}`);
    if (c.quote && !src.includes(norm(c.quote))) reasons.push(`quote for "${c.value}" not found in source`);
  });
  return { ok: reasons.length === 0, reasons };
}
