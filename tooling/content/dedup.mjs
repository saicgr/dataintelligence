#!/usr/bin/env node
// Near-duplicate check. The content-ingestor agent runs this BEFORE writing any card so it never
// inserts a question that already exists — it updates (same id) or skips instead.
//
// usage:  node tooling/content/dedup.mjs "the candidate question text?"
// prints the closest existing questions (with source + score) or "no near-duplicate".
//
// Corpus indexed: the 302-card generated bank (mobile/src/lib/generated/*.json), every pending +
// published fresh/lesson draft (tooling/content), and the bundled seeds (fresh.ts / lessons.ts).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const GENERATED_DIR = join(ROOT, 'mobile', 'src', 'lib', 'generated');

const STOP = new Set(
  ('a an the is are be of to in on for and or what when how why which do does you your it its with vs ' +
    'as at by from this that would when not no using use when-do whats what’s').split(/\s+/)
);

// crude stemmer so spill/spills, run/runs, partition/partitioning collapse together
const stem = (w) => w.replace(/(ing|edly|ed|es|s)$/, '').replace(/(.)\1$/, '$1');
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);

function jaccard(a, b) {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

// ── gather every existing question `q` + a source label ───────────────────────
const corpus = []; // { q, src }
const pushQ = (q, src) => {
  if (q && String(q).trim()) corpus.push({ q: String(q), src });
};

function fromJsonArrayFiles(dir, label) {
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    } catch {
      continue;
    }
    const arr = Array.isArray(data) ? data : Array.isArray(data?.cards) ? data.cards : [data];
    for (const c of arr) pushQ(c?.q, `${label}:${f}`);
  }
}

// 302-card bank (one JSON array per track)
fromJsonArrayFiles(GENERATED_DIR, 'bank');
// fresh + lesson drafts, archived published, assembled out/*
fromJsonArrayFiles(join(HERE, 'drafts'), 'draft');
fromJsonArrayFiles(join(HERE, 'drafts', 'published'), 'published');
fromJsonArrayFiles(join(HERE, 'drafts', 'lessons'), 'lesson-draft');
fromJsonArrayFiles(join(HERE, 'drafts', 'lessons', 'published'), 'lesson-published');
fromJsonArrayFiles(join(HERE, 'out'), 'out');

// bundled TS seeds — regex the `q:` lines (good enough for a dup check)
for (const [file, label] of [
  [join(ROOT, 'mobile', 'src', 'lib', 'fresh.ts'), 'fresh-seed'],
  [join(ROOT, 'mobile', 'src', 'lib', 'lessons.ts'), 'lesson-seed'],
  [join(ROOT, 'mobile', 'src', 'lib', 'content.ts'), 'daily'],
  [join(ROOT, 'mobile', 'src', 'lib', 'scenarios.ts'), 'scenario'],
  [join(ROOT, 'mobile', 'src', 'lib', 'basics.ts'), 'basics'],
]) {
  if (!existsSync(file)) continue;
  const txt = readFileSync(file, 'utf8');
  for (const m of txt.matchAll(/\bq:\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) pushQ(m[2], label);
}

// ── score the query against the corpus ────────────────────────────────────────
const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('usage: node dedup.mjs "the candidate question text?"');
  process.exit(2);
}
const qt = norm(query);
const ranked = corpus
  .map((c) => {
    const ct = norm(c.q);
    const j = jaccard(qt, ct);
    const contained = c.q.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(c.q.toLowerCase());
    return { ...c, score: contained ? Math.max(j, 0.9) : j };
  })
  .filter((c) => c.score >= 0.3)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

console.log(`indexed ${corpus.length} existing questions.`);
if (!ranked.length) {
  console.log('✓ no near-duplicate found — safe to insert as a new card.');
  process.exit(0);
}
console.log(`\n⚠ ${ranked.length} possible duplicate(s) — UPDATE the existing card (same id) or skip; do NOT insert a second:\n`);
for (const r of ranked) {
  console.log(`  ${(r.score * 100).toFixed(0)}%  [${r.src}]`);
  console.log(`        ${r.q}`);
}
process.exit(3); // non-zero so a wrapper can branch on "dupes found"
