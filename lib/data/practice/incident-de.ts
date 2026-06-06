import type { ConvItem } from "./types";

/**
 * Data Engineer incident set — production "find the root cause" scenarios for the
 * Incident Debugging track. The candidate reads artifacts (code/logs/config),
 * investigates by running SQL/Python in-browser, asks the coach, then submits a
 * root-cause + fix that's graded. The diagnosed answer (root cause, fix, red
 * herrings, rubric, coach facts) lives server-side in incident-de.server.ts and is
 * resolved by problemId — none of it ships to the client. Grounded in real Airflow /
 * Spark / warehouse failure modes at FAANG scale.
 */

/* ------------------------------------------------------------------ *
 * 1. Airflow sensor slot starvation (poke vs reschedule) — HELLISH
 * ------------------------------------------------------------------ */
const SENSOR_DAG = `# wait_and_load.py — one of 50 near-identical ingest DAGs, all @hourly.
from airflow import DAG
from airflow.sensors.external_task import ExternalTaskSensor
from airflow.operators.python import PythonOperator
from datetime import datetime

with DAG("wait_and_load_partner_x", schedule="@hourly",
         start_date=datetime(2026, 1, 1), catchup=False, max_active_runs=1) as dag:

    # Wait for the upstream "raw_landing" DAG to finish this hour.
    wait = ExternalTaskSensor(
        task_id="wait_for_raw",
        external_dag_id="raw_landing",
        external_task_id="finalize",
        mode="poke",            # <-- holds a worker slot the whole time it waits
        poke_interval=60,
        timeout=60 * 60 * 6,    # will sit here up to 6h
    )

    load = PythonOperator(task_id="load", python_callable=lambda: print("load"))
    wait >> load
`;

const SENSOR_CFG = `# airflow.cfg (excerpt) — Celery executor
[celery]
worker_concurrency = 16        # 16 task slots per worker
[core]
parallelism = 64               # 4 workers * 16 = 64 total slots
[scheduler]
# raw_landing has been running slow since a Kafka lag spike upstream
`;

const SENSOR_LOG = `[2026-05-21 02:00:11] scheduler   INFO   50 'wait_and_load_*' runs queued (hourly tick)
[2026-05-21 02:01:40] worker-1    INFO   wait_for_raw poking... raw_landing not done
[2026-05-21 02:01:41] worker-2    INFO   wait_for_raw poking... raw_landing not done
[2026-05-21 02:04:55] scheduler   WARN   64/64 task slots occupied; 0 free
[2026-05-21 02:05:02] scheduler   WARN   'raw_landing.finalize' is QUEUED but cannot start: no free slots
[2026-05-21 02:12:30] oncall      NOTE   added 2 more workers (now 96 slots). slots filled again in ~90s, still stuck.
[2026-05-21 02:40:00] scheduler   ERROR  raw_landing SLA missed; all 50 sensors still poking; pipeline frozen
`;

const SENSOR_SQL = `CREATE TABLE task_slots (
  ts          TIMESTAMP,
  dag_id      VARCHAR,
  task_id     VARCHAR,
  state       VARCHAR,     -- 'running' (holding a slot) or 'queued' (waiting for one)
  is_sensor   BOOLEAN,
  sensor_mode VARCHAR      -- 'poke' / 'reschedule' / NULL
);
INSERT INTO task_slots VALUES
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_a','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_b','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_c','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_d','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_e','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_f','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_g','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_h','wait_for_raw','running',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','raw_landing','extract','running',false,NULL),
  (TIMESTAMP '2026-05-21 02:05:00','raw_landing','transform','running',false,NULL),
  (TIMESTAMP '2026-05-21 02:05:00','raw_landing','finalize','queued',false,NULL),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_i','wait_for_raw','queued',true,'poke'),
  (TIMESTAMP '2026-05-21 02:05:00','wait_and_load_partner_j','wait_for_raw','queued',true,'poke');
`;

/* ------------------------------------------------------------------ *
 * 2. Airflow off-by-one logical_date — STANDARD (free)
 * ------------------------------------------------------------------ */
const OFFBYONE_DAG = `# daily_sales.py — daily sales extract, schedule="@daily".
from airflow.providers.common.sql.operators.sql import SQLExecuteQueryOperator

# logical_date / data_interval_start = the START of the interval the run covers.
# For an @daily run that fires at 2026-05-21 00:00, the interval it covers is
# 2026-05-20 00:00 .. 2026-05-21 00:00 (i.e. the data for 2026-05-20).
extract = SQLExecuteQueryOperator(
    task_id="extract_day",
    sql="""
        SELECT * FROM sales
        WHERE sale_date = DATE '{{ ds }}'   -- ds = logical_date = data_interval_START
    """,
)
`;

const OFFBYONE_LOG = `[2026-05-21 00:05:00] daily_sales  INFO   run logical_date(ds)=2026-05-20, executed at 2026-05-21 00:05
[2026-05-21 00:05:02] daily_sales  INFO   extracted rows for sale_date=2026-05-20: 0 rows
[2026-05-21 08:30:00] analyst      NOTE   "yesterday's" report is empty, but data IS in the sales table for 2026-05-20
`;

const OFFBYONE_SQL = `CREATE TABLE sales (
  sale_id    INTEGER,
  sale_date  DATE,
  amount     DECIMAL(10,2)
);
INSERT INTO sales VALUES
  (1, DATE '2026-05-19', 10.00),
  (2, DATE '2026-05-19', 20.00),
  (3, DATE '2026-05-20', 30.00),
  (4, DATE '2026-05-20', 40.00),
  (5, DATE '2026-05-20', 50.00),
  (6, DATE '2026-05-20', 60.00),
  (7, DATE '2026-05-21', 70.00),
  (8, DATE '2026-05-21', 80.00);
-- The run that fired at 2026-05-21 00:00 has ds=2026-05-20 and SHOULD return rows 3-6.
-- Reproduce the bug: query for the WRONG day to see what the analyst saw.
`;

