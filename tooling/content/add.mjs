#!/usr/bin/env node
// PRIMARY manual authoring path. Add a "stay current" card for anything you find —
// a YouTube video, a real interview question, a launch you noticed.
//   node add.mjs
// Writes a draft into drafts/ (origin:'manual'); review + ship it with `node publish.mjs`.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { assignDefaults, validateCard, writeDraft } from './shared.mjs';

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q, def) => {
  const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim();
  return a || def || '';
};

console.log('\n📝 New "stay current" card (manual). Source can be a YouTube URL, a docs page, anything.\n');

const tool = await ask('Tool/vendor label (e.g. AWS, Anthropic, Kafka)');
const domain = await ask('Domain — ai or de', 'ai');
const tk = await ask('Track color key (spark/kafka/rag/sql/dbt/sysd/eval)', 'rag');
const q = await ask('Question / hook ("X shipped — when would a senior reach for it?")');
const a = await ask('Answer (what shipped + why it matters + the senior takeaway)');
const fj = await ask('Junior tell (the naive read)');
const fs = await ask('Senior tell (the framing)');
const sourceUrl = await ask('Source URL (required)');
const sourceLabel = await ask('Source label', tool);
const packId = await ask('Pack id (optional — leave blank for free in-deck)');
const verifyDays = Number(await ask('Re-verify after N days', '90')) || 90;

rl.close();

const card = assignDefaults(
  { tool, domain, tk, q, a, fj, fs, sourceUrl, sourceLabel, ...(packId ? { packId } : {}) },
  { origin: 'manual', verifyDays }
);

const { ok, errors } = validateCard(card);
if (!ok) {
  console.error('\n❌ Not saved — fix:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
const path = writeDraft(card);
console.log(`\n✅ Draft saved: ${path}`);
console.log('   Review + publish with:  node publish.mjs\n');
