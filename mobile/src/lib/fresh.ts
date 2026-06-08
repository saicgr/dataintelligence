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
  {
    id: 'fresh-claude-opus-4-5',
    tk: 'rag',
    tool: 'Anthropic',
    domain: 'ai',
    q: 'Claude Opus 4.5 shipped with an "effort" parameter. What is it, and how does it change how you call the model?',
    a: 'Opus 4.5 (Nov 24, 2025) was the first model to clear 80% on SWE-bench Verified, and it added an effort parameter that lets you dial how much the model "works" on a request. The lever matters more than the benchmark: at medium effort Opus 4.5 matches Sonnet 4.5\'s best SWE-bench score while using ~76% fewer output tokens. So effort is a cost/quality knob — turn it down for cheap, fast, good-enough agentic steps and up only for the hard ones — not a quality switch you leave maxed. Pricing landed at $5 / $25 per million input/output tokens. Treat effort like a per-call budget, and reserve high effort for genuinely hard reasoning.',
    fj: 'Set effort to max so the answers are always best.',
    fs: 'Effort is a cost/latency knob — medium often matches a smaller model\'s top score at ~76% fewer output tokens; reserve high for the hard calls.',
    sourceUrl: 'https://www.anthropic.com/news/claude-opus-4-5',
    sourceLabel: 'Anthropic — Claude Opus 4.5',
    publishedAt: '2025-11-24',
    verifyBy: '2026-08-24',
    track: 'llms',
  },
  {
    id: 'fresh-gpt-5-1-adaptive-reasoning',
    tk: 'rag',
    tool: 'OpenAI',
    domain: 'ai',
    q: 'GPT-5.1 added "adaptive reasoning." What does that change for how you spend tokens on an API call?',
    a: 'GPT-5.1 (API, Nov 2025) lets the model decide how much to think per request: GPT-5.1 Instant can choose to reason on harder prompts and answer fast on easy ones, and the Thinking variant scales its own effort to query complexity (it also gained an "xhigh" effort tier above high). The point for builders: you no longer have to globally pin a reasoning level and overpay on trivial calls or underthink hard ones — the model right-sizes per turn. You still cap the ceiling with the effort parameter for latency-sensitive or cost-bounded paths. Set the ceiling deliberately; let adaptation handle the variance underneath it.',
    fj: 'Adaptive reasoning means I can stop setting a reasoning effort at all.',
    fs: 'It right-sizes thinking per turn, but you still set the effort ceiling — pin it low for latency/cost-bound paths, raise it only where depth pays.',
    sourceUrl: 'https://www.infoq.com/news/2025/12/openai-gpt-51/',
    sourceLabel: 'InfoQ — OpenAI GPT-5.1',
    publishedAt: '2025-11-13',
    verifyBy: '2026-08-13',
    track: 'llms',
  },
  {
    id: 'fresh-bedrock-agentcore-ga',
    tk: 'sql',
    tool: 'AWS',
    domain: 'ai',
    q: 'Amazon Bedrock AgentCore is GA. What is it, and which piece do you actually need first?',
    a: 'AgentCore (GA Oct 13, 2025) is AWS\'s managed runtime + services for running agents in production, framework- and model-agnostic. It is a set of independent services — Runtime, Memory, Identity, Gateway, and Observability — that you adopt à la carte, not a monolith. Runtime gives session isolation and long execution windows (up to 8 hours) for agents that wait on tools/humans; Gateway turns APIs into agent-callable tools; Identity handles delegated auth to downstream systems; Memory persists context across sessions; Observability traces the agent\'s steps. The trap is treating it as one product: most teams start with Runtime (where the agent executes) and add the others only as concrete needs (auth, memory, tracing) appear.',
    fj: 'AgentCore is one big agent product I turn on.',
    fs: 'It\'s five independent services — start with Runtime for execution/session isolation, then add Gateway/Identity/Memory/Observability as real needs appear.',
    sourceUrl: 'https://aws.amazon.com/about-aws/whats-new/2025/10/amazon-bedrock-agentcore-available/',
    sourceLabel: 'AWS — Bedrock AgentCore GA',
    publishedAt: '2025-10-13',
    verifyBy: '2026-08-13',
    track: 'bedrock',
  },
  {
    id: 'fresh-gemini-3-pro-vertex',
    tk: 'rag',
    tool: 'Google Vertex AI',
    domain: 'ai',
    q: 'Gemini 3 Pro is on Vertex AI with a ~1M-token context window. When does that big window actually help — and when does it bite you?',
    a: 'Gemini 3 Pro (announced Nov 18, 2025; available on Vertex AI) is Google\'s flagship multimodal model: text, images, video, audio and PDF input, a context window up to 1,048,576 tokens, and output capped at 65,536 tokens. The 1M window is the headline, but stuffing it is the junior move: huge contexts raise cost and latency on every call and can dilute attention (relevant facts get lost among filler). Use the long window for genuinely large single artifacts — a whole codebase, a long video, a big contract — where chunking would lose cross-references. For knowledge bases that change, retrieval (RAG) is still cheaper and fresher than re-sending everything. Reach for the big window when the task needs the whole artifact at once, not as a substitute for retrieval.',
    fj: 'A 1M-token window means I can just dump everything in the prompt.',
    fs: 'Big context costs latency/$ per call and can dilute attention — use it for one large artifact that needs whole-document reasoning; keep RAG for changing knowledge.',
    sourceUrl: 'https://blog.google/products/gemini/gemini-3/',
    sourceLabel: 'Google — Gemini 3',
    publishedAt: '2025-11-18',
    verifyBy: '2026-08-18',
    track: 'vertex-ai',
  },
  {
    id: 'fresh-mcp-standard',
    tk: 'rag',
    tool: 'Anthropic',
    domain: 'ai',
    q: 'The Model Context Protocol (MCP) is now an industry standard. What problem does it solve, and what does adopting it change in your architecture?',
    a: 'MCP (open-sourced by Anthropic Nov 25, 2024) is an open protocol that standardizes how AI apps connect to tools and data sources — one client/server contract instead of a bespoke connector per model × per tool. It attacks the "N×M" integration problem: instead of writing custom glue for every model-to-tool pair, a tool exposes one MCP server and any MCP-capable client (Claude, IDEs, agents) can call it. What it changes architecturally: tools/data live behind reusable MCP servers you can swap models against, and your agent code talks one protocol. It is plumbing, not intelligence — MCP standardizes the wiring and access; you still own auth scoping, what each server is allowed to touch, and the prompts that decide when to call a tool.',
    fj: 'MCP is an Anthropic feature that makes the model smarter.',
    fs: 'It\'s an open wiring standard that kills the N×M connector problem — reusable tool servers any client calls; you still own auth scope and tool-use logic.',
    sourceUrl: 'https://www.anthropic.com/news/model-context-protocol',
    sourceLabel: 'Anthropic — Model Context Protocol',
    publishedAt: '2024-11-25',
    verifyBy: '2026-09-01',
    track: 'rag',
  },
  {
    id: 'fresh-snowflake-cortex-aisql-ga',
    tk: 'sql',
    tool: 'Snowflake',
    domain: 'de',
    q: 'Snowflake Cortex AI SQL functions (AI_CLASSIFY, AI_EXTRACT, AI_TRANSCRIBE...) are GA. What changes about where you run AI over your data?',
    a: 'On Nov 4, 2025 Snowflake took a batch of Cortex AI SQL functions GA — including AI_CLASSIFY (label text/images), AI_EMBED (embeddings), AI_SIMILARITY, and AI_TRANSCRIBE (audio/video → text), alongside already-GA AI_EXTRACT, AI_TRANSLATE and AI_SENTIMENT. The shift: you call models from inside SQL, right next to the governed data, instead of exporting rows to an external service and re-importing results. That removes data movement, keeps governance/lineage in one place, and lets analysts use AI without a Python pipeline. The trade-off is you\'re running per-row inference inside the warehouse — fine for batch enrichment and classification, but watch cost on huge tables and latency for anything interactive; it is not a swap for a low-latency online serving path.',
    fj: 'Now I run all my AI inference inside Snowflake SQL.',
    fs: 'Great for governed in-place batch enrichment (no data export), but per-row inference costs add up on big tables — it\'s not an online low-latency serving layer.',
    sourceUrl: 'https://docs.snowflake.com/en/release-notes/2025/other/2025-11-04-cortex-aisql-operators-ga',
    sourceLabel: 'Snowflake — Cortex AI Functions GA',
    publishedAt: '2025-11-04',
    verifyBy: '2026-08-04',
    track: 'cortex',
  },
  {
    id: 'fresh-uc-managed-iceberg-ga',
    tk: 'spark',
    tool: 'Databricks',
    domain: 'de',
    q: 'Databricks Unity Catalog managed Apache Iceberg tables are GA. What does "any engine can read AND write" actually unlock?',
    a: 'Unity Catalog managed Iceberg tables are GA: you create Iceberg tables governed by UC and expose them through the Iceberg REST Catalog (IRC), so external engines — Spark, Trino, DuckDB, Snowflake, Dremio — can read and write the same tables (write via IRC moved past preview) while Databricks still runs Predictive Optimization and Liquid Clustering on them. The unlock is breaking format/catalog lock-in: one governed copy of the data, many compute engines, no copy-per-tool ETL. The senior caveat: multi-engine write means you must agree on one catalog as the source of truth for commits and governance, or concurrent writers from different engines create conflicts and split-brain metadata. Pick the system of record first; "open" doesn\'t mean "no coordination."',
    fj: 'Now every engine can write the same tables, so I don\'t need a single catalog anymore.',
    fs: 'Open IRC read/write removes copy-per-tool ETL, but multi-engine writes demand ONE catalog as the commit/governance source of truth or you get conflicting writers.',
    sourceUrl: 'https://www.databricks.com/blog/announcing-full-apache-iceberg-support-databricks',
    sourceLabel: 'Databricks — Full Apache Iceberg support',
    publishedAt: '2025-11-10',
    verifyBy: '2026-08-10',
    track: 'databricks',
  },
  {
    id: 'fresh-lakeflow-declarative-pipelines',
    tk: 'spark',
    tool: 'Databricks',
    domain: 'de',
    q: 'DLT is now "Lakeflow Declarative Pipelines" and the core was contributed to Apache Spark. What is the real change for a data engineer?',
    a: 'At Data + AI Summit 2025 Databricks rebranded DLT to Lakeflow Declarative Pipelines (same engine, backward compatible) and contributed the declarative-pipeline core to open-source Apache Spark as Spark Declarative Pipelines. The substance: the declarative model — you define WHAT each table is (a query + expectations) and the engine figures out dependency order, incremental refresh, and recovery — now extends from single queries to whole pipelines, and lives in OSS Spark, not just Databricks. For a data engineer this reframes the skill from writing orchestration (DAG wiring, retries, backfills) to declaring datasets and data-quality expectations. The catch: declarative removes boilerplate but not understanding — you still reason about incremental vs full refresh, expectation handling (drop/fail/warn), and cost; the engine automates execution, not your data modeling.',
    fj: 'It\'s just a rename of DLT, nothing to learn.',
    fs: 'The declarative model (define WHAT, engine handles order/incremental/recovery) is now in OSS Spark — the skill shifts from wiring DAGs to declaring datasets + quality expectations.',
    sourceUrl: 'https://www.databricks.com/blog/whats-new-lakeflow-declarative-pipelines-july-2025',
    sourceLabel: 'Databricks — Lakeflow Declarative Pipelines',
    publishedAt: '2025-07-15',
    verifyBy: '2026-09-01',
    track: 'databricks',
  },
  {
    id: 'fresh-snowflake-openflow-ga',
    tk: 'sql',
    tool: 'Snowflake',
    domain: 'de',
    q: 'Snowflake Openflow (managed ingestion built on Apache NiFi) is GA. Where does it fit in your data movement stack?',
    a: 'Openflow (announced at Snowflake Summit 2025, June 3) is a managed, multi-modal ingestion service built on Apache NiFi: hundreds of processors to connect arbitrary sources (DB CDC, Kafka streams, files, even unstructured text/images/audio) into Snowflake, deployable BYOC in your own cloud. Paired with the new Snowpipe Streaming architecture it advertises high-throughput streaming with data queryable seconds after ingest. Where it fits: it\'s the "E" and "L" — landing data into Snowflake — not transformation; you still model and transform with SQL / dbt / Lakeflow-style logic downstream. The senior read: it competes with Fivetran/custom NiFi for getting data IN, and choosing it is about consolidating ingestion under Snowflake governance, not about replacing your transformation layer.',
    fj: 'Openflow is an all-in-one ETL tool that replaces my transformations too.',
    fs: 'It\'s managed ingestion (the E+L, NiFi-based) landing data into Snowflake — you still transform downstream; the win is consolidating ingest under one governance plane.',
    sourceUrl: 'https://www.snowflake.com/en/product/features/openflow/',
    sourceLabel: 'Snowflake — Openflow',
    publishedAt: '2025-06-03',
    verifyBy: '2026-09-01',
    track: 'snowflake',
  },
  {
    id: 'fresh-microsoft-foundry-rebrand',
    tk: 'rag',
    tool: 'Azure AI',
    domain: 'ai',
    q: 'Azure AI Foundry is now "Microsoft Foundry" with a unified multi-model endpoint. What does the unified endpoint actually buy you?',
    a: 'At Ignite (Nov 18, 2025) Microsoft rebranded Azure AI Foundry to Microsoft Foundry and centered it on agents, unifying models, tools and governance under one resource provider with consistent RBAC/networking/policy. The concrete piece worth knowing: a unified endpoint that fronts 11,000+ models with automated routing to the best/cheapest model per task. The benefit is one integration surface plus the option to route by cost/quality instead of hard-coding a model. The senior caution: automated model routing is great for cost, but it makes outputs non-deterministic across requests and complicates evals, prompt tuning, and reproducibility — so pin a specific model for anything you must test, audit, or guarantee, and let routing optimize only the tolerant paths.',
    fj: 'Turn on auto-routing everywhere so it always picks the cheapest model.',
    fs: 'Routing cuts cost but breaks determinism/eval reproducibility — pin a fixed model for audited/tested paths, let routing optimize only the tolerant ones.',
    sourceUrl: 'https://devblogs.microsoft.com/foundry/whats-new-in-microsoft-foundry-oct-nov-2025/',
    sourceLabel: 'Microsoft Foundry — What\'s new',
    publishedAt: '2025-11-18',
    verifyBy: '2026-08-18',
    track: 'azure-ai',
  },
  {
    id: 'fresh-opus-4-5-context-compaction',
    tk: 'rag',
    tool: 'Anthropic',
    domain: 'ai',
    q: 'Claude Opus 4.5 added context compaction and memory for agents. What problem do these solve in a long-running agent?',
    a: 'Alongside Opus 4.5, Anthropic shipped agent-side improvements — context compaction and memory tools — that target the failure mode of long agentic runs: the context window fills with stale tool output and history until the agent loses the thread or hits the limit. Compaction summarizes/condenses earlier context so the agent keeps the salient state without carrying every raw token; memory persists facts across the run (and sessions). Anthropic reported these techniques combined gave roughly a 15% lift on agentic tasks. The reframe: a long agent\'s bottleneck is usually context management, not raw model IQ — what you keep, summarize, and forget. These are levers to manage the window deliberately; they don\'t remove the need to decide what state actually matters.',
    fj: 'A smarter model means my long agent runs just work without managing context.',
    fs: 'Long-run failures are usually context management, not model IQ — compaction/memory let you keep salient state and drop noise (~15% agentic lift), but you still decide what matters.',
    sourceUrl: 'https://www.anthropic.com/news/claude-opus-4-5',
    sourceLabel: 'Anthropic — Claude Opus 4.5',
    publishedAt: '2025-11-24',
    verifyBy: '2026-08-24',
    track: 'llms',
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
    level: 'Sr', // fresh "stay-current" cards are advanced by nature
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
