import type { ConvItem } from "./types";

/**
 * Data/AI system design interview questions.
 * Researched from Glassdoor, Reddit r/dataengineering, Hello Interview,
 * startdataengineering.com, seattledataguy.substack.com, datavidhya.com,
 * and dataengineeracademy.com (2023-2026).
 * Architectural claims cross-verified against public engineering blogs
 * (Databricks, Confluent, Netflix, TikTok/Apache Paimon docs).
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const SYSTEMDESIGN_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────
  {
    id: "sd-clickstream-1b-pipeline",
    category: "systemdesign",
    executes: false,
    free: true,
    level: "junior",
    title: "Design a 1B-events/day clickstream pipeline",
    company: "E-commerce platform · Series B",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your company runs a high-traffic e-commerce site. A JavaScript tracking pixel fires on every page interaction. Today you see 1 billion raw events per day; the growth forecast is 3× in 18 months. The marketing team needs a dashboard showing hourly page views, top-20 products clicked, and conversion-funnel drop-off. The BI team is fine with data that is up to 1 hour fresh. Design the end-to-end pipeline from event capture to the dashboard layer. Walk me through every layer, your format and serialization choices, how you handle late-arriving or duplicate events, and where you would partition the data.",
    hints: [
      "Clarify the freshness SLA and access pattern first — 1-hour freshness unlocks micro-batch rather than full streaming, which is significantly cheaper at this scale.",
      "Name a durable, replayable log (Kafka or Kinesis) as your first landing zone before any transformation — raw events must be replayable if transformation logic changes later.",
      "Deduplication strategy: a client-generated event_id UUID lets you deduplicate with a simple DISTINCT or MERGE in the transformation layer; without it, you need a server-side fingerprint.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer opens by clarifying requirements: 1-hour freshness is the SLA, so micro-batch Spark or hourly Airflow DAGs are acceptable — full Flink streaming is over-engineered and more expensive. The candidate should drive through these layers: (1) Collection: the JS pixel POSTs events to a lightweight HTTP collector (API Gateway + Lambda, or Nginx with Lua). Events are serialized as Protobuf (3-5× smaller than JSON, strongly typed) and published to Kafka topics partitioned by product_id or page_category for locality. (2) Durable log: Kafka retains raw events for 7 days (configurable), enabling full replay. This is the Bronze source of truth. (3) Micro-batch transformation: every 10 minutes, a Spark Structured Streaming or scheduled Spark batch job reads from Kafka, deduplicates on event_id (DISTINCT or MERGE INTO Delta with event_id as key), sessionizes with a 30-minute inactivity gap, and writes Parquet to S3/GCS Bronze partitioned by event_date/event_hour. A Silver dbt or Spark job cleans nulls and standardizes event types. (4) Gold aggregation: a hourly dbt job pre-aggregates top-20 products by click count and funnel-step transitions into small summary tables in Snowflake or BigQuery, consumed by the BI tool. (5) Late data: events arriving up to 30 minutes late are handled naturally because the Bronze job runs every 10 minutes; events beyond 30 minutes are caught by a daily reconciliation job that re-runs the Silver merge for the affected hour partition. (6) Partitioning: S3 Bronze is partitioned by event_date=YYYY-MM-DD/event_hour=HH. Avoid high-cardinality partitions (e.g., user_id) — 50–200 partitions per table is the sweet spot to avoid Hive metadata overhead. (7) Scale to 3×: increase Kafka partition count, scale Spark workers horizontally, and switch to Z-order on product_id in Delta Lake for faster top-20 queries. Compaction: a weekly OPTIMIZE job merges small Parquet files into 128–256 MB files to prevent the small-files problem from streaming writes. Lambda vs. Kappa: this is effectively a Kappa architecture (one streaming path, replay via Kafka) — Lambda (dual batch+stream) is unnecessary here because 1-hour freshness does not require a real-time speed layer.",
    rubric: [
      "Clarifies freshness SLA before choosing batch vs. streaming and justifies the choice economically",
      "Places a durable replayable log (Kafka/Kinesis) as the first landing zone before any transformation",
      "Describes a concrete deduplication strategy (event_id DISTINCT or MERGE INTO) and handles late arrivals explicitly",
      "Names the serving/gold layer with pre-aggregations appropriate for the dashboard (not raw scans)",
      "Addresses partitioning strategy, small-files/compaction, and at least one scale concern (3× growth path)",
    ],
  },

  {
    id: "sd-metrics-dashboard-backend",
    category: "systemdesign",
    executes: false,
    free: false,
    level: "junior",
    title: "Metrics and dashboard backend for a SaaS product",
    company: "B2B analytics SaaS · Series A",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Your SaaS product lets customers track KPIs on a dashboard: API call counts, error rates, and revenue by day. Each customer emits events via your SDK. You have 2,000 customers today; the dashboard must show data refreshed within 5 minutes. Events arrive at 5,000 per second aggregate. Design the ingestion pipeline, the aggregation strategy, and the serving layer. Discuss how you would isolate one noisy customer from affecting others, how you handle a customer backfilling 30 days of historical data, and how you keep infrastructure costs manageable.",
    hints: [
      "Clarify the access pattern first: do customers query raw events, or pre-computed aggregates? Pre-computation almost always wins at this scale for a 5-minute SLA.",
      "Multi-tenancy isolation starts at the Kafka topic or partition level — one customer flooding 4,000 of your 5,000 events/second should not delay others.",
      "Backfill is a distinct workload from live ingestion; route it through a separate consumer group or queue so it cannot starve the live aggregation pipeline.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer starts by clarifying: customers consume pre-computed aggregates, not raw event scans — this drives a push/pre-compute architecture. (1) Ingestion: SDK events POST to API Gateway, validated and published to Kafka. Partition by customer_id (ensures per-customer ordering and natural isolation). A per-customer rate limiter at the API layer (token bucket in Redis, 500 events/second per customer by default) prevents one customer from monopolizing broker throughput. (2) Aggregation pipeline: a Flink job reads from Kafka, maintains 1-minute tumbling windows and 5-minute sliding windows keyed by customer_id + metric_name. Flink keyed state scoped to customer_id prevents cross-tenant contamination. Aggregated results are emitted every 60 seconds and written to a PostgreSQL or ClickHouse table keyed by (customer_id, metric_name, window_start). (3) Serving layer: the dashboard API reads from ClickHouse (low-latency OLAP, sub-second for single-customer queries) or a Redis cache with a 5-minute TTL. WebSocket or server-sent events push updates to browsers on each Flink emission. (4) Backfill: when a customer uploads 30 days of historical events via a bulk upload API, those events land in a separate Kafka topic (backfill-events) consumed by a separate Spark batch job that runs hourly. This ensures the live Flink job is never backpressured by bulk ingest. The backfill Spark job writes directly to ClickHouse with upsert semantics (INSERT OR REPLACE). (5) Cost: ClickHouse on self-managed VMs is 5–10× cheaper than Snowflake for append-heavy time-series queries. Alternatively, DuckDB on Lambda for query-time aggregation over S3 Parquet is viable if QPS is low. Monitoring: Kafka consumer lag per customer partition; Flink watermark lag; ClickHouse query latency p99; Redis hit rate.",
    rubric: [
      "Clarifies pre-compute vs. on-demand aggregation before designing and justifies the choice for a 5-minute SLA",
      "Addresses multi-tenant isolation at ingestion (per-customer Kafka partitioning + rate limiting)",
      "Separates backfill workload from live ingestion with a distinct consumer group or pipeline to prevent starvation",
      "Names a serving store appropriate for low-latency per-customer reads (ClickHouse, Redis, or equivalent)",
      "Discusses at least one cost trade-off and a monitoring strategy (consumer lag, watermark, p99 latency)",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────
  {
    id: "sd-event-dedup-system",
    category: "systemdesign",
    executes: false,
    free: true,
    level: "mid",
    title: "Exactly-once event deduplication at scale",
    company: "AdTech impression platform · Series C",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your ad-impression pipeline ingests events from hundreds of mobile and web publisher SDKs. The SDKs retry aggressively on network failure, so the same impression arrives 2–5× on average. Revenue billing is per unique impression. Design a deduplication system that guarantees each impression is counted exactly once in the billing report. Scale: 800 million raw events per day arriving over Kafka; events can arrive up to 8 hours late. Budget constraints are real — explain the cost profile of each major option. Address what happens if the dedup job crashes mid-run.",
    hints: [
      "Clarify the deduplication key before anything else: is there a client-generated event_id you can trust, or must you derive a deterministic server-side fingerprint from a combination of fields?",
      "Compare in-stream deduplication (Flink keyed state with RocksDB) vs. post-load deduplication (MERGE INTO a Delta/Iceberg table) on cost, correctness, and operational complexity.",
      "Idempotency is the safety net: re-running the dedup job after a crash must produce the same result — the MERGE INTO approach with a primary key achieves this naturally.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer opens by clarifying the dedup key. With retry-happy mobile SDKs, a client event_id is unreliable (clients may regenerate it on retry). The safer approach is a server-side fingerprint: SHA-256(publisher_id || placement_id || user_token || floor(epoch_ms / 60000)) — this is deterministic and collision-resistant within a 1-minute bucket. Two main architectures: (1) In-stream Flink dedup: key the Kafka stream on fingerprint; a Flink RocksDB state backend stores a set of seen fingerprints for an 8-hour window. Deduplicated events flow downstream to S3 Bronze and the billing DWH. At 800M events/day, the fingerprint set size is approximately 800M × 32 bytes × 8-hour window fraction ≈ 2–10 GB of RocksDB state — manageable on a 3-node Flink cluster (~$300–500/month on managed Kinesis Data Analytics). Crash recovery: Flink checkpoints to S3 every 30 seconds; on restart, state is restored from the last checkpoint and Kafka offsets are rewound to that point — exactly-once is preserved. (2) Post-load MERGE INTO (recommended for cost): land all raw events (including dupes) to a Delta Lake or Iceberg Bronze table partitioned by event_date/event_hour. Run a Spark MERGE INTO job every hour that joins Bronze against a Silver deduplicated table on fingerprint, inserting only rows where fingerprint NOT IN Silver. The MERGE job looks back 9 partitions (8-hour late window + 1 buffer). Cost: Spark on spot instances running 1 hour/day ≈ $50–80/month — an order of magnitude cheaper than always-on Flink. Idempotency: re-running the same MERGE for the same time window produces the same Silver rows because the fingerprint set is the same. Crash safety: if the MERGE crashes after writing some output, Delta’s ACID transaction is rolled back — the next run restarts cleanly. Recommendation: use post-load MERGE for billing (accuracy over latency acceptable), with a monitoring job that alerts if raw/deduplicated event ratio exceeds 6× (signals an SDK bug or replay attack). Monitoring: raw vs. deduplicated count per publisher per hour; fingerprint collision rate; MERGE job duration trend.",
    rubric: [
      "Clarifies the dedup key (client event_id vs. server fingerprint) and justifies the choice before designing",
      "Compares in-stream (Flink stateful) vs. post-load (MERGE INTO) dedup with explicit cost and correctness trade-offs",
      "Handles the 8-hour late-arrival window with a partition look-back or watermark strategy",
      "Demonstrates idempotency: re-running the dedup job after a crash produces identical results without double-counting",
      "Covers monitoring to detect dedup anomalies (raw/dedup ratio spike, publisher-level breakdown)",
    ],
  },

  {
    id: "sd-cdc-lakehouse-pipeline",
    category: "systemdesign",
    executes: false,
    free: false,
    level: "mid",
    title: "CDC pipeline from Postgres to a lakehouse",
    company: "Subscription SaaS · growth stage",
    difficulty: "medium",
    mode: "text",
    prompt:
      "The business runs a Postgres OLTP database with orders, customers, and subscriptions tables (60M rows total, growing at 700K inserts/day with heavy updates). The analytics team needs a lakehouse that reflects the operational state within 15 minutes. Hard deletes in Postgres must be tracked for compliance. Design a CDC pipeline end to end. Address: how you perform the initial full load without blocking production, schema evolution when engineers add or rename a column, exactly-once delivery semantics, and how you handle a connector outage that lasts 4 hours.",
    hints: [
      "Clarify WAL access vs. query-only access first — log-based CDC (Debezium reading Postgres logical replication slots) is the only option that reliably captures hard deletes; polling-based CDC misses them entirely.",
      "Schema evolution is the silent pipeline killer: describe how you prevent a new nullable column in Postgres from breaking the downstream Avro schema and causing consumer failures.",
      "The 4-hour connector outage is the real stress test: Postgres WAL retention must be configured to outlast the max expected outage window, or you lose changes and must re-snapshot.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer immediately asks: do we have WAL access? Assuming Postgres logical replication is enabled (wal_level = logical), the architecture is: (1) CDC connector: Debezium Postgres connector reads the WAL via a replication slot and emits row-level change events (INSERT, UPDATE, DELETE with before/after images) to Kafka, one topic per source table (e.g., cdc.public.orders). The Kafka message key = primary key ensures per-row ordering and enables compaction. Confluent Schema Registry with Avro enforces backward-compatible schema evolution: adding a nullable column with a default value is allowed; renaming or dropping a column requires a new schema version and consumer migration. (2) Initial full load: Debezium snapshot mode reads a consistent snapshot (using a repeatable-read transaction) of all three tables while buffering new WAL events. The snapshot runs during off-peak hours and produces an initial set of INSERT events that bootstrap the lakehouse. Alternatively, a separate Spark job dumps the tables to S3 Bronze while Debezium buffers WAL; once Spark finishes, Debezium switches to streaming from the buffered offset. (3) Lakehouse write: a Flink or Spark Structured Streaming job consumes the Kafka CDC topics and applies MERGE INTO (Delta Lake with ACID transactions, or Apache Iceberg with MERGE ON READ). INSERT and UPDATE events upsert on primary key. DELETE events set an is_deleted = true flag and a deleted_at timestamp — soft delete in the lakehouse enables time-travel queries for compliance. (4) Exactly-once: Kafka consumer offsets are committed atomically with the Delta MERGE transaction using Delta’s optimistic concurrency control. The MERGE is idempotent: re-applying the same CDC event with the same primary key produces the same row. (5) 4-hour outage recovery: Postgres WAL retention (wal_keep_size or replication slot’s retained_lsn) must be set to retain at least 6 hours of WAL (outage + buffer). If the connector resumes within that window, it replays from the last committed LSN with no data loss. If WAL is purged, the connector must re-snapshot. Alert on replication slot lag > 2 hours to page before WAL is lost. (6) Schema evolution in the lakehouse: Delta Lake mergeSchema=true adds new columns automatically. Downstream dbt models use explicit column selection (never SELECT *) to avoid breaking when new columns appear. Column renames require a migration plan: add the new column name, backfill, then deprecate the old name. Monitoring: Debezium consumer lag in Kafka (target < 5 minutes); WAL slot retained_lsn vs. current LSN; MERGE job p99 duration; nightly row-count reconciliation (Postgres row count vs. lakehouse non-deleted row count).",
    rubric: [
      "Identifies log-based CDC (Debezium + WAL) vs. query-based polling and explains why WAL is required for delete capture",
      "Describes an initial full-load strategy that is consistent with the ongoing CDC stream (snapshot + buffered WAL replay)",
      "Explains schema evolution protection with Schema Registry, backward-compat rules, and explicit column selection downstream",
      "Addresses exactly-once or idempotent delivery via MERGE semantics, atomic offset commit, and crash-safe re-runs",
      "Handles the 4-hour outage scenario: WAL retention configuration, alerting on replication slot lag, and re-snapshot fallback",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────
  {
    id: "sd-fraud-detection-pipeline",
    category: "systemdesign",
    executes: false,
    free: false,
    level: "senior",
    title: "Near-real-time fraud detection data platform",
    company: "Payments fintech · Series D",
    difficulty: "hard",
    mode: "text",
    prompt:
      "You are designing the data platform for a payments company processing 8,000 transactions per second at peak. Fraud must be flagged within 150ms of a transaction arriving. The ML team’s gradient-boosted model needs 20 features: some static (merchant category, account age), some real-time aggregates (transaction count in the last 5 minutes, velocity deviation from the 30-day average). False-positive blocks are expensive — each blocked legitimate transaction costs the company $12 in customer-service calls. Design the full platform: feature computation, online vs. offline store, model serving, the feedback loop from analyst fraud labels back to retraining, and the monitoring layer. Be specific about latency budgets and failure modes.",
    hints: [
      "Clarify the 150ms budget decomposition first — how much goes to feature retrieval, model inference, network overhead, and the decision API? This decomposition drives every architectural choice downstream.",
      "The dual-store problem is the core challenge: an online store (Redis, <5ms reads) for inference and an offline store (Delta Lake, point-in-time-correct) for training are fundamentally different systems — describe both and how you keep them consistent.",
      "Training-serving skew is the most common failure mode in production ML pipelines: the feature values computed at inference time must be reproducible during training. Describe exactly how you guarantee this with point-in-time joins.",
    ],
    starter: "",
    idealAnswer:
      "A strong senior answer starts by decomposing the 150ms budget: feature retrieval ≤15ms, model inference ≤40ms (CPU ONNX) or ≤10ms (GPU), decision API + network ≤95ms. Anything slower gets a synchronous timeout with a fallback rule (e.g., approve if model unavailable, flag for async review). Architecture: (1) Ingestion: transactions publish to Kafka partitioned by user_id for per-user state locality. (2) Real-time feature computation: a Flink job maintains keyed state per user_id: 5-minute sliding window (transaction count, sum of amounts), and an exponentially-weighted moving average of transaction amount updated on each event. Static features (merchant category, account age) are pre-loaded into Redis from the operational DB via CDC. Flink writes computed feature vectors to Redis (online store) keyed by user_id with a 24-hour TTL; it also dual-writes to a Delta Lake offline store partitioned by event_date with event_timestamp and a system_timestamp. (3) Model serving: a Python serving endpoint (ONNX Runtime) fetches 20 features from Redis in a single pipeline call (~3ms), scores the model (~35ms on CPU), and returns a risk score. The payments API applies a configurable threshold (tunable per merchant segment) to approve, decline, or route to manual review. (4) Offline store and training: the Delta Lake offline store enables point-in-time-correct training. Training dataset generation: for each labeled transaction (user_id, transaction_id, event_timestamp, label), join to the offline feature table using AS OF event_timestamp — this ensures the model sees only features that were available at the moment of scoring, preventing future leakage. (5) Feedback loop: fraud analysts label transactions (confirmed_fraud / confirmed_legitimate / inconclusive) in a case tool; labels land in a labels table. The retraining pipeline runs weekly: it point-in-time-joins offline features to labels, trains on 90 days, validates on the last 14 days (holdout), and runs a shadow deployment for 48 hours (new model scores transactions in parallel but does not block) before promotion. Promotion gate: precision@5%-recall must be ≥ current model AND p99 inference latency ≤ 40ms. (6) Monitoring: model performance (AUC-ROC, precision/recall on analyst-labeled sample weekly), feature freshness lag (Flink checkpoint lag — alert if > 30s), feature distribution drift (KL divergence on 20 features vs. 30-day baseline — alert if any feature drifts > 0.1 nats), false-positive rate trend (alerts if FP rate rises 15% week-over-week), and Redis hit rate (miss = feature unavailable = degraded model). Failure modes: Redis outage → fallback to rule-based scoring (velocity > 5 TXN/minute = decline). Flink restart → replay from last Kafka checkpoint; state is restored from RocksDB snapshot in S3. Lambda vs. Kappa: this is Kappa — the same Flink pipeline serves both real-time scoring features and populates the offline store. No separate batch layer is needed because Flink’s event-time processing with watermarks handles late arrivals correctly.",
    rubric: [
      "Decomposes the 150ms latency budget across feature retrieval, inference, and network before designing any component",
      "Describes both an online store (Redis, low-latency) and offline store (Delta Lake, point-in-time-correct) and explains how dual-writes keep them consistent",
      "Addresses training-serving skew prevention via point-in-time joins using event_timestamp as the feature lookup cutoff",
      "Explains the analyst feedback loop end to end: labels table → point-in-time training join → shadow deployment → promotion gate",
      "Covers monitoring for model drift, feature drift, false-positive rate, and Redis availability with explicit alert thresholds",
    ],
  },

  {
    id: "sd-feature-store-design",
    category: "systemdesign",
    executes: false,
    free: false,
    level: "senior",
    title: "Design a centralized feature store for 20+ ML models",
    company: "Media streaming platform · FAANG-adjacent",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your ML platform has 20+ recommendation and ranking models maintained by six different teams. Each model independently computes overlapping features: user watch history (last 30 days), content popularity (rolling 7-day view count), and user-content affinity scores. The result is redundant pipelines, inconsistent feature definitions between teams, and training-serving skew that causes silent model degradation. Design a centralized feature store. Scale: 80M users, 2M content items, online inference at 15,000 QPS with a <10ms feature retrieval SLA. Address feature versioning (what happens when the watch-history window changes from 30 to 60 days), backfill strategy, and how you enforce training-serving consistency across all 20+ models.",
    hints: [
      "Clarify the online inference latency budget first — <10ms mandates an in-memory online store; a relational DB or even DynamoDB without DAX will not reliably hit this target at 15K QPS.",
      "The versioning problem is the core challenge: old models pinning feature v1 and new models using feature v2 must coexist in both the online and offline stores simultaneously — describe the key schema and routing logic.",
      "Training-serving skew prevention requires the same retrieval SDK to be used both at inference time and during training dataset generation; logging exact feature values at inference time (feature logging) is the gold standard for skew elimination.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer opens by clarifying the <10ms SLA at 15K QPS. This rules out DynamoDB standard (10–20ms p99 under load) and mandates Redis Cluster (sub-millisecond in-memory reads, horizontally scalable). Architecture: (1) Feature registry: a Git-backed YAML/protobuf registry is the single source of truth. Each entry defines: feature_name, entity_key (user_id or content_id), computation logic (SQL or Flink job reference), owner, version (semver), freshness SLA, and upstream data sources. A CI pipeline lints new feature definitions and checks for naming conflicts before merge. (2) Offline store: a Delta Lake table per feature group, partitioned by entity_id_bucket (hash mod 1000) and event_date. Each row carries event_timestamp (when the observation was valid) and system_timestamp (when it was written). Point-in-time join at training time: for each training example (entity_id, label_timestamp), join to the latest offline row where event_timestamp <= label_timestamp. This prevents future leakage. Feature versioning in the offline store: each semver gets its own column family or table suffix (e.g., user_watch_history_v2). Old versions are retained for 180 days to support re-training old model checkpoints. (3) Online store: Redis Cluster with key schema {feature_group}:{version}:{entity_id} → JSON or MessagePack value. A Python retrieval SDK fetches multiple feature groups in a single Redis PIPELINE command (~2–3ms round-trip for 20 features). Models pin a version string in their config; the SDK routes to the correct key prefix. At 15K QPS × 20 features, Redis handles ~300K commands/second — a 3-node Redis Cluster (r6g.xlarge) is sufficient with headroom. (4) Materialization pipeline: a Flink job continuously computes streaming features (rolling 7-day content popularity updated every 5 minutes) and dual-writes to the offline store (via Kafka → S3/Delta compaction job) and online store (Redis SETEX with TTL = freshness SLA). Batch features (affinity scores from a weekly Spark ALS job) are written to the offline store first, then an hourly Spark job materializes them to Redis for all active user_ids (those with a session in the last 7 days). (5) Versioning and backfill: when the watch-history window changes from 30 to 60 days (a breaking change, major version bump), a Spark backfill job computes the v2 feature for the last 180 days of user events and writes to the offline store under version v2. The online store materializer writes both v1 and v2 keys during the migration period. Models migrate one by one by updating their version pin; once all models are on v2, v1 keys expire (TTL = 7 days). (6) Training-serving skew prevention: the retrieval SDK used at inference time is the same open-source library used in the training dataset generation notebook. Additionally, the online serving gateway logs each feature request and response to a feature_log Kafka topic (asynchronously, off the hot path). A daily job samples 0.1% of these logs and computes distribution divergence vs. the corresponding offline feature values for the same entity + timestamp. An alert fires if any feature’s KL divergence > 0.05 nats. (7) Monitoring: feature freshness (time since last materialization vs. SLA — alert if stale), Redis cache miss rate (miss triggers a fallback re-compute or returns a default), training-serving skew score per feature, and offline store job SLA adherence.",
    rubric: [
      "Justifies Redis Cluster as the online store based on the <10ms SLA at 15K QPS, and explains why alternatives fall short",
      "Distinguishes the offline store (point-in-time correct, for training, Delta Lake with event_timestamp) from the online store (low-latency, for inference, Redis)",
      "Describes the versioning migration end to end: new version in offline store, dual-write to Redis during migration, model-by-model pin update, and v1 key expiry",
      "Explains the backfill strategy for the watch-history window change (Spark historical recompute writing to the v2 partition)",
      "Covers training-serving skew detection via feature logging + distribution divergence monitoring, not just architectural claims",
    ],
  },

  {
    id: "sd-lakehouse-design",
    category: "systemdesign",
    executes: false,
    free: false,
    level: "senior",
    title: "Design a production lakehouse from scratch",
    company: "Logistics enterprise · Series E",
    difficulty: "hard",
    mode: "text",
    prompt:
      "A logistics company processes data from 50,000 IoT GPS trackers, order-management system events, and third-party carrier APIs. All three sources have different latency profiles: GPS pings arrive every 30 seconds in near-real-time, OMS events arrive via Kafka within seconds, and carrier APIs are polled every 15 minutes. The company wants a unified lakehouse that supports: (a) operational dashboards with 5-minute freshness, (b) ad-hoc SQL analytics by the data science team, and (c) ML feature tables for an ETA prediction model. Today’s scale: 2 TB of new data per day. Design the full lakehouse architecture: table format choice, medallion layer design, Lambda vs. Kappa trade-off for the mixed-latency sources, compaction and Z-order strategy, governance, and how you handle schema evolution across three heterogeneous sources.",
    hints: [
      "Clarify the freshness SLA and query patterns before choosing Lambda vs. Kappa — 5-minute freshness for dashboards combined with ad-hoc SQL suggests a streaming-first Kappa architecture writing to an open table format, but the 15-minute carrier API poll cadence means some sources are inherently batch.",
      "Table format choice (Delta Lake vs. Apache Iceberg) is consequential: ask whether the company is locked into Databricks (favors Delta) or needs multi-engine access via Trino, Flink, and Spark simultaneously (favors Iceberg).",
      "Compaction and Z-order are not optional at 2 TB/day: small files from streaming writes will degrade query performance within weeks. Describe when and how you run OPTIMIZE/compaction, and which columns you Z-order for the dominant query patterns.",
    ],
    starter: "",
    idealAnswer:
      "A strong senior answer starts by clarifying requirements and constraints: multi-engine access (Trino for ad-hoc SQL, Flink for streaming, Spark for ML batch jobs) points toward Apache Iceberg over Delta Lake for avoiding vendor lock-in, though Delta is acceptable if Databricks is the primary engine. The answer should explicitly name this trade-off. Architecture: (1) Ingestion layer: GPS pings → Kafka topics partitioned by tracker_id (natural locality for vehicle-level state). OMS events → Kafka (already streaming). Carrier API → an Airflow DAG polls every 15 minutes, writes JSON responses to S3 Bronze as-is, and emits a Kafka message signaling new data is available. (2) Lambda vs. Kappa decision: this is a hybrid scenario. GPS and OMS sources are native streams — Kappa (one Flink pipeline, replay via Kafka) is the right choice for these two. Carrier API is inherently batch (15-minute poll) — treating it as “streaming” adds complexity with no benefit; a micro-batch Spark job every 15 minutes is simpler and sufficient. The architecture is therefore a pragmatic hybrid: Kappa for streaming sources, scheduled Spark for the batch source, unified writes to the same Iceberg tables. (3) Medallion layers: Bronze — raw immutable Parquet/Avro in S3, partitioned by source + event_date. Nothing is ever deleted from Bronze; it is the replay source. Silver — Flink writes cleansed, deduplicated, typed Parquet to Iceberg tables. GPS: partitioned by tracker_id_bucket (hash mod 500) + event_date. OMS: partitioned by order_date. Carrier: partitioned by carrier_id + poll_date. Schema evolution: Iceberg’s schema evolution is backward-compatible — adding or renaming columns does not rewrite existing files; the catalog tracks the schema history. New fields added by any source are automatically surfaced in the Silver table without a migration job. Gold — Spark or dbt jobs create pre-aggregated tables: current_vehicle_positions (latest GPS per tracker, Z-ordered on tracker_id), order_transit_status (joined OMS + carrier data), and ETA_features (per-order, per-segment travel time statistics for the ML model). (4) Compaction and Z-order: Flink writes produce small files (one file per Flink task per checkpoint interval — typically 128 MB target but often smaller under load). An hourly Iceberg compaction job (CALL system.rewrite_data_files) merges files to 256 MB targets. A daily CALL system.rewrite_manifests optimizes partition metadata. Z-order columns: GPS Silver → Z-order on (tracker_id, event_timestamp) for time-range queries on individual vehicles. OMS Silver → Z-order on (customer_id, order_date) for customer-level analytics. Gold ETA_features → Z-order on (route_segment_id, event_date) for the ML training query pattern. (5) Governance: Apache Polaris or Unity Catalog (if Databricks) manages table metadata, lineage, and access control. Row-level security: carrier API data is confidential to partner integrations — a view with a WHERE carrier_id = current_role() restricts access. PII (driver names, customer addresses in OMS) is tagged in the catalog and column-masked for non-privileged users. Data lineage tracks Bronze → Silver → Gold dependencies for impact analysis when upstream schemas change. (6) Monitoring: Flink consumer lag per Kafka topic (alert if > 5 minutes); compaction job duration trend (alert if nightly OPTIMIZE exceeds 2 hours, signaling file explosion); Iceberg snapshot age (old snapshots accumulate; run EXPIRE SNAPSHOTS weekly, retaining 30 days); query latency p95 on Gold tables (alert if > 10 seconds, indicating Z-order degradation from skipped compaction).",
    rubric: [
      "Justifies table format choice (Iceberg vs. Delta) based on multi-engine access requirements and vendor lock-in trade-offs",
      "Makes an explicit Lambda vs. Kappa decision per source type, not a blanket choice, and justifies the hybrid approach for mixed-latency ingestion",
      "Describes compaction and Z-order strategy with specific columns and a concrete schedule — not a hand-wave",
      "Covers all three medallion layers (Bronze raw, Silver cleaned/typed, Gold aggregated/ML-ready) with partitioning rationale",
      "Addresses schema evolution across heterogeneous sources (Iceberg schema evolution) and governance (access control, PII masking, lineage)",
    ],
  },
];