/* ------------------------------------------------------------------ *
 * 3. Airflow catchup=True flood — HARD (read-only)
 * ------------------------------------------------------------------ */
const CATCHUP_DAG = `# events_rollup.py — newly deployed today (2026-05-21) after a long pause.
from airflow import DAG
from datetime import datetime

with DAG(
    "events_rollup",
    schedule="@hourly",
    start_date=datetime(2024, 1, 1),   # <-- start_date is 16 months in the past
    catchup=True,                       # <-- scheduler will create a run per missed interval
    max_active_runs=32,
) as dag:
    ...
`;

const CATCHUP_LOG = `[2026-05-21 09:00:03] scheduler  INFO   DAG 'events_rollup' unpaused
[2026-05-21 09:00:05] scheduler  INFO   creating dag runs for backlog interval 2024-01-01 .. 2026-05-21
[2026-05-21 09:00:06] scheduler  INFO   ~12,200 hourly runs to schedule
[2026-05-21 09:01:10] scheduler  WARN   32 runs active; pool 'default_pool' exhausted
[2026-05-21 09:03:44] warehouse  ERROR  concurrency limit hit: 32 simultaneous OVERWRITE jobs on fct_events
[2026-05-21 09:05:00] oncall     PAGE   warehouse credits burning 40x normal; current-hour pipeline starved
`;

/* ------------------------------------------------------------------ *
 * 4. Airflow zombie tasks (worker OOMKill) — HARD (read-only)
 * ------------------------------------------------------------------ */
const ZOMBIE_LOG = `[2026-05-21 03:10:00] worker-7   INFO   task transform_big started (pid 4412)
[2026-05-21 03:10:01] worker-7   INFO   loading full day into a pandas DataFrame (df = pd.read_sql(...))
[2026-05-21 03:14:55] kernel     CRIT   Out of memory: Killed process 4412 (airflow task) total-vm:31.2GB
[2026-05-21 03:14:55] worker-7   --     (no further heartbeats from pid 4412)
[2026-05-21 03:20:11] scheduler  WARN   Detected zombie job: transform_big (no heartbeat for 300s)
[2026-05-21 03:20:11] scheduler  INFO   marking transform_big as failed; on_failure_callback NOT invoked
[2026-05-21 03:20:12] scheduler  INFO   retry 1/2 scheduled
[2026-05-21 03:35:40] scheduler  WARN   Detected zombie job: transform_big (no heartbeat for 300s)  -- retry also OOM-killed
[2026-05-21 03:50:55] alerting   NOTE   alert never fired even though task failed; downstream ran on stale data
`;

const ZOMBIE_CODE = `# transform_big.py — the task body.
import pandas as pd

def transform():
    # Loads the ENTIRE day partition into memory at once.
    df = pd.read_sql("SELECT * FROM raw_events WHERE dt = '{{ ds }}'", conn)  # ~28 GB
    df["norm"] = df["payload"].apply(heavy_parse)
    df.to_parquet("/out/{{ ds }}.parquet")
`;

const ZOMBIE_CFG = `# airflow.cfg (excerpt)
[scheduler]
scheduler_zombie_task_threshold = 300   # 5 min with no heartbeat => zombie => failed
[kubernetes_executor]
# worker pod memory limit:
#   resources.limits.memory = 16Gi      # task tries to load ~28 GB
`;

/* ------------------------------------------------------------------ *
 * 5. Nightly job double-counts after retry (non-idempotent append) — HARD
 * ------------------------------------------------------------------ */
const APPEND_CODE = `# load_daily_orders.py — runs nightly; failed once last night and Airflow auto-retried.
def load(ds):
    rows = extract_orders(ds)              # all orders for the day
    # APPEND into the warehouse fact table (no dedup, no partition replace):
    warehouse.write(
        table="fct_orders",
        rows=rows,
        mode="append",                     # <-- append, not overwrite/merge
    )
    # If this step throws, Airflow retries the WHOLE task -> extract+append run again.
    publish_metrics(ds)
`;

const APPEND_LOG = `[2026-05-20 01:00:02] load_daily_orders  INFO   ds=2026-05-19 extracted 4 orders, appended
[2026-05-20 01:00:09] load_daily_orders  ERROR  publish_metrics timed out (network blip)
[2026-05-20 01:00:10] scheduler          INFO   retry 1/2 of load_daily_orders (ds=2026-05-19)
[2026-05-20 01:01:30] load_daily_orders  INFO   ds=2026-05-19 extracted 4 orders, appended   <-- again
[2026-05-20 01:01:38] load_daily_orders  INFO   publish_metrics ok
[2026-05-20 08:00:00] finance            NOTE   2026-05-19 order count + revenue are exactly 2x the source system
`;

const APPEND_SQL = `CREATE TABLE fct_orders (
  load_batch  INTEGER,    -- which task attempt wrote the row (1 = first, 2 = retry)
  order_id    INTEGER,
  order_date  DATE,
  amount      DECIMAL(10,2)
);
INSERT INTO fct_orders VALUES
  -- attempt 1 (before the publish_metrics failure)
  (1, 5001, DATE '2026-05-19', 25.00),
  (1, 5002, DATE '2026-05-19', 40.00),
  (1, 5003, DATE '2026-05-19', 12.50),
  (1, 5004, DATE '2026-05-19', 80.00),
  -- attempt 2 (the retry re-appended the SAME orders)
  (2, 5001, DATE '2026-05-19', 25.00),
  (2, 5002, DATE '2026-05-19', 40.00),
  (2, 5003, DATE '2026-05-19', 12.50),
  (2, 5004, DATE '2026-05-19', 80.00),
  -- a clean prior day for contrast
  (1, 4990, DATE '2026-05-18', 30.00),
  (1, 4991, DATE '2026-05-18', 15.00);
`;

