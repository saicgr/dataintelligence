import type { ConvItem } from "./types";

/**
 * PySpark practice problems — conversational/code items graded by the AI
 * interviewer against idealAnswer + rubric (no in-browser execution).
 *
 * Research sources (May 2026):
 *  - DataCamp "Top 36 PySpark Interview Questions" (2026)
 *  - Databricks docs: AQE, Spark UI guide, long-stage diagnosis
 *  - SparkPlayground: join strategies, data skew fixes
 *  - datavidhya.com: 70 Spark scenario interview questions (2026)
 *  - Medium: Harpal Vaghela "Ultimate PySpark Interview Guide" (2025)
 *  - Databricks blog: "Adaptive Query Execution" (2020, updated)
 *  - Apache Spark official docs 3.5 / Databricks Runtime 14+
 */
export const PYSPARK_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────

  {
    id: "spark-transformations-vs-actions",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: true,
    level: "junior",
    title: "Transformations vs. Actions & Lazy Evaluation",
    company: "Fintech startup · junior DE screen",
    difficulty: "easy",
    prompt:
      "Explain the difference between a **transformation** and an **action** in PySpark. " +
      "Why does Spark use lazy evaluation, and what benefit does it provide? " +
      "Then write a short PySpark snippet that chains three transformations and ends with one action, " +
      "and describe exactly *when* Spark actually reads and processes the data.",
    hints: [
      "Transformations (filter, select, withColumn, join) are lazy — they add nodes to the DAG but read nothing. Actions (collect, count, show, write) trigger execution.",
      "Lazy evaluation lets Catalyst optimizer merge stages, push predicates down, and eliminate unused columns before a single byte is read.",
      "Spark materialises results only when an action is called; the DAG is replayed from scratch unless you cache an intermediate DataFrame.",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col

spark = SparkSession.builder.appName("demo").getOrCreate()

# Load a CSV (no data is read yet)
df = spark.read.csv("s3://bucket/events/", header=True, inferSchema=True)

# Chain transformations here — nothing executes yet
# 1.
# 2.
# 3.

# Trigger with a single action
result = ???
`,
    idealAnswer: `# Transformations vs Actions — key distinction
# -----------------------------------------------
# Transformations are lazy: they describe WHAT to do and update the DAG.
# Actions are eager: they trigger the DAG to execute and return a result.

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum

spark = SparkSession.builder.appName("demo").getOrCreate()

# READ — Spark records the source but reads 0 bytes (lazy)
df = spark.read.parquet("s3://bucket/events/")

# TRANSFORMATION 1 — narrow: no shuffle, predicate pushed to reader
filtered = df.filter(col("event_type") == "purchase")

# TRANSFORMATION 2 — wide: will cause a shuffle when executed
grouped = filtered.groupBy("user_id")

# TRANSFORMATION 3 — aggregation expression added to DAG
agg = grouped.agg(_sum("amount").alias("total_spend"))

# ACTION — Spark now submits the job; Catalyst compiles the DAG,
# Tungsten generates bytecode, and the cluster reads + processes data.
result = agg.collect()   # <-- only HERE does any I/O happen

# WHY LAZY EVALUATION?
# 1. Catalyst can reorder/merge stages (e.g., push filter before groupBy).
# 2. Columns not referenced downstream are pruned at the scan.
# 3. Multiple actions on the same DataFrame replay the DAG unless you cache:
#    agg.cache()  →  second .collect() reuses in-memory data.

# Common interview mistake: confusing show() (action) with a transformation.
# df.show() IS an action — it triggers execution.
`,
    rubric: [
      "Correctly defines transformations as lazy (DAG-only) and actions as eager (trigger execution).",
      "Identifies at least one narrow transformation (filter/map) and one wide transformation (groupBy/join) with shuffle implication.",
      "Code snippet has ≥3 transformations and exactly one action; no action accidentally called mid-chain.",
      "Explains Catalyst optimizer benefit: predicate pushdown, column pruning, stage fusion.",
      "Mentions that caching avoids re-running the DAG on repeated actions.",
    ],
  },

  {
    id: "spark-narrow-vs-wide-shuffle",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "junior",
    title: "Narrow vs. Wide Transformations & Shuffle Cost",
    company: "E-commerce · analytics DE screen",
    difficulty: "easy",
    prompt:
      "Classify each of the following PySpark operations as **narrow** or **wide**, and explain whether a shuffle occurs: " +
      "`filter`, `map` / `withColumn`, `union`, `groupBy().agg()`, `join` (on a non-partitioned column), `sortBy`. " +
      "Then write a snippet that demonstrates how you can avoid an unnecessary shuffle when joining a large table " +
      "to a small lookup table.",
    hints: [
      "Narrow: each input partition contributes to at most one output partition — no network transfer. Wide: multiple input partitions feed one output partition, requiring a shuffle across the network.",
      "Every shuffle serialises data to disk, sends it over the network, and deserialises it — easily 10-100× slower than narrow ops.",
      "broadcast() sends a small DataFrame to every executor so the large table never moves.",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import broadcast, col

spark = SparkSession.builder.appName("shuffle-demo").getOrCreate()

large_df = spark.read.parquet("s3://bucket/orders/")       # ~500 GB
small_df = spark.read.parquet("s3://bucket/products/")     # ~20 MB

# Default join — causes a shuffle of BOTH tables:
result_bad = large_df.join(small_df, "product_id")

# Optimised join — avoid shuffling large_df:
result_good = ???
`,
    idealAnswer: `# Narrow vs Wide classification
# ─────────────────────────────
# NARROW (no shuffle):
#   filter()          → each partition filtered independently
#   withColumn() / map() → element-wise, no cross-partition data
#   union()           → partition-wise concatenation
#
# WIDE (shuffle required):
#   groupBy().agg()   → records with the same key must land on same partition
#   join()            → records with matching keys must co-locate
#   sortBy()          → total order requires all data sorted across partitions
#
# Shuffle cost: disk write → network transfer → disk read → deserialise
# This can be 10-100× slower than in-memory narrow ops.

from pyspark.sql import SparkSession
from pyspark.sql.functions import broadcast, col

spark = SparkSession.builder.appName("shuffle-demo").getOrCreate()

large_df = spark.read.parquet("s3://bucket/orders/")    # 500 GB
small_df = spark.read.parquet("s3://bucket/products/")  # 20 MB

# ❌ Default sort-merge join — BOTH tables shuffle by product_id
result_bad = large_df.join(small_df, "product_id")

# ✅ Broadcast hash join — small_df is copied to every executor;
#    large_df NEVER moves; no shuffle at all.
result_good = large_df.join(broadcast(small_df), "product_id")

# Configuration: Spark auto-broadcasts if table < spark.sql.autoBroadcastJoinThreshold
# Default: 10 MB.  Set higher if your lookup table is larger but still fits memory:
# spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 50 * 1024 * 1024)

# To verify: result_good.explain() — look for "BroadcastHashJoin" in the plan.
result_good.explain()
`,
    rubric: [
      "Correctly classifies all 6 operations (filter/withColumn/union as narrow; groupBy/join/sortBy as wide).",
      "Explains shuffle: cross-partition data movement over the network, triggered by wide ops.",
      "Uses broadcast() for the small table join — eliminating the shuffle on large_df.",
      "Mentions spark.sql.autoBroadcastJoinThreshold and that explain() reveals BroadcastHashJoin in the plan.",
    ],
  },

  {
    id: "spark-repartition-vs-coalesce",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "junior",
    title: "repartition() vs coalesce() — When to Use Each",
    company: "Data platform team · mid-large tech",
    difficulty: "easy",
    prompt:
      "You have a 500-partition DataFrame after a heavy join. You now need to write the result to a single Parquet file for a downstream team. " +
      "Explain the difference between `repartition(1)` and `coalesce(1)`, including performance trade-offs. " +
      "Which would you choose and why? Also describe a scenario where `repartition()` (increasing partitions) is the right call.",
    hints: [
      "coalesce(n) is a narrow transformation — it merges partitions locally on each executor with no shuffle, but results in uneven partition sizes.",
      "repartition(n) is a wide transformation — it does a full shuffle to produce evenly-sized partitions.",
      "coalesce(1) on 500 partitions forces all work onto one task and one executor — huge memory risk for very large data.",
    ],
    starter: `from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("partition-demo").getOrCreate()

df = spark.read.parquet("s3://bucket/joined_output/")
print("Current partitions:", df.rdd.getNumPartitions())  # 500

# Option A
single_coalesce = df.coalesce(1)

# Option B
single_repartition = df.repartition(1)

# Which do you write and why?
single_coalesce.write.parquet("s3://bucket/output/single/")

# When would you INCREASE partitions with repartition()?
# ...
`,
    idealAnswer: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col

spark = SparkSession.builder.appName("partition-demo").getOrCreate()

df = spark.read.parquet("s3://bucket/joined_output/")
print("Current partitions:", df.rdd.getNumPartitions())  # 500

# ─── coalesce(1) vs repartition(1) ────────────────────────────────
#
# coalesce(n)
#   - Narrow transformation: merges existing partitions locally, no shuffle.
#   - Fast and cheap when REDUCING partitions.
#   - Risk: partitions may be unequal in size (some executors do more work).
#   - coalesce(1) → 1 task, 1 executor must hold the entire dataset in memory.
#     For very large data this causes OOM or extreme slowness.
#
# repartition(n)
#   - Wide transformation: full shuffle, redistributes data evenly.
#   - Expensive (network + disk I/O) but produces balanced partitions.
#   - repartition(1) → still a full shuffle before converging to 1 task.
#     Worse than coalesce(1) for writing a single file.
#
# VERDICT for this scenario (write a single file):
# Use coalesce(1) — it avoids the shuffle and single-file write is the bottleneck anyway.
# If the dataset fits in one executor's memory, coalesce(1) is fine.
df.coalesce(1).write.mode("overwrite").parquet("s3://bucket/output/single/")

# ─── When repartition() (INCREASING) is correct ───────────────────
#
# 1. After a filter that shrunk data — partition count is now too high,
#    each partition is tiny → too many small tasks. Fix: coalesce.
#
# 2. Before a heavy join/aggregation on a skewed key — repartition on
#    the join key to distribute data evenly and pre-sort partitions.
df_prepped = df.repartition(200, col("user_id"))
# Now groupBy("user_id") avoids reshuffling (already keyed).

# 3. After reading a single large CSV/JSON → Spark creates too few partitions.
# spark.read.csv(...).repartition(400)  to parallelise downstream work.

# Rule of thumb:
#   Reducing partitions → coalesce()   (no shuffle)
#   Rebalancing or increasing → repartition()   (full shuffle, even sizes)
#   Target ~128–256 MB per partition for most workloads.
`,
    rubric: [
      "Correctly identifies coalesce as narrow (no shuffle) and repartition as wide (full shuffle).",
      "Chooses coalesce(1) for writing a single file and justifies: avoids unnecessary shuffle, adequate since single-file write is the goal.",
      "Flags the OOM/slowness risk of coalesce(1) or repartition(1) for very large datasets.",
      "Gives a concrete scenario for increasing partitions with repartition(): skewed data before a join, too-few partitions after reading a flat file, or enabling parallelism.",
      "Mentions the ~128–256 MB per partition rule of thumb or spark.sql.shuffle.partitions tuning.",
    ],
  },

  // ─── MID ───────────────────────────────────────────────────────────────────

  {
    id: "spark-broadcast-vs-smj",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: true,
    level: "mid",
    title: "Broadcast Hash Join vs. Sort-Merge Join",
    company: "Retail analytics · mid-level DE loop",
    difficulty: "medium",
    prompt:
      "Your pipeline joins a 600 GB fact table of order events to a 400 MB product-dimension table. " +
      "The job currently takes 45 minutes and the Spark UI shows massive shuffle read/write in the join stage. " +
      "Explain the mechanical difference between a **Broadcast Hash Join** and a **Sort-Merge Join**, " +
      "then write optimised PySpark code to fix the join. " +
      "Also: what is `spark.sql.autoBroadcastJoinThreshold`, and how would you safely raise it?",
    hints: [
      "Broadcast Hash Join: the small side is copied (broadcast) to every executor → zero shuffle on the large side. Sort-Merge Join: both sides shuffle by join key, then sort + merge per partition.",
      "Default autoBroadcastJoinThreshold is 10 MB. Raising it to cover your 400 MB table requires executors with enough memory; test with explain() first.",
      "You can hint a join strategy with df.join(broadcast(other), key) — the BROADCAST hint overrides the threshold check.",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col

spark = SparkSession.builder.appName("join-opt").getOrCreate()

orders  = spark.read.parquet("s3://bucket/orders/")    # 600 GB
products = spark.read.parquet("s3://bucket/products/") # 400 MB

# Current slow join (sort-merge, full shuffle of BOTH sides):
result = orders.join(products, "product_id")

# Fix it:
`,
    idealAnswer: `from pyspark.sql import SparkSession
from pyspark.sql.functions import broadcast, col

spark = SparkSession.builder.appName("join-opt").getOrCreate()

orders   = spark.read.parquet("s3://bucket/orders/")    # 600 GB
products = spark.read.parquet("s3://bucket/products/")  # 400 MB

# ─── Mechanics ────────────────────────────────────────────────────
#
# Sort-Merge Join (SMJ) — default for large-large joins
#   1. Both sides shuffle by join key → all rows with key K land on same partition.
#   2. Each partition is sorted by key.
#   3. Merge (like merging two sorted arrays) — O(N log N) shuffle + sort cost.
#   Advantage: handles arbitrarily large tables, graceful disk spill.
#   Cost: 2 full shuffles of BOTH tables → expensive for even moderately large data.
#
# Broadcast Hash Join (BHJ)
#   1. Driver collects the small table.
#   2. Small table is broadcast to EVERY executor (copied to memory).
#   3. Each executor builds a local hash map of the small table.
#   4. Large table rows probe the hash map locally → NO shuffle of large table.
#   Advantage: eliminates shuffle entirely — often 5-20× faster.
#   Risk: if broadcast table > executor memory → OOM crash.
#
# ─── Fix 1: explicit broadcast hint (safest — no threshold change needed) ──
result = orders.join(broadcast(products), "product_id")

# Verify: physical plan must show BroadcastHashJoin, not SortMergeJoin
result.explain(mode="formatted")

# ─── Fix 2: raise the threshold to cover 400 MB table ──────────────────────
# Only safe if executors have enough memory (400 MB × num_executors headroom).
spark.conf.set("spark.sql.autoBroadcastJoinThreshold", 450 * 1024 * 1024)  # 450 MB
result2 = orders.join(products, "product_id")  # Spark auto-picks BHJ now

# ─── Fix 3: AQE auto-conversion (Spark 3.0+) ──────────────────────────────
# AQE can downgrade SMJ → BHJ at runtime if post-filter stats show small side:
spark.conf.set("spark.sql.adaptive.enabled", "true")
# No code change needed — AQE inspects shuffle stats and switches strategy.

# ─── Hint priority: BROADCAST > MERGE > SHUFFLE_HASH ──────────────────────
# Use .hint("MERGE") to force SMJ if you ever need it explicitly:
# orders.join(products.hint("MERGE"), "product_id")
`,
    rubric: [
      "Accurately explains SMJ mechanics (shuffle both sides, sort, merge) and BHJ mechanics (broadcast small side, local hash probe, no large-table shuffle).",
      "Uses broadcast() hint correctly in PySpark code.",
      "Explains autoBroadcastJoinThreshold (default 10 MB) and the risk of raising it without adequate executor memory.",
      "Mentions explain(mode='formatted') or explain() to verify the join strategy in the physical plan.",
      "Bonus: mentions AQE's ability to auto-convert SMJ → BHJ at runtime based on collected stats.",
    ],
  },

  {
    id: "spark-window-functions",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "mid",
    title: "Window Functions in PySpark",
    company: "SaaS analytics · mid DE / analytics engineer screen",
    difficulty: "medium",
    prompt:
      "Given a `transactions` table with columns `user_id`, `txn_date`, `amount`, write PySpark code using **window functions** to compute: " +
      "(1) each user's **running total** of amount ordered by date, " +
      "(2) each transaction's **rank** within its user by amount descending, and " +
      "(3) each transaction's amount compared to the user's **previous transaction** amount (lag). " +
      "Explain the performance implication: does a window function cause a shuffle?",
    hints: [
      "Import Window from pyspark.sql.window; define a WindowSpec with partitionBy() and orderBy() before calling the function.",
      "Window functions do cause a shuffle (partitionBy → data grouped by user_id across cluster), but they do NOT collapse rows — every input row produces one output row.",
      "For running total: use sum('amount').over(window_spec) with a row frame; for rank: rank().over(w); for lag: lag('amount', 1).over(w).",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, rank, lag
from pyspark.sql.window import Window

spark = SparkSession.builder.appName("window-demo").getOrCreate()

data = [
    (1, "2026-01-01", 100.0),
    (1, "2026-01-05", 250.0),
    (1, "2026-01-10", 75.0),
    (2, "2026-01-02", 300.0),
    (2, "2026-01-08", 150.0),
]
df = spark.createDataFrame(data, ["user_id", "txn_date", "amount"])

# Define a window spec partitioned by user_id, ordered by txn_date
w_by_date = Window.partitionBy("user_id").orderBy("txn_date")
w_by_amt  = Window.partitionBy("user_id").orderBy(col("amount").desc())

# (1) Running total
# (2) Rank by amount
# (3) Lag — previous amount
`,
    idealAnswer: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, rank, lag, round as _round
from pyspark.sql.window import Window

spark = SparkSession.builder.appName("window-demo").getOrCreate()

data = [
    (1, "2026-01-01", 100.0),
    (1, "2026-01-05", 250.0),
    (1, "2026-01-10",  75.0),
    (2, "2026-01-02", 300.0),
    (2, "2026-01-08", 150.0),
]
df = spark.createDataFrame(data, ["user_id", "txn_date", "amount"])

# Window spec: partition by user_id, ordered by date (for running total & lag)
w_date = Window.partitionBy("user_id").orderBy("txn_date")

# Window spec: partition by user_id, ordered by amount desc (for rank)
w_amt = Window.partitionBy("user_id").orderBy(col("amount").desc())

result = (
    df
    # (1) Running total — default frame when ORDER BY present is:
    #     ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    .withColumn("running_total", _sum("amount").over(w_date))

    # (2) Rank by amount descending — ties get the same rank, next rank skips
    .withColumn("amt_rank", rank().over(w_amt))

    # (3) Lag — previous transaction amount (None for first row per user)
    .withColumn("prev_amount", lag("amount", 1).over(w_date))
)

result.show()
# +-------+----------+------+-------------+--------+-----------+
# |user_id|  txn_date|amount|running_total|amt_rank|prev_amount|
# +-------+----------+------+-------------+--------+-----------+
# |      1|2026-01-01| 100.0|        100.0|       2|       null|
# |      1|2026-01-05| 250.0|        350.0|       1|      100.0|
# |      1|2026-01-10|  75.0|        425.0|       3|      250.0|
# |      2|2026-01-02| 300.0|        300.0|       1|       null|
# |      2|2026-01-08| 150.0|        450.0|       2|      300.0|
# +-------+----------+------+-------------+--------+-----------+

# ─── Performance note ─────────────────────────────────────────────
# partitionBy("user_id") causes a shuffle — rows with the same user_id
# must co-locate on the same executor.  This is a WIDE transformation.
# However, unlike groupBy().agg(), window functions do NOT reduce rows:
# every input row has exactly one output row.
#
# Use dense_rank() instead of rank() if you want no gaps after ties.
# Use row_number() if you want a unique sequential number regardless of ties.
`,
    rubric: [
      "Defines WindowSpec correctly using Window.partitionBy() and .orderBy() — separate specs for date-based and amount-based windows.",
      "Running total uses sum().over(w) with implicit or explicit ROWS UNBOUNDED PRECEDING frame.",
      "rank().over(w_amt) is used for ranking; distinguishes rank (gaps after ties) vs dense_rank (no gaps) vs row_number (unique).",
      "lag('amount', 1).over(w_date) correctly retrieves the previous row's value per user.",
      "Explains that partitionBy causes a shuffle (wide transformation) but rows are NOT collapsed.",
    ],
  },

  {
    id: "spark-etl-dedupe-transform",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "mid",
    title: "Real ETL: Deduplicate & Sessionise Events",
    company: "Streaming platform · data engineering take-home",
    difficulty: "medium",
    prompt:
      "You receive a raw clickstream table `events(user_id STRING, event_ts TIMESTAMP, event_type STRING, session_id STRING)`. " +
      "The data has **duplicate rows** (same user_id + event_ts + event_type) and some `session_id` values are NULL. " +
      "Write a PySpark ETL job that: (1) deduplicates keeping exactly one row per (user_id, event_ts, event_type), " +
      "(2) for rows where session_id IS NULL, derive it as `user_id || '_' || date(event_ts)` as a fallback, " +
      "(3) adds a `row_num` column numbering events within each session by time ascending. " +
      "Discuss write strategy: how many output partitions and why?",
    hints: [
      "dropDuplicates(['user_id','event_ts','event_type']) is idiomatic; distinct() deduplicates ALL columns which is wrong here.",
      "Use when(col('session_id').isNull(), concat(...)).otherwise(col('session_id')) for the null fill.",
      "row_number() over a window partitioned by session_id and ordered by event_ts gives the sequence; this causes a shuffle on session_id.",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, concat, lit, to_date, when, row_number
from pyspark.sql.window import Window
from pyspark.sql.types import StructType, StructField, StringType, TimestampType

spark = SparkSession.builder.appName("etl-dedupe").getOrCreate()

# Load raw events (assume already read from source)
raw = spark.read.parquet("s3://bucket/raw/clickstream/date=2026-05-01/")

# Step 1: Deduplicate on (user_id, event_ts, event_type)

# Step 2: Fill NULL session_id

# Step 3: Add row_num within each session ordered by event_ts

# Step 4: Write — discuss partition count
`,
    idealAnswer: `from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, concat, lit, to_date, when, row_number, coalesce
)
from pyspark.sql.window import Window

spark = SparkSession.builder.appName("etl-dedupe").getOrCreate()

raw = spark.read.parquet("s3://bucket/raw/clickstream/date=2026-05-01/")

# ─── Step 1: Deduplicate ──────────────────────────────────────────
# dropDuplicates on the natural key — NOT distinct() which checks ALL columns
# and would keep rows that differ only in session_id or other noise fields.
deduped = raw.dropDuplicates(["user_id", "event_ts", "event_type"])

# ─── Step 2: Fill NULL session_id ────────────────────────────────
# Fallback: user_id + '_' + date portion of event_ts
filled = deduped.withColumn(
    "session_id",
    when(
        col("session_id").isNull(),
        concat(col("user_id"), lit("_"), to_date(col("event_ts")).cast("string"))
    ).otherwise(col("session_id"))
)

# ─── Step 3: Row number within each session ───────────────────────
# Wide transformation: shuffle on session_id so all rows per session co-locate
w = Window.partitionBy("session_id").orderBy("event_ts")
result = filled.withColumn("row_num", row_number().over(w))

# ─── Step 4: Write ────────────────────────────────────────────────
# After the window shuffle, Spark default shuffle partitions = 200.
# For a daily batch, check result size: if ~10 GB target 128-256 MB/partition
# → repartition(50) or let AQE coalesce for you.
#
# Partition the OUTPUT by date for downstream efficiency:
(
    result
    .repartition(50)                        # tune to ~200 MB per file
    .write
    .mode("overwrite")
    .partitionBy("event_type")              # partition on disk for predicate pushdown
    .parquet("s3://bucket/clean/clickstream/date=2026-05-01/")
)

# Key decisions explained:
# - dropDuplicates(subset) vs distinct(): subset targets only the natural key,
#   preserving legitimate differences in other columns.
# - coalesce() not repartition() if we just want to reduce post-window shuffle
#   partitions — but repartition(50) gives even file sizes for S3.
# - partitionBy("event_type") on write creates Hive-style directory partitions,
#   so downstream jobs filtering on event_type skip irrelevant files entirely.
`,
    rubric: [
      "Uses dropDuplicates(['user_id','event_ts','event_type']) (not distinct()) and explains why subset matters.",
      "Correctly fills NULL session_id with when().isNull() + concat(user_id, '_', date(event_ts)).",
      "window spec uses partitionBy('session_id').orderBy('event_ts') with row_number(); notes this is a wide/shuffle op.",
      "Discusses output partition count relative to data size (target ~128-256 MB/partition) and explains partitionBy on write for predicate pushdown.",
    ],
  },

  // ─── SENIOR ────────────────────────────────────────────────────────────────

  {
    id: "spark-data-skew-salting-aqe",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "senior",
    title: "Data Skew Diagnosis, Salting & AQE",
    company: "Big tech · principal DE / staff DE loop",
    difficulty: "hard",
    prompt:
      "Your PySpark join between `orders` (2 TB) and `user_profiles` (50 GB) runs for 6 hours. " +
      "The Spark UI shows 199 tasks complete in 4 minutes; 1 task runs for 6 hours with massive shuffle read. " +
      "Diagnose what is happening and write **two** code-level fixes: " +
      "(1) manual salting technique, and " +
      "(2) enabling Adaptive Query Execution (AQE) skew-join handling. " +
      "Explain the trade-offs of each approach and when you'd prefer one over the other.",
    hints: [
      "One straggler task with huge shuffle read is the classic data-skew symptom: one join key (e.g., user_id='guest') dominates the data.",
      "Salting: append rand(0..N) to the skewed key in the large table, then replicate those N+1 copies in the small table — now the hot key splits across N partitions.",
      "AQE skew-join (spark.sql.adaptive.skewJoin.enabled=true) detects skewed partitions at runtime and splits them automatically — zero code change, but requires Spark 3.0+ and the skewed partition to exceed the threshold.",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, rand, floor, concat_ws, lit, explode, array

spark = SparkSession.builder.appName("skew-fix").getOrCreate()

orders   = spark.read.parquet("s3://bucket/orders/")         # 2 TB, skewed on user_id
profiles = spark.read.parquet("s3://bucket/user_profiles/")  # 50 GB

# The bad join:
result = orders.join(profiles, "user_id")   # one task runs forever

# Fix 1: Manual salting
N = 10  # salt buckets

# Fix 2: AQE
`,
    idealAnswer: `from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, floor, rand, concat_ws, lit, explode, array, posexplode, sequence
)

spark = SparkSession.builder.appName("skew-fix").getOrCreate()

orders   = spark.read.parquet("s3://bucket/orders/")         # 2 TB
profiles = spark.read.parquet("s3://bucket/user_profiles/")  # 50 GB

# ─── Diagnosis ────────────────────────────────────────────────────
# Spark UI → Stages tab → sort by Duration
# ONE task takes hours; others complete in minutes.
# Shuffle Read column for that task is enormous (e.g., hundreds of GB).
# → Data skew: one user_id value ("guest", NULL, or a bot account)
#   owns most of the orders, so ALL those records land in one partition.

# ─── Fix 1: Manual Salting ───────────────────────────────────────
# Idea: Split the hot key across N partitions by appending a random bucket index.
# Then replicate each profile row N times with all bucket suffixes.

N = 10  # number of salt buckets — tune based on skew severity

# Large table: append a random salt [0, N) to the join key
orders_salted = orders.withColumn(
    "user_id_salt",
    concat_ws("_", col("user_id"), (floor(rand() * N)).cast("int").cast("string"))
)

# Small table: explode to produce one row per bucket (N× fan-out)
salts = array(*[lit(str(i)) for i in range(N)])
profiles_salted = (
    profiles
    .withColumn("salt_list", salts)
    .withColumn("salt", explode(col("salt_list")))
    .withColumn("user_id_salt", concat_ws("_", col("user_id"), col("salt")))
    .drop("salt_list", "salt")
)

# Join on composite salted key — hot key now splits across N partitions
result_salted = (
    orders_salted
    .join(profiles_salted, "user_id_salt")
    .drop("user_id_salt")
)

# Trade-off: profiles table grows N× in memory/shuffle — only viable if
# profiles still fits in executor memory after replication.
# Also: you must implement and maintain this logic explicitly.

# ─── Fix 2: Adaptive Query Execution (AQE) — Spark 3.0+ ─────────
spark.conf.set("spark.sql.adaptive.enabled",              "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled",     "true")

# Thresholds that determine "skewed":
# A partition is skewed if its size > skewedPartitionFactor (5×) × median size
# AND size > skewedPartitionThresholdInBytes (default 256 MB).
spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionFactor",             "5")
spark.conf.set("spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes",   str(256 * 1024 * 1024))

# With AQE enabled the original join just works — no code changes needed:
result_aqe = orders.join(profiles, "user_id")

# AQE inspects shuffle-map statistics after the shuffle write phase,
# detects the hot partition, splits it into sub-partitions, and replicates
# the matching profile rows — automatically.

# ─── When to use each ─────────────────────────────────────────────
# AQE:      Spark 3.0+, no code change, handles skew dynamically.
#           Prefer AQE as the first line of defence.
#           Limitation: AQE only kicks in AFTER shuffle; salting avoids
#           writing the skewed shuffle data in the first place.
#
# Salting:  Applicable to Spark 2.x or when AQE thresholds are too coarse.
#           More control (tune N precisely). More code complexity.
#           Required if the skewed column has NULL values that AQE misses.
`,
    rubric: [
      "Correctly diagnoses the symptom: one straggler task with outsized shuffle read = data skew on a single join-key value.",
      "Salting implementation is correct: random salt appended to large table, full salt range replicated (exploded) in small table, join on composite key.",
      "AQE configuration uses spark.sql.adaptive.enabled + spark.sql.adaptive.skewJoin.enabled with explanation of how AQE detects and splits skewed partitions at runtime.",
      "Trade-offs are accurate: AQE is zero-code and Spark 3.0+; salting is more invasive but avoids writing skewed shuffle data and works on Spark 2.x.",
      "Mentions N× fan-out cost on the smaller table and the need to tune N based on skew severity.",
    ],
  },

  {
    id: "spark-ui-slow-job-diagnosis",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "senior",
    title: "Reading the Spark UI to Debug a Slow Job",
    company: "Cloud data platform · senior DE system design",
    difficulty: "hard",
    prompt:
      "A colleague's PySpark job has been running for 3 hours on what should be a 15-minute pipeline. " +
      "Walk through exactly how you would use the **Spark UI** to diagnose the root cause. " +
      "Name the specific tabs, columns, and metrics you check, in order. " +
      "Then write PySpark code that fixes the three most common root causes you identify through the UI: " +
      "(1) data skew (straggler tasks), (2) excessive spill to disk, and (3) too many small shuffle partitions.",
    hints: [
      "Start at Jobs tab → find the longest-running job → go to its Stages tab → sort by Duration → click the worst stage → examine task distribution and Summary Metrics.",
      "Straggler tasks: max task time >> median task time. Spill: look for 'Shuffle Spill (Memory)' and 'Shuffle Spill (Disk)' columns in the stage detail. Small partitions: many tasks with tiny input sizes (< 1 MB each).",
      "For spill, increase spark.executor.memory or increase the number of partitions (smaller partitions fit in memory). For too many partitions, raise spark.sql.shuffle.partitions or enable AQE coalescing.",
    ],
    starter: `# No code needed for the UI walkthrough — describe it step by step.
# Then show the PySpark fixes for each root cause.

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, broadcast

spark = SparkSession.builder.appName("slow-job-fix").getOrCreate()

df = spark.read.parquet("s3://bucket/large_dataset/")

# Root cause 1 fix: data skew
# Root cause 2 fix: spill to disk
# Root cause 3 fix: too many small partitions
`,
    idealAnswer: `# ─── Spark UI Diagnostic Walkthrough (in order) ──────────────────
#
# 1. JOBS TAB
#    - Sort by Duration, descending. Identify the hung job.
#    - Click "Description" link to see which action triggered it.
#
# 2. STAGES TAB (within that job)
#    - Columns: Input, Output, Shuffle Read, Shuffle Write, Duration.
#    - Sort by Duration descending → click the slowest stage.
#    - Large "Shuffle Read" column → shuffle-heavy (join/groupBy).
#    - "Input" with one stage reading everything → potential skew at source.
#
# 3. STAGE DETAIL PAGE
#    a) Summary Metrics box:
#       - "Duration" row: compare 25th, 50th (median), 75th, Max.
#         If Max >> Median → straggler tasks → DATA SKEW.
#       - "Shuffle Spill (Memory)" / "Shuffle Spill (Disk)" columns visible:
#         Non-zero disk spill → executors are running out of memory.
#       - "Input Size / Records" per task: tasks with tiny inputs (< 1 MB)
#         → too many partitions, wasted task-launch overhead.
#    b) Task list (scroll down):
#       - Sort by Duration → straggler task at top.
#       - Click straggler → see its shuffle read size vs. others.
#       - GC Time > 10% of task time → executor memory pressure / too much data per task.
#
# 4. SQL / DATAFRAME TAB
#    - Physical plan shows join strategy: SortMergeJoin vs BroadcastHashJoin.
#    - Look for Exchange nodes — each Exchange is a shuffle.
#    - "number of output rows" on each node helps spot filter push-down failures.
#
# 5. EXECUTORS TAB
#    - "Storage Memory Used" vs "Total Storage Memory" → if near 100% → GC pressure.
#    - "Shuffle Read / Write" totals per executor → one executor reading >> others → skew.

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, broadcast, floor, rand, concat_ws, lit, explode, array

spark = SparkSession.builder.appName("slow-job-fix").getOrCreate()

# ─── Root Cause 1: Data Skew (straggler task, huge shuffle read) ──
# Fix A: AQE skew join (Spark 3.0+, zero code change)
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.skewJoin.enabled", "true")

# Fix B: broadcast the smaller side if it fits
from pyspark.sql.functions import broadcast
large = spark.read.parquet("s3://bucket/large/")
small = spark.read.parquet("s3://bucket/small/")  # < executor memory budget
result = large.join(broadcast(small), "id")

# ─── Root Cause 2: Spill to Disk ──────────────────────────────────
# Spill means partition data > executor memory → serialised to disk (slow).
# Fix A: increase partitions so each partition is smaller:
spark.conf.set("spark.sql.shuffle.partitions", "800")   # was 200 by default

# Fix B: increase executor memory via cluster config (not in-code):
#   --executor-memory 16g  or  spark.executor.memory = 16g in conf

# Fix C: let AQE coalesce small partitions while also splitting large ones:
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")

# ─── Root Cause 3: Too Many Small Partitions ───────────────────────
# Symptom: 5000 tasks each reading 500 KB → 90% of time is task-launch overhead.
# Fix A: raise the AQE coalesce target size:
spark.conf.set("spark.sql.adaptive.advisoryPartitionSizeInBytes", str(128 * 1024 * 1024))  # 128 MB
# AQE merges tiny post-shuffle partitions up to advisory size automatically.

# Fix B: manual coalesce after a filter that dramatically shrank data:
df = spark.read.parquet("s3://bucket/large_dataset/")
filtered = df.filter(col("country") == "US")     # shrinks to 5% of data
compacted = filtered.coalesce(50)                # no shuffle, just merges locally
compacted.write.parquet("s3://bucket/output/")

# ─── Rule of thumb: target 128–256 MB per partition ───────────────
# Too large → spill. Too small → overhead. AQE handles both dynamically
# when spark.sql.adaptive.enabled = true (default since Spark 3.2).
`,
    rubric: [
      "Describes the correct UI navigation path: Jobs → Stages (sort by duration) → Stage Detail → Summary Metrics.",
      "Names the right metrics for each root cause: Max vs Median task duration for skew; Shuffle Spill (Disk) for spill; small per-task input size for too-many-partitions.",
      "Fixes skew with AQE skewJoin or broadcast() with explanation of when each applies.",
      "Fixes spill by increasing shuffle partitions or executor memory (explains why: smaller partitions fit in memory).",
      "Fixes small-partitions problem with AQE coalescePartitions or manual coalesce(); explains 128-256 MB target partition size rule of thumb.",
    ],
  },

  {
    id: "spark-partition-tuning-production",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: false,
    level: "senior",
    title: "End-to-End Partition Tuning for a Production Pipeline",
    company: "Logistics · staff engineer architecture review",
    difficulty: "hard",
    prompt:
      "You are tuning a daily PySpark pipeline that: reads 800 GB of Parquet from S3, " +
      "joins two tables, aggregates by region + product, and writes results partitioned by region. " +
      "The pipeline takes 90 minutes; SLA is 20 minutes. " +
      "Design the full partition strategy: " +
      "how many input partitions, shuffle partitions, and output partitions? " +
      "What settings do you change and in what order do you apply them? " +
      "Write production-ready PySpark code with all relevant conf settings. " +
      "Include at least one technique each for: source partitioning, shuffle tuning, and output file sizing.",
    hints: [
      "Rule of thumb: ~128–256 MB per partition. 800 GB / 128 MB = ~6400 input tasks. Adjust spark.sql.files.maxPartitionBytes.",
      "Default spark.sql.shuffle.partitions = 200, which means 200 shuffle partitions for 800 GB = 4 GB per partition → huge spill. Raise to ~1600.",
      "For output, repartition by the write partition key before writing to avoid many small files per region; use AQE's coalescing to handle uneven region sizes.",
    ],
    starter: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count, broadcast

spark = (
    SparkSession.builder
    .appName("logistics-daily-pipeline")
    # Add .config() calls here
    .getOrCreate()
)

orders   = spark.read.parquet("s3://bucket/orders/")       # 600 GB
products = spark.read.parquet("s3://bucket/products/")     # 200 GB

# Join, aggregate, write — add partition tuning throughout
`,
    idealAnswer: `from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count, broadcast

# ─── 1. Session config — tuned for 800 GB pipeline ────────────────
spark = (
    SparkSession.builder
    .appName("logistics-daily-pipeline")

    # SOURCE PARTITIONING
    # Default: 128 MB per partition. 800 GB / 128 MB ≈ 6400 partitions.
    # Keep default — gives ~6400 tasks for 800 GB, good parallelism.
    .config("spark.sql.files.maxPartitionBytes", str(128 * 1024 * 1024))  # 128 MB

    # Merge small adjacent files during planning (avoids 100k tiny tasks):
    .config("spark.sql.files.openCostInBytes", str(4 * 1024 * 1024))      # 4 MB

    # SHUFFLE TUNING
    # Default 200 shuffle partitions → 800 GB / 200 = 4 GB each → spill guaranteed.
    # Target ~256 MB per shuffle partition: 800 GB / 256 MB ≈ 3200.
    .config("spark.sql.shuffle.partitions", "3200")

    # AQE — auto-coalesces under-sized shuffle partitions and handles skew.
    .config("spark.sql.adaptive.enabled", "true")
    .config("spark.sql.adaptive.coalescePartitions.enabled", "true")
    .config("spark.sql.adaptive.advisoryPartitionSizeInBytes", str(256 * 1024 * 1024))
    .config("spark.sql.adaptive.skewJoin.enabled", "true")
    .config("spark.sql.adaptive.skewJoin.skewedPartitionFactor", "5")
    .config("spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes", str(256 * 1024 * 1024))

    # MEMORY
    # Ensure 80% executor memory is for Spark (not user overhead):
    .config("spark.memory.fraction", "0.8")
    .config("spark.memory.storageFraction", "0.3")

    .getOrCreate()
)

# ─── 2. Source reads ──────────────────────────────────────────────
orders   = spark.read.parquet("s3://bucket/orders/")       # 600 GB
products = spark.read.parquet("s3://bucket/products/")     # 200 GB

# ─── 3. Join strategy ─────────────────────────────────────────────
# Both tables large → sort-merge join (or let AQE decide).
# Repartition on join key BEFORE join to avoid double shuffle:
orders_keyed   = orders.repartition(3200, col("product_id"))
products_keyed = products.repartition(3200, col("product_id"))

joined = orders_keyed.join(products_keyed, "product_id")
# Because both sides are already partitioned by product_id,
# Spark can skip the shuffle phase (bucket-join semantics when using repartition hint).

# ─── 4. Aggregation ──────────────────────────────────────────────
agg = (
    joined
    .groupBy("region", "product_id")
    .agg(
        _sum("order_amount").alias("total_revenue"),
        count("order_id").alias("order_count"),
    )
)

# ─── 5. Output partition sizing ───────────────────────────────────
# partitionBy("region") on write: Spark creates one subdirectory per region.
# Problem: if region has 100 GB data → 3200/N partitions per region → tiny files.
# Fix: repartition by region first so each region gets evenly sized files,
#      then let each file be ~256 MB:
#
# Estimate: say 200 distinct regions, final agg ~10 GB total.
# 10 GB / 256 MB ≈ 40 output files. repartition(40, "region") → ~1 file/region avg.

output = agg.repartition(40, col("region"))

(
    output
    .write
    .mode("overwrite")
    .partitionBy("region")          # directory-level partitioning for query pruning
    .option("compression", "snappy")
    .parquet("s3://bucket/output/logistics_daily/")
)

# ─── 6. Tuning order ─────────────────────────────────────────────
# 1. Fix shuffle.partitions first (biggest single impact on spill/OOM).
# 2. Enable AQE — handles residual skew and coalesces tiny partitions.
# 3. Tune source partition bytes if scans are slow.
# 4. Profile with Spark UI after each change — measure stage durations.
# 5. Add repartition hints on join keys only if AQE doesn't auto-handle it.
`,
    rubric: [
      "Sets spark.sql.shuffle.partitions to a value based on data size (~200-300 MB per partition target), explains why default 200 causes spill at 800 GB scale.",
      "Enables AQE with coalescePartitions + skewJoin, explains what each setting does.",
      "Addresses source partitioning with spark.sql.files.maxPartitionBytes or equivalent.",
      "Demonstrates output file sizing strategy: repartition on region key before partitionBy write to avoid tiny files per region.",
      "Describes the tuning order / iteration approach: measure with Spark UI, fix highest-impact setting first, verify with explain() and stage metrics.",
    ],
  },

  // ─── RUNNABLE on the Spark runner (server-side local mode) ──────────────────
  {
    id: "spark-top-sellers-runnable",
    category: "pyspark",
    executes: false,
    mode: "code",
    free: true,
    level: "mid",
    title: "Top sellers by revenue (runs on Spark)",
    company: "Marketplace · DE screen",
    difficulty: "medium",
    prompt:
      "A DataFrame `orders(order_id, seller_id, amount)` is available. Compute the **total revenue per seller**, ordered by revenue descending (ties by `seller_id` ascending). **Assign your final DataFrame to a variable named `result`** with columns `seller_id` and `total_revenue`.",
    hints: [
      "`orders.groupBy(\"seller_id\").agg(F.sum(\"amount\").alias(\"total_revenue\"))`.",
      "Order with `F.desc(\"total_revenue\")` then `seller_id` for deterministic ties.",
      "Assign the final DataFrame to `result` — the runner collects and diffs it.",
    ],
    starter:
      "from pyspark.sql import functions as F\n\n# `orders` is available as a DataFrame.\nresult = orders\n",
    idealAnswer:
      "from pyspark.sql import functions as F\n\nresult = (\n    orders.groupBy(\"seller_id\")\n          .agg(F.sum(\"amount\").alias(\"total_revenue\"))\n          .orderBy(F.desc(\"total_revenue\"), \"seller_id\")\n)",
    rubric: [
      "Groups by seller_id and sums amount with a clean alias.",
      "Deterministic ordering (desc revenue, then seller_id).",
      "Assigns the result DataFrame to `result` with the right columns.",
    ],
    sparkExec: {
      orderMatters: true,
      reference:
        "from pyspark.sql import functions as F\nresult = orders.groupBy(\"seller_id\").agg(F.sum(\"amount\").alias(\"total_revenue\")).orderBy(F.desc(\"total_revenue\"), \"seller_id\")",
      sampleData: [
        {
          name: "orders",
          columns: ["order_id", "seller_id", "amount"],
          rows: [
            [1, 101, 120.0],
            [2, 102, 80.0],
            [3, 101, 200.0],
            [4, 103, 50.0],
            [5, 102, 300.0],
          ],
        },
      ],
    },
  },
];
