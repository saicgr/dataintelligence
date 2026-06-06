#!/usr/bin/env node
// The single human-reviewed chokepoint. Review ALL pending drafts (fresh + lessons,
// manual + auto), then assemble fresh-vN.json + lessons-vN.json + manifest.json and
// (optionally) upload to Supabase Storage.
//
//   node publish.mjs          → show the review table + dry-run (writes out/ only)
//   node publish.mjs --yes    → also upload to Supabase Storage + archive drafts
//
// Nothing reaches users without this step. Manual cards are trusted as-authored;
// auto cards carry advisory warnings from the verify step. "Automation proposes, human approves."
import { renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import {
  ensureDirs,
  ensureLessonDirs,
  LESSONS_PUBLISHED_DIR,
  OUT_DIR,
  PUBLISHED_DIR,
  readDrafts,
  readJSON,
  readLessonDrafts,
  validateCard,
  validateLesson,
} from './shared.mjs';

const YES = process.argv.includes('--yes');

const freshDrafts = readDrafts();
const lessonDrafts = readLessonDrafts();
if (freshDrafts.length === 0 && lessonDrafts.length === 0) {
  console.log('No drafts. Add a fresh card with `node add.mjs`, or drop a lesson JSON in drafts/lessons/.');
  process.exit(0);
}

// ── Review table ──────────────────────────────────────────────────────────────
let blocked = 0;
const review = (label, drafts, validate, line) => {
  if (!drafts.length) return;
  console.log(`\n${drafts.length} pending ${label}:\n`);
  for (const { card } of drafts) {
    const { ok, errors } = validate(card);
    console.log('  ' + (ok ? '✓ ' : '✗ ') + line(card));
    if (!ok) {
      blocked++;
      console.log(`      ❌ ${errors.join(', ')}`);
    }
  }
};
review('fresh card(s)', freshDrafts, validateCard, (c) => {
  const origin = c.origin === 'auto' ? '🤖 auto' : '✍️  manual';
  const warn = c._warnings?.length ? `  ⚠️  ${c._warnings.join('; ')}` : '';
  return `${origin}  [${c.tool}] ${String(c.q).slice(0, 64)}\n      ${c.sourceUrl}${warn}`;
});
review('lesson(s)', lessonDrafts, validateLesson, (c) => `📚 ${c.kind}  [${c.track}] ${String(c.q).slice(0, 64)}`);

if (blocked) {
  console.error(`\n${blocked} draft(s) fail validation — fix or remove them before publishing.`);
  process.exit(1);
}
if (!YES) {
  console.log('\n✓ Fields validated, nothing published. Next steps (run from the repo root):');
  console.log('  1. node tooling/content/preview.mjs        # opens the app wired to your drafts (nothing committed)');
  console.log('  2. node tooling/content/publish.mjs --yes  # reads right? assemble + upload → live OTA on next app launch');
  process.exit(0);
}

// ── Assemble: merge new drafts over the last published set, drop expired ────────
ensureDirs();
ensureLessonDirs();
const now = Date.now();
const manifestPath = join(OUT_DIR, 'manifest.json');
const prevManifest = readJSON(manifestPath, { version: 0, freshUrl: '', lessonsUrl: '' });
const prevVersion = Number(prevManifest.version) || 0;
const version = prevVersion + 1;

const mergeById = (prev, drafts, keepStale) => {
  const byId = new Map();
  for (const c of prev) byId.set(c.id, c);
  for (const { card } of drafts) {
    delete card._warnings;
    byId.set(card.id, card);
  }
  return [...byId.values()].filter((c) => keepStale(c));
};

const freshKeep = (c) => Date.parse(c.verifyBy) > now; // fresh always carries a verifyBy
const lessonKeep = (c) => !c.verifyBy || Date.parse(c.verifyBy) > now; // lessons are evergreen by default

const prevFresh = readJSON(join(OUT_DIR, `fresh-v${prevVersion}.json`), []);
const prevLessons = readJSON(join(OUT_DIR, `lessons-v${prevVersion}.json`), []);
const mergedFresh = mergeById(prevFresh, freshDrafts, freshKeep);
const mergedLessons = mergeById(prevLessons, lessonDrafts, lessonKeep);

const freshName = `fresh-v${version}.json`;
const lessonsName = `lessons-v${version}.json`;
const hasFresh = mergedFresh.length > 0;
const hasLessons = mergedLessons.length > 0;
if (hasFresh) writeFileSync(join(OUT_DIR, freshName), JSON.stringify(mergedFresh, null, 2));
if (hasLessons) writeFileSync(join(OUT_DIR, lessonsName), JSON.stringify(mergedLessons, null, 2));

// ── Publish to Supabase Storage (service-role key — server-only, never EXPO_PUBLIC_*) ──
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let freshUrl = prevManifest.freshUrl || '';
let lessonsUrl = prevManifest.lessonsUrl || '';
const bucket = 'content';
const publicUrl = (name) => `${url}/storage/v1/object/public/${bucket}/${name}`;

if (url && serviceKey) {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  const up = async (name, body) =>
    sb.storage.from(bucket).upload(name, body, { contentType: 'application/json', upsert: true });
  // payload files FIRST, manifest LAST (so the app never sees a manifest pointing at a missing file)
  if (hasFresh) {
    const r = await up(freshName, JSON.stringify(mergedFresh));
    if (r.error) throw r.error;
    freshUrl = publicUrl(freshName);
  }
  if (hasLessons) {
    const r = await up(lessonsName, JSON.stringify(mergedLessons));
    if (r.error) throw r.error;
    lessonsUrl = publicUrl(lessonsName);
  }
  const manifest = { version, freshUrl, lessonsUrl };
  const r2 = await up('manifest.json', JSON.stringify(manifest));
  if (r2.error) throw r2.error;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(
    `\n🚀 Published v${version} → ${mergedFresh.length} fresh, ${mergedLessons.length} lesson card(s).`
  );
  console.log('   It\'s LIVE — every app picks it up on its next launch. No app-store review, nothing more to do.');
} else {
  if (hasFresh && !freshUrl) freshUrl = `REPLACE_WITH_PUBLIC_URL/${freshName}`;
  if (hasLessons && !lessonsUrl) lessonsUrl = `REPLACE_WITH_PUBLIC_URL/${lessonsName}`;
  const manifest = { version, freshUrl, lessonsUrl };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(
    `\n📦 Wrote out/ (v${version}): ${mergedFresh.length} fresh, ${mergedLessons.length} lesson card(s).`
  );
  console.log('   No SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set — upload out/*.json to your content host,');
  console.log('   then set EXPO_PUBLIC_CONTENT_MANIFEST_URL in mobile/.env to the manifest URL.');
}

// archive the drafts we just published
for (const { file, card } of freshDrafts) renameSync(file, join(PUBLISHED_DIR, `${card.id}.json`));
for (const { file, card } of lessonDrafts) renameSync(file, join(LESSONS_PUBLISHED_DIR, `${card.id}.json`));
console.log('   Drafts archived.\n');
