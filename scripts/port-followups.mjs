#!/usr/bin/env node
/**
 * Port web `followupChain` drill-downs into the mobile generated card bank.
 *
 * Source: lib/data/tools/<tool>.ts   (export const levels → authored[].followupChain)
 * Target: mobile/src/lib/generated/<track>.json  (adds card.followups = [{q,a}])
 *
 * Matches web questionText ↔ mobile card.q by normalized text, then high-overlap
 * fallback. Conservative: only attaches on exact-normalized or Jaccard ≥ 0.82.
 * Idempotent — re-running overwrites followups from the same source.
 *
 *   node scripts/port-followups.mjs           # apply
 *   node scripts/port-followups.mjs --dry      # report only, write nothing
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');

// web tool file (lib/data/tools/X.ts)  →  mobile track (generated/Y.json)
const MAP = {
  databricks: 'databricks', spark: 'spark', sql: 'sql', dbt: 'dbt', kafka: 'kafka',
  airflow: 'airflow', snowflake: 'snowflake', python: 'python', rag: 'rag',
  llms: 'llms', agents: 'agents', vectordb: 'vectordb',
  datamodeling: 'modeling', systemdesign: 'sysd',
};

const norm = (s) =>
  String(s).toLowerCase().replace(/`/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b);
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
};

// Load a web tool .ts module by transpiling types away, then eval in a sandbox.
function loadLevels(tool) {
  const src = readFileSync(join(ROOT, 'lib/data/tools', `${tool}.ts`), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  // type-only imports are erased by transpile; no real deps remain.
  new Function('exports', 'module', 'require', js)(module.exports, module, () => ({}));
  return module.exports.levels || {};
}

// Collect {q, followups:[{q,a}]} from every authored entry across all levels.
function webFollowups(tool) {
  const levels = loadLevels(tool);
  const out = [];
  for (const lvl of Object.values(levels)) {
    for (const entry of lvl?.authored ?? []) {
      const chain = entry?.followupChain;
      if (entry?.questionText && Array.isArray(chain) && chain.length) {
        out.push({
          q: entry.questionText,
          followups: chain
            .filter((f) => f?.question && f?.answer)
            .map((f) => ({ q: f.question, a: f.answer })),
        });
      }
    }
  }
  return out.filter((w) => w.followups.length);
}

let totals = { matched: 0, cardsWithFollowups: 0, webChains: 0, tracks: 0 };
const report = [];

for (const [tool, track] of Object.entries(MAP)) {
  const jsonPath = join(ROOT, 'mobile/src/lib/generated', `${track}.json`);
  if (!existsSync(jsonPath)) { report.push(`  ${track}: (no mobile json) — skipped`); continue; }

  const web = webFollowups(tool);
  const cards = JSON.parse(readFileSync(jsonPath, 'utf8'));
  totals.webChains += web.length;
  totals.tracks++;

  const usedWeb = new Set();
  let matched = 0;
  for (const card of cards) {
    if (!card?.q) continue;
    // best web question for this card
    let best = null, bestScore = 0, bestIdx = -1;
    web.forEach((w, wi) => {
      const s = norm(w.q) === norm(card.q) ? 1 : jaccard(w.q, card.q);
      if (s > bestScore) { bestScore = s; best = w; bestIdx = wi; }
    });
    if (best && bestScore >= 0.82) {
      card.followups = best.followups;
      usedWeb.add(bestIdx);
      matched++;
    }
  }

  const withF = cards.filter((c) => c.followups?.length).length;
  totals.matched += matched;
  totals.cardsWithFollowups += withF;
  if (!DRY) writeFileSync(jsonPath, JSON.stringify(cards, null, 2) + '\n');
  report.push(
    `  ${track.padEnd(12)} cards:${String(cards.length).padStart(3)}  matched:${String(matched).padStart(3)}` +
    `  web-chains:${String(web.length).padStart(3)} (used ${usedWeb.size})`
  );
}

console.log(`\n${DRY ? '[DRY RUN] ' : ''}Ported web followupChain → mobile generated cards\n`);
console.log(report.join('\n'));
console.log(
  `\nTOTAL: ${totals.matched} cards matched across ${totals.tracks} tracks ` +
  `(${totals.webChains} web chains available).`
);
console.log(
  `Tracks with NO web twin (need authoring): cortex, mosaic, bedrock, vertex-ai, azure-ai,\n` +
  `  behavioral, cicd, data-integration, docker, git, hex, kubernetes, leadership, looker,\n` +
  `  observability, palantir, tableau, terraform, apis, architecture, bi, databases,\n` +
  `  deep-learning, evals, mlsys, prompt, pyspark, security, statistics, typescript,\n` +
  `  aws, azure, gcp\n`
);
