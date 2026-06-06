import type { CodePanel, SessionCard } from './content';
import type { TrackColorKey } from './theme';

/**
 * Pillar 2 — "Stay current".
 *
 * A retention engine, NOT a feed reader. Each fresh card uses the same
 * junior-trap / senior-correct schema as the core deck, PLUS a required source
 * URL and a verify-by date so stale facts retire instead of resurfacing.
 *
 * Delivery (answers "how does the app know about new content?"):
 *  - FRESH_SEED below is BUNDLED in the binary (works offline, day one).
 *  - contentSync.ts checks a remote manifest's version on launch; when it's
 *    newer it downloads the new card set, caches it (AsyncStorage), and calls
 *    setExtraFresh(). allFresh() merges remote-over-bundled. No app-store
 *    release needed — author cards, bump the manifest version, publish.
 */
export interface FreshCard {
  id: string;
  tk: TrackColorKey;
  tool: string; // vendor/source label, e.g. "Anthropic", "AWS", "OpenAI"
  domain: 'ai' | 'de';
  q: string; // names the SPECIFIC release + teaches it: "X shipped — what is it / when do you use it?"
  a: string; // what it IS, how it works, and the key trade-off — teach the thing (not "should you adopt it")
  fj: string; // junior tell (the naive read)
  fs: string; // senior tell (the framing)
  code?: CodePanel[]; // optional snippet(s) — e.g. show the new command / API usage being taught
  sourceUrl: string; // REQUIRED — official source
  sourceLabel: string;
  publishedAt: string; // ISO date
  verifyBy: string; // ISO date — re-verify or retire after this
  track?: string; // track SLUG (e.g. 'vectordb', 'llms') — when set, this card also lives INSIDE that track's lessons/Path. tk is only a color, so routing needs an explicit slug.
  packId?: string; // if set, this card belongs to a paid one-off pack (free when unset)
  origin?: 'manual' | 'auto'; // provenance: founder-authored vs machine-drafted
}

const FRESH_DAY = 86_400_000;
/** A fresh card only claims "this week" while it's genuinely recent; older ones drop the time clause
 *  so an evergreen, track-resident card doesn't keep lying that it's this week's news. */
const freshTag = (publishedAt: string, now: number): string =>
  Date.parse(publishedAt) > now - 10 * FRESH_DAY ? '🆕 Stay current · this week' : '🆕 Stay current';

/**
 * Bundled "This Week" seed. Illustrative, source-linked, dated. The pipeline
 * (question-author → answer-verifier against the cited URL) regenerates these.
 * Keep claims conservative; the verify step is what makes a freshness product safe.
 */
export const FRESH_SEED: FreshCard[] = [
  {
    id: 'fresh-s3-vectors',
    tk: 'sql',
    tool: 'AWS',
    domain: 'ai',
    q: 'Amazon S3 Vectors is GA. When would you reach for it — and when not?',
    a: 'S3 Vectors adds native vector storage + similarity query to S3 at object-store cost, aimed at very large, cost-sensitive, latency-tolerant retrieval. The takeaway: great for huge archival/embedding sets where $/GB dominates and you can tolerate higher query latency; a dedicated vector DB still wins for low-latency, high-QPS, hybrid (BM25+vector) and heavily-filtered search. Choose on your latency budget and query complexity, not hype.',
    fj: 'It replaces my vector database.',
    fs: 'It complements one — cheap large-scale retrieval, but a real vector DB still wins on low-latency, high-QPS, hybrid + filtered search.',
    sourceUrl: 'https://aws.amazon.com/s3/features/vectors/',
    sourceLabel: 'AWS S3 Vectors',
    publishedAt: '2026-05-20',
    verifyBy: '2026-09-01',
    track: 'vectordb',
  },
  {
    id: 'fresh-anthropic-prompt-caching',
    tk: 'rag',
    tool: 'Anthropic',
    domain: 'ai',
    q: 'Anthropic prompt caching is GA. What is it, and when does it actually cut cost and latency?',
    a: 'Prompt caching lets you mark a stable prefix of the prompt — long system instructions, tool definitions, a big reference doc, or few-shot examples — so the model reuses the cached representation on later calls instead of re-processing it. Cache reads are far cheaper and faster than normal input tokens, with a short time-to-live. It pays off when a large static chunk is reused across many requests and only a small dynamic part (the user turn) changes — so structure the prompt static-first, variable-last to keep the prefix identical. It does nothing if your prefix changes every call (e.g. a timestamp before the cached part): you pay the write premium for zero hits.',
    fj: 'It caches the answers, so repeated questions are free.',
    fs: 'It caches the static PREFIX (system/tools/context), not answers — order static-first, variable-last; only a reused prefix pays off.',
    sourceUrl: 'https://docs.claude.com/en/docs/build-with-claude/prompt-caching',
    sourceLabel: 'Anthropic prompt caching',
    publishedAt: '2026-05-28',
    verifyBy: '2026-12-01',
    track: 'llms',
  },
  {
    id: 'fresh-openai-structured-outputs',
    tk: 'rag',
    tool: 'OpenAI',
    domain: 'ai',
    q: 'OpenAI Structured Outputs enforces a JSON Schema on responses. What does it guarantee — and what doesn\'t it?',
    a: 'Structured Outputs constrains the model\'s decoding to a JSON Schema you supply (strict mode), so the response is guaranteed to parse and match the shape and types — no more "please return JSON" plus regex cleanup. It guarantees the STRUCTURE: valid JSON, required fields present, and enum membership when you specify it — which kills format-drift bugs in extraction and tool-calling pipelines. It does NOT guarantee the VALUES are correct: the model can still place a wrong-but-schema-valid answer in a field, so you still validate semantics and handle refusals. Enforce the contract at decode time, and still validate on the way out.',
    fj: 'It makes the model\'s answers correct.',
    fs: 'It guarantees the JSON shape/enums, not that the values are right — enforce at decode, then still validate the meaning.',
    sourceUrl: 'https://platform.openai.com/docs/guides/structured-outputs',
    sourceLabel: 'OpenAI Structured Outputs',
    publishedAt: '2026-05-30',
    verifyBy: '2026-12-01',
    track: 'llms',
  },
  {
    id: 'fresh-databricks-lakebase',
    tk: 'spark',
    tool: 'Databricks',
    domain: 'de',
    q: 'Databricks Lakebase puts a managed Postgres (OLTP) inside the lakehouse. What is it — and when does it beat a separate operational database?',
    a: 'Lakebase is a serverless Postgres database, managed by Databricks and integrated with the lakehouse: standard Postgres for transactional / serving workloads (app state, feature serving, low-latency lookups) sitting next to your analytical tables, with separated storage and compute and instant branching for dev/test. Reach for it when your operational state lives right beside analytics and you want to avoid ETL round-trips to an external DB and a second vendor. Stay on a dedicated/external Postgres when you already run a mature OLTP fleet, need specific extensions/tuning, or want to avoid lakehouse lock-in. It is OLTP convenience next to your analytics — not a swap for your warehouse, and not a high-scale standalone transactional system.',
    fj: 'It replaces our analytics warehouse.',
    fs: 'It\'s OLTP Postgres beside the lakehouse — great for serving/state next to analytics, not a swap for the warehouse or a high-scale standalone OLTP DB.',
    sourceUrl: 'https://www.databricks.com/product/lakebase',
    sourceLabel: 'Databricks Lakebase',
    publishedAt: '2026-05-22',
    verifyBy: '2026-12-01',
    track: 'databricks',
  },
];

