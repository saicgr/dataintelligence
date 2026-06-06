import type { ConvItem } from "./types";

/**
 * Code-review practice items — candidates read a short snippet with planted
 * issues and write a prose review identifying bugs, risks, and smells.
 * Bugs are verified against real sources: pandas docs, PySpark/Spark docs,
 * Apache Airflow guides, dbt community discourse, Python language reference,
 * and data-engineering interview reports (2023–2026).
 * `free: true` = available without Practice Pro.
 */
export const CODEREVIEW_ITEMS: ConvItem[] = [
  // ── JUNIOR ───────────────────────────────────────────────────────────────

  {
    id: "cr-pandas-iterrows-assignment",
    category: "codereview",
    executes: false,
    mode: "text",
    free: true,
    level: "junior",
    title: "Pandas: iterrows + chained assignment",
    company: "Analytics startup · Junior screen",
    difficulty: "easy",
    prompt: `Review this pandas snippet — what's wrong and how would you fix it?

\`\`\`python
import pandas as pd

def flag_high_value(df):
    """Add a 'high_value' column: True when amount > 1000."""
    for idx, row in df.iterrows():
        df["high_value"][idx] = row["amount"] > 1000
    return df
\`\`\``,
    hints: [
      "Think about what `df[\"high_value\"][idx] = ...` actually does under the hood — is it guaranteed to write back to `df`?",
      "Row-by-row Python loops over DataFrames are noticeably slower as the frame grows — what vectorized alternative exists?",
      "Check the pandas docs on SettingWithCopyWarning and chained indexing.",
    ],
    starter: "",
    idealAnswer: `**Issue 1 — Chained assignment (correctness / silent data loss)**
\`df["high_value"][idx] = ...\` is a two-step getitem chain. The first step (\`df["high_value"]\`) may return a *copy* depending on pandas internals. Writing to that copy does not modify the original DataFrame. pandas raises a SettingWithCopyWarning (or silently does nothing in some pandas 2.x Copy-on-Write builds). The result is that \`high_value\` may never actually be set.

Fix: use a single \`.loc\` call that targets both rows and columns in one step:
\`\`\`python
df.loc[idx, "high_value"] = row["amount"] > 1000
\`\`\`

**Issue 2 — iterrows is unnecessary and slow (performance)**
Iterating row-by-row in Python defeats the purpose of pandas. For a simple comparison this is easily vectorised:
\`\`\`python
df["high_value"] = df["amount"] > 1000
\`\`\`
This is 10–100x faster and eliminates the chained-assignment risk entirely.

**Issue 3 — Column created inside the loop (minor)**
If the DataFrame is empty the column is never created, so callers get a KeyError. The vectorised form handles the empty case automatically.

**Summary fix:**
\`\`\`python
def flag_high_value(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()  # avoid mutating the caller's frame
    df["high_value"] = df["amount"] > 1000
    return df
\`\`\``,
    rubric: [
      "Identifies chained indexing as the root correctness bug (SettingWithCopyWarning / copy vs view).",
      "Proposes `.loc[row, col]` or the vectorised form as the fix.",
      "Flags iterrows as a performance anti-pattern and suggests vectorisation.",
      "Notes the empty-DataFrame edge case or the caller-mutation side-effect.",
    ],
  },

  {
    id: "cr-mutable-default-arg",
    category: "codereview",
    executes: false,
    mode: "text",
    free: true,
    level: "junior",
    title: "Python: mutable default argument accumulates state",
    company: "Data platform team · Phone screen",
    difficulty: "easy",
    prompt: `Review this Python utility — what's wrong and how would you fix it?

\`\`\`python
def append_record(record, records=[]):
    """Add a record dict to the list and return the updated list."""
    records.append(record)
    return records

# Caller A
batch_1 = append_record({"id": 1, "val": "a"})
# Caller B — expects a fresh list
batch_2 = append_record({"id": 2, "val": "b"})
print(batch_2)  # What does this print?
\`\`\``,
    hints: [
      "Default argument values in Python are evaluated exactly once — when the `def` statement is executed, not on each call.",
      "What does `batch_2` actually contain? Trace through the shared state.",
      "What is the idiomatic Python pattern for a mutable default that should start fresh each call?",
    ],
    starter: "",
    idealAnswer: `**The bug — mutable default argument (correctness)**
In Python, default argument values are evaluated *once* at function-definition time. The empty list \`[]\` assigned as the default for \`records\` is created once and reused across every call that omits the argument. \`append_record\` therefore shares a single list across all callers.

After the two calls above:
- \`batch_1\` → \`[{"id": 1, "val": "a"}, {"id": 2, "val": "b"}]\`  (not \`[{"id": 1}]\`)
- \`batch_2\` is the *same object* as \`batch_1\`

This is one of the most common Python gotchas; it causes data leakage between requests in web frameworks, between test cases in test suites, and between pipeline runs in ETL code.

**Fix — use \`None\` as the sentinel:**
\`\`\`python
def append_record(record: dict, records: list | None = None) -> list:
    if records is None:
        records = []
    records.append(record)
    return records
\`\`\`
Each call that omits \`records\` now gets a new list. Callers that want to accumulate across calls can still pass their own list explicitly.

**Additional note**
The function also mutates the list in-place *and* returns it, which can confuse callers. A cleaner contract either mutates in-place (returns \`None\`) or returns a new list (\`return records + [record]\`).`,
    rubric: [
      "Correctly explains that Python evaluates defaults once at definition time.",
      "Traces through what `batch_1` and `batch_2` actually contain (shared object).",
      "Proposes the `None` sentinel pattern as the canonical fix.",
      "Mentions the mutation-vs-return contract ambiguity as an additional smell.",
    ],
  },

  {
    id: "cr-sql-not-in-null",
    category: "codereview",
    executes: false,
    mode: "text",
    free: false,
    level: "junior",
    title: "SQL: NOT IN silently excludes all rows when subquery has a NULL",
    company: "E-commerce · Data analyst screen",
    difficulty: "easy",
    prompt: `Review this SQL query — what's wrong and how would you fix it?

\`\`\`sql
-- Return all orders NOT placed by blacklisted users.
SELECT o.order_id, o.user_id, o.amount
FROM   orders o
WHERE  o.user_id NOT IN (
    SELECT user_id
    FROM   blacklisted_users
);
\`\`\`

The \`blacklisted_users\` table sometimes has rows where \`user_id\` is NULL (a data-quality issue upstream). What happens?`,
    hints: [
      "In SQL, `x NOT IN (1, 2, NULL)` evaluates to UNKNOWN, not TRUE — because `x != NULL` is always UNKNOWN.",
      "If the subquery returns even one NULL, what does `NOT IN` return for every row in `orders`?",
      "What join pattern avoids this NULL trap entirely?",
    ],
    starter: "",
    idealAnswer: `**The bug — NOT IN returns UNKNOWN when the subquery contains NULL (correctness)**
SQL uses three-valued logic: TRUE, FALSE, and UNKNOWN. \`x NOT IN (..., NULL, ...)\` expands to \`x != NULL AND ...\`, and any comparison with NULL yields UNKNOWN. The WHERE clause only passes rows where the condition is TRUE — UNKNOWN rows are silently filtered out.

So if \`blacklisted_users\` has even one NULL \`user_id\`, the entire query returns **zero rows** — every order is excluded, regardless of whether the user is blacklisted.

This is a notorious real-world production bug that causes "no data" incidents that are hard to debug.

**Fixes:**

Option A — filter NULLs in the subquery:
\`\`\`sql
WHERE o.user_id NOT IN (
    SELECT user_id
    FROM   blacklisted_users
    WHERE  user_id IS NOT NULL
)
\`\`\`

Option B — use NOT EXISTS (NULL-safe, and often more efficient):
\`\`\`sql
WHERE NOT EXISTS (
    SELECT 1
    FROM   blacklisted_users b
    WHERE  b.user_id = o.user_id
)
\`\`\`

Option C — LEFT JOIN anti-pattern:
\`\`\`sql
FROM  orders o
LEFT JOIN blacklisted_users b ON b.user_id = o.user_id
WHERE b.user_id IS NULL
\`\`\`

**Best practice:** prefer NOT EXISTS or a LEFT JOIN anti-join over NOT IN whenever the subquery column is nullable.

**Secondary issue** — missing index: ensure \`blacklisted_users.user_id\` is indexed; otherwise the subquery is a full-table scan per outer row.`,
    rubric: [
      "Correctly explains three-valued logic and why NOT IN + NULL yields UNKNOWN for every row.",
      "States the consequence: zero rows returned when any NULL exists in the subquery.",
      "Proposes at least one correct fix (NOT EXISTS, filtered subquery, or LEFT JOIN anti-join).",
      "Mentions the performance implication of an unindexed subquery as a bonus.",
    ],
  },

  // ── MID ─────────────────────────────────────────────────────────────────

  {
    id: "cr-pyspark-collect-udf",
    category: "codereview",
    executes: false,
    mode: "text",
    free: false,
    level: "mid",
    title: "PySpark: collect() to driver + Python UDF instead of built-ins",
    company: "Data lake team · Mid-level screen",
    difficulty: "medium",
    prompt: `Review this PySpark job — what's wrong and how would you fix it?

\`\`\`python
from pyspark.sql import SparkSession
from pyspark.sql.functions import udf
from pyspark.sql.types import StringType

spark = SparkSession.builder.getOrCreate()

def normalize_country(code):
    mapping = {"US": "United States", "GB": "United Kingdom", "DE": "Germany"}
    return mapping.get(code, "Unknown")

normalize_udf = udf(normalize_country, StringType())

def enrich_orders(orders_df, country_df):
    # Collect country lookup to driver, then broadcast manually
    country_rows = country_df.collect()          # line A
    country_map  = {r["code"]: r["name"] for r in country_rows}

    enriched = orders_df.withColumn(
        "country_name",
        normalize_udf(orders_df["country_code"])  # line B
    )
    return enriched
\`\`\``,
    hints: [
      "What happens at line A if `country_df` is very large? Where does all that data go?",
      "Python UDFs (line B) cross the JVM–Python serialisation boundary for every row — what's the built-in alternative for a simple map lookup?",
      "The `country_map` dict is computed but never used — what was the intended pattern, and is there a better Spark-native way?",
    ],
    starter: "",
    idealAnswer: `**Issue 1 — collect() pulls all data to the driver (scalability / OOM risk)**
\`country_df.collect()\` materialises the entire DataFrame into the driver's Python process. If the table is large this causes an OutOfMemoryError on the driver. Even if it currently fits, the code will silently break as data grows.

**Issue 2 — The collected country_map is never used (logic bug)**
After building \`country_map\`, the code ignores it and instead applies the hard-coded UDF. The collect was wasted work and the intended enrichment does not actually use the dynamic lookup table.

**Issue 3 — Python UDF instead of built-in function (performance)**
Python UDFs require Spark to serialise each row from JVM to a Python worker process and back, typically 3–5× slower than equivalent Catalyst/built-in operations. For a simple static key-value mapping, \`pyspark.sql.functions.create_map\` or a broadcast join is far more efficient.

**Fix — use a broadcast join (correct + scalable):**
\`\`\`python
from pyspark.sql.functions import broadcast

def enrich_orders(orders_df, country_df):
    return orders_df.join(
        broadcast(country_df),          # Spark copies small table to every executor
        on=orders_df["country_code"] == country_df["code"],
        how="left"
    ).drop("code")
\`\`\`

**Fix — static map via create_map (if the mapping is truly static):**
\`\`\`python
from pyspark.sql.functions import create_map, col, lit
from itertools import chain

mapping = {"US": "United States", "GB": "United Kingdom", "DE": "Germany"}
map_expr = create_map([lit(x) for x in chain(*mapping.items())])

orders_df.withColumn("country_name", map_expr[col("country_code")])
\`\`\`
Both approaches stay within the JVM and avoid serialisation overhead.`,
    rubric: [
      "Identifies collect() as an OOM/scalability risk when the table grows.",
      "Catches the logic bug: country_map is built but never used.",
      "Explains why Python UDFs are slower than built-in Spark functions.",
      "Proposes broadcast join or create_map as the correct Spark-native fix.",
    ],
  },

  {
    id: "cr-sql-join-fanout",
    category: "codereview",
    executes: false,
    mode: "text",
    free: false,
    level: "mid",
    title: "SQL: join fan-out inflates revenue metric",
    company: "Fintech · Metrics review",
    difficulty: "medium",
    prompt: `A data analyst wrote this query to compute total revenue per customer, joining in a promotions table to see which promo each order used. Review it — what's wrong?

\`\`\`sql
SELECT
    o.customer_id,
    SUM(o.amount) AS total_revenue
FROM orders o
JOIN promotions p ON p.order_id = o.id
GROUP BY o.customer_id;
\`\`\`

Assume \`promotions\` has one row per promo application, and a single order can have **multiple promotions applied** (e.g., a stacked discount + a referral code).`,
    hints: [
      "If order #42 has 2 promotions, how many times does it appear in the JOIN result before the GROUP BY?",
      "What happens to `SUM(o.amount)` when `amount` for that order is counted twice?",
      "How would you restructure the query so `amount` is only counted once per order, regardless of how many promotions it has?",
    ],
    starter: "",
    idealAnswer: `**The bug — join fan-out inflates revenue (correctness)**
When a single order has N promotion rows, the INNER JOIN duplicates that order row N times in the intermediate result set. \`SUM(o.amount)\` then counts the order's amount N times instead of once. If order #42 has amount $100 and 3 promotions, it contributes $300 to the customer's total instead of $100.

This is a classic "fan-out" bug. It produces silently wrong metrics — the query runs without error and looks reasonable, making it dangerous in production dashboards.

**Why INNER JOIN also drops orders**
The INNER JOIN excludes any order that has zero promotions. If the goal is all orders (not just promoted ones), the metric is further understated.

**Fix — aggregate orders before joining:**
\`\`\`sql
SELECT
    o.customer_id,
    SUM(o.amount) AS total_revenue
FROM orders o
GROUP BY o.customer_id;
-- Add promotion data separately if needed, e.g. via a LEFT JOIN on aggregated promos.
\`\`\`

**Fix — if promotion detail is needed, aggregate promotions first:**
\`\`\`sql
WITH order_promos AS (
    SELECT order_id, COUNT(*) AS promo_count, STRING_AGG(promo_code, ', ') AS promos
    FROM   promotions
    GROUP BY order_id
)
SELECT
    o.customer_id,
    SUM(o.amount) AS total_revenue,
    SUM(op.promo_count) AS total_promos_used
FROM orders o
LEFT JOIN order_promos op ON op.order_id = o.id
GROUP BY o.customer_id;
\`\`\`

**Rule of thumb:** whenever you JOIN to a "many" side before aggregating on the "one" side, you will almost always get fan-out. Aggregate first, join second.`,
    rubric: [
      "Names the fan-out bug: duplicate order rows in the join inflate SUM(amount).",
      "Quantifies the inflation (N promos → N×amount instead of 1×amount).",
      "Notes the INNER JOIN also silently drops orders with no promotions.",
      "Proposes a correct fix (aggregate before joining or aggregate the many-side first).",
      "States the general rule: aggregate the many-side before joining to avoid fan-out.",
    ],
  },

  {
    id: "cr-airflow-datetime-now",
    category: "codereview",
    executes: false,
    mode: "text",
    free: false,
    level: "mid",
    title: "Airflow DAG: datetime.now() breaks idempotency and backfills",
    company: "E-commerce platform · Data engineering screen",
    difficulty: "medium",
    prompt: `Review this Airflow DAG task — what's wrong and how would you fix it?

\`\`\`python
from datetime import datetime
from airflow.decorators import dag, task

@dag(schedule="@daily", start_date=datetime(2024, 1, 1), catchup=True)
def daily_sales_export():

    @task
    def export_yesterday_sales(**context):
        # Build the date range for "yesterday"
        run_date = datetime.now()                         # line A
        start    = run_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end      = run_date

        query = f"""
            SELECT * FROM sales
            WHERE  created_at BETWEEN '{start}' AND '{end}'
        """
        # ... run query and export to S3 ...
        print(f"Exported sales from {start} to {end}")

    export_yesterday_sales()

daily_sales_export()
\`\`\``,
    hints: [
      "Airflow's `catchup=True` will try to run this DAG for every missed day since `start_date`. What date does `datetime.now()` return during a backfill run for 2024-01-15 that executes today?",
      "What Airflow template variable or `context` key gives you the DAG's *logical* execution date instead of wall-clock time?",
      "If the task fails and is retried an hour later, what happens to the date range it queries?",
    ],
    starter: "",
    idealAnswer: `**Issue 1 — datetime.now() is non-idempotent (correctness / backfill breakage)**
\`datetime.now()\` returns the *wall-clock time at the moment the task runs*, not the DAG's logical execution date. This breaks the contract in three ways:

1. **Backfill:** When Airflow reruns the DAG for past dates (catchup=True), line A returns today's date, so all historical runs export today's data instead of the day they represent. All backfilled S3 files contain the same (wrong) data.

2. **Retry non-determinism:** If the task fails at 23:58 and is retried at 00:03 the next day, the two attempts query different date ranges. The export is not idempotent.

3. **Execution delay drift:** Even on schedule, tasks may start minutes after their scheduled time. Using now() means the query window silently shifts with the delay.

**Issue 2 — timezone naivety**
\`datetime.now()\` returns a naïve datetime in the server's local timezone. If the DB stores UTC timestamps and the Airflow worker is in a different timezone, the range is off by hours.

**Fix — use the Airflow logical date from context:**
\`\`\`python
@task
def export_yesterday_sales(**context):
    # data_interval_start/end are set by Airflow to the DAG's logical window,
    # regardless of when the task actually executes.
    start = context["data_interval_start"]   # pendulum datetime, UTC-aware
    end   = context["data_interval_end"]

    query = f"""
        SELECT * FROM sales
        WHERE  created_at >= '{start.isoformat()}'
          AND  created_at <  '{end.isoformat()}'
    """
    print(f"Exported sales from {start} to {end}")
\`\`\`

Use \`<\` (strict less-than) on the end boundary to avoid double-counting rows on the boundary when runs are adjacent.`,
    rubric: [
      "Explains that datetime.now() returns wall-clock time, not the DAG's logical date.",
      "Demonstrates the backfill breakage: historical runs all export today's data.",
      "Notes retry non-determinism: two retries of the same run may query different windows.",
      "Proposes data_interval_start / data_interval_end (or execution_date) from context as the fix.",
      "Bonus: mentions timezone-awareness (pendulum UTC vs naïve datetime).",
    ],
  },

  // ── SENIOR ───────────────────────────────────────────────────────────────

  {
    id: "cr-dbt-incremental-no-unique-key",
    category: "codereview",
    executes: false,
    mode: "text",
    free: false,
    level: "senior",
    title: "dbt incremental model duplicates without unique_key or dedup logic",
    company: "Analytics engineering · Senior interview",
    difficulty: "hard",
    prompt: `Review this dbt incremental model — what's wrong with its idempotency and how would you fix it?

\`\`\`sql
-- models/fct_events.sql
{{
  config(
    materialized = 'incremental'
  )
}}

SELECT
    event_id,
    user_id,
    event_type,
    created_at
FROM {{ source('raw', 'events') }}

{% if is_incremental() %}
  WHERE created_at > (SELECT MAX(created_at) FROM {{ this }})
{% endif %}
\`\`\``,
    hints: [
      "What happens on the very first run? What about after a failed partial run that is then retried?",
      "The filter is `created_at > MAX(created_at)`. What does this miss if the same event is re-delivered by the upstream source (at-least-once delivery)?",
      "What dbt config key prevents duplicate rows on each incremental merge?",
    ],
    starter: "",
    idealAnswer: `**Issue 1 — No unique_key: retries and late-arriving data cause duplicates (correctness)**
Without \`unique_key\`, dbt's incremental strategy is \`append\`. Every incremental run appends new rows without checking for existing ones. If:
- The pipeline retries after a partial failure, rows already written are appended again.
- The upstream source re-delivers an event (common in Kafka / Firehose at-least-once delivery), the duplicate is appended.

Over time \`fct_events\` silently accumulates duplicate event_ids, corrupting any COUNT, SUM, or metric downstream.

**Issue 2 — MAX(created_at) watermark skips late-arriving events (correctness)**
If an event arrives with a \`created_at\` timestamp older than the current watermark (e.g., a delayed mobile event), it is permanently excluded from the model. The watermark approach only works when events are guaranteed to arrive in-order, which is rarely true in practice.

**Issue 3 — No idempotent full-refresh safety**
The first run is a full load (correct). But if someone adds a \`WHERE\` condition or the source schema changes and they run \`dbt run --full-refresh\`, any state encoded in MAX(created_at) is lost, and the retry behaviour diverges from what operators expect.

**Fix — add unique_key and switch to merge strategy:**
\`\`\`sql
{{
  config(
    materialized  = 'incremental',
    unique_key    = 'event_id',
    incremental_strategy = 'merge'
  )
}}

SELECT
    event_id,
    user_id,
    event_type,
    created_at
FROM {{ source('raw', 'events') }}

{% if is_incremental() %}
  -- Use a lookback window to catch late-arriving events (e.g., 3 days)
  WHERE created_at >= (
      SELECT DATEADD('day', -3, MAX(created_at)) FROM {{ this }}
  )
{% endif %}
\`\`\`
The merge strategy upserts on \`event_id\`, so duplicates in the source or retries are deduplicated automatically. The lookback window (-3 days) catches late-arriving records at the cost of re-processing a small window — an acceptable trade-off for correctness.

**Best practice:** also add a dbt test (\`unique\` + \`not_null\` on \`event_id\`) so CI catches regressions.`,
    rubric: [
      "Identifies missing unique_key as the root cause of duplicate row accumulation.",
      "Explains the at-least-once delivery scenario that triggers duplicates.",
      "Catches the late-arriving event problem with the MAX(created_at) strict watermark.",
      "Proposes unique_key + merge strategy as the canonical dbt fix.",
      "Recommends a lookback window and/or dbt unique test as defensive practices.",
    ],
  },

  {
    id: "cr-hardcoded-secrets-no-error-handling",
    category: "codereview",
    executes: false,
    mode: "text",
    free: false,
    level: "senior",
    title: "Hardcoded credentials, broad exception silencing, and no retry logic",
    company: "Cloud data team · Senior / Staff screen",
    difficulty: "hard",
    prompt: `Review this production data-pipeline function — what are the bugs, risks, and smells?

\`\`\`python
import psycopg2
import boto3

DB_PASSWORD = "Sup3rS3cr3t!"          # line A
S3_SECRET   = "wJalrXUtnFEMI/K7MDENG" # line B

def load_and_upload(table: str, s3_bucket: str, s3_key: str):
    try:
        conn = psycopg2.connect(
            host="prod-db.internal",
            dbname="analytics",
            user="pipeline_user",
            password=DB_PASSWORD,
        )
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM {table}")  # line C
        rows = cur.fetchall()
        conn.close()

        s3 = boto3.client(
            "s3",
            aws_access_key_id="AKIAIOSFODNN7EXAMPLE",
            aws_secret_access_key=S3_SECRET,
        )
        s3.put_object(Bucket=s3_bucket, Key=s3_key, Body=str(rows))
    except Exception:                          # line D
        pass                                   # line E
\`\`\``,
    hints: [
      "Lines A and B will be committed to version control. What happens when a bot scans GitHub within minutes of the push?",
      "Line C builds a SQL string with an unvalidated caller-supplied `table` name. What attack does this enable, and how is it different from parameter injection in values?",
      "Lines D-E swallow every exception silently. From an on-call perspective, what is the consequence?",
    ],
    starter: "",
    idealAnswer: `**Issue 1 — Hardcoded secrets in source code (critical security)**
Lines A, B, and the inline \`aws_access_key_id\` embed secrets directly in code. Once committed to version control, secrets are permanent — even after deletion they remain in git history. GitGuardian's 2025 State of Secrets report found that bots scan public GitHub pushes within minutes and exploit exposed AWS keys within hours. In an internal repo, any employee or CI system with read access can exfiltrate credentials.

Fix: load secrets at runtime from the environment or a secrets manager:
\`\`\`python
import os
DB_PASSWORD = os.environ["DB_PASSWORD"]          # or use AWS Secrets Manager / Vault
# For boto3, rely on the IAM role attached to the EC2/ECS task — no explicit key needed.
s3 = boto3.client("s3")  # picks up instance profile automatically
\`\`\`

**Issue 2 — SQL injection via f-string table name (critical security)**
Line C interpolates the caller-supplied \`table\` argument directly into a SQL string. An attacker (or misconfigured caller) passing \`table = "orders; DROP TABLE orders; --"\` executes arbitrary SQL. Table/column identifiers cannot be passed as psycopg2 query parameters; instead, use an allowlist:
\`\`\`python
ALLOWED_TABLES = {"orders", "customers", "events"}
if table not in ALLOWED_TABLES:
    raise ValueError(f"Unknown table: {table!r}")
cur.execute(f"SELECT * FROM {table}")  # safe after allowlist check
\`\`\`

**Issue 3 — Bare except + pass silences all errors (observability / reliability)**
Lines D-E catch every exception, including \`KeyboardInterrupt\`, \`MemoryError\`, network failures, and authentication errors, and discard them silently. The function returns \`None\` in all failure cases. The pipeline operator has no way to know data was not uploaded. The fix is to log, re-raise, or propagate structured errors:
\`\`\`python
except Exception as exc:
    logger.exception("load_and_upload failed for table=%s key=%s", table, s3_key)
    raise  # let the orchestrator handle retries and alerting
\`\`\`

**Issue 4 — Resource leak: connection not closed on exception (correctness)**
If an exception occurs after \`conn\` is opened but before \`conn.close()\`, the connection leaks. Use a context manager:
\`\`\`python
with psycopg2.connect(...) as conn:
    with conn.cursor() as cur:
        ...
\`\`\`

**Issue 5 — fetchall() loads entire table into memory (scalability)**
\`cur.fetchall()\` materialises the full query result in the Python process. For large tables this causes OOM. Use server-side cursors (\`cur = conn.cursor(name="server_cursor")\`) and stream/chunk the result to S3 using multipart upload.

**Issue 6 — Serialising rows as str(rows) loses type fidelity**
\`str(rows)\` produces a Python repr string, not valid JSON or CSV. Downstream consumers cannot reliably parse it. Use \`csv\` or \`json\` serialisation, or write a Parquet file.`,
    rubric: [
      "Flags hardcoded secrets as a critical security issue and proposes env vars or a secrets manager.",
      "Identifies the SQL injection risk from f-string interpolation of the table name and suggests an allowlist.",
      "Explains why bare `except: pass` destroys observability and proposes logging + re-raise.",
      "Catches the connection resource leak and recommends a context manager.",
      "Bonus: notes fetchall() memory risk or the str(rows) serialisation flaw.",
    ],
  },
];
