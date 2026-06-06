#!/usr/bin/env node
// Validate + stamp + write ONE content draft into the queue. Used by the `content-ingestor` agent so
// ids/dates are deterministic and an INVALID draft can never land in drafts/ (which would break
// publish.mjs). This NEVER publishes — it only writes a candidate draft a human approves later.
//
// usage:
//   node draft.mjs fresh  <partial-card.json>   # a "what shipped" / news / concept FreshCard
//   node draft.mjs lesson <lesson-card.json>    # a coding/diagnostic LessonCard (drafts/lessons/)
//
// Exit codes: 0 = written, 1 = validation failed (nothing written), 2 = bad usage.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assignDefaults,
  ensureLessonDirs,
  LESSONS_DRAFTS_DIR,
  validateCard,
  validateLesson,
  writeDraft,
} from './shared.mjs';

const [, , kind, file] = process.argv;
if (!kind || !file || !['fresh', 'lesson'].includes(kind)) {
  console.error('usage: node draft.mjs <fresh|lesson> <partial-card.json>');
  process.exit(2);
}

/** Tell the founder exactly what to run next (he may not remember the commands). */
function printNextSteps() {
  console.log('\n  Nothing is live yet — it\'s just a draft file. Next steps: VALIDATE, then publish (from repo root):');
  console.log('    1. node tooling/content/publish.mjs        # validate fields (lists + flags errors; publishes nothing)');
  console.log('    2. node tooling/content/preview.mjs        # opens the app wired to your drafts (read it; nothing published)');
  console.log('    3. node tooling/content/publish.mjs --yes  # both good? go live, OTA (no app-store review)');
}

let raw;
try {
  raw = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`✗ could not read/parse ${file}: ${err.message}`);
  process.exit(1);
}

if (kind === 'fresh') {
  const card = assignDefaults(raw, { origin: raw.origin || 'manual' });
  const { ok, errors } = validateCard(card);
  if (!ok) {
    console.error('✗ invalid fresh card — nothing written:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
  const path = writeDraft(card);
  console.log(`✓ wrote ${path}`);
  console.log(`  id: ${card.id}   track: ${card.track || '(none — aggregate "Stay current" only)'}`);
  printNextSteps();
} else {
  ensureLessonDirs();
  const { ok, errors } = validateLesson(raw);
  if (!ok) {
    console.error('✗ invalid lesson card — nothing written:\n  - ' + errors.join('\n  - '));
    process.exit(1);
  }
  if (!raw.id) {
    console.error('✗ lesson card needs an `id` — nothing written.');
    process.exit(1);
  }
  const path = join(LESSONS_DRAFTS_DIR, `${raw.id}.json`);
  writeFileSync(path, JSON.stringify(raw, null, 2));
  console.log(`✓ wrote ${path}`);
  console.log(`  id: ${raw.id}   track: ${raw.track}`);
  printNextSteps();
}
