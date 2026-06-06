import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the Platform / SRE incident set, keyed by problemId.
 * Holds the diagnosed root cause, fix, contributing factors, red herrings (hellish),
 * triage order, grading rubric, and the facts the coach MAY reveal when asked. None
 * of this reaches the client — the brief/artifacts/investigation data live on the
 * item in incident-sre.ts; the diagnosis lives here. `import "server-only"` is the
 * enforcement boundary. Merge into incidents.server.ts (or via the generated file).
 */
export const INCIDENT_SRE_SCENARIOS: Record<string, IncidentScenario> = {
  // 1 ── memory leak / OOM (hard) ────────────────────────────────────────────
  "inc-sre-oom-restarts": {
    actualRootCause:
      "Two stacked leaks in the hot-path handler. (1) Unbounded cache: taxRuleCache is keyed on JSON.stringify({country, req}) where `req` includes orderId+timestamp, so the key is unique on every call. Every request inserts a brand-new entry that is never evicted, so the heap climbs in a sawtooth that never recovers until the cgroup memory limit kills the pod (OOMKilled, not a JVM OOM). (2) Connection leak: on the cache-miss path the handler `return applyRules(...)` BEFORE calling client.release(), so a pooled connection is leaked on every miss — which is why the pool slowly saturates (active=98/100, nothing returning). It's time/load-driven, not deploy-driven, which is why there was no recent deploy.",
    actualFix:
      "Bound the cache: key it on `country` ALONE (the only thing tax rules depend on) and add a max size / TTL or an LRU so it can't grow without bound. Fix the connection leak by releasing on every path — acquire, then release in a finally block (or use pool.query / a withClient helper) so an early return can't skip release(). Add a container memory-limit + restartCount alert and a connection-pool-utilization alert so the next leak is caught before it pages.",
    contributingFactors: [
      "Cache key embeds per-request fields (orderId/ts) instead of just the cache dimension (country)",
      "No eviction policy (no max size, no TTL, no LRU) on a process-lifetime Map",
      "Connection acquired before an early-return branch that skips release()",
      "OOMKilled is a cgroup kill — easy to misread as a JVM heap problem and tune GC instead of finding the leak",
      "No memory-limit / restartCount / pool-utilization alerting to catch slow leaks",
    ],
    triageOrder: [
      "Mitigate: raise the memory limit or add a scheduled restart to stop the OOM paging while you investigate; bump pool max only as a stopgap",
      "Root-cause: confirm the unbounded cache (unique key) and the missing release() on the miss path from the heap sawtooth + pool saturation",
      "Prevent: bound the cache + try/finally release + memory/pool alerts so a future leak is caught early",
    ],
    rubric: [
      "Identifies the unbounded cache: key embeds the full request so every call inserts a never-evicted entry; heap grows forever",
      "Identifies the SECOND, independent leak: the cache-miss path early-returns before client.release(), leaking a connection per miss",
      "Connects both artifacts: sawtooth heap (OOM) and pool saturation are distinct leaks with distinct fixes — doesn't blame GC tuning",
      "Fix: bound the cache (key on country, add max size/TTL/LRU) AND release on all paths (try/finally)",
      "Notes it's load/time-driven not deploy-driven and proposes memory-limit + pool-utilization alerts",
    ],
    facts: [
      { q: "Was there a recent deploy or traffic change?", a: "No deploy in a week; traffic is normal. The leak is proportional to time/requests served, not to a change." },
      { q: "Is this a JVM OutOfMemoryError or a container kill?", a: "Container kill — kubelet OOMKilled (memory cgroup limit). The process is killed from outside; GC tuning won't fix it." },
      { q: "What does the cache key actually contain?", a: "JSON.stringify({country, req}) — and req carries orderId and timestamp, so the key is unique every call." },
      { q: "Why is the DB pool saturating too?", a: "It's a separate leak: the cache-miss branch returns before client.release(), so each miss leaks one pooled connection." },
    ],
  },

  // 2 ── p99 spikes, p50 fine (hard) ──────────────────────────────────────────
  "inc-sre-p99-spikes": {
    actualRootCause:
      "Stop-the-world GC pauses caused by humongous-object allocation, not a slow downstream or hot-path lock. Some tenants request a full CSV report export inline on the request thread with stream:false, so the entire result set (tens of MB) is materialized into one byte[]. At an 8Gi heap, G1's region size is ~4MB, so a 30MB buffer is a 'humongous allocation'; these trigger recurring Full GCs (~2.5s stop-the-world). During each pause EVERY in-flight request stalls — that's why p99 spikes hit unrelated /render requests in the same window while p50 stays at ~40ms, error rate is ~0, and CPU is only ~45% (it's not saturation).",
    actualFix:
      "Stream the export instead of buffering it: write chunked/streamed output so you never allocate the multi-MB humongous buffer (stream:true). Move large exports off the latency-sensitive request path (async job / dedicated pool) so they can't pause the /render workers. Optionally raise G1 region size and tune for the workload, but the real fix is eliminating the humongous allocation.",
    contributingFactors: [
      "Full report export materialized into a single in-memory byte[] (stream:false)",
      "Export runs inline on the shared request worker threads, so its GC pause stalls latency-sensitive endpoints",
      "G1 region size (~4MB at 8Gi heap) makes the export buffer a humongous object, forcing Full GCs",
      "Latency SLOs are p99-based; a p50/CPU dashboard hides the problem and invites chasing the wrong thing",
    ],
    rubric: [
      "Recognizes the signature: steady p50 + correlated p99 spikes across unrelated requests = stop-the-world GC, not a slow query or lock",
      "Reads the GC log: recurring ~2.5s Full GCs preceded by 'Humongous Allocation' (a few large objects, not steady pressure)",
      "Connects to config: report_export buffers the full result set (stream:false), creating the humongous object",
      "Uses the data: groups request_metrics by minute, shows slow windows align with /export and that co-located /render requests stall too",
      "Fix: stream the export (no full materialization); move exports off the hot path; optionally tune G1 region size — addresses cause not symptom",
    ],
    facts: [
      { q: "Is a specific endpoint slow, or all of them?", a: "All in-flight requests in a window go slow together, then clear — it's a global stall, not one slow endpoint." },
      { q: "Is the DB or a downstream slow?", a: "No — downstreams are healthy and error rate is ~0. The stall is in-process." },
      { q: "What is a 'Humongous Allocation'?", a: "In G1, a single allocation >= half a region (region ~4MB here). The export's multi-MB byte[] qualifies and forces Full GCs." },
      { q: "What does the export config do?", a: "It materializes the entire result set into one byte[] before sending (stream:false) — the source of the humongous object." },
    ],
  },

  // 3 ── cache stampede / thundering herd (hard) ──────────────────────────────
  "inc-sre-cache-stampede": {
    actualRootCause:
      "Classic cache stampede / thundering herd. The hot 'catalog:hot-deals' key has a fixed 300s TTL set at deploy time, so it expires for every pod at the same instant. On expiry, all ~812 pods miss simultaneously and each independently runs the same 1.4s heavy join directly against the DB (no lock, no request coalescing, no stale-serve). The concurrent recomputes exhaust the shared DB connection pool (200/200, hundreds queued), so timeouts and 503s spill over to OTHER endpoints sharing that pool — not just the homepage. It recurs every 5 minutes because the TTL re-synchronizes the next expiry.",
    actualFix:
      "Prevent the herd so only ONE recompute runs per expiry: single-flight / request coalescing (in-process + a cross-pod distributed lock keyed on the cache key) so concurrent misses wait for the one in-flight recompute and share its result. Add stale-while-revalidate: serve the last-known-good value while the single refresh runs, so users never see a 503. Add probabilistic early recomputation (XFetch) and TTL jitter so keys don't all expire at the same instant. Optionally isolate the heavy query's pool so it can't starve other endpoints.",
    contributingFactors: [
      "Fixed TTL set at deploy means synchronized expiry across all pods (no jitter)",
      "No request coalescing / single-flight / lock — every miss recomputes independently",
      "No stale-while-revalidate, so during recompute there is nothing to serve",
      "The recompute is an expensive 1.4s join holding a pooled connection",
      "Shared connection pool lets one hot key's stampede starve unrelated endpoints",
    ],
    rubric: [
      "Identifies the cache stampede / thundering herd: one hot key expires, hundreds of pods miss at once, each runs the heavy recompute",
      "Explains the cascade: concurrent recomputes exhaust the shared pool, so 503s spill to unrelated endpoints",
      "Explains the 5-minute periodicity: fixed 300s TTL set at deploy = synchronized expiry for everyone",
      "Fix: single-flight / request coalescing or per-key lock so only one query runs; others wait or serve stale",
      "Defense in depth: stale-while-revalidate, probabilistic early refresh, TTL jitter to desynchronize expiry",
    ],
    facts: [
      { q: "Why exactly every 5 minutes?", a: "The TTL is 300s and set at deploy, so the key expires for all pods at the same instant; the cycle repeats every refresh." },
      { q: "How many misses on expiry?", a: "The log shows ~812 misses for the same key within 200ms — one per pod." },
      { q: "Why do OTHER endpoints 503 too?", a: "The recompute holds connections from a shared pool; stampede saturates it, so unrelated endpoints time out waiting for a connection." },
      { q: "Is the DB itself broken?", a: "No — the join is just heavy (~1.4s). The DB is fine until hundreds of identical queries hit at once." },
    ],
  },

  // 4 ── retry amplification cascade (hellish) ────────────────────────────────
  "inc-sre-retry-amplification": {
    actualRootCause:
      "Self-inflicted retry-amplification cascade, NOT an external dependency failure. identity-provider had a transient slowdown (p99 180ms -> 1.1s) from a GC pause / slow disk — it was SLOW, not down. Both layers in the call chain do blind retries with no backoff, no circuit breaker, and no retry budget: api-gateway retries 3x and auth-svc retries 3x, so a single slow call fans out to up to (1+3)x(1+3) = ~16 calls. Worse, the inner timeout (auth-svc 800ms) is SHORTER than the outer (gateway 2000ms), so auth-svc gives up and retries while the gateway is still waiting, multiplying load further. The result: ~9x RPS to identity-provider with zero real traffic increase, which then genuinely overloaded it and turned a transient blip into a full outage.",
    actualFix:
      "Triage in order. MITIGATE first to let the dependency recover: shed the retry load — disable/throttle retries or trip a circuit breaker so traffic to identity-provider drops back toward baseline. Then ROOT-CAUSE (confirm the amplification math from the config). Then PREVENT: add a circuit breaker, exponential backoff WITH jitter, and a retry budget (cap retries to a small % of total requests). Make timeouts increase OUTWARD (inner <= outer is the bug; the inner should not retry while the outer still waits — give the outer the budget or make the inner timeout >= meaningful work). Don't retry 429 (it means 'slow down') or non-idempotent operations. Add load-shedding + concurrency limits on identity-provider so a slowdown degrades gracefully instead of cascading.",
    contributingFactors: [
      "Blind retries at TWO layers multiply (gateway 1+3 x auth 1+3 = ~16)",
      "No exponential backoff and no jitter — retries are immediate and synchronized",
      "No circuit breaker and no retry budget to cap retry traffic",
      "Inner timeout (800ms) shorter than outer (2000ms): inner retries while outer still waits",
      "Retries fire on 429, ignoring the dependency's explicit backpressure signal",
      "No load-shedding / concurrency limit on identity-provider, so it can't protect itself",
    ],
    redHerrings: [
      "'identity-provider is DOWN' — it was only SLOW at first; the down state was caused by the retry storm, not the trigger",
      "Scaling up identity-provider — adds capacity into a multiplying retry storm; the amplification will just consume it too",
      "Blaming a traffic spike / new users — RPS rose ~9x with no real traffic increase; the extra load is all retries",
    ],
    triageOrder: [
      "Mitigate FIRST: shed retry load — disable/throttle retries or trip a circuit breaker so identity-provider can recover (stop the bleeding)",
      "Root-cause: confirm the nested-retry amplification and inner<outer timeout bug from the config and the ~9x RPS with no traffic increase",
      "Prevent: circuit breaker + exponential backoff with jitter + retry budget + don't-retry-429 + outward-increasing timeouts + load-shedding on the dependency",
    ],
    rubric: [
      "Rejects 'dependency is down': it was SLOW first; the outage is self-inflicted by retry amplification",
      "Quantifies amplification: nested blind retries (gateway 1+3 x auth 1+3 ~= 16) drive ~9x RPS with no real traffic increase",
      "Spots inner-timeout-shorter-than-outer (800ms < 2000ms): inner retries while outer still waits, multiplying load",
      "Triage order right: MITIGATE (shed retries / trip breaker) first, THEN root-cause, THEN prevent",
      "Fix: circuit breaker, exponential backoff with jitter, retry budget, don't retry 429/non-idempotent, timeouts increase outward",
      "Prevention: load-shedding + concurrency limits so a slowdown degrades gracefully instead of cascading",
    ],
    facts: [
      { q: "Was identity-provider actually down at the start?", a: "No — at 09:20 it was SLOW (p99 1.1s), not down. It only went down a minute later, after the retry storm hit it." },
      { q: "Did real traffic increase?", a: "No. User-facing RPS was flat; the ~9x increase to identity-provider is entirely stacked retries." },
      { q: "How many retries are configured?", a: "Gateway retries 3x AND auth-svc retries 3x, with no backoff, no breaker, and no retry budget." },
      { q: "What about the timeouts?", a: "Inner (auth-svc) is 800ms, outer (gateway) is 2000ms — the inner gives up and retries while the outer is still waiting." },
      { q: "Should we scale identity-provider?", a: "Not as the fix — the retry storm will consume new capacity too. Shed retry load first." },
    ],
  },

  // 5 ── deploy "succeeded" but feature dead (standard) ───────────────────────
  "inc-sre-deploy-dead-feature": {
    actualRootCause:
      "Config/env drift, not a code or infra failure. A green deploy only proves the pods are healthy and tests passed — it doesn't validate runtime config. showPromoBanner() reads the flag from the env var FEATURE_NEW_PROMO_BANNER, defaulting to false when unset. The prod values overlay (values-prod.yaml) never sets that var (staging does), so on prod it's unset and the flag is false for 100% of users. Compounding it: the team toggled the REMOTE flag service, but prod's flag source is configured as `source: env`, so the remote toggle had no effect — two sources of truth that disagree.",
    actualFix:
      "Set FEATURE_NEW_PROMO_BANNER: \"true\" in the prod overlay (or change the prod flag source to the remote service the team actually toggled) and redeploy/refresh. Reconcile the two flag sources down to one source of truth to remove the drift. Add a post-deploy verification/smoke check that asserts the feature is actually serving (e.g. /flags returns true and the banner renders), not just that pods are healthy. Add config-parity checks across overlays so prod can't silently lack a flag staging has.",
    contributingFactors: [
      "Prod overlay missing the env var that staging sets (overlay drift)",
      "Two flag sources (env var AND remote service) with no single source of truth",
      "Prod flag source is 'env' but the team toggled the remote service",
      "Flag defaults to false when unset, so the failure is silent (no error, no 5xx)",
      "'Deploy succeeded' is interpreted as 'feature live' — no post-deploy feature verification",
    ],
    rubric: [
      "Recognizes a green deploy doesn't validate runtime config — this is config/env drift, not code/infra",
      "Finds the unset env var: prod overlay never sets FEATURE_NEW_PROMO_BANNER, so the env-read flag defaults to false",
      "Catches the second trap: the team toggled the REMOTE service but prod reads from env (two sources of truth)",
      "Fix: set the flag in the prod overlay (or align source to the toggled service), redeploy/refresh; reconcile to one source",
      "Prevention: post-deploy smoke/verification that the feature actually serves + config parity checks across overlays",
    ],
    facts: [
      { q: "Are the pods actually unhealthy?", a: "No — 12/12 healthy, readiness OK, no 5xx, no errors. The feature is simply off." },
      { q: "Where does the flag value come from on prod?", a: "From the env var FEATURE_NEW_PROMO_BANNER, which is UNSET on prod (staging sets it; prod overlay doesn't)." },
      { q: "Didn't someone toggle the flag service?", a: "Yes, but prod's flag source is 'env', not the remote service — so the toggle had no effect on prod." },
      { q: "Is the code wrong?", a: "No — the flag client behaves correctly; it returns false because the env var it reads is unset." },
    ],
  },

  // 6 ── Cloudflare-style config-doubled proxy panic, DDoS red herring (hellish) ─
  "inc-sre-cf-config-doubled": {
    actualRootCause:
      "An internally-generated config file doubled in size and blew a preallocated limit, panicking the edge proxy — it is NOT a DDoS. An access-control/permissions change made the metadata catalog expose a second schema (r0) in addition to default. The Bot Management feature-generation query (`SELECT name, type FROM system.columns WHERE table='http_requests_features'`) has no schema/database filter, so after the change it returned rows from BOTH schemas, doubling the generated feature count from 202 to 404. The proxy's load_feature_config preallocates for a cap of 200 features and does try_push(...).unwrap(); when rows exceed 200 the bounded insert returns Err and unwrap() PANICS the worker thread, producing 5xx. It's INTERMITTENT because each edge node picks up a freshly-generated (good or bad) config every ~5 minutes, so the ~28% 5xx waxes and wanes with the refresh cycle. (Adapted from the Cloudflare Nov-18-2025 outage.)",
    actualFix:
      "Triage in order. MITIGATE first: roll back / pin the last-known-good config file and halt generation of the bad one (or revert the permissions change) so the proxy stops panicking — do NOT start by debugging the panic. ROOT-CAUSE: add the missing schema/database filter to the generator query (`WHERE schema_name='default'`) so it returns 202 again. PREVENT: make the proxy bound-check and degrade gracefully on oversized input instead of unwrap()-panicking (treat config size as untrusted); add a config-size canary / validation gate that refuses to propagate a file whose feature count jumped, and a kill-switch to freeze config propagation.",
    contributingFactors: [
      "Generator query omits a schema/database filter, so a permissions change silently doubled its output",
      "Proxy preallocates a hard cap (200) and unwrap()s on overflow instead of degrading gracefully",
      "Config is regenerated and propagated every ~5 min with no size/sanity validation gate",
      "A permissions/access-control change had an unanticipated effect on a metadata query — change wasn't risk-assessed against config generation",
      "Intermittent symptom (flapping with the refresh) makes it easy to misread as a traffic/attack pattern",
    ],
    redHerrings: [
      "'We're being DDoSed' — rate-limiting + challenges changed the 5xx rate by nothing; the 5xx tracks the config refresh, not inbound traffic",
      "Spiky-looking traffic — it's an artifact of requests failing/retrying, not an attack",
      "Debugging the Rust panic first — the panic is a symptom of the oversized config; mitigate the config before deep-diving the proxy crash",
    ],
    triageOrder: [
      "Mitigate FIRST: roll back / pin last-known-good config and stop generating the bad file (or revert the permissions change) to stop the panics",
      "Root-cause: confirm the doubled feature count comes from the unfiltered metadata query after the permissions change (query system_columns with vs without a schema filter)",
      "Prevent: add the schema filter, make the proxy bound-check + degrade instead of unwrap, add a config-size canary/validation before propagation",
    ],
    rubric: [
      "Does NOT chase the DDoS red herring: notes rate-limiting had zero effect and the 5xx flaps with the 5-min config refresh, not inbound traffic",
      "Root cause: a permissions change made the metadata query return BOTH schemas (no filter), doubling the config from 202 to 404 features",
      "Connects to the panic: 404 > preallocated cap 200, so the bounded insert errors and unwrap() panics the worker thread",
      "Explains the intermittency: each edge node picks up a fresh (good or bad) config every 5 min, so 5xx waxes and wanes",
      "Triage order right: MITIGATE (roll back / pin good config) first, THEN root-cause, THEN prevent — not debug-the-panic-first",
      "Fix: add the missing schema filter; proxy bound-checks and degrades gracefully (no unwrap on untrusted size); config-size canary before propagation",
    ],
    facts: [
      { q: "Is the 5xx rate correlated with inbound traffic?", a: "No. Rate-limiting and challenges changed it by nothing. It tracks the config refresh cycle, not request volume." },
      { q: "What changed right before it started?", a: "A database access-control change at 11:05 that made an additional schema (r0) visible to the metadata query." },
      { q: "Why did the config double?", a: "The generator query has no schema filter, so it counted the same columns under both 'default' and 'r0' — 202 became 404 features." },
      { q: "Why does the proxy crash instead of skipping extra features?", a: "It preallocates a cap of 200 and unwrap()s the bounded insert; >200 returns Err and unwrap() panics the worker thread." },
      { q: "Why is it intermittent?", a: "Each edge node refreshes config every ~5 min and may pick up a good or bad build, so the 5xx flaps on and off." },
    ],
  },

  // 7 ── idempotency key scoped globally (hellish) ────────────────────────────
  "inc-sre-idempotency-cross-tenant": {
    actualRootCause:
      "The idempotency key is scoped to the client-supplied key ALONE — `idem:<idemKey>` — in a single global Redis namespace. It is neither namespaced by tenant nor by operation. This one bug produces both symptoms: (1) cross-tenant replay — tenant globex sending the same 'order-1042' key as tenant acme hits the existing entry and gets acme's stored response replayed, leaking acme's receipt/amount to globex; (2) operation collision — /charge and /refund using the same key collide because the operation isn't part of the key. Redis is NOT returning stale or corrupt data; it is faithfully replaying exactly what was stored under a key that is far too broad. It's an application key-scoping bug, and the cross-tenant case is also a data-privacy/security incident.",
    actualFix:
      "Scope the idempotency key per tenant AND per operation: `idem:<tenant>:<operation>:<idemKey>`. Additionally, bind the stored response to the requesting principal — record tenant+operation alongside the stored result and, on a replay, validate they match the incoming request; reject (don't replay) on mismatch as defense in depth. Remediate: identify and refund/reverse the duplicate and cross-tenant transactions, and handle the cross-tenant exposure through the security/privacy incident process (notification, audit) — not just as a billing correction.",
    contributingFactors: [
      "Idempotency key built from the client-supplied key only — no tenant scope",
      "No operation scope, so different operations (charge vs refund) share a key",
      "Single global Redis namespace shared across all tenants",
      "Stored response not bound/validated against the requesting tenant+operation before replay",
      "Client-supplied keys are low-entropy/sequential (order-1042), making collisions across tenants likely",
    ],
    redHerrings: [
      "'Redis returned a stale/corrupt value' — Redis faithfully replays what was stored; the defect is the key scope, not the cache",
      "'A client double-submitted' — that's exactly what idempotency should handle correctly; the bug is the key, not the client",
      "Blaming a Redis eviction/TTL — entries are within TTL and intact; the wrong entry is being matched, not a missing one",
    ],
    triageOrder: [
      "Mitigate: stop the bleeding — disable replay / partition keys by tenant immediately (e.g. prefix by tenant at the edge) so no further cross-tenant leaks or collisions occur",
      "Root-cause: confirm the global key scope from the code and the data (same stored_as key across different tenants and operations)",
      "Prevent + remediate: scope key per tenant+operation, validate stored response ownership before replay, reverse the bad transactions, and run the privacy/security incident process",
    ],
    rubric: [
      "Rejects the 'stale/corrupt Redis' theory: Redis faithfully replays the stored value; the defect is the KEY scope (application bug)",
      "Root cause: idempotency key scoped to the client key alone (idem:<key>) — not namespaced by tenant and not by operation",
      "Maps both symptoms to one bug: missing tenant scope -> cross-tenant replay (leak); missing operation scope -> charge/refund collision",
      "Uses the data: groups idem_log by stored_as to show the same key shared across tenants and operations",
      "Fix: key as idem:<tenant>:<operation>:<key>; validate the stored response belongs to the requesting tenant/op before replaying",
      "Remediation: reverse the duplicate/cross-tenant transactions and treat the cross-tenant exposure as a security/privacy incident",
    ],
    facts: [
      { q: "Is Redis returning corrupted data?", a: "No — it's returning exactly what was stored. The problem is the key it was stored under is too broad (no tenant, no operation)." },
      { q: "What is the stored key?", a: "`idem:<idemKey>` — just the client-supplied key, in one global namespace shared by all tenants and operations." },
      { q: "How does a customer see another tenant's receipt?", a: "Tenant globex reused acme's idemKey 'order-1042'; the existing entry matched, so acme's stored response was replayed to globex." },
      { q: "How do charge and refund collide?", a: "The operation isn't part of the key, so /refund with the same idemKey hits the /charge entry." },
      { q: "What would a correct key look like?", a: "idem:<tenant>:<operation>:<idemKey> — unique per tenant+operation — plus validating the stored response's owner before replaying." },
    ],
  },
};