/** Remote/OTA-delivered fresh cards merged at runtime (set by contentSync.ts). */
let extraFresh: FreshCard[] = [];
export function setExtraFresh(cards: FreshCard[]): void {
  extraFresh = cards;
}

/** Remote-over-bundled, deduped by id. */
export function allFresh(): FreshCard[] {
  const seen = new Set<string>();
  const out: FreshCard[] = [];
  for (const c of [...extraFresh, ...FRESH_SEED]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

/** Non-expired fresh cards (verify-by in the future), newest first. */
export function liveFresh(now: number): FreshCard[] {
  return allFresh()
    .filter((c) => Date.parse(c.verifyBy) > now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

function toCard(c: FreshCard, now: number): SessionCard {
  return {
    id: c.id, // STABLE id — preserved on every surface (track + aggregate) so progress/Save/Like unify.
    kind: 'flip',
    tk: c.tk,
    tool: c.tool,
    tag: freshTag(c.publishedAt, now),
    q: c.q,
    a: c.a,
    fj: c.fj,
    fs: c.fs,
    code: c.code,
    fresh: true,
    sourceUrl: c.sourceUrl,
    sourceLabel: c.sourceLabel,
    publishedAt: c.publishedAt,
    verifyBy: c.verifyBy,
    packId: c.packId,
  };
}

/** Free, in-deck fresh cards (no packId), filtered by domain, newest first. */
export function freshSessionCards(
  now: number,
  domain: 'ai' | 'de' | 'all',
  limit = Number.POSITIVE_INFINITY
): SessionCard[] {
  const live = liveFresh(now).filter(
    (c) => !c.packId && (domain === 'all' || c.domain === domain)
  );
  const capped = Number.isFinite(limit) ? live.slice(0, limit) : live;
  return capped.map((c) => toCard(c, now));
}

/** Free fresh cards bound to a specific track slug — appended to that track's bank so stay-current
 *  items live INSIDE the track (lessons/Path), not only in the aggregate "Stay current" session. */
export function freshForTrack(now: number, slug: string): SessionCard[] {
  return liveFresh(now)
    .filter((c) => c.track === slug && !c.packId)
    .map((c) => toCard(c, now));
}

export function freshCount(now: number, domain: 'ai' | 'de' | 'all'): number {
  return liveFresh(now).filter(
    (c) => !c.packId && (domain === 'all' || c.domain === domain)
  ).length;
}

/** Cards belonging to a specific paid pack (gated by ownership upstream). */
export function freshPackCards(now: number, packId: string): SessionCard[] {
  return liveFresh(now)
    .filter((c) => c.packId === packId)
    .map((c) => toCard(c, now));
}

export function freshPackCount(now: number, packId: string): number {
  return liveFresh(now).filter((c) => c.packId === packId).length;
}