/* ------------------------------------------------------------------ *
 * 6. Late-arriving events drop ~3% revenue (watermark too tight) — HARD (free)
 * ------------------------------------------------------------------ */
const WATERMARK_CODE = `# revenue_stream.py — Spark Structured Streaming hourly revenue.
events = (spark.readStream.format("kafka").load()
          .select(from_json("value").alias("e")).select("e.*"))

agg = (events
       .withWatermark("event_time", "1 minute")   # <-- drop anything > 1 min late
       .groupBy(window("event_time", "1 hour"))
       .agg(_sum("amount").alias("revenue")))
# Mobile clients buffer offline and flush on reconnect — many events arrive 2-30 min late.
`;

const WATERMARK_LOG = `[2026-05-21 10:00:00] stream  INFO   window 09:00-10:00 closed; watermark = 09:59:00 (1 min slack)
[2026-05-21 10:02:11] stream  WARN   dropped 1,204 late events for window 09:00-10:00 (event_time < watermark)
[2026-05-21 10:30:00] finance NOTE   hourly revenue consistently ~3% under the batch reconciliation total
[2026-05-21 10:31:00] mobile  NOTE   offline buffer flush: median client delay 4m, p95 ~22m on flaky networks
`;

const WATERMARK_SQL = `CREATE TABLE raw_events (
  event_id     INTEGER,
  event_time   TIMESTAMP,    -- when it actually happened (the hour 09:00-10:00)
  arrival_time TIMESTAMP,    -- when it reached the stream
  amount       DECIMAL(10,2)
);
INSERT INTO raw_events VALUES
  -- on-time events (arrive within 1 min of event_time) -> counted
  (1, TIMESTAMP '2026-05-21 09:10:00', TIMESTAMP '2026-05-21 09:10:30', 20.00),
  (2, TIMESTAMP '2026-05-21 09:20:00', TIMESTAMP '2026-05-21 09:20:20', 35.00),
  (3, TIMESTAMP '2026-05-21 09:45:00', TIMESTAMP '2026-05-21 09:45:10', 50.00),
  (4, TIMESTAMP '2026-05-21 09:55:00', TIMESTAMP '2026-05-21 09:55:40', 15.00),
  (5, TIMESTAMP '2026-05-21 09:58:00', TIMESTAMP '2026-05-21 09:58:30', 10.00),
  -- LATE events (mobile offline flush): event_time in 09:xx but arrival way after watermark -> DROPPED
  (6, TIMESTAMP '2026-05-21 09:12:00', TIMESTAMP '2026-05-21 10:01:30', 40.00),
  (7, TIMESTAMP '2026-05-21 09:30:00', TIMESTAMP '2026-05-21 10:08:00', 25.00),
  (8, TIMESTAMP '2026-05-21 09:40:00', TIMESTAMP '2026-05-21 10:18:00', 60.00),
  (9, TIMESTAMP '2026-05-21 09:50:00', TIMESTAMP '2026-05-21 10:22:00', 30.00);
-- arrival_time > event_time + 1 min => dropped by the watermark.
`;

/* ------------------------------------------------------------------ *
 * 7. Backfill overwrote good data with partial — HELLISH
 * ------------------------------------------------------------------ */
const OVERWRITE_CODE = `# backfill_sessions.py — re-run to fix a schema tweak for 2026-05-18.
df = spark.read.parquet("s3://raw/sessions/dt=2026-05-18")   # source had a transient outage

# Spark default partitionOverwriteMode = STATIC:
# this overwrites EVERY partition the writer touches, deleting the OLD partition dirs first,
# then writing whatever this run produced — even if the read came back short.
(df.write
   .mode("overwrite")
   .partitionBy("dt")
   .parquet("s3://curated/sessions"))
`;

const OVERWRITE_LOG = `[2026-05-21 14:00:00] backfill  INFO   reading s3://raw/sessions/dt=2026-05-18
[2026-05-21 14:00:05] backfill  WARN   upstream raw bucket returned 2 of 8 part files (S3 listing came back short)
[2026-05-21 14:00:40] backfill  INFO   overwrite mode=STATIC: deleted curated/sessions/dt=2026-05-18 (old 8M rows)
[2026-05-21 14:01:20] backfill  INFO   wrote curated/sessions/dt=2026-05-18 (1.9M rows)
[2026-05-21 14:02:00] backfill  INFO   wrote curated/sessions/dt=2026-05-19 (untouched? -> ALSO cleared)
[2026-05-21 16:30:00] analyst   NOTE   2026-05-18 session count dropped 8M -> 1.9M; 05-19 now empty too
[2026-05-21 16:31:00] oncall    NOTE   first thought: timezone bug shifted the partition. but dt values look right.
`;

