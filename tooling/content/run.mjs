#!/usr/bin/env node
// OPTIONAL automated ingest. Fetches curated sources, authors cards EXTRACTIVELY, verifies
// each claim adversarially, applies the deterministic hard gate, and writes survivors into
// drafts/ as origin:'auto'. It NEVER publishes — the founder still reviews via publish.mjs.
//
//   ANTHROPIC_API_KEY=... node run.mjs
import process from 'node:process';

import { authorCard } from './author.mjs';
import { hardGate, isDuplicate, loadCorpus } from './gate.mjs';
import { assignDefaults, validateCard, writeDraft } from './shared.mjs';
import { fetchAllEntries } from './sources.mjs';
import { verifyClaims } from './verify.mjs';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY to run the automated ingest. (The manual path needs no key.)');
  process.exit(1);
}

const corpus = loadCorpus();
const entries = await fetchAllEntries();
console.log(`\nFetched ${entries.length} source entries. Authoring + verifying…\n`);

let kept = 0;
let rejected = 0;
for (const entry of entries) {
  try {
    const authored = await authorCard(entry);
    if (!authored) continue;

    if (isDuplicate(authored.card, corpus)) {
      rejected++;
      console.log(`  ↩︎ dup: ${String(authored.card.q).slice(0, 60)}`);
      continue;
    }

    const verdicts = await verifyClaims(authored.card, authored.claims, entry.text);
    const gate = hardGate({ claims: authored.claims, verdicts, sourceText: entry.text });
    if (!gate.ok) {
      rejected++;
      console.log(`  ✗ rejected: ${String(authored.card.q).slice(0, 60)}\n      ${gate.reasons.join('; ')}`);
      continue;
    }

    const card = assignDefaults(authored.card, { origin: 'auto' });
    const v = validateCard(card);
    if (!v.ok) {
      rejected++;
      console.log(`  ✗ invalid: ${v.errors.join(', ')}`);
      continue;
    }
    writeDraft(card);
    corpus.add(String(card.q).toLowerCase());
    kept++;
    console.log(`  ✓ draft: [${card.tool}] ${String(card.q).slice(0, 60)}`);
  } catch (err) {
    rejected++;
    console.warn(`  ! error on ${entry.url}: ${err.message}`);
  }
}

console.log(`\nDone. ${kept} auto-draft(s) written, ${rejected} rejected/skipped.`);
console.log('Review + publish with:  node publish.mjs\n');
