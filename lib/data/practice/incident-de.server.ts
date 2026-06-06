import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the Data Engineer incident set. Keyed by problemId,
 * matching the ids in incident-de.ts. Holds the diagnosed root cause, fix,
 * contributing factors, red herrings (hellish), triage order, grading rubric, and
 * the facts the coach MAY reveal when asked (never the root cause). `import
 * "server-only"` is the enforcement boundary — none of this reaches the client.
 */
export const INCIDENT_DE_SCENARIOS: Record<string, IncidentScenario> = {
  "inc-de-sensor-slot-starvation": {
    actualRootCause:
      "Sensor deadlock from poke-mode sensors. All 50 hourly DAGs run an ExternalTaskSensor in mode='poke', which holds a worker task slot for the entire time it waits. 50 sensors occupy all 64 (and later 96) task slots, so raw_landing.finalize — the task they are all waiting on — can never get a slot to run. Nothing can ever make progress: the sensors hold the slots hostage waiting for work that needs a slot the sensors won't release.",
    actualFix:
      "Switch the sensors to mode='reschedule' (or use a deferrable/async sensor) so a waiting sensor releases its worker slot and only re-occupies one briefly when it re-checks. This frees slots for raw_landing.finalize to run. Optionally put the sensors in a dedicated pool with a bounded slot count and/or reduce concurrent sensors so they can never starve real work. To recover now, clear/kill the poking sensors (or pause the 50 DAGs) so raw_landing can finish.",
    contributingFactors: [
      "poke mode holds a worker slot for the whole wait",
      "50 near-identical DAGs all sense the same upstream at the same hourly tick",
      "Upstream raw_landing was already slow (Kafka lag), lengthening the wait window",
      "No dedicated pool bounding how many slots sensors can consume",
    ],
    redHerrings: [
      "Adding workers looks like the fix but isn't — the new slots are immediately eaten by the same poking sensors; the deadlock reproduces at any worker count because it is structural, not a capacity shortage",
      "raw_landing being slow looks like the cause, but even if it were fast it still can't get a slot — the slow upstream only widened the window in which the deadlock forms",
    ],
    triageOrder: [
      "Mitigate: clear/kill the poking sensors or pause the 50 sensing DAGs so raw_landing.finalize can grab a slot and finish",
      "Root-cause: confirm via the slot snapshot that sensors (poke) are holding the slots and the awaited task is starved",
      "Prevent: switch sensors to reschedule/deferrable mode; add a bounded pool for sensors so they can never consume all slots",
    ],
    rubric: [
      "Investigates before concluding — uses the task_slots snapshot to show sensors hold the slots while raw_landing.finalize is queued",
      "Root cause: poke-mode sensor deadlock — 50 sensors hold every slot so the awaited task can't run",
      "Calls adding workers a red herring and explains why the deadlock is independent of worker count",
      "Fix: reschedule/deferrable sensor mode (frees the slot while waiting), optionally a bounded sensor pool",
      "Correct triage: free slots now (clear sensors / pause DAGs) before changing the mode for the long term",
    ],
    facts: [
      { q: "What mode are the sensors in?", a: "mode='poke' with poke_interval=60 and a 6-hour timeout." },
      { q: "How many slots are there?", a: "16 worker_concurrency * 4 workers = 64; on-call added 2 workers to reach 96." },
      { q: "Did adding workers help?", a: "No — the new slots filled within ~90s and it stayed stuck." },
      { q: "Is raw_landing itself broken?", a: "No, its extract/transform ran; only finalize is stuck, and it's stuck because it's QUEUED with no free slot." },
      { q: "How many sensors are holding slots in the snapshot?", a: "Query task_slots — count rows where is_sensor=true and state='running'." },
    ],
  },

  "inc-de-logical-date-off-by-one": {
    actualRootCause:
      "Misunderstanding of Airflow's logical_date. For an @daily run, ds (logical_date / data_interval_start) is the START of the data interval the run covers — i.e. the day being processed — and the run physically fires one interval later. The report author assumed ds was the calendar day the run executes. So the run that fired on 2026-05-21 has ds=2026-05-20 and filters sale_date='2026-05-20' (which is actually correct for the interval it covers), but the author expected it to return the day they think of as 'yesterday' relative to the run. The 0 rows came from the author reasoning about the wrong day boundary; whichever day they intended, the hand-written filter doesn't line up with it.",
    actualFix:
      "Align the filter to the day the run is actually responsible for. Use the data interval Airflow gives you (data_interval_start / data_interval_end, or the ds/next_ds macros) rather than hand-rolled assumptions, so the partition the run processes matches the filter. If the intent is 'process the day that just ended', that is exactly data_interval_start — make the SQL and the mental model agree on it.",
    contributingFactors: [
      "logical_date = start of the data interval, run executes one interval later",
      "Author conflated 'the day the run executes' with ds",
      "Hand-written date filter instead of relying on data_interval_start/end",
    ],
    rubric: [
      "Investigates before concluding — queries sales for the candidate dates to locate the rows",
      "Root cause: logical_date semantics — ds is the data-interval start (day processed), not the execution day",
      "Correctly states which day a run covers vs when it runs (one interval later)",
      "Fix: use data_interval_start/end (or the right macro) so the filter matches the intended day",
    ],
    facts: [
      { q: "What is ds for this run?", a: "ds=2026-05-20; the run executed at 2026-05-21 00:05." },
      { q: "Where is the data?", a: "Query the sales table — rows exist for 2026-05-20 (and other days); spot which day the run actually filtered on." },
      { q: "Is the schedule wrong?", a: "No, @daily is fine; the issue is which date the SQL filter resolves to." },
    ],
  },

  "inc-de-catchup-flood": {
    actualRootCause:
      "catchup=True with a start_date 16 months in the past. When the DAG was unpaused, the scheduler created a run for every missed hourly interval from 2024-01-01 to now (~12,200 runs), running up to max_active_runs=32 concurrently. Each run fires an OVERWRITE job on the warehouse, so spend spiked ~40x and the backlog saturated the pool, starving the current-hour run.",
    actualFix:
      "Set catchup=False (and/or move start_date forward to a sensible recent date) so unpausing only schedules the latest interval. If historical reprocessing is genuinely needed, run a deliberate, throttled backfill over an explicit date range with bounded concurrency — never an open-ended catchup against a far-past start_date. To recover now, pause the DAG and clear/mark the backlog runs so the spend stops.",
    contributingFactors: [
      "start_date 16 months in the past",
      "catchup=True (default-on behavior for this DAG)",
      "max_active_runs=32 let 32 OVERWRITE jobs hit the warehouse at once",
      "DAG was paused/parked for a long time, so the backlog was huge",
    ],
    triageOrder: [
      "Mitigate: pause the DAG and clear/skip the backlog runs to stop the credit bleed and free the warehouse",
      "Root-cause: confirm from the log that ~12k runs were created over the 16-month interval due to catchup",
      "Prevent: catchup=False and/or recent start_date; controlled throttled backfill if history is truly needed",
    ],
    rubric: [
      "Investigates before concluding — reads the scheduler log to see how many runs over what interval were created",
      "Root cause: catchup=True + far-past start_date floods the scheduler with one run per missed hourly interval",
      "Links the flood to the 40x cost and current-hour starvation (concurrent OVERWRITE jobs saturating the pool)",
      "Fix: catchup=False / recent start_date; throttled explicit backfill for any real history need",
      "Correct triage: stop the bleed (pause + clear backlog) before changing config",
    ],
    facts: [
      { q: "How many runs were created?", a: "~12,200 hourly runs over 2024-01-01 .. 2026-05-21." },
      { q: "What's the DAG's start_date?", a: "datetime(2024, 1, 1) — about 16 months before today." },
      { q: "Why is the warehouse spend so high?", a: "Up to 32 simultaneous OVERWRITE jobs on fct_events from the backlog runs." },
    ],
  },

  "inc-de-zombie-oomkill": {
    actualRootCause:
      "The task loads an entire ~28 GB day partition into a pandas DataFrame (df = pd.read_sql('SELECT * ...')), but the worker pod memory limit is 16 GB. The OS OOM-killer SIGKILLs the task process. Because SIGKILL is uncatchable, the process dies instantly with no chance to run cleanup, so on_failure_callback (which runs in the task process) never fires. The heartbeat stops, and after scheduler_zombie_task_threshold (300s) the scheduler detects a zombie and marks the task failed. The retry hits the same memory wall and is also OOM-killed. No alert ever fired and downstream consumed stale data.",
    actualFix:
      "Memory: stop loading the whole partition into memory — stream/chunk the read (chunksize), push the transform down to SQL/Spark, or raise the pod memory limit to fit the data. Alerting: don't rely on an in-process on_failure_callback for OOM-killed tasks; alert on the scheduler-side failed/zombie state (e.g. an SLA/callback at the DAG level, an external monitor on task state, or a dead-man's-switch) so a SIGKILL can't suppress the alert. Add a downstream freshness/row-count guard so a silent failure can't propagate stale data.",
    contributingFactors: [
      "Full-partition pd.read_sql (~28 GB) vs 16 GB pod limit",
      "OOM-killer uses SIGKILL — no in-process cleanup, so on_failure_callback never runs",
      "Zombie detection only flips state after the heartbeat threshold (300s)",
      "No downstream freshness/row-count check, so stale data propagated silently",
    ],
    rubric: [
      "Investigates before concluding — reconstructs OOM-kill -> lost heartbeat -> zombie -> failed from the timeline",
      "Root cause: task memory (~28 GB) exceeds the 16 GB pod limit; OS OOM-kills it with SIGKILL",
      "Explains the silent alert: SIGKILL prevents in-process on_failure_callback from running",
      "Fix (memory): chunk/stream or push down the transform, or raise the pod limit",
      "Fix (alerting): scheduler-side/external failure alerting independent of the task process; add a freshness/row-count guard",
    ],
    facts: [
      { q: "What killed the process?", a: "The kernel OOM-killer: 'Out of memory: Killed process 4412, total-vm 31.2GB'." },
      { q: "What's the pod memory limit?", a: "16Gi; the task tries to materialize ~28 GB at once." },
      { q: "Why didn't on_failure_callback fire?", a: "Think about what SIGKILL does to a process — there is no opportunity for in-process cleanup or callbacks." },
      { q: "What is the zombie threshold?", a: "scheduler_zombie_task_threshold = 300s — that's why 'failed' shows up ~5 min after the kill." },
    ],
  },

  "inc-de-non-idempotent-append": {
    actualRootCause:
      "The load task is non-idempotent. It extracts the day's orders and writes them with mode='append' (no dedup, no partition replace, no upsert). When publish_metrics — a step AFTER the append — timed out, Airflow retried the WHOLE task, so extract+append ran a second time and the same orders were appended again. That's why 2026-05-19 has every order_id twice and the count/revenue are exactly 2x.",
    actualFix:
      "Make the write idempotent: replace the day's partition (overwrite-by-partition) or MERGE/upsert by order_id instead of blind append, so re-running the task yields the same result. Better, split extract / append / publish_metrics into separate tasks so a failure in publish_metrics retries only publish, not the append. To correct finance, dedupe/restate the 2026-05-19 partition (keep one row per order_id).",
    contributingFactors: [
      "mode='append' with no dedup/upsert/partition-replace",
      "Airflow retries the whole task, including the already-succeeded append, on a downstream failure",
      "publish_metrics failure happened after the append, so the retry re-did the append",
      "Single monolithic task instead of separate extract/load/publish steps",
    ],
    rubric: [
      "Investigates before concluding — queries fct_orders to confirm duplicate order_ids for 2026-05-19",
      "Root cause: non-idempotent append + whole-task retry after a post-append failure double-loaded the day",
      "Explains the retry-after-partial-success interaction precisely",
      "Fix: partition-replace or MERGE/upsert by order_id; ideally split extract/load/publish tasks",
      "Triage: restate/dedupe the 2026-05-19 partition to correct finance, then ship the idempotent write",
    ],
    facts: [
      { q: "Are there duplicate order_ids?", a: "Query fct_orders for 2026-05-19 — each order_id appears in two load_batches (1 and 2)." },
      { q: "What write mode does the load use?", a: "mode='append'." },
      { q: "Why did it retry?", a: "publish_metrics timed out (a network blip); Airflow retried the whole task, re-running extract+append." },
      { q: "Was the source itself doubled?", a: "No — the source has each order once; the duplication is purely from the re-append." },
    ],
  },

  "inc-de-tight-watermark-revenue": {
    actualRootCause:
      "The watermark allows only 1 minute of lateness (withWatermark('event_time', '1 minute')). Mobile clients buffer events while offline and flush them on reconnect, arriving minutes late (median ~4m, p95 ~22m). Those events have an event_time inside the window but an arrival_time well past event_time + 1 minute, so Structured Streaming drops them as too late. The dropped, revenue-bearing events are exactly the ~3% gap vs the batch reconciliation.",
    actualFix:
      "Widen the watermark / grace period to match the real lateness distribution (e.g. ~30 minutes to cover p95), accepting the latency and state-size trade-off. For stragglers beyond the grace window, reconcile with a periodic batch correction layer rather than counting on the stream. Right-size the watermark to the data, don't set it to infinity (unbounded state).",
    contributingFactors: [
      "1-minute watermark slack vs minutes-late mobile flushes",
      "Offline-buffer flush pattern produces large event_time-to-arrival gaps",
      "No batch correction layer to recapture late stragglers",
    ],
    rubric: [
      "Investigates before concluding — quantifies the dropped late amount from raw_events and ties it to ~3%",
      "Root cause: watermark too tight (1 min) drops minutes-late mobile-flush events that carry revenue",
      "Distinguishes event_time vs arrival_time and the drop boundary (arrival > event_time + slack)",
      "Fix: widen watermark/grace to the real lateness distribution; add a batch correction for extreme stragglers",
      "Names the trade-off: more slack = higher latency and state — sizes it, doesn't make it infinite",
    ],
    facts: [
      { q: "How much lateness does the watermark allow?", a: "1 minute (withWatermark('event_time','1 minute'))." },
      { q: "How late do mobile events arrive?", a: "Median ~4 min, p95 ~22 min on flaky networks (offline-buffer flush)." },
      { q: "How much revenue is being dropped?", a: "Query raw_events for rows where arrival_time > event_time + 1 min and SUM(amount) — that's the gap." },
      { q: "Is the batch total right?", a: "Yes — batch reprocesses with all data, so it includes the late events the stream dropped." },
    ],
  },

  "inc-de-partition-overwrite-race": {
    actualRootCause:
      "Two interacting causes. (1) The upstream raw read came back SHORT — the S3 listing returned only 2 of 8 part files (eventual-consistency / incomplete listing), so the backfill DataFrame was partial (1.9M instead of 8M rows). (2) The write used Spark's default STATIC partitionOverwriteMode with mode('overwrite'): in STATIC mode Spark deletes the target partition directories BEFORE writing, and it cleared partitions beyond the one it actually rewrote — so 2026-05-18 was clobbered with the partial data and 2026-05-19 (which the job never meant to rewrite) was emptied as collateral. The partial read alone would have shrunk 05-18; the STATIC overwrite alone wouldn't have lost good rows; together they destroyed two days.",
    actualFix:
      "Use DYNAMIC partition overwrite (spark.sql.sources.partitionOverwriteMode=dynamic) — or write to a temp location and atomically swap — so only the partitions actually present in the output are replaced and untouched partitions (05-19) are never deleted. Gate the backfill on a source completeness check (expected file count / row-count threshold) so a short/partial read aborts instead of overwriting good data. Restore 2026-05-18 and 2026-05-19 from snapshot/backup. The timezone theory is wrong — the dt values are correct.",
    contributingFactors: [
      "S3 listing returned 2 of 8 part files -> partial source read",
      "Spark default STATIC partitionOverwriteMode deletes partitions before writing",
      "STATIC overwrite cleared a partition (05-19) the run never rewrote",
      "No source-completeness / row-count guard before overwriting",
    ],
    redHerrings: [
      "The timezone/day-boundary theory: on-call suspects a tz shift moved partitions, but the dt values are correct — it's a plausible-but-wrong lead that wastes time",
      "Blaming only the partial read explains 05-18 shrinking but NOT 05-19 going empty — chasing only that one cause leaves half the outage unexplained",
    ],
    triageOrder: [
      "Mitigate: restore 2026-05-18 and 2026-05-19 partitions from snapshot/backup to stop user-facing data loss",
      "Root-cause: confirm the short read (2/8 files) AND that STATIC overwrite deleted an un-rewritten partition; verify dt values to kill the timezone theory",
      "Prevent: switch to DYNAMIC overwrite (or temp-then-swap) and add a source-completeness guard before any overwrite",
    ],
    rubric: [
      "Investigates before concluding — checks the before/after row counts and the dt values (rules out timezone) before naming a cause",
      "Identifies BOTH causes: partial source read (2/8 files) AND STATIC partition overwrite deleting an un-rewritten partition",
      "Explicitly rejects the timezone red herring and explains why it's plausible but wrong",
      "Fix: DYNAMIC overwrite or temp-then-swap + a completeness/row-count guard; restore from backup",
      "Correct triage: restore the clobbered partitions first, then fix the overwrite mode and add the guard",
    ],
    facts: [
      { q: "How complete was the source read?", a: "The S3 listing returned 2 of 8 part files — the read came back short (1.9M vs 8M rows)." },
      { q: "What overwrite mode was used?", a: "Spark default: STATIC partitionOverwriteMode with mode('overwrite')." },
      { q: "Are the dt values shifted?", a: "No — query curated_sessions; the dt values are correct, so the timezone theory doesn't hold." },
      { q: "Why did 05-19 go empty?", a: "It was never rewritten — STATIC overwrite deleted target partition dirs beyond the one the run produced." },
      { q: "Is there a backup?", a: "Yes — there are prior snapshots of the curated partitions to restore from." },
    ],
  },

  "inc-de-spark-repartition-oom": {
    actualRootCause:
      "repartition(1) funnels the entire dataset into a single partition handled by one task on one executor. Stage 4 is therefore a single task that must hold/sort all the rows, spills 9.4 GB, and OOMs. The join key user_id is heavily skewed (guest/anonymous user_id=0 is ~70% of clicks), which both inflates the volume going through that one task and would cause skew problems in the join even without repartition(1).",
    actualFix:
      "Don't collapse everything into one partition — remove repartition(1). If a single output file is genuinely required, write normally (many partitions) and merge afterward, or use coalesce to a sane number of partitions, never 1 on a large dataset. Handle the skew: enable AQE skew-join handling (spark.sql.adaptive.skewJoin.enabled) and/or salt the hot user_id so the join load spreads across tasks. Bumping executor memory does not fix a single-task funnel.",
    contributingFactors: [
      "repartition(1) before the write forces all rows into one task",
      "Heavily skewed join key (guest user_id=0 ~70% of clicks)",
      "Single-task stage can't be parallelized by more executor memory",
    ],
    redHerrings: [
      "Bumping executor memory is the wrong instinct — one task can't be parallelized by adding RAM; it only delays the OOM",
    ],
    rubric: [
      "Investigates before concluding — notes stage 4 is a single spilling task from the log rather than just raising memory",
      "Root cause: repartition(1) funnels the whole (skewed) dataset into one task that OOMs",
      "Calls bumping executor memory a red herring and explains why (a single task doesn't parallelize with more RAM)",
      "Fix: drop repartition(1); if one file is needed, write-then-merge or coalesce with enough partitions",
      "Handles skew: AQE skew-join and/or salting the hot user_id",
    ],
    facts: [
      { q: "How many tasks does stage 4 have?", a: "One — it's after repartition(1)." },
      { q: "Is the data skewed?", a: "Yes — guest/anonymous user_id=0 is ~70% of all clicks." },
      { q: "Does the job really need one output file?", a: "It was just for tidiness; one file is not a hard requirement and can be produced by a post-write merge." },
      { q: "Would more executor memory help?", a: "Consider what more RAM does for a single task that already spills 9.4 GB — it doesn't parallelize the work." },
    ],
  },

  "inc-de-bigquery-full-scan": {
    actualRootCause:
      "The dashboard query is SELECT * with no filter on the partition column dt, so every 5-minute auto-refresh scans the entire ~1.2 PB table (~$7.4k per run at on-demand pricing). The WHERE user_country='US' filters on a non-partition column, so it prunes nothing — it's applied after the full scan. SELECT * also reads all ~1100 columns. require_partition_filter is set to false on the table, so nothing blocks the unfiltered scan.",
    actualFix:
      "Query: add a dt partition filter (e.g. WHERE dt = CURRENT_DATE) and select only the needed columns; cut the refresh frequency and/or point the dashboard at a small pre-aggregated table or a cached result. Prevention: set require_partition_filter = true on the table so any query without a partition filter is rejected before it runs, making this class of accidental full scan impossible.",
    contributingFactors: [
      "SELECT * with no dt partition filter -> full ~1.2 PB scan",
      "Filter on user_country (non-partition column) prunes nothing",
      "Auto-refresh every 5 min multiplies the cost",
      "require_partition_filter = false leaves the table unprotected",
    ],
    rubric: [
      "Investigates before concluding — confirms no dt filter and that user_country isn't the partition key before concluding",
      "Root cause: unfiltered SELECT * scans the whole ~1.2 PB partitioned table every refresh",
      "Quantifies the cost (bytes scanned * price * refresh rate) and notes SELECT * reads all columns",
      "Fix (query): add a dt filter, select needed columns, reduce refresh / use a pre-agg or cache",
      "Fix (prevention): require_partition_filter = true so unfiltered queries are rejected",
    ],
    facts: [
      { q: "Does the query filter on the partition column?", a: "No — it filters on user_country, which is not the dt partition key." },
      { q: "How much does each run scan?", a: "~1.18 PB (~$7.4k per run); it auto-refreshes every 5 minutes." },
      { q: "Is the table protected?", a: "No — require_partition_filter = false in the DDL." },
      { q: "How much data does the dashboard actually need?", a: "One day — compare scanning all dt vs WHERE dt = a single day in the SQL console." },
    ],
  },

  "inc-de-timezone-day-boundary": {
    actualRootCause:
      "Events are stored in UTC, but the query truncates the raw UTC timestamp to a DATE (CAST(event_ts AS DATE)) and compares to UTC CURRENT_DATE. The business day is America/Los_Angeles (UTC-7/8). So the day boundary used is UTC, not Pacific: evening-PT activity (which is the next day in UTC) lands in the wrong day bucket, and in the PT morning the UTC 'today' still mostly contains the previous PT day's activity — so 'today' reads like yesterday.",
    actualFix:
      "Convert event_ts to America/Los_Angeles before truncating to a date, and compare against the current date in that same timezone (e.g. truncate the tz-converted timestamp, and use a Pacific 'today'). Use the IANA timezone name so DST is handled automatically rather than a fixed offset.",
    contributingFactors: [
      "event_ts truncated in UTC, not the business tz",
      "Comparison against UTC CURRENT_DATE rather than a Pacific 'today'",
      "Day boundary mismatch shifts evening-PT (next-day-UTC) events into the wrong day",
    ],
    rubric: [
      "Investigates before concluding — groups the data by UTC date vs PT-shifted date to show the bucket shift",
      "Root cause: day boundary is UTC because the raw UTC timestamp is truncated and compared to UTC CURRENT_DATE",
      "Explains the symptom: PT-morning 'today' (UTC) still holds last night's PT activity, so it looks like yesterday",
      "Fix: convert to America/Los_Angeles before truncating, compare against the current date in that tz, use the tz name for DST",
    ],
    facts: [
      { q: "What timezone are events stored in?", a: "UTC; the business reports in America/Los_Angeles." },
      { q: "What does the query truncate?", a: "The raw UTC event_ts (CAST(event_ts AS DATE)) and compares to UTC CURRENT_DATE." },
      { q: "How can I see the shift?", a: "Group events by UTC date vs by event_ts shifted to Pacific — evening-PT rows move to a different day bucket." },
      { q: "Is it a DST issue?", a: "Use the IANA tz name (America/Los_Angeles) so the offset (UTC-7/8) is handled correctly across DST." },
    ],
  },
};
