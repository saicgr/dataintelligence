import type { CodeExample, FollowUp, RedFlag, Risk } from "../types";

export interface Authored {
  category: string;
  riskLevel: Risk;
  isComparison?: boolean;
  comparisonTools?: string[];
  freePreview?: boolean;
  asked?: number;
  questionText: string;
  answerStructured: string;
  explanationDeep: string;
  code?: CodeExample[];
  interviewerLens: string;
  followupChain: FollowUp[];
  redFlags: RedFlag[];
  alternatePhrasings: string[];
  interviewContexts: string[];
}

/** Topic lists used to generate stubs for collapsed categories + filler deep dives. */
export interface ToolTopics {
  moreDeepDives: string[];
  decisions: string[];
  quickRef: string[];
  redFlags: RedFlag[];
  checklist: string[];
  behavioral: string[];
  reverse: string[];
}

export const DE_AUTHORED: Record<string, Authored[]> = {
  snowflake: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 31,
      questionText:
        "A dashboard query on a 4 TB table is slow. Walk me through how you'd diagnose and fix it in Snowflake.",
      answerStructured:
        "- Start at the **Query Profile**, not the warehouse size. Look for the dominant operator: TableScan with low partition pruning, an exploding join, or spilling to local/remote disk.\n- Check **pruning**: `partitions scanned / partitions total`. Poor pruning usually means the filter columns don't match the natural clustering, so I'd evaluate a **clustering key** or a materialized view.\n- Check **spilling**: bytes spilled to local/remote storage means the warehouse is memory-bound — size up *temporarily* or reduce the working set, don't just leave it XL.\n- Separate **cold vs warm**: re-run to see result cache / warehouse cache effects before concluding.\n- Only after the query is efficient do I talk about right-sizing the warehouse or a dedicated warehouse for BI concurrency.",
      explanationDeep:
        "The senior move is to treat warehouse size as the *last* lever, not the first. Snowflake's performance story is mostly about how many micro-partitions you touch and whether the operation fits in memory. The Query Profile tells you which it is.\n\nPruning is the big one. Micro-partitions store min/max metadata per column; a `WHERE event_date = ...` only prunes well if data is roughly ordered by `event_date`. High-cardinality, randomly-distributed predicates prune badly no matter how big the warehouse is. That's when clustering keys or a pre-aggregated materialized view earn their cost.\n\nSpilling is the second. When a join or sort exceeds memory, Snowflake spills to local SSD and then to remote storage — remote spill is catastrophically slow. Sizing up doubles memory and often removes the spill, but the durable fix is reducing the working set (filter earlier, avoid `SELECT *`, prune the join).",
      interviewerLens:
        "I'm listening for whether you reach for the Query Profile or just say 'make the warehouse bigger.' Juniors scale compute; seniors find out *why* it's slow first. If you mention partition pruning and spilling unprompted, you've basically passed this question. The trap I set is hoping you'll say 'bump it to a 2XL' — candidates who do that have never owned a Snowflake bill.",
      followupChain: [
        { question: "When would a clustering key actually hurt you?", answer: "On high-churn tables: reclustering is a background cost that scales with how much you rewrite. If the table is small, or queries don't filter on the clustering column, you're paying credits for nothing. Clustering pays off on large, mostly-append tables filtered on a consistent key." },
        { question: "Result cache vs warehouse cache — what's the difference?", answer: "Result cache returns the exact prior result for an identical query (within 24h, if underlying data is unchanged) with no compute. Warehouse (local SSD) cache holds recently-read micro-partitions so a *similar* query scans less. The first needs query identity; the second just needs a warm warehouse." },
        { question: "How would you stop one bad BI query from starving ETL?", answer: "Separate warehouses per workload, plus a resource monitor and statement timeout on the BI warehouse. Multi-cluster (auto-scale) handles BI concurrency spikes without touching ETL." },
      ],
      redFlags: [
        { junior: "\"I'd resize the warehouse to XL.\"", senior: "\"I'd open the Query Profile and check pruning and spilling before touching warehouse size.\"" },
        { junior: "\"Snowflake auto-tunes, so there's nothing to do.\"", senior: "\"Auto-tuning handles micro-partitioning, but clustering, query shape, and warehouse isolation are still on me.\"" },
      ],
      alternatePhrasings: [
        "\"Our BI dashboard got slow overnight — how do you investigate?\"",
        "\"How do you optimize an expensive Snowflake query?\"",
      ],
      interviewContexts: [
        "Asked at a Series B fintech for a Senior Analytics Engineer role",
        "Came up in 2 separate Snowflake-heavy interviews",
      ],
    },
    {
      category: "decision-frameworks",
      riskLevel: "medium",
      asked: 14,
      questionText:
        "How do you decide between a view, a materialized view, and a scheduled table for a heavy aggregation?",
      answerStructured:
        "- **View**: always fresh, zero storage, but recomputes every read. Good for cheap logic or low query volume.\n- **Materialized view**: Snowflake keeps it current automatically and even rewrites queries to use it — but it's restricted (single table, limited functions) and costs maintenance credits.\n- **Scheduled table** (task + MERGE/INSERT): full control over refresh cadence, joins, and incremental logic; staleness is bounded by the schedule. Best for complex multi-table aggregates queried often.\n- Decision driver = **read frequency × compute cost vs freshness requirement × maintenance cost**.",
      explanationDeep:
        "I frame it as: how often is this read, how expensive is it to compute, and how fresh must it be? A view that's read once a day can be expensive and nobody cares. A view powering a dashboard hit 10k times an hour is a disaster — that's a materialized view or a scheduled table.\n\nMaterialized views are seductive but boxed in: single base table, no joins, limited aggregate functions. The moment you need a multi-table rollup you're into a task-driven table with incremental MERGE logic, which also gives you control over when the credits are spent.",
      interviewerLens:
        "I want to hear the three axes — freshness, read volume, compute cost — not a memorized definition of each object. The senior signal is naming the materialized-view restrictions (single table!) because that's the thing people hit in production and get surprised by.",
      followupChain: [
        { question: "Your materialized view won't create — why?", answer: "Almost always because the query joins, uses a window function, or an unsupported aggregate. MVs are single-table with a restricted function set; that's the usual wall." },
        { question: "How do you make the scheduled table incremental?", answer: "A stream on the source captures changes; the task does a MERGE using the stream, so each run only processes new/changed rows instead of a full rebuild." },
      ],
      redFlags: [
        { junior: "\"Materialized views are just faster views, always use them.\"", senior: "\"MVs are single-table and maintenance-costed — I check the restrictions and the read/refresh ratio first.\"" },
      ],
      alternatePhrasings: ["\"When would you pre-aggregate vs compute on the fly?\""],
      interviewContexts: ["Asked at an enterprise data-platform team"],
    },
    {
      category: "tool-comparison",
      riskLevel: "high",
      isComparison: true,
      comparisonTools: ["Snowflake", "Databricks"],
      asked: 22,
      questionText:
        "Snowflake vs Databricks for a new analytics platform — which would you choose and why?",
      answerStructured:
        "- **It depends on workload mix.** Snowflake wins on SQL analytics + BI: near-zero ops, great concurrency, predictable for warehousing teams.\n- **Databricks wins on data science + ML + big unstructured/streaming**: notebooks, Spark, MLflow, and the lakehouse with open Delta format.\n- **Governance/format**: Databricks (Delta + Unity Catalog) is open-format and lake-first; Snowflake is more managed/closed but now supports Iceberg tables.\n- **Cost model**: Snowflake credits per-warehouse-second (easy to reason about); Databricks DBUs + your own cloud compute (more knobs, more savings if you tune).\n- I'd pick **Snowflake** for a SQL/BI-centric org that wants low ops, **Databricks** for an ML/streaming-heavy org that wants open format and one platform for engineering + science.",
      explanationDeep:
        "The wrong answer is declaring a universal winner. The right answer ties the choice to the team and workload. If your consumers are analysts writing SQL and Tableau, Snowflake's operational simplicity is worth a lot. If you have ML teams who live in notebooks and you're ingesting streaming + unstructured data, Databricks consolidates that better and avoids format lock-in via Delta.\n\nThe modern nuance: the lines blur. Snowflake added Snowpark and Iceberg; Databricks added great SQL warehousing. So I anchor on existing team skills, governance requirements (open vs managed), and the dominant workload — and I say so explicitly.",
      interviewerLens:
        "This is a trap for tribal answers. If you immediately say 'Databricks is better' or 'Snowflake is better' with no qualification, you've failed it. I'm hiring someone who picks based on workload, team, and cost — and who knows both have eaten into each other's territory. Naming Iceberg/Snowpark shows you're current.",
      followupChain: [
        { question: "Where does open table format (Iceberg/Delta) actually matter?", answer: "When you want multiple engines on one copy of data, or to avoid vendor lock-in. If everything is one vendor's SQL anyway, the format matters less day-to-day but still de-risks future migration." },
        { question: "How would you control cost on each?", answer: "Snowflake: auto-suspend, right-sized + isolated warehouses, resource monitors. Databricks: job clusters over all-purpose, spot instances, autoscaling, and photon for SQL." },
      ],
      redFlags: [
        { junior: "\"Databricks is just better / Snowflake is just better.\"", senior: "\"Depends on workload mix and team — here's the line I'd draw and why.\"" },
      ],
      alternatePhrasings: ["\"We're greenfield — lakehouse or warehouse?\""],
      interviewContexts: ["Asked at 3 separate platform-team interviews"],
    },
  ],
  dbt: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 27,
      questionText:
        "Explain dbt incremental models and how you handle late-arriving data correctly.",
      answerStructured:
        "- An **incremental model** only processes new/changed rows instead of rebuilding the whole table, gated by `is_incremental()` and a filter on a watermark (e.g. `updated_at > (select max(updated_at) from {{ this }})`).\n- For correctness, set a **`unique_key`** so dbt does a MERGE/delete+insert rather than blind append — otherwise late or re-sent rows duplicate.\n- Handle **late-arriving data** with a lookback window (`>= max - interval '3 days'`) so records that land after their event time still get picked up and merged.\n- Pick the right **incremental strategy** (`merge`, `delete+insert`, `insert_overwrite`) for the warehouse, and use `on_schema_change` to control column drift.\n- Keep a periodic **full refresh** (`--full-refresh`) for safety net / backfills.",
      explanationDeep:
        "The naive incremental model — append where timestamp is newer than the max — is wrong the moment data arrives late or gets corrected, because you both miss late rows and duplicate corrected ones. The fix is two-part: a `unique_key` so updates merge instead of duplicate, and a lookback window so the filter reaches back far enough to catch stragglers.\n\nThe lookback is a deliberate trade: too short and you miss late data, too long and you reprocess more rows (cost). I size it to the observed lateness distribution plus a margin. And I always keep full-refresh working, because incremental state can drift and you need a clean rebuild path.",
      interviewerLens:
        "Anyone can recite `is_incremental()`. The senior tell is the late-arriving-data handling: unique_key + lookback window. If you don't mention `unique_key`, I assume your incremental tables silently duplicate in prod. Bonus points for mentioning that you keep full-refresh as an escape hatch.",
      followupChain: [
        { question: "merge vs delete+insert vs insert_overwrite?", answer: "merge updates matched rows in place (needs unique_key, good general default). delete+insert removes matching keys then inserts (simpler semantics on some warehouses). insert_overwrite replaces whole partitions — great for partitioned, idempotent daily rebuilds on BigQuery/Spark." },
        { question: "How do you test an incremental model?", answer: "Unique + not_null on the key, a freshness/row-count test, and crucially a full-refresh-vs-incremental reconciliation in CI to catch drift between the two paths." },
      ],
      redFlags: [
        { junior: "\"I filter where updated_at > max(updated_at).\"", senior: "\"...with a unique_key for merges and a lookback window for late data, plus a full-refresh fallback.\"" },
        { junior: "\"Incremental is always faster, so always use it.\"", senior: "\"Incremental trades compute for complexity and drift risk — I use it when the table is big and mostly-append.\"" },
      ],
      alternatePhrasings: [
        "\"How do you avoid reprocessing the whole table every run?\"",
        "\"Walk me through a production incremental model.\"",
      ],
      interviewContexts: ["Asked at 3 separate analytics-engineering interviews", "Series A SaaS, Senior AE loop"],
    },
    {
      category: "tool-comparison",
      riskLevel: "medium",
      isComparison: true,
      comparisonTools: ["dbt", "Stored Procedures"],
      asked: 9,
      questionText:
        "Why dbt instead of orchestrating transformations with stored procedures?",
      answerStructured:
        "- **Version control + code review**: dbt models are files in git, so transformations get PRs, history, and rollback. Stored procs rot in the database.\n- **Testing + docs**: built-in schema/data tests and auto-generated lineage docs; procs have none of this by default.\n- **DAG + modularity**: `ref()` builds a dependency graph and handles run order; procs you wire by hand.\n- **Environments**: dev/CI/prod via targets and `defer`, hard to replicate with procs.\n- Trade-off: dbt is transform-only (ELT, in-warehouse) and adds a tool to learn; procs can be fine for tiny shops already living in the DB.",
      explanationDeep:
        "The core argument is software-engineering discipline applied to SQL: versioning, testing, modularity, and lineage. Stored procedures technically transform data too, but they're invisible to git, untested, and order-dependent in ways nobody documents.\n\nI'm honest about the trade: dbt assumes ELT (compute in the warehouse) and is one more thing to run. For a two-person shop with five procs, that overhead may not pay. At any real scale, it does.",
      interviewerLens:
        "I want the engineering-maturity answer (git, tests, lineage), not just 'dbt is modern.' Candidates who can also name when dbt is overkill show judgment rather than hype.",
      followupChain: [
        { question: "What does ref() actually buy you?", answer: "It declares dependencies so dbt builds the DAG and run order automatically, and it makes models environment-aware (dev vs prod schemas) without hardcoding names." },
      ],
      redFlags: [
        { junior: "\"dbt is just nicer SQL.\"", senior: "\"dbt brings testing, lineage, and version control to transforms — that's the real win.\"" },
      ],
      alternatePhrasings: ["\"What does dbt give you over plain SQL scripts?\""],
      interviewContexts: ["Asked at a mid-size SaaS company"],
    },
  ],
  airflow: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 24,
      questionText:
        "What makes an Airflow DAG idempotent, and why does it matter for backfills?",
      answerStructured:
        "- **Idempotent** = re-running a task for the same logical date produces the same result, no duplicates or drift.\n- Achieve it by partitioning work on the **execution/logical date** (`{{ ds }}`/`data_interval_start`) and writing to a **deterministic partition** you overwrite, not append.\n- Use **`INSERT OVERWRITE` / delete-by-partition / MERGE**, never blind `INSERT`.\n- Keep tasks **atomic and side-effect-isolated** — write to a temp location then swap, so a mid-task failure doesn't leave partial state.\n- This is what makes **backfills and retries safe**: you can rerun any date range and get correct results.",
      explanationDeep:
        "Backfills are the reason idempotency matters. The whole value of Airflow's scheduler is being able to (re)run any historical interval. If your task appends, a retry or backfill double-writes. If it overwrites a date partition keyed on the logical date, you can run 2019 again tomorrow and get the identical, correct table.\n\nThe second half is atomicity: write to a staging path/table and atomically swap or MERGE at the end, so a crash mid-run never leaves the destination half-written. Don't depend on `datetime.now()` inside tasks — depend on the logical date the scheduler passes in, or backfills silently compute 'today's' data for an old interval.",
      interviewerLens:
        "The phrase I'm waiting for is 'keyed on the execution date' and 'overwrite the partition.' If you say you `INSERT` rows in a task, I know your backfills duplicate data and you've probably been burned by it (or will be). Mentioning `now()` as an anti-pattern is a strong senior signal.",
      followupChain: [
        { question: "Why is using datetime.now() in a task a bug?", answer: "Because a backfill of an old date should use that date's logical interval, not wall-clock now. now() makes tasks non-deterministic and breaks reruns. Use the logical date macros instead." },
        { question: "How do you stop overlapping runs of the same DAG?", answer: "max_active_runs=1 and/or depends_on_past, plus pools to bound concurrency on shared resources." },
        { question: "Backfill of 2 years is hammering the source DB — what do you do?", answer: "Bound concurrency with a pool and max_active_runs, add a sensor/rate limit, and consider catchup=False with a controlled, chunked backfill rather than unleashing all intervals at once." },
      ],
      redFlags: [
        { junior: "\"I just INSERT the new rows each run.\"", senior: "\"I overwrite the date partition keyed on the logical date so retries and backfills stay correct.\"" },
        { junior: "\"I use datetime.now() to get the run date.\"", senior: "\"I use the execution/logical date macros so backfills compute the right interval.\"" },
      ],
      alternatePhrasings: ["\"How do you make a pipeline safe to re-run?\"", "\"Design a DAG that can be backfilled.\""],
      interviewContexts: ["Asked at a logistics company, Senior DE loop", "Came up in 2 orchestration-heavy interviews"],
    },
  ],
  kafka: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 26,
      questionText:
        "How does Kafka partitioning interact with ordering and consumer parallelism?",
      answerStructured:
        "- Ordering is guaranteed **only within a partition**, not across the topic. So the partition key decides what stays ordered.\n- Parallelism is bounded by partition count: **at most one consumer per partition** within a group, so #partitions caps consumer concurrency.\n- Choose the **key** so that everything that must be ordered (e.g. all events for one `user_id`/`account_id`) lands on the same partition.\n- Watch for **hot partitions**: a skewed key (one whale customer) overloads one partition/consumer.\n- Increasing partitions later **reshuffles key→partition mapping**, breaking ordering for in-flight keys — plan partition count up front.",
      explanationDeep:
        "The single most important sentence: ordering is per-partition. New engineers assume a topic is an ordered log; it's N ordered logs. So the design question is 'what's my ordering unit?' and you key on that. Order per user? Key on user_id.\n\nThen parallelism: a consumer group assigns each partition to exactly one consumer, so you can never have more working consumers than partitions. Under-partition and you can't scale out; over-partition and you add overhead and tiny-batch inefficiency. And because the default partitioner is `hash(key) % numPartitions`, adding partitions later remaps existing keys — ordering guarantees break for keys mid-flight. That's why partition count is an up-front capacity decision.",
      interviewerLens:
        "I'm checking that you know ordering is per-partition and that partition count caps consumer parallelism — those two facts drive every real Kafka design decision. The follow-up trap is asking what happens when you add partitions; if you don't flinch about ordering/rebalancing, you haven't run Kafka in anger.",
      followupChain: [
        { question: "exactly-once vs at-least-once — when do you need EOS?", answer: "At-least-once + idempotent consumers covers most pipelines cheaply. Exactly-once (idempotent producer + transactions) is for money-movement / dedup-critical flows where downstream can't dedupe; it costs throughput and complexity." },
        { question: "A single consumer can't keep up — options?", answer: "Add consumers up to the partition count; beyond that you must add partitions (accepting the remap), speed up processing, or fan out work after consuming." },
      ],
      redFlags: [
        { junior: "\"Kafka keeps all messages in order.\"", senior: "\"Order is per-partition; I key on the entity that must stay ordered.\"" },
        { junior: "\"Just add partitions whenever you need speed.\"", senior: "\"Adding partitions remaps keys and breaks ordering for in-flight keys, so it's an up-front decision.\"" },
      ],
      alternatePhrasings: ["\"How do you scale Kafka consumers?\"", "\"How do you guarantee ordering in Kafka?\""],
      interviewContexts: ["Asked at a payments company, Senior DE", "Streaming-platform interview"],
    },
  ],
  spark: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 29,
      questionText:
        "Your Spark job is slow with one task running far longer than the rest. Diagnose it.",
      answerStructured:
        "- That's classic **data skew**: one partition has far more rows (a hot join key like `null` or a mega-customer), so one task does most of the work.\n- Confirm in the **Spark UI**: a few tasks with huge shuffle read/records while the rest finish fast.\n- Fixes: **salt the skewed key** (append a random suffix and replicate the small side), **broadcast** the smaller table to avoid the shuffle entirely, or enable **AQE skew join** handling (`spark.sql.adaptive.skewJoin.enabled`).\n- Filter/handle the **null or sentinel keys** separately — they're often the culprit.\n- Don't just bump executors: more cores don't help if one task is the bottleneck.",
      explanationDeep:
        "Skew is the #1 reason a Spark job has a long tail. Work is distributed by partition; if the join key is skewed, one partition is enormous and its single task gates the whole stage. Throwing executors at it does nothing because the parallelism unit (the partition) is the problem.\n\nThe toolbox: broadcast join eliminates the shuffle when one side is small enough (no key redistribution at all). Salting spreads a hot key across N synthetic keys so the work parallelizes. Modern Spark's Adaptive Query Execution can detect and split skewed partitions automatically, which often fixes it without code changes — but you still need to recognize the symptom.",
      interviewerLens:
        "The word I want is 'skew,' fast, from the symptom 'one long task.' Then I want a real remedy — broadcast, salting, or AQE — not 'add more memory.' Mentioning null keys as a common culprit tells me you've actually debugged this in production.",
      followupChain: [
        { question: "When can't you broadcast?", answer: "When the 'small' side isn't small — broadcasting a multi-GB table OOMs executors. There's a size threshold (autoBroadcastJoinThreshold); above it you salt or rely on AQE instead." },
        { question: "What does AQE do here?", answer: "At runtime it sees actual partition sizes and can split skewed partitions, coalesce tiny ones, and switch to broadcast — adapting the plan to real data instead of compile-time estimates." },
        { question: "Repartition vs coalesce?", answer: "repartition does a full shuffle to increase/balance partitions; coalesce merges partitions without a full shuffle to reduce count cheaply (e.g. before writing fewer output files)." },
      ],
      redFlags: [
        { junior: "\"I'd add more executors / memory.\"", senior: "\"One long task is skew — I'd broadcast, salt, or use AQE, after confirming in the UI.\"" },
        { junior: "\"Spark handles distribution automatically.\"", senior: "\"It distributes by partition, so a skewed key defeats it regardless of cluster size.\"" },
      ],
      alternatePhrasings: ["\"What is data skew and how do you fix it?\"", "\"Why does my join have a long tail?\""],
      interviewContexts: ["Asked at a big-data platform team, Senior DE", "FAANG-adjacent data-eng loop"],
    },
  ],
  databricks: [
    {
      category: "deep-dives",
      riskLevel: "high",
      freePreview: true,
      asked: 20,
      questionText:
        "What does Delta Lake give you over plain Parquet on object storage?",
      answerStructured:
        "- **ACID transactions** via a transaction log (`_delta_log`), so concurrent writers and readers don't see partial/corrupt state.\n- **Time travel**: query/rollback to a previous version (`VERSION AS OF`) — huge for audits and 'oops' recovery.\n- **Schema enforcement + evolution**: rejects bad writes, supports controlled column changes.\n- **Upserts/deletes** (`MERGE`, `DELETE`) — Parquet alone is append/overwrite only, painful for GDPR deletes or CDC.\n- **Performance**: file compaction (`OPTIMIZE`), data skipping, Z-ordering / liquid clustering.",
      explanationDeep:
        "Plain Parquet on S3 is just files — no transactions, no row-level updates, no consistent view under concurrency. Delta adds a transaction log that turns that pile of files into a table with database-like guarantees while keeping the open columnar format.\n\nThe day-to-day wins are MERGE (CDC and dedup become trivial), time travel (rollback a bad batch, reproduce a report), and schema enforcement (a malformed upstream write gets rejected instead of silently poisoning the table). OPTIMIZE + Z-order/liquid clustering then keep read performance up by compacting small files and co-locating data.",
      interviewerLens:
        "I want ACID + the transaction log named explicitly, plus a concrete use case (CDC MERGE or GDPR delete) — not just 'Delta is better.' If you mention the small-files problem and OPTIMIZE, you've clearly operated a lakehouse, not just read the marketing.",
      followupChain: [
        { question: "What's the small-files problem and how does Delta help?", answer: "Streaming/many-writer ingestion creates tons of tiny files, killing read performance. OPTIMIZE compacts them into right-sized files; auto-optimize/auto-compaction can do it on write." },
        { question: "What does Unity Catalog add on top?", answer: "Centralized governance: fine-grained access control, lineage, and discovery across workspaces — the governance layer Delta tables alone don't provide." },
      ],
      redFlags: [
        { junior: "\"Delta is just Parquet but faster.\"", senior: "\"Delta adds ACID via a transaction log, MERGE, time travel, and schema enforcement on top of Parquet.\"" },
      ],
      alternatePhrasings: ["\"Why a lakehouse instead of files in S3?\"", "\"What problem does Delta Lake solve?\""],
      interviewContexts: ["Asked at a lakehouse-migration team, Senior DE"],
    },
  ],
};

