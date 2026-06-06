import type { ConvItem } from "./types";

/**
 * Case-study / open-ended system-design interview questions.
 * Researched from Glassdoor, Reddit r/dataengineering, Hello Interview,
 * startdataengineering.com, systemdesignhandbook.com, and Medium (2023-2026).
 * Every idealAnswer was cross-checked against real architectural patterns.
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const CASESTUDY_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────
  {
    id: "case-clickstream-ingest",
    category: "casestudy",
    executes: false,
    free: true,
    level: "junior",
    title: "Clickstream ingest → S3 → dashboard",
    company: "E-commerce startup · Series A",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Your company just launched a new storefront. The marketing team wants a daily dashboard showing page views, top products clicked, and funnel drop-off rates. A JavaScript tracking pixel fires an event on every page interaction — roughly 2 million events per day today, projected to grow 10× in 12 months. Design the end-to-end pipeline from event capture to the dashboard. Walk me through every layer and your key choices.",
    hints: [
      "Before drawing boxes, ask: what is the acceptable data freshness — minutes, hours, or next-morning batch? That drives streaming vs. batch.",
      "Think about where raw events land first (a durable log or object storage) before any transformation — you want to be able to replay.",
      "Name the transformation layer explicitly: what cleans, deduplicates, and sessionizes events before they reach the BI layer?",
    ],
    starter: "",
    idealAnswer:
      "Strong answers open by clarifying requirements: daily freshness is acceptable at this scale, so a batch architecture is fine for now. The candidate should name a landing zone (S3 raw/bronze prefix) where the JS pixel posts events via a lightweight API (API Gateway + Lambda or a simple Nginx collector). Events are serialized as JSON or Protobuf and partitioned by date. A nightly Spark or dbt job reads the raw Parquet files, cleans and deduplicates (dropping events with the same session_id + event_type + timestamp within a 1-second window), sessionizes (30-minute inactivity gap), and writes to a silver layer. A gold layer pre-aggregates the top-20 products, funnel steps, and daily uniques into small summary tables consumed by a BI tool (Looker, Metabase). For 10× growth, the candidate should mention partitioning S3 by date+hour, switching the collector to Kafka or Kinesis to handle burst, and potentially shifting to micro-batch Spark Structured Streaming. Key trade-offs: JSON is human-readable but 3-5× larger than Protobuf; storing raw events in S3 enables full replay if the transformation logic changes. Deduplication strategy: use an event_id UUID generated client-side and deduplicate with DISTINCT on event_id in dbt. The candidate should also mention data quality checks: null user_id rates, unexpected schema columns, and daily row-count anomalies.",
    rubric: [
      "Asks about data freshness SLA before choosing batch vs. streaming",
      "Identifies a durable raw landing zone (S3 / object store) before transformation",
      "Names at least two transformation concerns: deduplication and sessionization",
      "Describes a serving/gold layer appropriate for a BI dashboard (pre-aggregations or a DWH)",
      "Addresses at least one scale or failure concern (10× growth path, partition strategy, or data quality check)",
    ],
  },
  {
    id: "case-marketplace-warehouse",
    category: "casestudy",
    executes: false,
    free: false,
    level: "junior",
    title: "Data warehouse for a two-sided marketplace",
    company: "Gig marketplace · early-stage",
    difficulty: "easy",
    mode: "text",
    prompt:
      "You are the first data engineer at a two-sided marketplace (buyers post jobs, sellers bid and fulfill). The CEO wants a weekly report: total GMV, average time-to-fill per category, and seller churn rate. Data lives in a Postgres operational database with three tables: jobs, bids, and users. Design a data warehouse that supports these reports. Cover modeling, pipeline, and tooling choices.",
    hints: [
      "Start by identifying the grain of each fact table — what does one row represent?",
      "Ask whether historical snapshots matter (e.g., did the seller's tier change between bid and fulfillment?).",
      "A simple daily batch pipeline with dbt on top of a cloud warehouse is the right scope for junior — don't over-engineer into streaming.",
    ],
    starter: "",
    idealAnswer:
      "A strong junior answer starts by modeling: fact_jobs (grain: one row per job, with keys to dim_user for buyer, dim_category, and date), fact_bids (grain: one row per bid, with job_id FK, seller_id FK, bid_amount, outcome). dim_user tracks sellers and buyers; since seller tier can change, SCD Type 2 is worth mentioning (add effective_from / effective_to columns) though SCD Type 1 is acceptable with the caveat that history is lost. The pipeline extracts from Postgres nightly via a full extract or incremental watermark on updated_at, loads raw tables to S3 or the warehouse staging area, then dbt models transform to facts and dims. GMV is SUM(job_filled_amount) on fact_jobs WHERE status = 'filled'. Time-to-fill: DATEDIFF(filled_at, posted_at) averaged by category. Seller churn: sellers active in week N-4 but absent in week N. Tooling: Fivetran or Airbyte for extraction, Snowflake or BigQuery as the warehouse, dbt for transformation, and a BI tool for the weekly report. Key trade-offs: full extract is simple but does not scale past ~10M rows; incremental watermark is faster but misses hard-deleted rows. The candidate should mention a data quality check: GMV should not be negative, and category dimension should be complete before the fact load.",
    rubric: [
      "Defines a clear grain for at least one fact table",
      "Mentions at least one slowly-changing dimension concern",
      "Describes a full extraction or incremental watermark from Postgres",
      "Names the transformation layer (dbt or equivalent) and at least one DWH tool",
      "Explains how at least one of the three required metrics is computed from the model",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────
  {
    id: "case-deduplication-system",
    category: "casestudy",
    executes: false,
    free: true,
    level: "mid",
    title: "Exactly-once event deduplication at scale",
    company: "AdTech platform · Series B",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your ad-impression pipeline ingests events from hundreds of publisher SDKs. The SDKs retry on network failure, so the same impression can arrive 2-5× on average. Revenue reporting is billed per unique impression. Design a deduplication system that guarantees each impression is counted exactly once in the billing report. Scale: 500 million events/day, events can arrive up to 6 hours late. Budget is a real constraint — explain cost trade-offs.",
    hints: [
      "Clarify the deduplication window first: events arriving up to 6 hours late means you need state that outlives a single micro-batch.",
      "A deterministic event fingerprint (hash of publisher_id + ad_id + user_token + timestamp_bucket) is more reliable than trusting client-generated IDs.",
      "Compare in-stream deduplication (Flink keyed state) vs. post-load deduplication (MERGE INTO a warehouse table) on cost and correctness.",
    ],
    starter: "",
    idealAnswer:
      "A strong mid-level answer opens by clarifying the deduplication key: is there a client-provided event_id, or must we derive a fingerprint? With retry-happy SDKs, a server-side fingerprint (SHA-256 of publisher_id + placement_id + user_token + floor(epoch_seconds / 60)) is more reliable. Two main patterns: (1) In-stream with Flink: key the stream on fingerprint; Flink RocksDB state keeps a bloom filter or exact set for a 6-hour window; deduplicated events flow to Kafka and into S3/DWH. Cost: RocksDB on managed Flink (Kinesis Data Analytics or Confluent) runs ~$0.10/CKU-hour, and state at 500M events × 20-byte fingerprint = ~10 GB state — manageable. (2) Post-load with Delta Lake / Iceberg MERGE INTO: land all events (including dupes) to S3 Bronze, then run a MERGE INTO on fingerprint every hour; much cheaper compute but 1-hour dedup lag and the billing table is dirty until the merge runs. The candidate should recommend option 2 for billing (correctness over latency) and discuss idempotency: re-running the MERGE must be safe. For the 6-hour late-arrival window, the MERGE must look back 6 hours of partitions — partition on event_date+event_hour and look back 7 partitions. Monitoring: track raw vs. deduplicated count per hour; a >5% dedup rate spike signals an SDK bug or attack. The candidate should mention that the billing system should consume only the deduplicated table, not the raw stream.",
    rubric: [
      "Clarifies the deduplication key strategy (client event_id vs. server-derived fingerprint) before designing",
      "Compares at least two deduplication approaches (in-stream stateful vs. post-load MERGE) with trade-offs",
      "Handles the 6-hour late-arrival window explicitly with a partition look-back or watermark strategy",
      "Addresses idempotency: re-running the dedup job must not double-count",
      "Mentions monitoring or alerting to detect dedup anomalies",
    ],
  },
  {
    id: "case-metrics-dashboard-backend",
    category: "casestudy",
    executes: false,
    free: false,
    level: "mid",
    title: "Near-real-time metrics dashboard backend",
    company: "SaaS analytics product · Series C",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your product embeds a real-time metrics dashboard that end customers use to monitor their own KPIs (e.g., API call counts, error rates, revenue). Each customer has up to 50 metrics; you have 5,000 customers. The dashboard must refresh within 10 seconds. Events arrive via a customer-facing REST API at up to 50,000 events/second aggregate. Design the backend data pipeline and serving layer. Discuss how you handle late data, multi-tenancy isolation, and backfill when a customer's config changes.",
    hints: [
      "Ask: are the 10-second aggregations pre-computed and pushed, or computed on-demand at query time? That fork determines your entire architecture.",
      "Multi-tenant systems often need per-customer quotas at the ingestion layer — think about what happens if one customer sends 40,000 of the 50,000 events/second.",
      "Late data arriving after a window closes: does the dashboard show corrected numbers or is eventual correction acceptable?",
    ],
    starter: "",
    idealAnswer:
      "A strong answer starts by clarifying: are aggregations pre-computed (push model) or on-demand (pull model)? For a 10-second SLA across 5,000 customers, pre-computation is safer. Architecture: (1) Ingestion — customer events POST to an API Gateway, validated and published to Kafka topics partitioned by customer_id (ensures per-customer ordering, natural isolation). A per-customer rate limiter at the API layer prevents one noisy customer from dominating. (2) Stream Processing — a Flink job reads from Kafka, maintains 1-minute tumbling windows and 10-second sliding windows per (customer_id, metric_name). Flink keyed state scoped to customer_id provides tenant isolation. Aggregated results are emitted every 10 seconds. (3) Serving store — results written to Redis hashes keyed by customer_id:metric_name with a 60-second TTL. The dashboard WebSocket or server-sent-events backend reads from Redis and pushes to the browser. (4) Late data — Flink allowed lateness of 30 seconds; events arriving after 30 seconds are dropped with a dead-letter queue metric. For financial metrics, the candidate should mention that a nightly batch job recomputes from raw S3 (the source of truth) and overwrites the warehouse table. (5) Backfill on config change — when a customer adds a new metric definition, trigger a Spark job that reads raw events from S3 and populates historical data into the warehouse; the Redis layer is warm-started from the warehouse on next query. Trade-offs: Redis is fast but volatile — if it crashes, all dashboards are stale until the Flink window emits again (up to 10 seconds). A read-through cache from ClickHouse or DuckDB is a safer fallback. Monitoring: Flink consumer lag per customer topic; Redis hit rate; WebSocket connection count.",
    rubric: [
      "Distinguishes push (pre-compute) vs. pull (on-demand) architecture and justifies the choice",
      "Addresses multi-tenant isolation at both ingestion (rate limiting/partitioning) and processing (keyed state) layers",
      "Explains the late-data policy explicitly (allowed lateness, dead-letter, or nightly correction batch)",
      "Describes the serving store and why it meets the 10-second refresh SLA",
      "Covers the backfill strategy when customer configuration changes",
    ],
  },
  {
    id: "case-cdc-pipeline",
    category: "casestudy",
    executes: false,
    free: false,
    level: "mid",
    title: "CDC pipeline from Postgres to a lakehouse",
    company: "Subscription SaaS · growth stage",
    difficulty: "medium",
    mode: "text",
    prompt:
      "The business has a Postgres operational database (orders, customers, subscriptions tables — ~50M rows total, growing at 500K inserts/day with frequent updates). The analytics team needs a data lakehouse that reflects the operational state within 10 minutes. Hard deletes in Postgres must be tracked. Design a CDC pipeline from Postgres to your lakehouse. Address schema evolution, exactly-once delivery, and how to handle an initial full load.",
    hints: [
      "Clarify whether you have access to the Postgres WAL (log-based CDC) or only query access (polling-based CDC) — the choice changes your tooling entirely.",
      "Log-based CDC (Debezium) captures deletes; query-based polling misses them. Mention this distinction early.",
      "Schema evolution is the silent killer of CDC pipelines — describe how you prevent a new column in Postgres from breaking downstream consumers.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer immediately asks: do we have WAL access? Assuming yes (Postgres logical replication enabled), the architecture is: Debezium connector reads the WAL and emits row-level change events (INSERT/UPDATE/DELETE with before/after images) to Kafka, one topic per source table (e.g., cdc.public.orders). Each message key = primary key ensures per-row ordering. Confluent Schema Registry with Avro enforces backward-compatible schema evolution — adding a nullable column with a default is allowed; renaming or removing a column is rejected. Initial full load: Debezium snapshot mode reads a consistent snapshot of the table before switching to streaming, or a separate Spark job does a one-time dump to S3 Bronze while Debezium buffers WAL events. Bronze layer stores raw CDC events as Parquet or Avro partitioned by event_date. Silver layer: a Flink or Spark Structured Streaming job applies MERGE INTO (Delta Lake / Iceberg) using the primary key — INSERT events upsert, DELETE events set an is_deleted flag and a deleted_at timestamp (soft delete in the lakehouse). This enables time-travel queries. Exactly-once: Kafka consumer group offsets are committed atomically with the Delta MERGE transaction using Delta Lake's optimistic concurrency control; the job is idempotent because re-applying the same MERGE with the same LSN range produces the same result. Schema evolution in the lakehouse: Delta Lake's schema merging (mergeSchema=true) adds new columns automatically; the downstream dbt models use explicit column selection (never SELECT *) to avoid breaking on schema changes. Monitoring: Debezium connector lag in Kafka (target < 1 minute), WAL retention window (must be longer than max connector downtime), and a reconciliation count comparing Postgres row count vs. lakehouse current-state table nightly.",
    rubric: [
      "Identifies log-based (WAL/Debezium) vs. query-based CDC and justifies the choice for delete capture",
      "Describes an initial full-load strategy that is consistent with the ongoing CDC stream",
      "Explains schema evolution protection (schema registry + backward-compat rules + explicit column selection)",
      "Addresses exactly-once or idempotent delivery via MERGE semantics and offset management",
      "Covers delete handling (soft delete with is_deleted flag) and monitoring (connector lag, WAL retention)",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────
  {
    id: "case-fraud-pipeline",
    category: "casestudy",
    executes: false,
    free: false,
    level: "senior",
    title: "Near-real-time fraud detection pipeline",
    company: "Payments fintech · Series D",
    difficulty: "hard",
    mode: "text",
    prompt:
      "You are designing the data platform for a payments company processing 5,000 transactions per second at peak. Fraud must be flagged within 200ms of a transaction event. The ML team has a gradient-boosted model that needs 15 features: some are static (merchant category, account age), some are real-time aggregates (transaction count in last 5 minutes, amount deviation from 30-day average). False-positive blocks cost revenue. Design the end-to-end pipeline: feature computation, model serving, feedback loop, and retraining cadence.",
    hints: [
      "Clarify the latency budget breakdown: 200ms total — how much goes to feature retrieval, model inference, and the decision API?",
      "The hardest part is the dual feature store: online store for <5ms reads at inference time, offline store for point-in-time-correct training. Describe both.",
      "The feedback loop is where most candidates fall short — discuss how analyst-labeled fraud decisions flow back into retraining without introducing label leakage.",
    ],
    starter: "",
    idealAnswer:
      "A strong senior answer starts by decomposing the 200ms budget: feature retrieval ≤20ms, model inference ≤50ms, network + decision API ≤130ms. Architecture: (1) Ingestion — transactions publish to Kafka partitioned by merchant_id for locality. (2) Real-time feature computation — a Flink job maintains keyed state per (user_id, merchant_id): 5-minute sliding window for transaction count/amount sum, and a pre-computed 30-day rolling average updated every hour via a batch job. Flink writes computed features to Redis (online store) with a 24-hour TTL. Static features (merchant category, account age) are pre-loaded into Redis on account creation and updated via CDC. (3) Model serving — a TensorFlow Serving or ONNX Runtime endpoint reads 15 features from Redis in a single pipeline call (~5ms), scores the model (~20ms on CPU, ~5ms on GPU), and returns a risk score. The payments API blocks or routes to manual review based on threshold (configurable per merchant). (4) Offline store — Flink also writes the same feature values, along with the transaction_id and event_timestamp, to a Delta Lake table (offline store). This enables point-in-time-correct joins: during training, features are joined to labels using the timestamp of the transaction, not the timestamp of the analyst's label. (5) Feedback loop — fraud analysts label transactions (confirmed fraud / confirmed legitimate) in a case management tool; labels land in a labels table in the DWH. The retraining pipeline runs weekly: it point-in-time-joins offline features to labels (using the transaction event_timestamp as the cutoff to avoid leakage), trains on the last 90 days, validates on last 14 days, and promotes if precision@0.05-recall ≥ previous model. (6) Monitoring — model performance degradation (AUC, precision/recall), feature drift (KL divergence on feature distributions), and latency p99 per Flink operator. Trade-offs: Redis is fast but eventually consistent — a feature update in Flink may lag by up to the checkpoint interval (e.g., 10 seconds). For the 30-day rolling average, a batch job refreshing hourly is acceptable given the window. False-positive cost: lower thresholds to reduce blocks, but monitor fraud rate uplift in A/B tests before full rollout.",
    rubric: [
      "Decomposes the 200ms latency budget across feature retrieval, inference, and network before designing",
      "Describes both an online store (Redis, low-latency reads) and offline store (Delta Lake, point-in-time joins for training)",
      "Addresses the training-serving skew risk via point-in-time-correct feature joins",
      "Explains the feedback loop from analyst labels to retraining without label leakage",
      "Covers monitoring: model drift, feature drift, and pipeline latency p99",
    ],
  },
  {
    id: "case-feature-store",
    category: "casestudy",
    executes: false,
    free: false,
    level: "senior",
    title: "Design a feature store for a recommendation engine",
    company: "Media streaming platform · FAANG-adjacent",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your ML team trains 20+ recommendation models that all need overlapping features: user watch history (last 30 days), content popularity (rolling 7-day view counts), and user-content affinity scores. Features are computed by different teams, creating inconsistency and redundant pipelines. Design a centralized feature store that serves both offline training and online inference. Address versioning, backfill, and the training-serving skew problem. Scale: 50M users, 500K content items, inference at 10,000 QPS.",
    hints: [
      "Clarify the latency SLA for online inference first — 10ms vs. 100ms changes your online store choice entirely.",
      "The training-serving skew problem is the core challenge: the exact feature values used to score during inference must be reproducible during training. Ask how you guarantee that.",
      "Feature versioning: what happens when a feature definition changes (e.g., watch history window changes from 30 to 60 days)? Old models and new models must coexist.",
    ],
    starter: "",
    idealAnswer:
      "A strong senior answer opens with clarifying the online inference latency SLA. At 10K QPS and assuming a 50ms total API budget, feature retrieval must be <10ms, which mandates an in-memory online store (Redis Cluster or DynamoDB DAX). Architecture: (1) Feature registry — a Git-backed YAML registry defines each feature: name, entity (user_id or content_id), computation logic, owner, SLA, and version. This is the single source of truth. (2) Offline store — Delta Lake table per feature group, partitioned by entity_id and event_date. Features are written with an event_timestamp (when the observation was valid) and a created_timestamp (when it was written). Point-in-time join at training time: for each training example (user_id, label_timestamp), join to the latest feature row where event_timestamp ≤ label_timestamp. This prevents future leakage. (3) Online store — Redis Cluster: key = {feature_group}:{entity_id}, value = JSON of latest feature values, TTL = feature SLA (e.g., 1 hour for watch history). The retrieval SDK fetches multiple feature groups in a Redis pipeline call. (4) Materialization pipeline — a Flink job continuously computes streaming features (rolling 7-day popularity updated every minute) and dual-writes to both the offline store (Kafka → S3/Delta) and online store (Redis). Batch features (affinity scores from a Spark job running hourly) are written to offline store first, then materialized to online store. (5) Versioning — each feature version gets a unique semver. Old versions remain in the offline store for re-training old model versions. Online store serves the latest version by default; models pin a version in their feature retrieval config. (6) Backfill — when a feature definition changes (30→60 day window), a Spark backfill job recomputes the feature for the last 90 days of history and writes to a new version partition. (7) Skew prevention — the retrieval SDK used at inference time is the same library used to generate training datasets. Logged feature values at inference time (store request and response in a feature log S3 table) can be used for exact-match training, eliminating skew entirely. Monitoring: feature freshness (time since last write vs. SLA), online store miss rate (falls back to offline store), training-serving skew score (distribution divergence between offline features and logged online features).",
    rubric: [
      "Distinguishes the offline store (point-in-time-correct, for training) from the online store (low-latency, for inference)",
      "Explains point-in-time joins to prevent future label leakage during training dataset generation",
      "Addresses feature versioning: how old and new feature definitions coexist for different model versions",
      "Describes the dual-write materialization pipeline and how streaming vs. batch features are handled differently",
      "Covers monitoring for training-serving skew (e.g., distribution divergence or logged feature comparison)",
    ],
  },
  {
    id: "case-llm-serving-pipeline",
    category: "casestudy",
    executes: false,
    free: false,
    level: "senior",
    title: "LLM inference and observability pipeline at scale",
    company: "Enterprise AI SaaS · Series C",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your product exposes an AI assistant powered by a fine-tuned LLM. Users send up to 50,000 requests/day today, growing 5× in 6 months. Each request must be logged (prompt, response, latency, model version, cost) for billing, safety review, compliance, and model evaluation. You must also detect prompt injection attacks, enforce per-customer token budgets, and support A/B testing between model versions. Design the data platform behind this: ingestion, storage, evaluation pipeline, and the observability layer.",
    hints: [
      "Clarify data retention and compliance requirements first — prompts may contain PII, which constrains where and how long you store them.",
      "Token budget enforcement must happen synchronously before inference. Observability logging can be async — separate the hot path from the cold path.",
      "The A/B evaluation pipeline is where most candidates hand-wave — describe exactly how you determine which model version wins.",
    ],
    starter: "",
    idealAnswer:
      "A strong senior answer opens by clarifying: What is the compliance regime (GDPR, HIPAA, SOC2)? How long must logs be retained? Can raw prompts be stored, or must they be hashed/truncated? With PII concerns, prompts are stored with customer_id-scoped encryption and a 90-day retention policy in a private S3 bucket with Object Lock. Architecture: (1) Hot path — when a request arrives, a token budget check runs synchronously against Redis (per-customer remaining tokens for the billing period). If budget is exhausted, the request is rejected with a 429. Otherwise, the request is forwarded to the model serving tier. Prompt injection detection runs as a lightweight classifier (distilBERT) with <10ms latency in the same synchronous hop. (2) Async logging — after the model responds, the gateway emits a structured log event (request_id, customer_id, model_version, prompt_hash, response_hash, input_tokens, output_tokens, latency_ms, cost_usd, injection_score) to Kafka. This decouples inference latency from logging overhead. A Flink job consumes the log topic and writes to: (a) a Delta Lake table for analytics and billing (partitioned by customer_id, date), (b) a ClickHouse table for real-time observability dashboards (p50/p95/p99 latency, cost per customer, error rate), and (c) a safety review queue for requests where injection_score > 0.7. (3) Billing — a nightly dbt job aggregates input_tokens + output_tokens per customer and writes to a billing_events table consumed by the billing microservice. Idempotency: request_id is the dedup key; reprocessing the same request_id produces the same row. (4) A/B testing — new model versions are assigned a traffic percentage in a feature flag system. The experiment assignment (request_id, model_version, experiment_id) is logged in the same Kafka event. An evaluation pipeline runs nightly: for each experiment, it samples 500 prompt-response pairs per variant, runs an LLM-as-judge evaluation (GPT-4o scoring helpfulness, accuracy, safety on a 1-5 scale), and computes win rate. A Bayesian stopping rule determines when statistical significance is reached. Results publish to a Slack channel and a dashboard. (5) Model evaluation on production traffic — a weekly pipeline samples 1,000 logged requests (stratified by customer tier and use case), strips PII, and runs them through candidate model versions. Output quality scores are compared to the current production model. (6) Observability — Grafana dashboards on ClickHouse: latency percentiles by model version, token cost trends, injection detection rates, and per-customer quota utilization. Alerts on p99 latency > 5s or error rate > 1%. Trade-offs: storing raw prompts enables richer eval but increases PII risk and storage cost; storing only hashes is safer but limits debugging. The recommended approach is customer-controlled data sharing consent: customers opt in to raw log storage for premium support and advanced eval.",
    rubric: [
      "Separates the hot path (synchronous token budget + injection check) from the async observability pipeline to protect inference latency",
      "Addresses PII compliance explicitly: encryption, retention policy, and customer consent before designing storage",
      "Describes a concrete A/B evaluation methodology (LLM-as-judge, Bayesian stopping, win rate) rather than hand-waving",
      "Covers idempotent billing aggregation with a dedup key and a nightly reconciliation job",
      "Explains the real-time observability layer (ClickHouse / metrics store) and what alerts are wired up",
    ],
  },
];
