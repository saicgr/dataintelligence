import type { ConvItem } from "./types";

/**
 * Incident Debugging — Platform / SRE role set. Production "you're on call, find
 * the root cause" scenarios. The candidate reads artifacts (logs/config/code),
 * may investigate with an in-browser SQL/Python console, asks the coach, then
 * submits a root-cause + fix that's graded. The diagnosed answer (root cause,
 * fix, red herrings, triage order, rubric, facts) lives server-side in
 * incident-sre.server.ts (resolved by problemId) and never ships to the client.
 *
 * Most SRE incidents are READ-ONLY: artifacts are LOGS (5xx rates, GC pauses,
 * OOM/restart events, rebalances), CONFIG (timeouts, pool sizes, retry/circuit
 * breaker settings, feature flags, cache TTLs) and CODE (the request handler /
 * retry logic / idempotency key generation). A few add a runnable DuckDB console
 * over a requests/metrics table.
 *
 * Tier spread: 1 standard, 3 hard, 3 hellish. Two items are free.
 */

// ───────────────────────── inc-sre-oom-restarts (hard) ─────────────────────────

const OOM_LOG = `[2026-05-28 02:00:11] checkout-svc-7f9  INFO   pod started, heap=512Mi limit=2Gi
[2026-05-28 03:41:50] checkout-svc-7f9  WARN   heap 1.6Gi / 2Gi (78%)
[2026-05-28 05:12:33] checkout-svc-7f9  WARN   heap 1.9Gi / 2Gi (95%)
[2026-05-28 05:18:02] kubelet           WARN   Memory cgroup out of memory: Killed process (checkout-svc)
[2026-05-28 05:18:02] kubelet           INFO   OOMKilled; restartCount=14; reason=OOMKilled
[2026-05-28 05:18:09] checkout-svc-7f9  INFO   pod started, heap=512Mi limit=2Gi
[2026-05-28 06:55:40] checkout-svc-7f9  WARN   heap 1.6Gi / 2Gi (78%)
[2026-05-28 07:02:18] db-pool           WARN   active=98/100 idle=0 wait_queue=42 (no connections returning)
[2026-05-28 08:31:55] kubelet           INFO   OOMKilled; restartCount=15; reason=OOMKilled
-- pattern: sawtooth heap, OOMKilled roughly every ~3h, restartCount climbing, db-pool slowly saturating
`;

const OOM_HANDLER = `// orderEnrichment.ts — called once per checkout request (hot path).
import { Pool } from "pg";

const pool = new Pool({ max: 100 });

// Process-lifetime cache of "country -> tax rules". Looks innocent: we never evict.
const taxRuleCache = new Map<string, TaxRules>();

export async function enrichOrder(req: OrderRequest): Promise<EnrichedOrder> {
  // BUG #1: key includes the full request (orderId + ts), so it's unique every call.
  const cacheKey = JSON.stringify({ country: req.country, req });
  if (!taxRuleCache.has(cacheKey)) {
    const client = await pool.connect();
    const rules = await loadTaxRules(client, req.country);
    taxRuleCache.set(cacheKey, rules); // grows forever, one entry per request
    // BUG #2: early return on the cache-miss path — client.release() never runs.
    return applyRules(req, rules);
  }
  const rules = taxRuleCache.get(cacheKey)!;
  const client = await pool.connect();
  const out = applyRules(req, rules);
  client.release();
  return out;
}
`;

// ───────────────────────── inc-sre-p99-spikes (hard) ─────────────────────────

const P99_GC_LOG = `# gc.log — G1GC, snippet around the latency spikes (heap 8Gi)
[2026-05-30T14:00:02] [GC pause (G1 Evacuation Pause) (young)] 18M->12M(8192M), 0.0121 secs
[2026-05-30T14:03:31] [GC pause (G1 Humongous Allocation)]     7100M->6980M(8192M), 0.9930 secs
[2026-05-30T14:03:33] [Full GC (Allocation Failure)]            6980M->5800M(8192M), 2.3400 secs
[2026-05-30T14:07:48] [GC pause (G1 Humongous Allocation)]     7050M->6900M(8192M), 1.1200 secs
[2026-05-30T14:07:50] [Full GC (Allocation Failure)]            6900M->5600M(8192M), 2.6100 secs
# note: full GCs (~2.5s STW) recur every few minutes; "Humongous Allocation" precedes each.
# Humongous = single allocation >= 1/2 region size; suggests a few very large objects/buffers.
`;

const P99_CONFIG = `# render-svc config (excerpt)
server:
  worker_threads: 16
report_export:
  # Some tenants request a full CSV export inline on the request thread.
  # No streaming — the whole result set is materialized into one byte[] before send.
  max_rows: 5_000_000
  stream: false          # <-- exports buffer entirely in memory
jvm:
  heap: 8g
  gc: G1GC
  # G1 region size auto = 4MB at this heap; a 30MB export buffer is a "humongous" object.
metrics:
  note: "p50 ~40ms steady. p99 spikes to 2-3s in bursts. error rate ~0. CPU ~45%."
`;