export const DE_TOPICS: Record<string, ToolTopics> = {
  snowflake: {
    moreDeepDives: ["How does Snowflake's storage/compute separation change capacity planning?", "Explain micro-partitions and how pruning works.", "How do you implement CDC with Streams and Tasks?", "Zero-copy cloning — what is it good for?"],
    decisions: ["Transient vs permanent vs temporary tables — how do you choose?", "When do you reach for a separate virtual warehouse?", "Standard vs multi-cluster warehouse for concurrency?"],
    quickRef: ["What is a micro-partition?", "Default auto-suspend setting you'd use", "What does AUTO_SUSPEND save you?", "How long is the result cache valid?", "What is a virtual warehouse?", "Time Travel default retention", "What is zero-copy cloning?", "RBAC: role vs user", "What is a stage?", "VARIANT column use case"],
    redFlags: [{ junior: "\"Bigger warehouse = always faster.\"", senior: "\"Only if the query is memory-bound or compute-bound — check the profile first.\"" }, { junior: "\"Snowflake has no indexes so you can't tune it.\"", senior: "\"You tune via clustering, pruning, query shape, and warehouse isolation.\"" }],
    checklist: ["Review warehouse sizing + auto-suspend", "Recall micro-partition pruning story", "Be ready to read a Query Profile aloud", "Know Streams + Tasks for CDC", "Cost levers: resource monitors, isolation"],
    behavioral: ["Tell me about a time you cut warehouse cost", "Describe debugging a slow dashboard", "A time you designed a schema others reused"],
    reverse: ["How is the team managing warehouse cost today?", "What's the freshness SLA on the core marts?", "Snowflake-only or moving toward Iceberg?"],
  },
  dbt: {
    moreDeepDives: ["How do you structure staging / intermediate / marts layers?", "Explain dbt tests (generic vs singular) and where they run.", "How do snapshots implement SCD Type 2?", "What does dbt's DAG/`ref()` solve operationally?"],
    decisions: ["View vs table vs incremental materialization?", "When to use snapshots vs incremental SCD?", "Macro vs model — where does logic belong?"],
    quickRef: ["What does ref() do?", "source() vs ref()", "What is a seed?", "Generic test examples (unique, not_null)", "What is on_schema_change?", "What does --full-refresh do?", "What is a snapshot?", "Where do dbt docs come from?", "Exposures — what for?", "What is dbt's `this`?"],
    redFlags: [{ junior: "\"Put everything in one big model.\"", senior: "\"Layer staging → intermediate → marts so logic is testable and reusable.\"" }],
    checklist: ["Explain incremental + unique_key", "Staging/marts layering", "How tests run in CI", "Snapshots for SCD2", "Late-arriving data handling"],
    behavioral: ["A time you cleaned up a messy dbt project", "How you introduced testing to a team", "Handling a breaking schema change"],
    reverse: ["How big is the dbt DAG today?", "What's test coverage like?", "CI/CD setup for dbt?"],
  },
  airflow: {
    moreDeepDives: ["Sensors vs deferrable operators — why does it matter?", "How do XComs work and when do they bite you?", "Executor types: Local vs Celery vs Kubernetes.", "How do you manage cross-DAG dependencies?"],
    decisions: ["TaskFlow API vs classic operators?", "Pools vs priority weights for resource contention?", "Catchup on vs off for a new DAG?"],
    quickRef: ["What is execution_date / logical date?", "What is catchup?", "What is a pool?", "What does max_active_runs do?", "Sensor vs deferrable operator", "What is an XCom?", "depends_on_past meaning", "What is a trigger rule?", "What is a SubDAG (and why avoid it)?", "What is the scheduler's role?"],
    redFlags: [{ junior: "\"Use now() for the run date.\"", senior: "\"Use the logical date so backfills are correct.\"" }, { junior: "\"Pass big data through XCom.\"", senior: "\"XCom is for small metadata; stash large data in storage and pass a pointer.\"" }],
    checklist: ["Idempotency story (partition overwrite)", "Backfill concurrency control", "Sensor vs deferrable", "XCom size limits", "Retries + alerting setup"],
    behavioral: ["A time a backfill went wrong", "How you reduced DAG flakiness", "Migrating a fragile cron to Airflow"],
    reverse: ["What executor are you on?", "How are SLAs/alerting handled?", "Biggest source of DAG flakiness today?"],
  },
  kafka: {
    moreDeepDives: ["Explain consumer groups and rebalancing.", "Delivery semantics: at-most/at-least/exactly-once.", "How does the ISR and acks setting affect durability?", "Compacted topics vs retention topics."],
    decisions: ["How many partitions should a new topic have?", "acks=all vs acks=1 trade-off?", "Keyed vs keyless production?"],
    quickRef: ["What guarantees ordering in Kafka?", "What is a consumer group?", "What is ISR?", "acks settings meaning", "What is log compaction?", "What is a partition leader?", "Retention vs compaction", "What is consumer lag?", "What is a rebalance?", "Idempotent producer — what it does"],
    redFlags: [{ junior: "\"Kafka guarantees global order.\"", senior: "\"Order is per-partition only.\"" }],
    checklist: ["Per-partition ordering story", "Partition count vs consumer parallelism", "Delivery semantics choice", "Hot-partition / skew awareness", "Consumer lag monitoring"],
    behavioral: ["A time you debugged consumer lag", "Designing a topic for a new event stream", "Handling a poison message"],
    reverse: ["What are your delivery-semantics requirements?", "How do you monitor lag?", "Schema registry in place?"],
  },
  spark: {
    moreDeepDives: ["Narrow vs wide transformations and shuffles.", "cache/persist — when does it actually help?", "Catalyst + Tungsten: what do they optimize?", "How do you tune partition count and shuffle partitions?"],
    decisions: ["Broadcast join vs sort-merge join?", "RDD vs DataFrame vs Dataset — when?", "repartition vs coalesce?"],
    quickRef: ["What triggers a shuffle?", "Narrow vs wide transformation", "What is a stage?", "What does broadcast do?", "What is AQE?", "cache vs persist", "What is spark.sql.shuffle.partitions?", "Driver vs executor role", "What is a lineage / DAG?", "What is predicate pushdown?"],
    redFlags: [{ junior: "\"Cache everything.\"", senior: "\"Cache only reused, expensive datasets — caching costs memory.\"" }],
    checklist: ["Skew diagnosis + fixes", "Broadcast vs sort-merge", "Shuffle partition tuning", "AQE on/off effects", "Reading the Spark UI"],
    behavioral: ["A time you fixed a slow Spark job", "Cutting cluster cost", "A tricky OOM you solved"],
    reverse: ["Are you on classic Spark or photon/AQE?", "Typical data volumes per job?", "Batch, streaming, or both?"],
  },
  databricks: {
    moreDeepDives: ["Medallion architecture: bronze/silver/gold.", "Job clusters vs all-purpose clusters.", "Auto Loader for incremental ingestion.", "Unity Catalog governance model."],
    decisions: ["Delta Live Tables vs hand-written notebooks/jobs?", "Z-order vs liquid clustering?", "Photon on or off?"],
    quickRef: ["What is the _delta_log?", "What does OPTIMIZE do?", "What is Z-ordering?", "Time travel syntax", "What is Auto Loader?", "Bronze/silver/gold meaning", "Job vs all-purpose cluster", "What is Unity Catalog?", "What is a MERGE used for?", "What is the small-files problem?"],
    redFlags: [{ junior: "\"Delta is just Parquet.\"", senior: "\"Delta adds ACID, MERGE, and time travel via a transaction log.\"" }],
    checklist: ["Delta vs Parquet benefits", "Medallion layering", "OPTIMIZE + clustering", "Job vs all-purpose cluster cost", "Unity Catalog basics"],
    behavioral: ["A lakehouse migration you led", "Cutting Databricks cost", "Designing a medallion pipeline"],
    reverse: ["Are you on Unity Catalog?", "DLT or custom jobs?", "How is cluster cost governed?"],
  },
};