const OVERWRITE_SQL = `CREATE TABLE curated_sessions (
  dt        DATE,
  source    VARCHAR,     -- 'original_good' vs 'backfill_partial'
  rows_cnt  BIGINT
);
INSERT INTO curated_sessions VALUES
  -- what each partition held BEFORE the backfill (good, complete)
  (DATE '2026-05-17','original_good', 7800000),
  (DATE '2026-05-18','original_good', 8000000),
  (DATE '2026-05-19','original_good', 8100000),
  (DATE '2026-05-20','original_good', 7950000),
  -- what's there AFTER the static-overwrite backfill of 05-18 ran against a short read
  (DATE '2026-05-17','backfill_partial', 7800000),   -- untouched, fine
  (DATE '2026-05-18','backfill_partial', 1900000),   -- clobbered with partial (read came back short)
  (DATE '2026-05-19','backfill_partial', 0),          -- collateral: STATIC overwrite wiped a partition it never rewrote
  (DATE '2026-05-20','backfill_partial', 7950000);   -- untouched, fine
`;

/* ------------------------------------------------------------------ *
 * 8. Spark executor OOM (repartition(1) + skew) — HARD
 * ------------------------------------------------------------------ */
const SPARK_OOM_CODE = `# export_report.py — joins clicks to users, writes one tidy file.
joined = clicks.join(users, "user_id")                 # user_id is heavily skewed

# "I want a single output file, so I'll coalesce everything to one partition."
out = joined.repartition(1)                            # <-- funnels ALL rows to ONE task/executor
out.write.parquet("s3://reports/daily")
`;

const SPARK_OOM_LOG = `[2026-05-21 05:00:00] spark  INFO   stage 4: 1 task (after repartition(1))
[2026-05-21 05:03:12] spark  WARN   Task 0 in stage 4 spilling 9.4 GB to disk
[2026-05-21 05:06:40] spark  ERROR  ExecutorLostFailure: container killed by YARN, 18.1 GB of 16 GB used
[2026-05-21 05:06:41] spark  ERROR  java.lang.OutOfMemoryError in stage 4 task 0
[2026-05-21 05:07:00] oncall NOTE   one user_id (guest/anonymous = 0) is ~70% of all clicks
[2026-05-21 05:08:00] oncall NOTE   first instinct: bump executor memory. but stage 4 is a SINGLE task.
`;

/* ------------------------------------------------------------------ *
 * 9. FAANG-search $30k SELECT * over a petabyte table — HARD
 * ------------------------------------------------------------------ */
const SCAN_QUERY = `-- adhoc_debug.sql — copied from a teammate, run in the BI tool every 5 min by a dashboard.
SELECT *
FROM search.query_logs           -- date-partitioned, ~1.2 PB, 1100 columns
-- (no WHERE on the partition column 'dt')
WHERE user_country = 'US';        -- filters AFTER the full scan; not a partition prune
`;

const SCAN_CFG = `-- table DDL (excerpt)
CREATE TABLE search.query_logs (
  dt DATE,                 -- PARTITION column
  user_country STRING,     -- NOT partitioned; clustering only
  ... 1098 more columns ...
)
PARTITION BY dt
OPTIONS (
  require_partition_filter = false   -- <-- so a missing dt filter scans EVERY partition
);
-- on-demand pricing ~ $6.25 / TB scanned. 1.2 PB * each run...
`;

const SCAN_LOG = `[2026-05-21 11:00:00] bigquery  INFO   job adhoc_debug scanned 1.18 PB (SELECT *, no partition filter)
[2026-05-21 11:00:00] bigquery  INFO   estimated cost: ~$7,400 this run
[2026-05-21 11:05:00] bigquery  INFO   job adhoc_debug scanned 1.18 PB (dashboard auto-refresh)
[2026-05-21 11:10:00] finops    PAGE   project query spend up $30k since 11:00; one query id dominates
`;

const SCAN_SQL = `CREATE TABLE query_logs (
  dt           DATE,
  user_country VARCHAR,
  query_text   VARCHAR,
  latency_ms   INTEGER
);
INSERT INTO query_logs VALUES
  (DATE '2026-05-18','US','foo',12),
  (DATE '2026-05-18','CA','bar',30),
  (DATE '2026-05-19','US','baz',9),
  (DATE '2026-05-19','UK','qux',40),
  (DATE '2026-05-20','US','aaa',15),
  (DATE '2026-05-20','US','bbb',22),
  (DATE '2026-05-21','US','ccc',18),
  (DATE '2026-05-21','DE','ddd',27),
  (DATE '2026-05-21','US','eee',11),
  (DATE '2026-05-21','CA','fff',33);
-- The dashboard only needs ONE day. Compare scanning all dt vs WHERE dt = DATE '2026-05-21'.
`;

/* ------------------------------------------------------------------ *
 * 10. Dashboard shows yesterday-as-today (timezone day boundary) — STANDARD
 * ------------------------------------------------------------------ */
const TZ_QUERY = `-- daily_active.sql — "today's" active users for the exec dashboard.
-- Events are stored in UTC. The business reports in America/Los_Angeles (UTC-7/8).
SELECT
  CAST(event_ts AS DATE)              AS day,     -- <-- truncates the RAW UTC timestamp
  COUNT(DISTINCT user_id)             AS dau
FROM events
WHERE CAST(event_ts AS DATE) = CURRENT_DATE       -- "today" in UTC, not in business tz
GROUP BY 1;
`;

const TZ_LOG = `[2026-05-21 07:30:00] dashboard  NOTE   "today" DAU looks like yesterday's number all morning (PT)
[2026-05-21 07:31:00] analyst    NOTE   evening PT traffic (which is next-day UTC) is bucketed into the wrong day
`;