const P99_SETUP_SQL = `CREATE TABLE request_metrics (
  ts            TIMESTAMP,
  endpoint      VARCHAR,
  latency_ms    INTEGER,
  status        INTEGER
);
INSERT INTO request_metrics VALUES
  -- 14:02 minute: all small/fast (p50 path)
  (TIMESTAMP '2026-05-30 14:02:01', '/render', 38, 200),
  (TIMESTAMP '2026-05-30 14:02:05', '/render', 41, 200),
  (TIMESTAMP '2026-05-30 14:02:18', '/render', 36, 200),
  (TIMESTAMP '2026-05-30 14:02:44', '/render', 44, 200),
  (TIMESTAMP '2026-05-30 14:02:51', '/export', 39, 200),
  -- 14:03 minute: a couple of big /export calls cause a full GC; everything in the window stalls
  (TIMESTAMP '2026-05-30 14:03:30', '/export', 2510, 200),
  (TIMESTAMP '2026-05-30 14:03:31', '/render', 2480, 200),
  (TIMESTAMP '2026-05-30 14:03:31', '/render', 2495, 200),
  (TIMESTAMP '2026-05-30 14:03:32', '/render', 40, 200),
  (TIMESTAMP '2026-05-30 14:03:33', '/render', 39, 200),
  -- 14:07 minute: same pattern recurs with the next big export
  (TIMESTAMP '2026-05-30 14:07:48', '/export', 2660, 200),
  (TIMESTAMP '2026-05-30 14:07:49', '/render', 2600, 200),
  (TIMESTAMP '2026-05-30 14:07:50', '/render', 42, 200),
  (TIMESTAMP '2026-05-30 14:07:55', '/render', 37, 200),
  (TIMESTAMP '2026-05-30 14:08:10', '/render', 41, 200);
`;

// ───────────────────────── inc-sre-cache-stampede (hard) ─────────────────────────

const STAMPEDE_LOG = `[2026-05-29 12:00:00] catalog-svc   INFO   serving /catalog/hot-deals from redis (hit)
[2026-05-29 12:00:00] redis         INFO   key catalog:hot-deals EXPIRED (ttl 300s elapsed)
[2026-05-29 12:00:00] catalog-svc   WARN   cache MISS catalog:hot-deals (x1)
[2026-05-29 12:00:00] catalog-svc   WARN   cache MISS catalog:hot-deals (x812 in 200ms)  <-- every pod, same key, same instant
[2026-05-29 12:00:00] db-primary    WARN   connections 200/200 (saturated), 600 queued
[2026-05-29 12:00:01] db-primary    ERROR  query timeout: SELECT * FROM deals WHERE active (heavy join, 1.4s)
[2026-05-29 12:00:01] catalog-svc   ERROR  upstream db error -> 503 for /catalog/hot-deals
[2026-05-29 12:00:06] catalog-svc   INFO   first recompute finished, key repopulated; 5s of 503s for ALL endpoints sharing the pool
[2026-05-29 12:05:00] redis         INFO   key catalog:hot-deals EXPIRED  <-- and it happens again, exactly 5 min later
`;

const STAMPEDE_CODE = `// catalog.ts — read-through cache for the homepage "hot deals" block.
const TTL_SECONDS = 300; // every key created in the same deploy expires at ~the same time

export async function getHotDeals(): Promise<Deal[]> {
  const cached = await redis.get("catalog:hot-deals");
  if (cached) return JSON.parse(cached);

  // MISS: go straight to the DB. No lock, no coalescing, no stale-serve.
  // Under load every pod that misses runs this 1.4s join concurrently.
  const deals = await db.query(
    "SELECT * FROM deals d JOIN inventory i ON i.sku = d.sku WHERE d.active"
  ); // heavy; holds a pooled connection for ~1.4s
  await redis.set("catalog:hot-deals", JSON.stringify(deals), "EX", TTL_SECONDS);
  return deals;
}
`;

// ───────────────────────── inc-sre-retry-amplification (hellish) ─────────────────────────

const RETRY_LOG = `[2026-05-31 09:15:00] auth-svc      INFO   p99 to identity-provider = 180ms (healthy)
[2026-05-31 09:20:12] identity-prov WARN   GC pause + slow disk; p99 -> 1100ms (NOT down, just slow)
[2026-05-31 09:20:13] auth-svc      WARN   request to identity-provider exceeded 800ms timeout -> retry 1/3
[2026-05-31 09:20:14] auth-svc      WARN   retry 1 also timed out -> retry 2/3
[2026-05-31 09:20:15] auth-svc      WARN   retry 2 timed out -> retry 3/3
[2026-05-31 09:20:30] api-gateway   WARN   auth-svc slow -> retry 1/3 (gateway ALSO retries; multiplies)
[2026-05-31 09:21:00] identity-prov ERROR  inbound RPS 4x baseline (retries stacking) -> now actually overloaded
[2026-05-31 09:21:05] identity-prov ERROR  CPU 100%, queue full, dropping requests
[2026-05-31 09:21:40] auth-svc      ERROR  cascade: identity-provider DOWN; all logins failing (was just SLOW at 09:20)
-- a transient 1.1s slowdown became a full outage. RPS to identity-provider went 1x -> ~9x via stacked retries.
`;

