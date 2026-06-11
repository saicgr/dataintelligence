import type { ArcStep } from './content';
import type { TrackColorKey } from './theme';

/**
 * Pillar 1 — "Explain it fully" articulation scenarios.
 *
 * The user knows the concept but can't PRODUCE the full senior explanation under
 * pressure. Each scenario opens with teaching-expectancy framing, makes the user
 * answer out loud (produce-before-reveal), then reveals the senior "arc" and a
 * BINARY rubric (criteria-referenced, not a 1–5 vanity slider). Checklist
 * completeness feeds the spaced-repetition scheduler.
 *
 * These are bundled seeds; the build-time author/verifier pipeline emits more in
 * the same shape, shipped via the same OTA/remote path as fresh cards.
 */
export interface Scenario {
  id: string;
  domain: 'ai' | 'de';
  tk: TrackColorKey;
  tool: string;
  framing: string; // "A new hire asks you to explain…"
  prompt: string; // the thing to answer out loud
  arc: ArcStep[]; // the senior model answer, step by step
  rubric: string[]; // binary criteria to self-check against the revealed answer
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'scn-spark-oom',
    domain: 'de',
    tk: 'spark',
    tool: 'Spark',
    framing:
      'A new hire pings you: "The nightly Spark job keeps failing with an OutOfMemoryError in prod. Can you explain what\'s actually happening and how you\'d fix it?" Walk them through it end to end.',
    prompt: 'Explain why a Spark job OOMs in production — and how you diagnose and fix it.',
    arc: [
      {
        label: 'Symptom',
        body: 'An executor (or the driver) dies with OutOfMemoryError; you see failed tasks, retries, and often heavy disk spill or long GC pauses in the Spark UI before the crash.',
      },
      {
        label: 'Diagnose (before touching config)',
        body: 'Open the Spark UI. Is it the driver or an executor? Look at the stages tab for shuffle read/write size, task-level skew (one task 100× the others), spill (memory→disk), and GC time. Diagnose which component and which stage before changing anything.',
      },
      {
        label: 'Root cause (name the real one)',
        body: 'Usually one of: data skew (a hot key), an oversized broadcast join, collect()/toPandas() pulling a huge result to the driver, too few or skewed shuffle partitions, or genuinely insufficient memory. "Add more RAM" is the junior reflex — name the actual mechanism first.',
      },
      {
        label: 'Fix (match the cause)',
        body: 'Skew → salt the key or enable AQE skew join. Oversized broadcast → raise/lower the broadcast threshold or switch to sort-merge. collect-to-driver → don\'t; write out or aggregate. Too-few partitions → repartition / raise spark.sql.shuffle.partitions to fit memory. Only then consider more executor memory.',
      },
      {
        label: 'Trade-off',
        body: 'More partitions = more shuffle overhead and small-file risk; more memory = higher cost and possible GC pressure; salting adds a stage. State which you chose and why for this workload.',
      },
      {
        label: 'Prevent & quantify',
        body: 'Add spill/GC monitoring and a skew alert; pin shuffle partitions; cite before/after, e.g. "runtime 42→9 min, no spill, cluster cost down ~30%."',
      },
    ],
    rubric: [
      'Diagnosed in the Spark UI (driver vs executor, skew, spill, GC) BEFORE changing config',
      'Named the real root cause (skew / broadcast / collect-to-driver / too-few partitions) — not just "add RAM"',
      'Gave a fix that matches that specific cause',
      'Named a trade-off of the fix',
      'Quantified impact or added prevention/monitoring',
    ],
  },
  {
    id: 'scn-kafka-lag',
    domain: 'de',
    tk: 'kafka',
    tool: 'Kafka',
    framing:
      'A teammate says: "Consumer lag on our orders topic keeps growing and we\'re falling behind real-time. Explain what\'s going on and how you\'d fix it without losing or double-processing orders."',
    prompt: 'Explain growing Kafka consumer lag — diagnosis, fix, and the delivery trade-off.',
    arc: [
      { label: 'Symptom', body: 'Committed offset falls further behind the log end offset; end-to-end latency climbs; lag metric grows monotonically.' },
      { label: 'Diagnose', body: 'Is consumption < production rate? Check per-partition lag (is it ALL partitions or one hot partition = skewed keys?), consumer count vs partition count, processing time per record, and rebalance storms.' },
      { label: 'Root cause', body: 'Common: too few partitions to parallelize, a slow/blocking processing step, uneven key distribution, or frequent rebalances. Max parallelism = partition count, so extra consumers past that sit idle.' },
      { label: 'Fix', body: 'Speed up per-record work (batch/async I/O), add partitions + consumers up to the partition count, fix key skew, and tune max.poll.records / poll interval to stop rebalance churn.' },
      { label: 'Trade-off', body: 'Adding partitions breaks per-key ordering guarantees and can\'t be reduced later; more consumers help only up to partition count. Note the ordering cost.' },
      { label: 'Delivery semantics', body: 'Decide at-least-once (commit after processing, handle duplicates idempotently) vs exactly-once (transactions). Quantify: lag back to ~0, p99 latency target met.' },
    ],
    rubric: [
      'Checked per-partition lag and consumer-vs-partition count before adding consumers',
      'Named the real root cause (skew / slow processing / too few partitions / rebalances)',
      'Gave a matching fix',
      'Addressed ordering or delivery-semantics trade-off (at-least-once vs exactly-once)',
      'Quantified the target (lag ~0 / latency SLO)',
    ],
  },
  {
    id: 'scn-rag-wrong-cite',
    domain: 'ai',
    tk: 'rag',
    tool: 'RAG',
    framing:
      'PM asks: "Our RAG assistant keeps citing the wrong doc even though the right one is in the index. Explain why and how you\'d fix it — without just swapping the model."',
    prompt: 'Explain a RAG system citing the wrong document, and how you debug it.',
    arc: [
      { label: 'Symptom', body: 'Answers cite a plausible-but-wrong source; the correct doc exists in the index but isn\'t used.' },
      { label: 'Isolate retrieval vs generation', body: 'Bisect: is the correct chunk in the top-k retrieved set? If NO → retrieval bug. If YES but ignored → generation/prompt bug. The gold-context test settles it: inject the right chunk and see if the answer corrects.' },
      { label: 'Root cause (retrieval side)', body: 'Usually chunking (answer split across boundaries), embedding-model/domain mismatch, missing hybrid search for exact terms/IDs, or no re-ranker so a near-duplicate outranks the right chunk.' },
      { label: 'Fix', body: 'Tune chunking + overlap, add BM25 hybrid + RRF for exact-term queries, add a cross-encoder re-ranker over top-k, and measure recall@k on a labeled set — before touching the LLM.' },
      { label: 'Trade-off', body: 'Re-rankers add 50–200ms; hybrid adds infra; bigger k adds context cost/noise. Pick per latency budget.' },
      { label: 'Quantify', body: 'Report recall@5 and citation-accuracy before/after on a fixed eval set, not anecdotes.' },
    ],
    rubric: [
      'Isolated retrieval vs generation (e.g. gold-context injection) before blaming the model',
      'Named a real retrieval root cause (chunking / embedding mismatch / no hybrid / no re-ranker)',
      'Gave a matching fix',
      'Named a latency/cost trade-off',
      'Measured with recall@k / citation accuracy on a labeled set',
    ],
  },
  {
    id: 'scn-sql-slow-query',
    domain: 'de',
    tk: 'sql',
    tool: 'SQL',
    framing:
      'On-call ping: "A dashboard query that ran in 2s last month now takes 90s and is timing out users. Explain how you\'d figure out why and fix it — without just throwing an index at it."',
    prompt: 'Explain how you diagnose and fix a query that suddenly got 40× slower.',
    arc: [
      { label: 'Symptom', body: 'Same query, same shape, latency jumped from ~2s to ~90s. No code change shipped, so suspect data/plan drift, not logic.' },
      { label: 'Read the plan first', body: 'EXPLAIN ANALYZE the actual query. Compare estimated vs actual rows (a 1000× gap = stale statistics). Look for the expensive node: seq scan on a now-huge table, a hash join that spilled to disk, or a nested loop the planner chose on a bad cardinality estimate.' },
      { label: 'Root cause (name the mechanism)', body: 'Common: stale stats after a big load flipped the planner from index/hash to nested-loop or seq scan; table growth crossed a threshold; a missing/unusable index after a type cast; or parameter sniffing on a skewed predicate. Identify which, don\'t guess.' },
      { label: 'Fix (match the cause)', body: 'Stale stats → ANALYZE / refresh statistics so the planner re-plans. Genuinely missing index → add a selective/covering one matching the predicate + sort. Bad join order → fix the estimate or restructure. Verify the new plan actually uses it.' },
      { label: 'Trade-off', body: 'Every index slows writes and costs storage; over-indexing bloats the table. A covering index helps reads but widens the index. State why this index earns its keep here.' },
      { label: 'Prevent & quantify', body: 'Auto-analyze thresholds, a slow-query log + plan-regression alert, and capture the plan in CI. Cite before/after: "90s→1.8s, seq scan replaced by index scan, est rows now match actual."' },
    ],
    rubric: [
      'Read EXPLAIN ANALYZE and compared estimated vs actual rows BEFORE adding an index',
      'Named the real mechanism (stale stats / plan flip / missing index / skew) — not just "add an index"',
      'Gave a fix that matches that cause and verified the new plan',
      'Named a write/storage trade-off of indexing',
      'Quantified impact or added plan-regression monitoring',
    ],
  },
  {
    id: 'scn-airflow-backfill',
    domain: 'de',
    tk: 'dbt',
    tool: 'Airflow',
    framing:
      'A teammate asks: "We need to backfill 6 months of a daily pipeline after a logic fix, but last time a backfill took down the scheduler and double-wrote data. Explain how you\'d run it safely."',
    prompt: 'Explain how to safely backfill a long date range in Airflow without breaking prod.',
    arc: [
      { label: 'Frame the risk', body: 'A naive backfill floods the scheduler with hundreds of concurrent task instances, starves live DAGs of slots, and — if tasks aren\'t idempotent — double-writes. The two failure modes are resource contention and non-idempotency.' },
      { label: 'Make tasks idempotent first', body: 'Each run must be safe to re-run: partition writes by execution_date (ds) and use delete-insert / MERGE on that partition, not append. A backfill is worthless if re-running a date duplicates rows.' },
      { label: 'Bound concurrency', body: 'Limit blast radius: max_active_runs on the DAG, pools to cap shared-resource (DB/warehouse) parallelism, and chunk the range instead of one giant `airflow dags backfill`. Run it isolated from the live schedule where possible.' },
      { label: 'Use the right time semantics', body: 'Templated dates (ds / data_interval_start), not datetime.now(), so each backfilled run reads/writes ITS partition. catchup behaviour and the start_date must be deliberate, not accidental.' },
      { label: 'Trade-off', body: 'Higher concurrency = faster backfill but more contention with live SLAs; lower = slower but safe. Stagger or run off-peak. State the chosen ceiling and why.' },
      { label: 'Verify & quantify', body: 'Reconcile row counts per partition before/after, spot-check a few dates, confirm live DAGs kept their SLA. Cite: "182 partitions backfilled, no duplicates, scheduler lag stayed <30s."' },
    ],
    rubric: [
      'Identified the two real risks (scheduler/resource contention AND non-idempotent double-writes)',
      'Made tasks idempotent (partition by ds + delete-insert/MERGE) before backfilling',
      'Bounded concurrency (max_active_runs / pools / chunking) to protect live DAGs',
      'Used templated execution dates, not now(), for correct per-run partitions',
      'Verified with per-partition reconciliation or quantified SLA/duplicate impact',
    ],
  },
  {
    id: 'scn-python-memory-leak',
    domain: 'de',
    tk: 'sql',
    tool: 'Python',
    framing:
      'On-call: "Our long-running Python ETL service\'s memory climbs all day until the OOM-killer restarts it every few hours. Explain how you\'d find the leak and fix it."',
    prompt: 'Explain how you diagnose and fix unbounded memory growth in a long-running Python service.',
    arc: [
      { label: 'Symptom', body: 'RSS grows monotonically over hours; no crash on a single request, but the process gets OOM-killed and restarts. Throughput is fine until it dies — classic slow leak.' },
      { label: 'Confirm it IS a leak', body: 'Plot RSS over time first. A sawtooth that returns to baseline is normal GC churn, not a leak. A steady climb that never recovers is. Rule out simply loading a big dataset into memory at once (that\'s a design issue, not a leak).' },
      { label: 'Find what is retained', body: 'Use tracemalloc snapshots (diff two points) or objgraph to see which object type grows. The usual culprits: an unbounded cache/dict/list keyed by request, accumulating in a module-level global, or objects pinned by reference cycles / lingering references (e.g. closures, logging handlers, un-closed clients).' },
      { label: 'Fix (match the cause)', body: 'Unbounded cache → bound it (LRU with maxsize / TTL). Global accumulator → scope it per-request and let it be collected. Big dataset → stream/chunk instead of loading whole. Closed-resource leak → context managers. Don\'t paper over it by raising the memory limit.' },
      { label: 'Trade-off', body: 'A bounded cache trades hit-rate for stable memory; streaming trades a little throughput for flat RSS. State the ceiling you picked and the cost.' },
      { label: 'Prevent & quantify', body: 'Add an RSS/restart-rate metric + alert, a memory ceiling in CI/load test, and periodic tracemalloc in staging. Cite: "RSS flat at ~600MB over 24h, zero OOM restarts (was every 3h)."' },
    ],
    rubric: [
      'Confirmed it is actually a leak (RSS-over-time / sawtooth vs steady climb) before fixing',
      'Used a real tool (tracemalloc / objgraph) to find WHICH object is retained',
      'Named a real cause (unbounded cache / module global / cycle / unclosed resource)',
      'Gave a matching fix instead of just raising the memory limit',
      'Quantified stable memory / added a restart-rate or RSS alert',
    ],
  },
  {
    id: 'scn-llm-hallucination-prod',
    domain: 'ai',
    tk: 'rag',
    tool: 'LLMs',
    framing:
      'PM escalates: "A customer screenshot shows our LLM assistant confidently inventing a refund policy that doesn\'t exist. Explain why this happens and how you\'d actually reduce it in production — not just \'use a better model\'."',
    prompt: 'Explain LLM hallucination in production and how you systematically reduce it.',
    arc: [
      { label: 'Name the mechanism', body: 'An LLM predicts the most plausible next token, not the true one. With no grounding it fills gaps with fluent, confident fabrication — especially on specifics (policies, numbers, citations) outside or under-represented in training. Confidence is not calibrated to correctness.' },
      { label: 'Classify the failure', body: 'Is it (a) no source of truth given (ungrounded), (b) the right doc was retrieved but ignored, or (c) it answered something out of scope it should have refused? Each has a different fix; reproduce on a labeled set to know which dominates.' },
      { label: 'Ground it (biggest lever)', body: 'Put the authoritative policy in context via RAG and instruct: "answer ONLY from the provided context; if it\'s not there, say you don\'t know." Grounding + an explicit abstain path kills most of the fabrication-on-specifics class.' },
      { label: 'Constrain & verify', body: 'Lower temperature for factual tasks, require citations the answer must quote, add a verifier/groundedness check (does the claim appear in the retrieved text?), and use structured output where the schema is known. Refuse out-of-scope rather than guess.' },
      { label: 'Trade-off', body: 'Strict grounding + abstaining raises "I don\'t know" rate (lower coverage) and adds retrieval/verification latency + cost. You\'re trading some helpfulness/speed for trustworthiness — state the chosen point.' },
      { label: 'Quantify & monitor', body: 'Measure groundedness / factual-accuracy and unsupported-claim rate on a fixed eval set, log low-confidence/abstained answers for review. Cite: "unsupported-claim rate 9%→1.5%, abstain on out-of-scope 95%."' },
    ],
    rubric: [
      'Explained the real mechanism (next-token prediction, uncalibrated confidence) — not "the model is dumb"',
      'Classified the failure (ungrounded / ignored-context / out-of-scope) on a labeled set',
      'Made grounding + an explicit abstain/"I don\'t know" path the primary fix',
      'Named the coverage/latency/cost trade-off of strict grounding',
      'Quantified with groundedness / unsupported-claim rate on a fixed eval set',
    ],
  },
  {
    id: 'scn-sysd-rate-limiter',
    domain: 'de',
    tk: 'sysd',
    tool: 'System Design',
    framing:
      'Interviewer: "Design a rate limiter for our public API — 1000 requests per user per minute, across a fleet of stateless app servers. Walk me through it end to end."',
    prompt: 'Design a distributed rate limiter for a multi-server API.',
    arc: [
      { label: 'Clarify requirements', body: 'Per-user (key on API key/user id), 1000/min, fleet of N stateless servers behind a load balancer. Ask: hard or soft limit? per-region or global? fail-open or fail-closed if the limiter store is down? These change the design.' },
      { label: 'Why local counters fail', body: 'An in-memory counter per server lets a user do 1000×N by spreading requests across servers. The state must be shared, so the counter lives in a central low-latency store (Redis), keyed by user + window.' },
      { label: 'Pick the algorithm', body: 'Fixed window is simplest but allows a 2× burst at the window boundary. Sliding-window-log is exact but memory-heavy. Token bucket / sliding-window-counter smooths bursts with O(1) state — usually the right default. Name the one you\'d ship and why.' },
      { label: 'Make it atomic & correct', body: 'Read-modify-write across servers races; do the increment + check atomically (Redis INCR with EXPIRE, or a Lua script for token bucket) so concurrent requests can\'t both slip under the limit. Return 429 + Retry-After when over.' },
      { label: 'Trade-off & failure mode', body: 'Centralized store = a dependency and a hot key (shard/cluster it); strict global accuracy costs a network hop per request. Decide fail-open (availability) vs fail-closed (protection) when Redis is unreachable, and degrade gracefully.' },
      { label: 'Scale & quantify', body: 'Shard by user key, consider local-then-sync (approximate) for extreme scale, expose 429-rate and limiter p99 latency metrics. Cite the budget: "<1ms added p99, holds at 50k rps."' },
    ],
    rubric: [
      'Clarified limit semantics + fail-open vs fail-closed before designing',
      'Explained why per-server local counters break (allows N× the limit) and used shared state',
      'Chose a named algorithm (token bucket / sliding window) with justification',
      'Made the increment+check atomic (avoided the read-modify-write race) and returned 429/Retry-After',
      'Named the central-store trade-off (hot key / latency / availability) and a scale or metric target',
    ],
  },
  {
    id: 'scn-dbt-test-failure',
    domain: 'de',
    tk: 'dbt',
    tool: 'dbt',
    framing:
      'A teammate asks: "Our nightly dbt run failed on a unique test on the orders model and now downstream dashboards are stale. Explain how you\'d triage this and stop it recurring — without just deleting the test."',
    prompt: 'Explain how you triage a failing dbt test and prevent the recurrence.',
    arc: [
      { label: 'Read the failure, not the vibe', body: 'A unique test failed on orders.order_id means duplicates entered. First run the test\'s compiled SQL (dbt stores failing rows / `--store-failures`) to SEE the offending keys — don\'t theorize about why before looking.' },
      { label: 'Trace it upstream', body: 'Duplicates are a symptom. Did a source start sending dupes, did an incremental model double-insert a batch, or did a join fan out (many-to-many) and multiply rows? Walk the lineage to the model that introduced them.' },
      { label: 'Root cause (name it)', body: 'Common: a fan-out join missing a grain-defining filter, an incremental model whose unique_key/merge let a re-run append instead of merge, or a genuinely dirty source needing dedup. Identify which, not "the test is flaky."' },
      { label: 'Fix at the source of the bug', body: 'Fan-out → fix the join grain or aggregate. Incremental → set the correct unique_key and use merge/delete+insert so re-runs don\'t duplicate. Dirty source → an explicit dedup model with a documented rule. Then re-run; the test should pass without being weakened.' },
      { label: 'Trade-off', body: 'Deleting/loosening the test makes the build green but ships bad data downstream — never do that to unblock. Stricter tests catch more but can block releases; decide error vs warn severity per criticality.' },
      { label: 'Prevent & quantify', body: 'Add tests at the grain boundary (not just the mart), wire freshness + a CI build on PRs, and alert on failed tests. Cite: "dupes traced to incremental re-run, unique_key fixed, 0 failing rows, dashboards fresh by 6am."' },
    ],
    rubric: [
      'Inspected the actual failing rows (store-failures / compiled SQL) before theorizing',
      'Traced the dupes upstream through lineage instead of patching the mart',
      'Named the real cause (fan-out join / bad incremental unique_key / dirty source)',
      'Fixed the root cause and re-ran rather than deleting/loosening the test',
      'Added grain-level tests / CI / alerting and quantified the result',
    ],
  },
  {
    id: 'scn-snowflake-cost-spike',
    domain: 'de',
    tk: 'sql',
    tool: 'Snowflake',
    framing:
      'Finance flags it: "Our Snowflake bill doubled this month with no new users. Explain how you\'d find what\'s burning credits and bring it down — without just downsizing the warehouse and hoping."',
    prompt: 'Explain how you diagnose and reduce a Snowflake cost spike.',
    arc: [
      { label: 'Frame the cost model', body: 'Snowflake bills compute by warehouse-seconds (size × time it\'s running), plus storage and serverless features. A doubled bill is almost always compute: warehouses running longer, more often, or oversized — so attribute credits before changing anything.' },
      { label: 'Find the burn', body: 'Query ACCOUNT_USAGE / WAREHOUSE_METERING_HISTORY and QUERY_HISTORY: which warehouse and which queries consumed the credits? Look for warehouses that never auto-suspend (idle but billing), a runaway query/dashboard hammering on a schedule, or heavy spilling to remote storage (under-provisioned for the query).' },
      { label: 'Root cause (name it)', body: 'Common: auto-suspend set too high / disabled so the warehouse idles hot, a new BI dashboard polling constantly, multi-cluster scaling out under a thundering herd, or a query doing full scans because of no clustering/pruning. Identify which line item, not a guess.' },
      { label: 'Fix (match the cause)', body: 'Idle warehouse → set auto-suspend to ~60s and auto-resume. Bad query → fix pruning (cluster key / filter on partition columns) so it scans less. Burst load → right-size or cap multi-cluster max. Use result cache / materialized views for repeated dashboards. Separate workloads onto sized warehouses.' },
      { label: 'Trade-off', body: 'Aggressive auto-suspend adds cold-start latency on the next query; a smaller warehouse is cheaper but slower on big scans and may spill. Match warehouse size to workload, don\'t globally shrink.' },
      { label: 'Prevent & quantify', body: 'Set resource monitors with credit quotas + alerts, tag warehouses by team for chargeback, and watch spill. Cite: "idle ETL warehouse auto-suspend 600s→60s + dashboard moved to result cache, credits -45%."' },
    ],
    rubric: [
      'Explained the warehouse-seconds compute cost model and attributed credits via ACCOUNT_USAGE/QUERY_HISTORY first',
      'Found the specific burn (no auto-suspend / runaway query / multi-cluster / spill) — not guessing',
      'Named the real root cause line item',
      'Gave a matching fix (auto-suspend, pruning/clustering, right-size, result cache) — not a blanket downsize',
      'Named the latency/spill trade-off and added resource monitors / quantified savings',
    ],
  },
  {
    id: 'scn-spark-small-files',
    domain: 'de',
    tk: 'spark',
    tool: 'Spark',
    framing:
      'A teammate says: "Reads on our data-lake table have gotten painfully slow and the catalog lists hundreds of thousands of tiny files. Explain what happened and how you\'d fix it."',
    prompt: 'Explain the small-files problem on a data lake and how you fix it.',
    arc: [
      { label: 'Symptom', body: 'A partitioned table accumulates hundreds of thousands of tiny (KB-sized) files; every read spends more time listing + opening files and on per-file task overhead than reading data. Listing alone dominates.' },
      { label: 'Diagnose how they got there', body: 'Look at write patterns: streaming micro-batches or frequent appends each emit files; high shuffle-partition count means each writer task writes its own small file; over-partitioning (e.g. partition by an high-cardinality column) explodes file count. Confirm the source before compacting.' },
      { label: 'Root cause', body: 'Too many output partitions/writers relative to data volume, or streaming writes without compaction, or a partition scheme too granular. The engine pays fixed per-file cost (open + metadata) regardless of file size.' },
      { label: 'Fix (match the cause)', body: 'Compact: coalesce/repartition before write to target ~128MB–1GB files, run a periodic compaction job (or OPTIMIZE/compaction on Delta/Iceberg), and fix the partition scheme to a sensible cardinality. For streaming, add a downstream compaction/optimize step.' },
      { label: 'Trade-off', body: 'Bigger files = fewer reads but coarser pruning and more rewrite cost during compaction; coalesce avoids a shuffle but can skew; repartition shuffles but balances. State the target file size and why.' },
      { label: 'Prevent & quantify', body: 'Set a target file size in the writer, schedule compaction/OPTIMIZE, and alert on file count per partition. Cite: "420k files→3k, read latency 6min→40s, listing time negligible."' },
    ],
    rubric: [
      'Explained why small files hurt (per-file open/listing/task overhead dominates), not just "too many files"',
      'Diagnosed the write pattern that produced them (streaming / too many writers / over-partitioning)',
      'Named the root cause before compacting',
      'Gave a matching fix (compaction/OPTIMIZE, target file size, partition-scheme fix)',
      'Named a trade-off (pruning vs file size / shuffle) and quantified or added monitoring',
    ],
  },
  {
    id: 'scn-rag-stale-index',
    domain: 'ai',
    tk: 'rag',
    tool: 'RAG',
    framing:
      'Support lead: "Our RAG bot keeps quoting last quarter\'s pricing even though we updated the docs weeks ago. Explain why and how you\'d keep the index fresh — beyond \'just re-embed everything nightly\'."',
    prompt: 'Explain why a RAG system serves stale content and how you keep the index fresh.',
    arc: [
      { label: 'Symptom', body: 'The source doc is updated, but the bot still retrieves and quotes the old version — so the stale data lives in the vector index, not the source of truth.' },
      { label: 'Trace the ingestion path', body: 'Walk it: doc updated → was the change detected → re-chunked → re-embedded → upserted into the vector store → old vectors deleted? Stale answers mean one link broke. Check whether ingestion is event-driven or a forgotten one-off batch, and whether old chunks were ever removed.' },
      { label: 'Root cause (name it)', body: 'Usually: no incremental re-ingestion (the index was built once), updates append new chunks but never delete the superseded ones (so old + new both retrievable), or there\'s no document versioning so the retriever can\'t prefer the current one.' },
      { label: 'Fix', body: 'Drive ingestion off change events / a content hash so only changed docs re-embed; upsert by a stable doc/chunk id and DELETE superseded vectors (don\'t just add); store a version/updated_at in metadata and filter/prefer the latest. Add a freshness SLA on the pipeline.' },
      { label: 'Trade-off', body: 'Real-time re-embedding on every edit costs API calls + write load; nightly full re-embed is simple but wasteful and laggy. Incremental + change-detection is the middle ground — state the freshness target you\'re buying.' },
      { label: 'Quantify & monitor', body: 'Track index-vs-source staleness (max age of a chunk), and alert when an updated doc isn\'t reflected within the SLA. Cite: "pricing reflected within 5min of doc edit, zero stale superseded chunks retrievable."' },
    ],
    rubric: [
      'Located the staleness in the index/ingestion path (not the LLM)',
      'Traced the full ingestion chain (detect → re-chunk → re-embed → upsert → delete old)',
      'Named the real cause (no incremental ingest / superseded chunks not deleted / no versioning)',
      'Fixed with change-driven upsert + deletion of old vectors + metadata versioning',
      'Named the cost/freshness trade-off and added a staleness SLA / metric',
    ],
  },
  {
    id: 'scn-kafka-poison-pill',
    domain: 'de',
    tk: 'kafka',
    tool: 'Kafka',
    framing:
      'On-call at 2am: "A consumer keeps crashing on the same message, restarting, and crashing again — the whole partition is stuck and lag is exploding. Explain what\'s happening and how you\'d handle it safely."',
    prompt: 'Explain a Kafka "poison pill" stuck consumer and how you handle it without losing data.',
    arc: [
      { label: 'Symptom', body: 'One un-processable record (bad schema, undeserializable, or a record that always throws) sits at the committed offset. The consumer fails before committing, restarts, re-reads the SAME offset, fails again — an infinite loop that blocks every later message on the partition. Lag grows unbounded.' },
      { label: 'Diagnose', body: 'Confirm it\'s a single offset, not a systemic bug: the error is identical every restart and pinned to one partition/offset. Capture the offending record\'s key/offset/value. Distinguish a transient downstream outage (retry will eventually pass) from a truly poison record (will never pass).' },
      { label: 'Root cause', body: 'A record the consumer can never successfully process, combined with no error-isolation: the code treats every failure as retryable and never advances past it, so head-of-line blocking freezes the partition.' },
      { label: 'Fix', body: 'Add bounded retries, then route the failing record to a dead-letter topic (or quarantine store) and commit past it so the partition unblocks. Make processing idempotent so the retries before DLQ are safe. Never silently skip — the DLQ preserves it for inspection/replay.' },
      { label: 'Trade-off', body: 'DLQ + skip restores availability but can break strict ordering and risks dropping data if the DLQ isn\'t monitored/replayed; infinite retry preserves order but sacrifices the whole partition. Choose per business need (e.g. payments vs telemetry).' },
      { label: 'Prevent & quantify', body: 'Validate/schema-check at the edge (schema registry), alert on DLQ volume and per-partition stall, and build a replay path. Cite: "partition unblocked in <1min, 1 record to DLQ + alerted, lag drained, zero data lost."' },
    ],
    rubric: [
      'Explained the head-of-line-blocking loop (re-read same uncommitted offset) — not just "consumer is slow"',
      'Diagnosed single poison offset vs a transient/systemic failure before acting',
      'Used bounded retries + dead-letter topic + commit past it (not silent skip, not infinite retry)',
      'Addressed idempotency and the ordering/data-loss trade-off',
      'Added schema validation / DLQ monitoring / replay and quantified recovery',
    ],
  },
];
