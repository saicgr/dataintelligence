# ByteShards content tooling — "stay current"

Manual-first. You author cards by hand and publish on your schedule; automation is optional and never auto-publishes.

```
npm install                # once (installs @anthropic-ai/sdk, @supabase/supabase-js)
node add.mjs               # add a card (YouTube video, found question, a launch) → drafts/
node dedup.mjs "<q>"       # check a question against the whole corpus before adding (no dupes)
node publish.mjs           # review the queue (dry run)
node preview.mjs           # SEE the drafts in the app over localhost — nothing archived/published
node publish.mjs --yes     # assemble out/fresh-vN.json + manifest.json and upload (go live, OTA)
```

## Flow

1. **Author (you):** `node add.mjs` prompts for the card + a source URL → writes `drafts/<id>.json` (`origin:"manual"`). Or drop a JSON file into `drafts/` yourself.
2. **(Optional) Auto candidates:** `ANTHROPIC_API_KEY=… node run.mjs` fetches curated changelogs (Spark/AWS/Anthropic/OpenAI/Databricks…), authors cards **extractively**, verifies every model name / GA-vs-preview / number / price against the source (separate adversarial call + a deterministic `includes()` backstop), dedupes vs the shipped 302, and writes survivors into the **same** `drafts/` queue as `origin:"auto"`. It never publishes.
3. **Preview (you):** `node preview.mjs` is one command — it assembles the SAME merged set publish would, serves it locally, **boots the web app wired to it on its own port (8090, so it won't clash with a dev server on 8081), and opens your browser to it.** No `.env` edits. The new cards appear in Stay current + their tracks, exactly as they'll ship; your drafts stay untouched and nothing is published. `Ctrl-C` stops both the app and the content server. (`--no-app` serves content only, for iOS sim / a device / Android emulator — then point `EXPO_PUBLIC_CONTENT_MANIFEST_URL` at `http://localhost:4555/manifest.json`, or `http://10.0.2.2:4555/...` on Android, yourself.)
4. **Review + publish (you):** `node publish.mjs` lists every pending draft with provenance + warnings (dry run). `--yes` merges them over the last published set, drops expired (`verifyBy`) cards, writes `out/fresh-vN.json` + `out/manifest.json`, uploads to Supabase Storage, and archives the drafts. Run it **immediately** for a single find or **weekly** for a batch — your call.

Manual cards are trusted as authored (you're the verifier). Only `origin:"auto"` cards face the strict machine gate.

## Publishing target

`publish.mjs --yes` uploads to a **public-read** Supabase Storage bucket `content` (fresh file first, `manifest.json` last). Set, in this folder's environment only (NEVER in `mobile/.env` / `EXPO_PUBLIC_*`):

```
SUPABASE_URL=...                 # your project url
SUPABASE_SERVICE_ROLE_KEY=...    # SERVER-ONLY secret — do not commit, do not expose to the app
```

Without those it writes `out/` locally and prints manual-upload instructions. After the first publish, set `EXPO_PUBLIC_CONTENT_MANIFEST_URL` in `mobile/.env` to the public `manifest.json` URL — the app version-checks it on launch (`mobile/src/lib/contentSync.ts`) and delivers new cards over-the-air, no app-store release.

## Notes
- `verifyBy` defaults to +90 days so stale facts auto-retire (`liveFresh` in the app).
- The `FreshCard` shape is canonical in `mobile/src/lib/fresh.ts` — keep `shared.mjs` validation in sync.
- Scrape sources (OpenAI/Databricks/etc.) are best-effort; a broken selector warns and is skipped, never failing a run.