const RETRY_CONFIG = `# resilience config across the call chain (api-gateway -> auth-svc -> identity-provider)
api-gateway:
  call: auth-svc
  timeout_ms: 2000
  retries: 3          # blind retries
  backoff: none       # no jitter, no exponential backoff
  circuit_breaker: disabled
  retry_budget: none  # no cap on % of traffic that may be retries

auth-svc:
  call: identity-provider
  timeout_ms: 800     # SHORTER than the gateway timeout (inner timeout < outer)
  retries: 3          # blind retries
  backoff: none
  circuit_breaker: disabled
  retry_on: [timeout, 5xx, 429]   # retries even on 429 "slow down"
# effective fan-out on one slow call: gateway(1+3) x auth(1+3) = up to ~16 calls to identity-provider
`;

// ───────────────────────── inc-sre-deploy-dead-feature (standard) ─────────────────────────

const DEPLOY_LOG = `[2026-05-27 16:40:02] ci            INFO   build #4821 green; all tests pass
[2026-05-27 16:42:10] deploy        INFO   rollout complete: 12/12 pods healthy, readiness OK
[2026-05-27 16:42:11] deploy        INFO   "deploy SUCCEEDED" — promo-banner feature shipped
[2026-05-27 16:50:00] support       NOTE   PM: "I'm on prod and the new promo banner is NOT showing"
[2026-05-27 16:51:30] promo-svc     INFO   GET /flags -> new_promo_banner = false (served to 100% of users)
[2026-05-27 16:52:00] oncall        NOTE   pods are healthy, no errors, no 5xx. the feature is just... off.
`;

const DEPLOY_CODE = `// flagClient.ts — reads the feature flag at request time.
export function showPromoBanner(ctx: RequestCtx): boolean {
  // The flag is read from an env var injected at deploy time.
  // Default is false when the var is unset or unparseable.
  const raw = process.env.FEATURE_NEW_PROMO_BANNER; // expected "true"
  return raw === "true";
}
`;

const DEPLOY_CONFIG = `# values-prod.yaml (the prod overlay that the deploy used)
env:
  LOG_LEVEL: info
  REGION: us-east-1
  # NOTE: the staging overlay (values-staging.yaml) DOES set this:
  #   FEATURE_NEW_PROMO_BANNER: "true"
  # but the prod overlay was never updated, so on prod the var is UNSET.
  # The flag system has TWO sources: this env var AND a remote flag service.
  # The remote flag service default for new_promo_banner is also "false".
flags:
  source: env        # prod reads from env (unset) — NOT from the remote service the PM toggled
  remote_default: false
`;

// ───────────────────────── inc-sre-cf-config-doubled (hellish) ─────────────────────────
// Adapted from the Cloudflare Nov-18-2025 outage. DDoS is a RED HERRING.

const CF_LOG = `[2026-05-26 11:05:00] db-perms      INFO   access-control change applied: users can now see r0 schema metadata (gradual rollout)
[2026-05-26 11:20:00] edge-proxy    ERROR  ~28% of requests returning 5xx (INTERMITTENT — comes and goes every ~5 min)
[2026-05-26 11:20:10] secops        NOTE   intermittent 5xx + traffic looks spiky -> "are we being DDoSed?"
[2026-05-26 11:22:00] secops        NOTE   enabled rate-limiting + challenge; 5xx rate UNCHANGED (not traffic-driven)
[2026-05-26 11:25:00] edge-proxy    ERROR  thread proxy_worker panicked: called \`Result::unwrap()\` on an \`Err\` value
[2026-05-26 11:25:00] edge-proxy    ERROR  panic in load_feature_config(): features=404 exceeds preallocated cap 200
[2026-05-26 11:25:05] config-gen    INFO   bot_features.bin generated: 404 features (was 202 on last good build)
[2026-05-26 11:30:00] edge-proxy    NOTE   5xx flaps in step with config refresh: bad config -> good config -> bad config every 5 min
-- the 5xx waxes/wanes as each edge node picks up a freshly-generated (good or bad) config file every 5 minutes.
`;

const CF_QUERY_GEN = `-- feature_gen.sql — generates the Bot Management feature list, written to bot_features.bin every 5 min.
-- BUG: no database/schema filter. Returns one row per (schema, column).
SELECT name, type
FROM system.columns
WHERE table = 'http_requests_features'
ORDER BY name;
-- Before the perms change: only the 'default' schema was visible -> 202 rows.
-- After the perms change (gradual rollout): both 'default' AND 'r0' visible -> 404 rows (doubled).
`;