const TZ_SQL = `CREATE TABLE events (
  event_id   INTEGER,
  user_id    INTEGER,
  event_ts   TIMESTAMP    -- stored in UTC
);
INSERT INTO events VALUES
  -- 2026-05-20 evening Pacific = late-night / next-day UTC.
  -- e.g. 2026-05-20 21:00 PT == 2026-05-21 04:00 UTC.
  (1, 100, TIMESTAMP '2026-05-21 04:00:00'),   -- PT: 2026-05-20 21:00
  (2, 101, TIMESTAMP '2026-05-21 05:30:00'),   -- PT: 2026-05-20 22:30
  (3, 102, TIMESTAMP '2026-05-21 06:45:00'),   -- PT: 2026-05-20 23:45
  -- 2026-05-21 morning Pacific = same-day UTC.
  (4, 103, TIMESTAMP '2026-05-21 16:00:00'),   -- PT: 2026-05-21 09:00
  (5, 104, TIMESTAMP '2026-05-21 17:30:00'),   -- PT: 2026-05-21 10:30
  (6, 100, TIMESTAMP '2026-05-21 18:00:00'),   -- PT: 2026-05-21 11:00 (user 100 again)
  -- a couple from 2026-05-19 for contrast
  (7, 105, TIMESTAMP '2026-05-19 20:00:00'),
  (8, 106, TIMESTAMP '2026-05-20 03:00:00');
-- Grouping by UTC date vs by (event_ts shifted to PT) gives different day buckets.
`;

