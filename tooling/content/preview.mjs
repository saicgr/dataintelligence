#!/usr/bin/env node
// Preview this week's pending drafts IN THE APP before you publish — no upload, no archive, no real
// version bump. It assembles the SAME merged set publish.mjs would (drafts merged over the last
// published set), serves it on localhost, AND boots the web app already wired to it — so you just open
// ONE url to validate the content + the app. Your drafts stay in drafts/ untouched.
//
//   node tooling/content/preview.mjs              # serve content + auto-launch the web app
//   node tooling/content/preview.mjs --no-app     # only serve content (you run the app yourself / iOS)
//   PORT=5000 node tooling/content/preview.mjs     # custom content-server port
//
// When the cards look right, ship for real:  node publish.mjs --yes
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OUT_DIR,
  readDrafts,
  readJSON,
  readLessonDrafts,
  validateCard,
  validateLesson,
} from './shared.mjs';

const PORT = Number(process.env.PORT) || 4555; // content server
const APP_PORT = Number(process.env.APP_PORT) || 8090; // dedicated app port (avoids your existing :8081 dev server)
const LAUNCH_APP = !process.argv.includes('--no-app');
const MOBILE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile');
const PREVIEW_DIR = join(OUT_DIR, 'preview');
if (!existsSync(PREVIEW_DIR)) mkdirSync(PREVIEW_DIR, { recursive: true });

const freshDrafts = readDrafts();
const lessonDrafts = readLessonDrafts();
if (!freshDrafts.length && !lessonDrafts.length) {
  console.log('No drafts to preview. Add content first (the content-ingestor agent or node add.mjs).');
  process.exit(0);
}

// same validation gate as publish — never preview an invalid card
let blocked = 0;
for (const { card } of freshDrafts) {
  const r = validateCard(card);
  if (!r.ok) { blocked++; console.error(`✗ fresh ${card.id}: ${r.errors.join(', ')}`); }
}
for (const { card } of lessonDrafts) {
  const r = validateLesson(card);
  if (!r.ok) { blocked++; console.error(`✗ lesson ${card.id}: ${r.errors.join(', ')}`); }
}
if (blocked) {
  console.error(`\n${blocked} invalid draft(s) — fix before previewing.`);
  process.exit(1);
}

// assemble = mirror of publish.mjs, but isolated to out/preview/ and with NO archive / NO upload.
const now = Date.now();
const prodManifest = readJSON(join(OUT_DIR, 'manifest.json'), { version: 0 });
const prevVersion = Number(prodManifest.version) || 0;
const version = now; // always newer than any cached version → the app refetches on every preview run
const mergeById = (prev, drafts, keep) => {
  const byId = new Map(prev.map((c) => [c.id, c]));
  for (const { card } of drafts) {
    const c = { ...card };
    delete c._warnings;
    byId.set(c.id, c);
  }
  return [...byId.values()].filter(keep);
};
const prevFresh = readJSON(join(OUT_DIR, `fresh-v${prevVersion}.json`), []);
const prevLessons = readJSON(join(OUT_DIR, `lessons-v${prevVersion}.json`), []);
const mergedFresh = mergeById(prevFresh, freshDrafts, (c) => Date.parse(c.verifyBy) > now);
const mergedLessons = mergeById(prevLessons, lessonDrafts, (c) => !c.verifyBy || Date.parse(c.verifyBy) > now);

const base = `http://localhost:${PORT}`;
const manifest = {
  version,
  freshUrl: mergedFresh.length ? `${base}/fresh.json` : '',
  lessonsUrl: mergedLessons.length ? `${base}/lessons.json` : '',
};
writeFileSync(join(PREVIEW_DIR, 'fresh.json'), JSON.stringify(mergedFresh));
writeFileSync(join(PREVIEW_DIR, 'lessons.json'), JSON.stringify(mergedLessons));
writeFileSync(join(PREVIEW_DIR, 'manifest.json'), JSON.stringify(manifest));

const TYPES = { '.json': 'application/json' };
const server = createServer((req, res) => {
  const name = (req.url || '/').split('?')[0].replace(/^\//, '') || 'manifest.json';
  const file = join(PREVIEW_DIR, name);
  res.setHeader('Access-Control-Allow-Origin', '*'); // web app fetches cross-origin from the dev server
  res.setHeader('Cache-Control', 'no-store');
  if (!file.startsWith(PREVIEW_DIR) || !existsSync(file)) {
    res.statusCode = 404;
    return res.end('not found');
  }
  res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});

let appProc = null;
function shutdown() {
  if (appProc) appProc.kill('SIGINT');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`\n📋 Previewing ${mergedFresh.length} fresh + ${mergedLessons.length} lesson card(s) (incl. this week's drafts).`);
  console.log('   Drafts are NOT archived and the real version is NOT bumped.\n');

  if (!LAUNCH_APP) {
    // content-only mode: print the manual wiring (e.g. for iOS sim / a device / Android emulator)
    console.log(`   Content server:  ${base}/manifest.json`);
    console.log(`   Point EXPO_PUBLIC_CONTENT_MANIFEST_URL at it in mobile/.env, then run the app yourself.`);
    console.log(`   (Android emulator: use http://10.0.2.2:${PORT}/manifest.json instead of localhost.)`);
    console.log('\n   Happy with the cards?  →  node tooling/content/publish.mjs --yes');
    console.log('   Ctrl-C to stop.\n');
    return;
  }

  // Boot the web app on a DEDICATED port with the manifest URL injected — no .env edit, and no clash
  // with any dev server you already have on :8081. Expo inlines EXPO_PUBLIC_* from the environment and
  // won't override a value already set in process.env. An explicit --port avoids the "port busy?" prompt.
  console.log('   🚀 Starting the web app wired to your draft content… (first build can take ~30–60s)\n');
  console.log(`   👉 When it's ready, open:  http://localhost:${APP_PORT}`);
  console.log('      Your new cards are in "Stay current" and inside their tracks. (Browser may open automatically.)');
  console.log('\n   Happy with them?  →  node tooling/content/publish.mjs --yes');
  console.log('   Ctrl-C to stop BOTH the app and this content server.\n');

  appProc = spawn('npm', ['run', 'web', '--', '--port', String(APP_PORT)], {
    cwd: MOBILE_DIR,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_CONTENT_MANIFEST_URL: `${base}/manifest.json`, BROWSER: 'none' },
  });
  appProc.on('exit', (code) => {
    console.log(`\n   Web app exited (${code ?? 0}). Stopping content server.`);
    shutdown();
  });

  // Poll the app port; the moment it answers, open the browser for the founder (true "just a URL").
  const appUrl = `http://localhost:${APP_PORT}`;
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  let opened = false;
  const deadline = Date.now() + 150_000;
  const poll = setInterval(async () => {
    if (opened || Date.now() > deadline) return clearInterval(poll);
    try {
      const r = await fetch(appUrl, { method: 'HEAD' });
      if (r.ok || r.status >= 200) {
        opened = true;
        clearInterval(poll);
        console.log(`\n   ✅ App is ready — opening ${appUrl} …`);
        spawn(opener, [appUrl], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref();
      }
    } catch {
      /* not up yet — keep polling */
    }
  }, 2000);
});