const CF_PROXY_CODE = `// load_feature_config.rs — runs on every edge proxy on each config refresh.
const MAX_FEATURES: usize = 200; // preallocated; "we never use more than ~60"

fn load_feature_config(path: &str) -> FeatureConfig {
    let rows = read_feature_file(path); // parsed from bot_features.bin
    let mut features = Vec::with_capacity(MAX_FEATURES);
    for row in rows {
        // BUG: unwrap() on the bounded insert. When rows > 200 this returns Err,
        // and unwrap() PANICS the worker thread instead of degrading gracefully.
        features.try_push(row).unwrap();
    }
    FeatureConfig { features }
}
`;

const CF_SETUP_SQL = `-- Reproduce the doubling: the metadata catalog the feature query reads.
CREATE TABLE system_columns (
  schema_name VARCHAR,
  table_name  VARCHAR,
  name        VARCHAR,
  type        VARCHAR
);
-- 'default' schema: 202 feature columns (collapsed to 4 representative rows; treat count as the signal)
INSERT INTO system_columns VALUES
  ('default', 'http_requests_features', 'feat_001', 'Float64'),
  ('default', 'http_requests_features', 'feat_002', 'Float64'),
  ('default', 'http_requests_features', 'feat_201', 'Float64'),
  ('default', 'http_requests_features', 'feat_202', 'Float64'),
  -- after the perms change, the SAME columns ALSO show up under the 'r0' schema (duplicates)
  ('r0',      'http_requests_features', 'feat_001', 'Float64'),
  ('r0',      'http_requests_features', 'feat_002', 'Float64'),
  ('r0',      'http_requests_features', 'feat_201', 'Float64'),
  ('r0',      'http_requests_features', 'feat_202', 'Float64');
-- The buggy generator query omits a "WHERE schema_name = 'default'" filter, so it
-- counts BOTH schemas -> the feature count doubles past the proxy's cap of 200.
`;

// ───────────────────────── inc-sre-idempotency-cross-tenant (hellish) ─────────────────────────

const IDEM_LOG = `[2026-05-25 10:00:01] payments  INFO   tenant=acme   POST /charge idem-key=order-1042 -> 201 charged $50.00
[2026-05-25 10:00:01] payments  INFO   tenant=acme   POST /charge idem-key=order-1042 (retry) -> 200 replayed (dedup OK)
[2026-05-25 10:00:04] payments  WARN   tenant=globex POST /charge idem-key=order-1042 -> 200 REPLAYED acme's response!
[2026-05-25 10:00:04] payments  ERROR  globex customer saw acme's receipt ($50.00, acme merchant) — CROSS-TENANT leak
[2026-05-25 10:03:10] payments  WARN   tenant=acme   POST /refund idem-key=order-1042 -> collided with the /charge key (same key, diff op)
[2026-05-25 10:03:10] support   NOTE   duplicate-charge complaints AND a wrong-receipt complaint in the same window
-- two bugs surface together: (1) cross-tenant response replay, (2) the SAME key reused across DIFFERENT operations.
`;

const IDEM_CODE = `// idempotency.ts — dedups POSTs so client retries don't double-charge.
// Keys are stored in a global Redis namespace.
export function idempotencyKey(req: ChargeRequest): string {
  // BUG: scoped to the client-supplied key ALONE.
  // - Not namespaced by tenant -> tenant B reusing "order-1042" replays tenant A's response.
  // - Not namespaced by operation -> /charge and /refund with the same key collide.
  return \`idem:\${req.idemKey}\`;
}

export async function handleCharge(req: ChargeRequest, res: Res) {
  const key = idempotencyKey(req);
  const prior = await redis.get(key);
  if (prior) return res.replay(JSON.parse(prior)); // replays WHOEVER wrote it first
  const result = await charge(req);
  await redis.set(key, JSON.stringify(result), "EX", 86400);
  return res.send(result);
}
`;

const IDEM_SETUP_SQL = `CREATE TABLE idem_log (
  ts        TIMESTAMP,
  tenant    VARCHAR,
  operation VARCHAR,
  idem_key  VARCHAR,     -- the client-supplied key (global namespace as stored)
  stored_as VARCHAR,     -- the actual Redis key used: "idem:" + idem_key
  amount    DECIMAL(10,2),
  outcome   VARCHAR      -- 'charged' | 'replayed'
);
INSERT INTO idem_log VALUES
  (TIMESTAMP '2026-05-25 10:00:01', 'acme',   'charge', 'order-1042', 'idem:order-1042', 50.00, 'charged'),
  (TIMESTAMP '2026-05-25 10:00:01', 'acme',   'charge', 'order-1042', 'idem:order-1042', 50.00, 'replayed'),
  (TIMESTAMP '2026-05-25 10:00:04', 'globex', 'charge', 'order-1042', 'idem:order-1042', 99.00, 'replayed'),
  (TIMESTAMP '2026-05-25 10:03:10', 'acme',   'refund', 'order-1042', 'idem:order-1042', 50.00, 'replayed'),
  (TIMESTAMP '2026-05-25 10:05:00', 'acme',   'charge', 'order-2001', 'idem:order-2001', 12.00, 'charged'),
  (TIMESTAMP '2026-05-25 10:05:00', 'globex', 'charge', 'order-2001', 'idem:order-2001', 80.00, 'replayed');
-- The signal: the SAME stored_as key is shared across DIFFERENT tenants and DIFFERENT operations.
-- A correct key would be stored_as = "idem:" + tenant + ":" + operation + ":" + idem_key (unique per row group).
`;