export const INCIDENT_DE_ITEMS: ConvItem[] = [
  {
    id: "inc-de-sensor-slot-starvation",
    category: "incident",
    level: "senior",
    title: "Every DAG is frozen and adding workers didn't help",
    company: "FAANG · retail",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: at the top of the hour the whole Airflow estate froze. 50 hourly ingest DAGs each have an ExternalTaskSensor waiting on a shared upstream DAG (raw_landing). raw_landing's final task is QUEUED but won't start. On-call already added 2 more workers and the new slots filled within 90s — still stuck. You have the DAG, airflow.cfg, the scheduler log, and a snapshot of task slots. Investigate, then submit the root cause and the fix.",
    hints: [
      "Look at what state the sensors are in vs what state raw_landing.finalize is in. What is everything competing for?",
      "Read the sensor's `mode`. In that mode, does a waiting sensor hold a worker slot or release it? Query task_slots: how many slots are held by sensors vs by real work?",
      "Adding workers filled up again instantly — so more capacity isn't the fix. Why does the deadlock reproduce at any worker count, and what mode change breaks it?",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries task_slots to see sensors are holding the slots, not guessing",
      "Root cause: poke-mode sensors each hold a worker slot while waiting; 50 of them exhaust all slots so the upstream task they wait on can never get a slot — a sensor deadlock",
      "Identifies that adding workers is a red herring: more slots just get eaten by the same poking sensors; the deadlock is structural, not a capacity problem",
      "Fix: switch the sensors to reschedule (or deferrable) mode so they free the slot while waiting; optionally a dedicated pool / fewer concurrent sensors",
      "Triage order: mitigate by killing/clearing the poking sensors (or pausing the 50 DAGs) so raw_landing can finish, THEN change the mode to prevent recurrence",
    ],
    incident: {
      brief:
        "50 hourly DAGs each run an ExternalTaskSensor waiting on raw_landing; raw_landing.finalize is QUEUED but never starts and the pipeline is frozen. On-call added workers and it filled up again in ~90s. Find the root cause and the fix.",
      severity: "SEV-1 · pipeline-wide outage",
      tier: "hellish",
      artifacts: [
        { name: "dags/wait_and_load.py", kind: "code", language: "python", content: SENSOR_DAG },
        { name: "config/airflow.cfg", kind: "config", language: "text", content: SENSOR_CFG },
        { name: "logs/scheduler.log", kind: "log", language: "text", content: SENSOR_LOG },
      ],
      sql: { setupSql: SENSOR_SQL, tables: ["task_slots"] },
      python: true,
    },
  },
  {
    id: "inc-de-logical-date-off-by-one",
    category: "incident",
    level: "mid",
    title: "Daily report returns zero rows but the data is there",
    company: "Series C data platform",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: the @daily sales extract that ran this morning returned 0 rows, but the sales table clearly has yesterday's data. The DAG filters `sale_date = '{{ ds }}'`. You have the DAG, the run log, and the sales table. Investigate, then submit the root cause and the fix.",
    hints: [
      "What does `ds` / logical_date actually equal for an @daily run, relative to when the run executes?",
      "The run fired at 2026-05-21 00:05 but its ds is 2026-05-20. Query the table for both dates — which one has the data the report was supposed to show?",
      "Decide which day the run is RESPONSIBLE for: the data interval it covers vs the wall-clock day it ran. Then make the filter match that.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries sales for the relevant dates to confirm where the rows are",
      "Root cause: confusion about logical_date — `ds` is the START of the data interval (the day being processed), the report author expected it to be the calendar run day, so the filter matches the wrong day boundary",
      "Correctly states which day a given run covers (interval start) vs when it executes (one interval later)",
      "Fix: align the filter to the intended day — e.g. use the macro that names the day actually being processed (data_interval_start vs next/prev), or rely on data_interval_start/end rather than hand-rolled date math",
    ],
    incident: {
      brief:
        "The @daily sales extract returned 0 rows this morning even though yesterday's sales rows exist. It filters sale_date = '{{ ds }}'. Find the root cause and the fix.",
      severity: "SEV-3 · reporting",
      tier: "standard",
      artifacts: [
        { name: "dags/daily_sales.py", kind: "code", language: "python", content: OFFBYONE_DAG },
        { name: "logs/run.log", kind: "log", language: "text", content: OFFBYONE_LOG },
      ],
      sql: { setupSql: OFFBYONE_SQL, tables: ["sales"] },
    },
  },
  {
    id: "inc-de-catchup-flood",
    category: "incident",
    level: "mid",
    title: "Unpausing one DAG burned 40x the warehouse credits",
    company: "FAANG · streaming",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: a teammate unpaused the events_rollup DAG this morning and warehouse spend instantly jumped ~40x. The scheduler created thousands of runs and the current-hour pipeline is now starved behind them. You have the DAG and the scheduler log. Investigate, then submit the root cause and the fix.",
    hints: [
      "Read the scheduler log: how many runs did it try to create, and over what interval?",
      "Look at the DAG's start_date and catchup setting together. What does catchup=True do when start_date is far in the past?",
      "How do you stop the flood right now without losing the runs you actually want, and what DAG settings prevent this on the next deploy?",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — reads the scheduler log to see ~12k runs created over a 16-month interval",
      "Root cause: catchup=True with a start_date 16 months in the past makes the scheduler backfill a run for every missed hourly interval, flooding the warehouse with concurrent OVERWRITE jobs",
      "Explains the cost/starvation link: the backlog runs hold all the slots/credits so the current-hour run is starved",
      "Fix: set catchup=False (and/or move start_date forward); if history is genuinely needed, run a controlled, throttled backfill instead of an unbounded catchup",
      "Triage: pause/clear the backlog runs to stop the spend bleed first, then change the DAG config",
    ],
    incident: {
      brief:
        "Unpausing events_rollup created thousands of runs and warehouse spend jumped ~40x; the current-hour pipeline is starved. Find the root cause and the fix.",
      severity: "SEV-2 · cost + freshness",
      tier: "hard",
      artifacts: [
        { name: "dags/events_rollup.py", kind: "code", language: "python", content: CATCHUP_DAG },
        { name: "logs/scheduler.log", kind: "log", language: "text", content: CATCHUP_LOG },
      ],
    },
  },
  {
    id: "inc-de-zombie-oomkill",
    category: "incident",
    level: "senior",
    title: "A task 'succeeds' then gets marked failed, and no alert fires",
    company: "FAANG · social",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: transform_big keeps getting marked as a zombie and failed, both the original run and the retry. The on_failure_callback never fires so no alert went out, and downstream ran on stale data. You have the task code, airflow.cfg, and the worker/scheduler log. Investigate, then submit the root cause and the fix.",
    hints: [
      "Trace the log timeline: what does the kernel say happened to the process, and what does the scheduler then conclude after no heartbeat?",
      "Compare the task's memory need against the worker pod memory limit in airflow.cfg. What loads the whole partition into memory at once?",
      "Why didn't on_failure_callback fire? Think about what SIGKILL/OOMKill does to in-process cleanup vs a normal task failure. Then fix both the memory and the silent-failure problem.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — reconstructs the timeline (OOM kill -> no heartbeat -> zombie detection -> marked failed) rather than guessing a logic bug",
      "Root cause: the task loads the entire ~28 GB day partition into a pandas DataFrame but the worker pod is limited to 16 GB; the OS OOM-killer SIGKILLs the process, the heartbeat stops, and the scheduler marks it a zombie after scheduler_zombie_task_threshold",
      "Explains why no alert fired: SIGKILL gives no chance for in-process cleanup, so on_failure_callback (run in the task process) is never invoked",
      "Fix (memory): stop loading the whole partition — stream/chunk it, push the transform down to SQL/Spark, or raise the pod memory limit; (alerting): use scheduler-side failure handling / external alerting that fires on the zombie/failed state, not an in-process callback",
      "Notes the downstream-on-stale-data risk and adds a freshness/row-count check so a silent failure can't propagate",
    ],
    incident: {
      brief:
        "transform_big is repeatedly marked a zombie and failed (original + retry), on_failure_callback never fires, no alert goes out, and downstream ran on stale data. Find the root cause and the fix.",
      severity: "SEV-2 · silent failure",
      tier: "hard",
      artifacts: [
        { name: "dags/transform_big.py", kind: "code", language: "python", content: ZOMBIE_CODE },
        { name: "config/airflow.cfg", kind: "config", language: "text", content: ZOMBIE_CFG },
        { name: "logs/worker.log", kind: "log", language: "text", content: ZOMBIE_LOG },
      ],
    },
  },
  {
    id: "inc-de-non-idempotent-append",
    category: "incident",
    level: "senior",
    title: "Yesterday's revenue is exactly double the source system",
    company: "FAANG · retail",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: finance reports that 2026-05-19 order count and revenue in the warehouse are exactly 2x the source system. The nightly load failed once and Airflow auto-retried. You have the load code, the run log, and the fct_orders table. Investigate, then submit the root cause and the fix.",
    hints: [
      "Exactly 2x is a strong signal. Query fct_orders for 2026-05-19 — are there duplicate order_ids?",
      "Read the load code: what write mode does it use, and what does Airflow do to the whole task when a LATER step (publish_metrics) fails?",
      "The extract+append both re-ran on retry. Make the load safe to run twice without changing the result — what write pattern guarantees that?",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries fct_orders to confirm duplicate order_ids for 2026-05-19 (not just trusting the 2x)",
      "Root cause: the task is non-idempotent — it appends extracted rows, and when publish_metrics failed, Airflow retried the WHOLE task, so the same orders were appended a second time",
      "Identifies the retry-after-partial-success interaction (failure was downstream of the append, so the retry re-did the append)",
      "Fix: make the load idempotent — partition/replace by day or MERGE/upsert by order_id instead of blind append; optionally split extract/append/publish into separate tasks so a publish retry doesn't re-append",
      "Triage: dedupe/restate the 2026-05-19 partition to correct finance numbers, then ship the idempotent write",
    ],
    incident: {
      brief:
        "2026-05-19 order count and revenue are exactly 2x source after the nightly load failed once and retried. Find the root cause and the fix.",
      severity: "SEV-1 · finance-facing",
      tier: "hard",
      artifacts: [
        { name: "pipeline/load_daily_orders.py", kind: "code", language: "python", content: APPEND_CODE },
        { name: "logs/run.log", kind: "log", language: "text", content: APPEND_LOG },
      ],
      sql: { setupSql: APPEND_SQL, tables: ["fct_orders"] },
    },
  },
  {
    id: "inc-de-tight-watermark-revenue",
    category: "incident",
    level: "senior",
    title: "Streaming revenue runs ~3% under the batch total every hour",
    company: "FAANG · streaming",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the hourly streaming revenue is consistently ~3% below the nightly batch reconciliation. The stream logs say it's dropping thousands of 'late' events per window. You have the streaming code, the stream log, and a sample of raw events with both event_time and arrival_time. Investigate, then submit the root cause and the fix.",
    hints: [
      "The log says events are being dropped because event_time < watermark. What sets the watermark slack in the code?",
      "Query raw_events: how many rows have arrival_time more than 1 minute after event_time? Sum the amount of those — does it explain the ~3%?",
      "Mobile clients buffer offline and flush minutes late (p95 ~22m). Pick a watermark/grace policy that captures them without holding state forever — and decide how to reconcile what was already dropped.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries raw_events to quantify the dropped (late-arriving) amount and ties it to the ~3% gap",
      "Root cause: the watermark allows only 1 minute of lateness, but mobile offline-buffer flushes arrive minutes late (median ~4m, p95 ~22m), so those revenue-bearing events fall outside the watermark and are dropped",
      "Distinguishes event_time from arrival_time and explains the dropped-vs-counted boundary (arrival > event_time + slack)",
      "Fix: widen the watermark / add a grace period sized to the real lateness distribution (e.g. ~30 min), accepting the latency/state trade-off; consider a batch correction layer for stragglers beyond grace",
      "Notes the trade-off: more slack = more correct but higher latency and state — doesn't just set it to infinity",
    ],
    incident: {
      brief:
        "Hourly streaming revenue runs ~3% under the batch reconciliation; the stream drops thousands of 'late' events per window. Find the root cause and the fix.",
      severity: "SEV-2 · revenue accuracy",
      tier: "hard",
      artifacts: [
        { name: "stream/revenue_stream.py", kind: "code", language: "python", content: WATERMARK_CODE },
        { name: "logs/stream.log", kind: "log", language: "text", content: WATERMARK_LOG },
      ],
      sql: { setupSql: WATERMARK_SQL, tables: ["raw_events"] },
    },
  },
  {
    id: "inc-de-partition-overwrite-race",
    category: "incident",
    level: "senior",
    title: "A backfill wiped good days and the timezone theory is a dead end",
    company: "FAANG · search",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: a backfill of the 2026-05-18 sessions partition was supposed to fix a schema tweak. Instead 05-18 dropped from 8M to 1.9M rows AND 05-19 is now empty. On-call's first theory is a timezone shift moving partitions, but the dt values look correct. You have the backfill code, the run log, and a before/after row-count table. Investigate, then submit the root cause and the fix.",
    hints: [
      "Two things broke: 05-18 was clobbered with a partial, and 05-19 — which the job never meant to touch — went to zero. Treat them as possibly-linked.",
      "Read the log: the raw read came back SHORT (2 of 8 part files), and the write used overwrite with partitionOverwriteMode default. What does STATIC overwrite delete before it writes?",
      "Test the timezone theory by checking the dt values, then drop it. Fix BOTH causes: the partial source read AND the overwrite mode that nuked a partition it never rewrote.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries the before/after row counts and confirms dt values are correct (rules out the timezone theory) instead of chasing it",
      "Identifies TWO interacting causes: (1) the upstream raw read came back short (S3 listing returned 2 of 8 files) so the backfill wrote a partial, AND (2) Spark's default STATIC partitionOverwriteMode deletes partitions before writing — including 05-19, which the run didn't even rewrite",
      "Explicitly rejects the timezone/day-boundary red herring after checking dt, and explains why it's plausible but wrong",
      "Fix: use DYNAMIC partition overwrite (or write-to-temp-then-swap) so only intended partitions change; gate the backfill on a source completeness/row-count check so a short read never overwrites good data; restore 05-18 and 05-19 from snapshot/backup",
      "Gets triage order right: restore the clobbered partitions from backup first (stop the bleeding), then fix the overwrite mode and add the completeness guard",
    ],
    incident: {
      brief:
        "A backfill of the 2026-05-18 sessions partition cut it from 8M to 1.9M rows and also emptied 05-19. The dt values look right so it's 'not timezone'. Find the root cause(s) and the fix.",
      severity: "SEV-1 · data loss",
      tier: "hellish",
      artifacts: [
        { name: "spark/backfill_sessions.py", kind: "code", language: "python", content: OVERWRITE_CODE },
        { name: "logs/backfill.log", kind: "log", language: "text", content: OVERWRITE_LOG },
      ],
      sql: { setupSql: OVERWRITE_SQL, tables: ["curated_sessions"] },
      python: true,
    },
  },
  {
    id: "inc-de-spark-repartition-oom",
    category: "incident",
    level: "senior",
    title: "Bumping executor memory won't fix this OOM",
    company: "FAANG · social",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the daily report job dies with an executor OOM in stage 4 every run. On-call's instinct is to bump executor memory, but the log shows stage 4 is a single task. You have the job code and the Spark log. Investigate, then submit the root cause and the fix.",
    hints: [
      "Read the job: what does it do right before the write to produce 'one tidy file', and what does that do to the number of partitions?",
      "Stage 4 has exactly ONE task and it spills 9.4 GB. If all rows funnel into one task, what does adding executor memory actually buy you?",
      "Note the skew clue (guest user_id = 0 is ~70% of clicks). Fix the single-partition funnel and the skew without coalescing everything to one task.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — reads the log to see stage 4 is a single task that spills, rather than blindly increasing memory",
      "Root cause: repartition(1) funnels the entire (skewed) dataset into one partition/task on one executor, which OOMs; the skewed guest user_id=0 join makes it worse",
      "Identifies that bumping executor memory is a red herring — one task can't be parallelized by giving it more RAM; it just delays the OOM",
      "Fix: don't collapse to a single partition (drop repartition(1)); if a single output file is truly required, write normally then merge, or use coalesce with enough partitions; handle skew via AQE skew-join / salting the hot user_id",
      "Explains the skew angle: one hot key dominates the shuffle, so even without repartition(1) the join needs skew handling",
    ],
    incident: {
      brief:
        "The daily report job OOMs in stage 4 every run; stage 4 is a single task that spills 9.4 GB. Adding executor memory was the first instinct. Find the root cause and the fix.",
      severity: "SEV-2 · job failure",
      tier: "hard",
      artifacts: [
        { name: "spark/export_report.py", kind: "code", language: "python", content: SPARK_OOM_CODE },
        { name: "logs/spark.log", kind: "log", language: "text", content: SPARK_OOM_LOG },
      ],
      python: true,
    },
  },
  {
    id: "inc-de-bigquery-full-scan",
    category: "incident",
    level: "senior",
    title: "One dashboard query is burning $30k an hour",
    company: "FAANG · search",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: FinOps paged — project query spend jumped $30k since 11:00 and one query id dominates. It's a dashboard that auto-refreshes every 5 min against a ~1.2 PB partitioned table. You have the query, the table DDL, and the billing log. Investigate, then submit the root cause and the fix.",
    hints: [
      "Read the query and the table DDL together. The table is partitioned by dt — does the query filter on dt?",
      "The WHERE is on user_country, which isn't the partition column, so it filters AFTER scanning everything. Query: compare bytes scanned for a full scan vs WHERE dt = one day.",
      "Fix the query AND make this class of mistake impossible at the table level. What table option rejects a query with no partition filter?",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — inspects the query against the partition column and confirms there's no dt filter (and that user_country isn't the partition key)",
      "Root cause: SELECT * with no partition (dt) filter scans the entire ~1.2 PB table every 5-minute refresh; filtering on user_country happens after the scan and prunes nothing",
      "Quantifies the cost driver (bytes scanned * price * refresh frequency) and notes SELECT * also reads all 1100 columns",
      "Fix (query): add a dt partition filter and select only needed columns; reduce refresh frequency / use a pre-aggregated table or BI cache",
      "Fix (prevention): set require_partition_filter = true on the table so any query without a partition filter is rejected before it runs",
    ],
    incident: {
      brief:
        "A dashboard auto-refreshing every 5 min runs SELECT * on a ~1.2 PB dt-partitioned table; spend jumped $30k since 11:00. Find the root cause and the fix.",
      severity: "SEV-1 · cost",
      tier: "hard",
      artifacts: [
        { name: "queries/adhoc_debug.sql", kind: "query", language: "sql", content: SCAN_QUERY },
        { name: "config/query_logs.ddl.sql", kind: "config", language: "sql", content: SCAN_CFG },
        { name: "logs/billing.log", kind: "log", language: "text", content: SCAN_LOG },
      ],
      sql: { setupSql: SCAN_SQL, tables: ["query_logs"] },
    },
  },
  {
    id: "inc-de-timezone-day-boundary",
    category: "incident",
    level: "mid",
    title: "The 'today' dashboard shows yesterday all morning",
    company: "FAANG · social",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: the exec dashboard's 'today' DAU looks like yesterday's number every morning Pacific time, and evening-PT traffic seems to land in the wrong day. Events are stored in UTC; the business reports in America/Los_Angeles. You have the query, a note from the analyst, and a sample events table. Investigate, then submit the root cause and the fix.",
    hints: [
      "Events are UTC but the business day is Pacific. What timezone does CASTing the raw event_ts to a DATE use?",
      "Query events grouped by UTC date vs by the timestamp shifted to Pacific — do evening-PT rows (which are next-day UTC) land in a different day bucket?",
      "Fix the day boundary so 'today' means the Pacific calendar day, including CURRENT_DATE — convert to the business timezone before truncating.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries the data both ways (UTC date vs PT-shifted date) to show the bucket shift",
      "Root cause: the query truncates the raw UTC timestamp to a date (and compares to UTC CURRENT_DATE), so the day boundary is UTC, not the business's Pacific day; evening-PT events fall on the next UTC day",
      "Explains the symptom: in the PT morning, UTC 'today' still mostly contains last night's PT activity, so 'today' reads like yesterday",
      "Fix: convert event_ts to America/Los_Angeles before truncating to a date, and compare against the current date in that same timezone (handle DST via the tz name, not a fixed offset)",
    ],
    incident: {
      brief:
        "The 'today' DAU on the exec dashboard reads like yesterday every PT morning; events are UTC, business reports in Pacific. Find the root cause and the fix.",
      severity: "SEV-3 · reporting",
      tier: "standard",
      artifacts: [
        { name: "queries/daily_active.sql", kind: "query", language: "sql", content: TZ_QUERY },
        { name: "logs/notes.log", kind: "log", language: "text", content: TZ_LOG },
      ],
      sql: { setupSql: TZ_SQL, tables: ["events"] },
    },
  },
];