export const INCIDENT_SRE_ITEMS: ConvItem[] = [
  // 1 ── memory leak / OOM (hard) ────────────────────────────────────────────
  {
    id: "inc-sre-oom-restarts",
    category: "incident",
    level: "senior",
    title: "Checkout pods OOMKilled every few hours",
    company: "FAANG · platform",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: checkout-svc pods are being OOMKilled roughly every 3 hours (restartCount is up to 15). Heap climbs in a sawtooth that never recovers, and the DB connection pool is slowly saturating (active=98/100, nothing returning). No code deploy in the last week — traffic is normal. You have the kubelet/OOM log and the hot-path handler. Find the root cause(s) and the fix.",
    hints: [
      "A heap that climbs and never comes down = something is retained forever. Find a collection that only ever grows. Look at the cache key.",
      "Two separate leaks are stacked here. The pool log (active near max, none returning) points at a SECOND leak independent of the heap — trace every code path to release().",
      "OOMKilled is a memory cgroup limit kill, not a JVM OOM. The fix is bound the cache (size/TTL or correct key) AND release the connection on every path, including early returns.",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies the unbounded cache: the key embeds the full request, so every call inserts a new entry that's never evicted — heap grows forever",
      "Identifies the SECOND leak: the cache-miss path early-returns before client.release(), leaking a pooled connection per miss",
      "Connects the two artifacts: sawtooth heap (OOM) AND pool saturation are distinct leaks with distinct fixes",
      "Fix: bound the cache (correct key = country only, plus max size / TTL or LRU) and release the connection on all paths (try/finally)",
      "Notes it's load/time-driven not deploy-driven, and proposes a memory-limit alert + leak guardrail to catch regressions",
    ],
    incident: {
      brief:
        "checkout-svc OOMKilled ~every 3h (restartCount=15). Heap sawtooths upward, never recovers; DB pool saturating with nothing returning. No recent deploy. Find the root cause(s) and fix.",
      severity: "SEV-2 · customer-facing (checkout)",
      tier: "hard",
      artifacts: [
        { name: "logs/oom.log", kind: "log", language: "text", content: OOM_LOG },
        { name: "src/orderEnrichment.ts", kind: "code", language: "typescript", content: OOM_HANDLER },
      ],
    },
  },

  // 2 ── p99 spikes, p50 fine (hard) ──────────────────────────────────────────
  {
    id: "inc-sre-p99-spikes",
    category: "incident",
    level: "senior",
    title: "p99 spikes to 2-3s while p50 stays at 40ms",
    company: "FAANG · platform",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3 trending up: /render p50 is a healthy ~40ms but p99 spikes to 2-3s in recurring bursts. Error rate is ~0 and CPU is ~45%, so it's not saturation. The spikes hit ALL in-flight requests in a window at once, then clear. You have a GC log, the service config, and a request-metrics table to query. Find the root cause and the fix.",
    hints: [
      "p50 fine + p99 spiking in correlated bursts that hit unrelated requests = a stop-the-world event, not a slow query. Read the GC log for Full GC pauses and what precedes them.",
      "Query request_metrics: group by minute and compare p50 vs max latency. The slow windows coincide with a specific endpoint. What allocates a huge object there?",
      "'Humongous Allocation' in G1 = a single object >= half a region. The config materializes a multi-MB export buffer in memory (stream:false). Fix = stream the export so you never allocate the humongous buffer.",
    ],
    idealAnswer: "",
    rubric: [
      "Recognizes the signature: p50 steady + correlated p99 spikes across unrelated requests = stop-the-world GC pauses, not a slow downstream or lock on the hot path",
      "Reads the GC log: recurring ~2.5s Full GCs preceded by 'Humongous Allocation' — a few very large objects, not steady allocation pressure",
      "Connects to config: report_export buffers the full result set into one byte[] (stream:false), creating a humongous object that triggers Full GC",
      "Uses the data: groups request_metrics by minute, shows the slow windows align with /export, and that the stall hits co-located /render requests too",
      "Fix: stream the export (chunked, no full materialization); optionally tune G1 region size / move exports off the hot path — addresses cause, not just symptom",
    ],
    incident: {
      brief:
        "/render p50 ~40ms, p99 spikes to 2-3s in recurring bursts. Error rate ~0, CPU ~45%. Spikes hit all in-flight requests in a window at once. Find the root cause and fix.",
      severity: "SEV-3 · latency SLO at risk",
      tier: "hard",
      artifacts: [
        { name: "logs/gc.log", kind: "log", language: "text", content: P99_GC_LOG },
        { name: "config/render-svc.yaml", kind: "config", language: "text", content: P99_CONFIG },
      ],
      sql: { setupSql: P99_SETUP_SQL, tables: ["request_metrics"] },
    },
  },

  // 3 ── cache stampede / thundering herd (hard) ──────────────────────────────
  {
    id: "inc-sre-cache-stampede",
    category: "incident",
    level: "mid",
    title: "Homepage 503s for 5 seconds, every 5 minutes",
    company: "Payments",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the homepage throws 503s for about 5 seconds, then recovers — and it happens like clockwork every 5 minutes. During each burst the DB primary saturates (200/200 connections, hundreds queued) and the timeouts spill over to OTHER endpoints sharing the pool. You have the on-call log and the cache code. Find the root cause and the fix.",
    hints: [
      "Every 5 minutes = a TTL boundary. One hot key expires and the log shows 812 simultaneous misses in 200ms. What do all those misses do next?",
      "Each miss runs the same 1.4s heavy join directly against the DB with no coordination — that's a cache stampede / thundering herd, and it exhausts the shared pool.",
      "Fix: prevent the herd — request coalescing / single-flight or a per-key lock so only ONE recompute runs, plus stale-while-revalidate and TTL jitter so keys don't all expire together.",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies the cache stampede / thundering herd: a single hot key expires and hundreds of pods miss simultaneously, each running the heavy recompute",
      "Explains the cascade: concurrent recomputes exhaust the shared DB pool, so timeouts/503s spill to unrelated endpoints, not just /hot-deals",
      "Explains the 5-minute periodicity: fixed 300s TTL set at deploy means the key expires for everyone at the same instant (synchronized expiry)",
      "Fix: single-flight / request coalescing or a per-key recompute lock so only one query runs; others wait or serve stale",
      "Adds defense in depth: stale-while-revalidate (serve last-known-good during recompute), probabilistic early refresh, and TTL jitter to desynchronize expiry",
    ],
    incident: {
      brief:
        "Homepage returns 503s for ~5s every 5 minutes. DB primary saturates each time (200/200, hundreds queued) and timeouts spill to other endpoints on the same pool. Find the root cause and fix.",
      severity: "SEV-2 · customer-facing (homepage)",
      tier: "hard",
      artifacts: [
        { name: "logs/oncall.log", kind: "log", language: "text", content: STAMPEDE_LOG },
        { name: "src/catalog.ts", kind: "code", language: "typescript", content: STAMPEDE_CODE },
      ],
    },
  },

  // 4 ── retry amplification cascade (hellish) ────────────────────────────────
  {
    id: "inc-sre-retry-amplification",
    category: "incident",
    level: "senior",
    title: "A 1-second slowdown took the whole login path down",
    company: "Cloud infra",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: all logins are failing. On-call's first instinct is 'identity-provider is DOWN' — but the timeline shows it was only SLOW (p99 went from 180ms to 1.1s) at the start, then became fully overloaded a minute later. RPS to identity-provider jumped to ~9x baseline with NO real traffic increase. You have the cascade log and the resilience config across the call chain. Find the root cause, the correct triage order, and the fix.",
    hints: [
      "Don't accept 'the dependency is down' — the log says it was SLOW first, then went down. What turns a transient slowdown into 9x RPS with no new users? Count the retries.",
      "Read the config across BOTH hops: gateway retries 3x AND auth-svc retries 3x, so one slow call fans out to ~16. The inner timeout (800ms) is also SHORTER than the outer (2000ms) — the inner gives up and retries while the outer is still waiting.",
      "Mitigate first (shed load / stop the bleeding: disable retries or trip a breaker), THEN fix: circuit breaker + exponential backoff with jitter + a retry budget (cap retries as % of traffic) + retry timeouts that increase outward, and don't retry 429.",
    ],
    idealAnswer: "",
    rubric: [
      "Rejects the 'dependency is down' framing: identity-provider was SLOW first; the outage was self-inflicted by retry amplification, not an external failure",
      "Quantifies the amplification: nested blind retries (gateway 1+3 x auth 1+3) turn one slow call into ~16, driving ~9x RPS with no real traffic increase",
      "Spots the inner-timeout-shorter-than-outer bug (800ms inner < 2000ms outer): the inner layer retries while the outer is still waiting, multiplying load",
      "Gets triage order right: MITIGATE first (shed retry load / trip a breaker / disable retries) to let the dependency recover, THEN root-cause, THEN prevent",
      "Fix: circuit breaker, exponential backoff WITH jitter, a retry budget (cap retries as a % of requests), don't retry 429/non-idempotent ops, and make timeouts increase outward",
      "Prevention: load-shedding + concurrency limits on the dependency so a slowdown degrades gracefully instead of cascading",
    ],
    incident: {
      brief:
        "All logins failing. identity-provider was only SLOW (p99 180ms -> 1.1s) at first, then overloaded a minute later. RPS to it hit ~9x baseline with no real traffic increase. On-call suspects the dependency is down. Find the real root cause, the triage order, and the fix.",
      severity: "SEV-1 · auth down (all logins)",
      tier: "hellish",
      artifacts: [
        { name: "logs/cascade.log", kind: "log", language: "text", content: RETRY_LOG },
        { name: "config/resilience.yaml", kind: "config", language: "text", content: RETRY_CONFIG },
      ],
    },
  },

  // 5 ── deploy "succeeded" but feature dead (standard) ───────────────────────
  {
    id: "inc-sre-deploy-dead-feature",
    category: "incident",
    level: "mid",
    title: 'Deploy "succeeded" but the new feature is dead',
    company: "FAANG · platform",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: the deploy went green (12/12 pods healthy, all tests passed, 'deploy SUCCEEDED'), but the new promo banner is NOT showing on prod. No errors, no 5xx — the feature is simply off. /flags reports new_promo_banner=false for 100% of users. You have the deploy log, the flag client, and the prod values overlay. Find the root cause and the fix.",
    hints: [
      "'Deploy succeeded' only means the pods are healthy — it says nothing about config. The feature reads a flag; find where that flag's value actually comes from on prod.",
      "Compare the prod overlay to staging. The flag client reads an ENV var, but the prod overlay never sets FEATURE_NEW_PROMO_BANNER, so it's unset and defaults to false.",
      "There's also a config drift trap: the team toggled the REMOTE flag service, but prod is configured to read from env (source: env), not the remote service. Fix the prod overlay (or point the source at the service that was toggled) and add a post-deploy verification check.",
    ],
    idealAnswer: "",
    rubric: [
      "Recognizes that a green deploy (healthy pods, passing tests) does not validate runtime config — the failure is config/env drift, not a code or infra fault",
      "Finds the unset env var: prod values overlay never sets FEATURE_NEW_PROMO_BANNER, so the env-read flag defaults to false (staging set it; prod drifted)",
      "Catches the second trap: the team toggled the REMOTE flag service, but prod's flag source is 'env', so the toggle had no effect (two sources of truth)",
      "Fix: set the flag in the prod overlay (or align flag source with the toggled service), redeploy/refresh; reconcile the two flag sources to one",
      "Prevention: post-deploy smoke/verification that asserts the feature is actually serving (not just that pods are healthy), and config parity checks across overlays",
    ],
    incident: {
      brief:
        "Deploy green (12/12 healthy, tests pass) but new promo banner not showing on prod. No errors/5xx; /flags = false for everyone. Find why the feature is dead and the fix.",
      severity: "SEV-3 · feature not live",
      tier: "standard",
      artifacts: [
        { name: "logs/deploy.log", kind: "log", language: "text", content: DEPLOY_LOG },
        { name: "src/flagClient.ts", kind: "code", language: "typescript", content: DEPLOY_CODE },
        { name: "config/values-prod.yaml", kind: "config", language: "text", content: DEPLOY_CONFIG },
      ],
    },
  },

  // 6 ── Cloudflare-style config-doubled proxy panic, DDoS red herring (hellish) ─
  {
    id: "inc-sre-cf-config-doubled",
    category: "incident",
    level: "senior",
    title: "~28% of traffic 5xxs intermittently — is it a DDoS?",
    company: "CDN / edge",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: about 28% of requests are returning 5xx, but INTERMITTENTLY — it flaps on and off every ~5 minutes. SecOps suspects a DDoS and turned on rate-limiting + challenges, but the 5xx rate didn't budge. Meanwhile an edge-proxy worker thread is panicking on an internally-generated config file. You have the on-call log, the config-generation query, the proxy loader code, and the metadata catalog to query. Find the real root cause, why SecOps is wrong, the correct triage order, and the fix.",
    hints: [
      "RED HERRING: it's not a DDoS. Rate-limiting changed nothing, and the 5xx rate doesn't track inbound traffic — it tracks the config refresh. What flaps every 5 minutes? The internally-generated config file.",
      "An access-control change made a metadata query start returning duplicate rows (both schemas), so the generated config DOUBLED from 202 to 404 features — past the proxy's preallocated cap of 200. Query system_columns: count rows with vs without a schema filter.",
      "The proxy unwrap()s on the bounded insert, so an oversized file PANICS instead of degrading. Triage: MITIGATE first (roll back the config / serve last-known-good good file, stop generating the bad one), THEN root-cause (add the missing schema filter to the query), THEN prevent (bound-check + graceful-degrade instead of unwrap, plus a config-size canary).",
    ],
    idealAnswer: "",
    rubric: [
      "Does NOT chase the DDoS red herring: notes rate-limiting had zero effect and the 5xx flaps with the 5-min config refresh, not with inbound traffic — it's an internal config bug",
      "Root cause: an access-control / permissions change made the metadata query return rows from BOTH schemas (no schema filter), doubling the generated config from 202 to 404 features",
      "Connects to the panic: 404 features exceeds the proxy's preallocated cap of 200; the bounded insert errors and unwrap() panics the worker thread, producing the 5xx",
      "Explains the intermittency: each edge node picks up a freshly-generated (good or bad) config every 5 min, so the 5xx waxes and wanes with the refresh cycle",
      "Gets triage order right: MITIGATE first (roll back / pin last-known-good config, halt the bad generation), THEN root-cause, THEN prevent — does not start by debugging the proxy panic",
      "Fix: add the missing schema/database filter to the generator query; make the proxy bound-check and degrade gracefully (no unwrap on untrusted size); add a config-size canary/validation before propagation",
    ],
    incident: {
      brief:
        "~28% of traffic 5xxs INTERMITTENTLY (flaps every ~5 min). SecOps suspects a DDoS; rate-limiting didn't help. An edge proxy is panicking on an internally-generated config file (404 features > cap 200). Find the real root cause, why DDoS is wrong, the triage order, and the fix.",
      severity: "SEV-1 · edge 5xx (28% of traffic)",
      tier: "hellish",
      artifacts: [
        { name: "logs/oncall.log", kind: "log", language: "text", content: CF_LOG },
        { name: "gen/feature_gen.sql", kind: "query", language: "sql", content: CF_QUERY_GEN },
        { name: "proxy/load_feature_config.rs", kind: "code", language: "text", content: CF_PROXY_CODE },
      ],
      sql: { setupSql: CF_SETUP_SQL, tables: ["system_columns"] },
    },
  },

  // 7 ── idempotency key scoped globally — dup payments + cross-tenant (hellish)
  {
    id: "inc-sre-idempotency-cross-tenant",
    category: "incident",
    level: "senior",
    title: "Duplicate charges AND a customer seeing another tenant's receipt",
    company: "Payments",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1 (money + data leak): support has duplicate-charge complaints AND a report of one tenant's customer seeing a DIFFERENT tenant's receipt — in the same window. The idempotency layer is supposed to dedup client retries. On-call's first guess is 'Redis returned a stale/corrupt value'. You have the idempotency log, the key-generation code, and an idem_log table to query. Find the root cause, why the 'stale Redis' theory is wrong, and the fix.",
    hints: [
      "RED HERRING: Redis isn't returning stale/corrupt data — it's faithfully replaying exactly what was stored. The bug is what KEY it was stored under. Read idempotencyKey().",
      "The key is just `idem:<clientKey>` — not namespaced by tenant and not by operation. Query idem_log: group by stored_as and you'll see the SAME key shared across different tenants AND across /charge vs /refund.",
      "Two failure modes from one bug: (1) tenant B reusing 'order-1042' replays tenant A's response = cross-tenant leak; (2) /charge and /refund with the same key collide. Fix: scope the key per tenant + per operation (idem:tenant:op:key), and ideally bind the stored response to the requesting tenant so a mismatch is rejected, not replayed.",
    ],
    idealAnswer: "",
    rubric: [
      "Rejects the 'stale/corrupt Redis' theory: Redis faithfully replays the stored value — the defect is the KEY scope, an application bug, not a cache fault",
      "Root cause: the idempotency key is scoped to the client-supplied key ALONE (idem:<key>) — not namespaced by tenant and not by operation",
      "Maps both symptoms to the one bug: missing tenant scope -> cross-tenant response replay (data leak); missing operation scope -> /charge and /refund collide",
      "Uses the data: groups idem_log by stored_as to show the same Redis key shared across different tenants and different operations",
      "Fix: scope the key as idem:<tenant>:<operation>:<clientKey>; additionally validate the stored response belongs to the requesting tenant/op before replaying (reject on mismatch)",
      "Remediation: identify and refund/reverse the duplicate/cross-tenant transactions, and treat the cross-tenant exposure as a security/privacy incident, not just a billing bug",
    ],
    incident: {
      brief:
        "Duplicate charges AND a tenant's customer seeing another tenant's receipt, same window. Idempotency layer should dedup retries. On-call suspects stale/corrupt Redis. Find the real root cause and the fix.",
      severity: "SEV-1 · money + cross-tenant data leak",
      tier: "hellish",
      artifacts: [
        { name: "logs/idem.log", kind: "log", language: "text", content: IDEM_LOG },
        { name: "src/idempotency.ts", kind: "code", language: "typescript", content: IDEM_CODE },
      ],
      sql: { setupSql: IDEM_SETUP_SQL, tables: ["idem_log"] },
    },
  },
];
