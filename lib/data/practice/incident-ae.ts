import type { ConvItem } from "./types";

/**
 * Incident Debugging — Analytics Engineer role (dbt / SQL / warehouse / metrics).
 * Eight production-incident scenarios. The candidate reads the artifacts
 * (models, configs, logs, queries), investigates by running SQL in the in-browser
 * DuckDB console (and Python where flagged), then submits a root cause + fix.
 *
 * Only the client-visible halves live here (brief, artifacts, seeded data). The
 * diagnosed root cause / fix / red herrings / triage / rubric / facts live
 * server-side in incident-ae.server.ts (resolved by problemId). idealAnswer is
 * ALWAYS "" — the grader builds the reference server-side.
 */

/* ------------------------------------------------------------------ *
 * 1) Source-freshness gate halts the run — wrong loaded_at_field      *
 * ------------------------------------------------------------------ */

const FRESHNESS_YML = `# models/staging/_sources.yml
version: 2
sources:
  - name: fivetran_orders
    database: raw
    schema: fivetran_orders
    loaded_at_field: order_created_at        # <- freshness measured off THIS column
    freshness:
      warn_after:  { count: 6,  period: hour }
      error_after: { count: 12, period: hour }
    tables:
      - name: orders
`;

const FRESHNESS_LOG = `$ dbt source freshness
07:00:02  Running with dbt=1.8.3
07:00:03  1 of 1 START freshness of fivetran_orders.orders ............. [RUN]
07:00:05  1 of 1 ERROR STALE freshness of fivetran_orders.orders ...... [ERROR in 2.31s]
07:00:05    max(order_created_at) = 2026-05-29 18:44:10
07:00:05    snapshotted_at        = 2026-05-31 07:00:05  (age = 36h21m > error_after 12h)
07:00:05  Done. PASS=0 WARN=0 ERROR=1 SKIP=0 TOTAL=1
07:00:05  FAIL: source freshness gate -> downstream 'dbt build' skipped, dashboards not refreshed
07:00:06  NOTE  Fivetran connector dashboard shows last successful sync 2026-05-31 06:58 (12 min ago).`;

const FRESHNESS_SETUP = `CREATE TABLE orders (
  order_id          INTEGER,
  customer_id       INTEGER,
  amount            DECIMAL(10,2),
  order_created_at  TIMESTAMP,   -- when the CUSTOMER placed the order (business event time)
  _fivetran_synced  TIMESTAMP    -- when Fivetran LOADED the row into the warehouse
);
INSERT INTO orders VALUES
  -- A steady trickle of orders. Note: order_created_at is the EVENT time and can be
  -- days old (back-dated imports, slow checkout), while _fivetran_synced is recent and
  -- monotonically advances as the connector syncs. The newest event time is 2 days old,
  -- but every row was loaded by Fivetran in the last few minutes.
  (5001, 9001, 19.99,  TIMESTAMP '2026-05-27 10:00:00', TIMESTAMP '2026-05-31 06:57:40'),
  (5002, 9002, 49.00,  TIMESTAMP '2026-05-28 09:12:00', TIMESTAMP '2026-05-31 06:57:42'),
  (5003, 9003, 9.99,   TIMESTAMP '2026-05-28 22:40:00', TIMESTAMP '2026-05-31 06:57:45'),
  (5004, 9004, 120.00, TIMESTAMP '2026-05-29 08:05:00', TIMESTAMP '2026-05-31 06:57:50'),
  (5005, 9005, 15.50,  TIMESTAMP '2026-05-29 18:44:10', TIMESTAMP '2026-05-31 06:58:01'),
  (5006, 9006, 60.00,  TIMESTAMP '2026-05-26 14:00:00', TIMESTAMP '2026-05-31 06:58:03'),
  (5007, 9007, 35.25,  TIMESTAMP '2026-05-27 19:30:00', TIMESTAMP '2026-05-31 06:58:07'),
  (5008, 9008, 8.00,   TIMESTAMP '2026-05-28 11:11:00', TIMESTAMP '2026-05-31 06:58:11');
`;

/* ------------------------------------------------------------------ *
 * 2) Metric collapsed into an "Unknown" bucket — NULLs in GROUP BY    *
 * ------------------------------------------------------------------ */

const UNKNOWN_SQL = `-- models/marts/revenue_by_channel.sql
-- Powers the "Revenue by Marketing Channel" exec dashboard.
SELECT
  c.channel               AS channel,
  SUM(o.amount)           AS revenue,
  COUNT(*)                AS orders
FROM {{ ref('stg_orders') }}    o
LEFT JOIN {{ ref('dim_campaign') }} c
  ON o.campaign_id = c.campaign_id
GROUP BY 1
ORDER BY revenue DESC;
`;

const UNKNOWN_LOG = `[#analytics-alerts] dashboard owner:
  "Since Monday's release, 'Unknown' is our #1 channel by revenue — 40% of all
   revenue is now Unknown. Last week Unknown was ~2%. Paid Search 'dropped'.
   Nobody changed the dashboard. Did marketing break attribution?"
[release note 2026-05-25] dim_campaign rebuilt: legacy 'paid_search_v1' campaign_ids
   were migrated to new 'paid_search' campaign_ids; the old rows were deleted from
   dim_campaign. stg_orders still carries the historical campaign_id values.`;

const UNKNOWN_SETUP = `CREATE TABLE stg_orders (
  order_id     INTEGER,
  amount       DECIMAL(10,2),
  campaign_id  INTEGER       -- some are legacy ids no longer present in dim_campaign
);
CREATE TABLE dim_campaign (
  campaign_id  INTEGER,
  channel      VARCHAR
);
INSERT INTO dim_campaign VALUES
  (200, 'Email'),
  (201, 'Social'),
  (202, 'paid_search'),     -- the NEW paid-search id
  (203, 'Affiliate');
INSERT INTO stg_orders VALUES
  -- New-id orders: join cleanly.
  (1, 50.00, 200),
  (2, 30.00, 201),
  (3, 25.00, 202),
  (4, 90.00, 203),
  (5, 40.00, 200),
  -- LEGACY paid_search_v1 ids (100,101,102) — these rows were DELETED from dim_campaign,
  -- so the LEFT JOIN yields channel = NULL and the dashboard buckets them as 'Unknown'.
  (6,  120.00, 100),
  (7,  200.00, 101),
  (8,  80.00,  101),
  (9,  60.00,  102),
  (10, 150.00, 100);
`;

/* ------------------------------------------------------------------ *
 * 3) Report doubled — join fan-out on a non-unique key                *
 * ------------------------------------------------------------------ */

const DOUBLED_SQL = `-- models/marts/customer_orders.sql
-- "Orders & lifetime value per customer" — used by the CRM team.
SELECT
  o.order_id,
  o.amount,
  a.region
FROM {{ ref('stg_orders') }}      o
JOIN {{ ref('stg_addresses') }}   a
  ON a.customer_id = o.customer_id;   -- intend: one address per customer
`;

const DOUBLED_LOG = `[CRM team] "Total orders on the customer report = 12, but the orders table
  only has 8 rows. Lifetime-value per customer is exactly 2x for some customers,
  exactly right for others. Started after we loaded the new address feed."
[data eng] stg_addresses now stores BOTH 'billing' and 'shipping' rows per
  customer (address_type column added last sprint). It used to be one row each.`;

const DOUBLED_SETUP = `CREATE TABLE stg_orders (
  order_id     INTEGER,
  customer_id  INTEGER,
  amount       DECIMAL(10,2)
);
CREATE TABLE stg_addresses (
  customer_id   INTEGER,
  address_type  VARCHAR,   -- 'billing' or 'shipping' — NOT unique per customer anymore
  region        VARCHAR
);
INSERT INTO stg_orders VALUES
  (1, 101, 10.00),
  (2, 101, 20.00),
  (3, 102, 30.00),
  (4, 102, 40.00),
  (5, 103, 50.00),
  (6, 104, 60.00),
  (7, 104, 70.00),
  (8, 105, 80.00);
INSERT INTO stg_addresses VALUES
  -- customers 101 & 104 have TWO rows (billing + shipping) -> fan-out doubles their orders
  (101, 'billing',  'West'),
  (101, 'shipping', 'West'),
  (102, 'billing',  'East'),
  (103, 'billing',  'South'),
  (104, 'billing',  'North'),
  (104, 'shipping', 'North'),
  (105, 'billing',  'West');
`;

/* ------------------------------------------------------------------ *
 * 4) dbt incremental drops late/updated rows — ">" on created_at only *
 * ------------------------------------------------------------------ */

const INCR_SQL = `-- models/marts/fct_orders.sql
{{ config(materialized='incremental', unique_key='order_id') }}

SELECT
  order_id,
  customer_id,
  status,
  amount,
  created_at,
  updated_at
FROM {{ ref('stg_orders') }}

{% if is_incremental() %}
  -- only pull "new" rows since the last run
  WHERE created_at > (SELECT MAX(created_at) FROM {{ this }})
{% endif %}
`;

const INCR_LOG = `[finance] "Refunds aren't showing up in fct_orders. An order placed Tuesday and
  refunded Thursday still shows status='completed' in the mart, but the source
  (stg_orders) clearly shows status='refunded'. New orders look fine."
[note] Orders are mutable: status flips completed -> refunded/cancelled and amount
  changes. created_at is set once at insert; updated_at changes on every mutation.
  A full-refresh of the model makes the numbers correct; the next incremental run
  diverges again.`;

const INCR_SETUP = `CREATE TABLE stg_orders (
  order_id    INTEGER,
  customer_id INTEGER,
  status      VARCHAR,
  amount      DECIMAL(10,2),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
);
-- "this" = the incremental target as it stood AFTER the last run (Tuesday night).
-- MAX(created_at) in fct_orders was 2026-05-26 (order 4).
CREATE TABLE fct_orders (
  order_id    INTEGER,
  customer_id INTEGER,
  status      VARCHAR,
  amount      DECIMAL(10,2),
  created_at  TIMESTAMP,
  updated_at  TIMESTAMP
);
INSERT INTO fct_orders VALUES
  (1, 11, 'completed', 100.00, TIMESTAMP '2026-05-25 09:00:00', TIMESTAMP '2026-05-25 09:00:00'),
  (2, 12, 'completed',  50.00, TIMESTAMP '2026-05-25 14:00:00', TIMESTAMP '2026-05-25 14:00:00'),
  (3, 13, 'completed',  75.00, TIMESTAMP '2026-05-26 10:00:00', TIMESTAMP '2026-05-26 10:00:00'),
  (4, 14, 'completed',  20.00, TIMESTAMP '2026-05-26 16:00:00', TIMESTAMP '2026-05-26 16:00:00');
-- source NOW (Thursday): orders 1 & 3 were REFUNDED Thursday (updated_at advanced,
-- created_at unchanged), order 5 is brand new. The "created_at >" filter only catches
-- order 5; the refunds (created_at <= 2026-05-26) are silently skipped forever.
INSERT INTO stg_orders VALUES
  (1, 11, 'refunded',    0.00, TIMESTAMP '2026-05-25 09:00:00', TIMESTAMP '2026-05-28 11:00:00'),
  (2, 12, 'completed',  50.00, TIMESTAMP '2026-05-25 14:00:00', TIMESTAMP '2026-05-25 14:00:00'),
  (3, 13, 'refunded',    0.00, TIMESTAMP '2026-05-26 10:00:00', TIMESTAMP '2026-05-28 13:30:00'),
  (4, 14, 'completed',  20.00, TIMESTAMP '2026-05-26 16:00:00', TIMESTAMP '2026-05-26 16:00:00'),
  (5, 15, 'completed',  90.00, TIMESTAMP '2026-05-28 08:00:00', TIMESTAMP '2026-05-28 08:00:00');
`;

/* ------------------------------------------------------------------ *
 * 5) Snowflake full-table scan despite WHERE — cast defeats pruning   *
 * ------------------------------------------------------------------ */

const PRUNE_SQL = `-- The hot dashboard query (Snowflake). events is clustered on event_ts.
-- It "filters to one day" but scans the entire multi-TB table every run.
SELECT
  user_id,
  COUNT(*) AS events
FROM events
WHERE TO_DATE(event_ts) = '2026-05-31'   -- <- column wrapped in TO_DATE()
GROUP BY user_id;
`;

const PRUNE_PROFILE = `-- Snowflake query profile (abridged)
Partitions scanned:  48,212
Partitions total:    48,212        <- 100% scanned: NO pruning
Bytes scanned:       3.9 TB
Warehouse:           XL  (16 credits/hr)
Elapsed:             7m 41s
Note: events is clustered on event_ts (TIMESTAMP). Snowflake stores per-partition
min/max of event_ts, but the predicate wraps event_ts in TO_DATE(), so the value the
optimizer can compare against the partition metadata is unavailable at compile time.
A sibling query 'WHERE event_ts >= ... AND event_ts < ...' scans 41 partitions in 0.6s.`;

const PRUNE_SETUP = `-- DuckDB stand-in so you can see the row-level behavior (semantics, not micro-partitions).
CREATE TABLE events (
  event_id  INTEGER,
  user_id   INTEGER,
  event_ts  TIMESTAMP
);
INSERT INTO events VALUES
  (1, 1, TIMESTAMP '2026-05-30 23:59:59'),
  (2, 1, TIMESTAMP '2026-05-31 00:00:01'),
  (3, 2, TIMESTAMP '2026-05-31 08:14:00'),
  (4, 2, TIMESTAMP '2026-05-31 09:00:00'),
  (5, 3, TIMESTAMP '2026-05-31 23:59:59'),
  (6, 3, TIMESTAMP '2026-06-01 00:00:01'),
  (7, 4, TIMESTAMP '2026-05-29 12:00:00'),
  (8, 4, TIMESTAMP '2026-06-02 12:00:00');
-- Both 'TO_DATE(event_ts) = ...' and the sargable range return the SAME rows
-- (events on 2026-05-31). The difference is purely whether the predicate is
-- sargable enough for the engine to prune by the event_ts min/max metadata.
`;

/* ------------------------------------------------------------------ *
 * 7) Snowflake cost creep — accidental cross join (missing ON)        *
 * ------------------------------------------------------------------ */

const COST_SQL = `-- models/marts/daily_user_spend.sql  (runs hourly on a 4XL)
-- Should be: spend per user per day, one row per (user, day).
SELECT
  u.user_id,
  d.calendar_date,
  SUM(s.amount) AS spend
FROM {{ ref('dim_users') }}        u
JOIN {{ ref('dim_calendar') }}     d        -- <- no ON clause: cross join with calendar!
JOIN {{ ref('fct_spend') }}        s
  ON s.user_id = u.user_id
 AND s.spend_date = d.calendar_date
GROUP BY 1, 2;
`;

const COST_LOG = `[finance-ops] "Warehouse credits for the analytics WH 9x'd overnight. One model,
  daily_user_spend, went from 40s to 38 minutes and spilled to remote storage. No
  data-volume change that explains 9x. Bill projection: +$48k/mo if left running."
[query history] daily_user_spend: rows produced in the join step = users * calendar
  * (matched spend) — exploded from ~1e6 to ~3.6e11 intermediate rows before the
  final GROUP BY collapsed them. Result is still 'correct' but obscenely expensive.`;

const COST_SETUP = `CREATE TABLE dim_users    (user_id INTEGER);
CREATE TABLE dim_calendar (calendar_date DATE);
CREATE TABLE fct_spend    (user_id INTEGER, spend_date DATE, amount DECIMAL(10,2));
INSERT INTO dim_users VALUES (1),(2),(3);
INSERT INTO dim_calendar VALUES
  (DATE '2026-05-29'),(DATE '2026-05-30'),(DATE '2026-05-31'),(DATE '2026-06-01');
INSERT INTO fct_spend VALUES
  (1, DATE '2026-05-31', 10.00),
  (2, DATE '2026-05-31', 20.00),
  (3, DATE '2026-05-30', 30.00);
-- The dim_calendar join has NO ON clause -> every user row crosses every calendar
-- row BEFORE fct_spend constrains it. Intermediate cardinality = 3 users * 4 days
-- * (spend matches) instead of just the matched spend rows. Final GROUP BY hides
-- the blow-up; the cost lives in the exploded intermediate.
`;

/* ------------------------------------------------------------------ *
 * 8) A/B significant but wrong — SAMPLE-RATIO MISMATCH (hellish)      *
 * ------------------------------------------------------------------ */

const SRM_ASSIGN = `// assignment.js — bucketing on the web tier
// Intended: 50/50 split, sticky per user, one arm per user for the experiment.
function getVariant(userId, sessionId) {
  // BUG: when the auth cookie is missing on a request, we fall back to sessionId.
  // A user who logs in mid-session gets bucketed once by sessionId (logged-out)
  // and again by userId (logged-in) — landing them in BOTH arms across events.
  const key = userId ? userId : sessionId;
  const h = hash(key) % 100;
  return h < 50 ? 'control' : 'treatment';
}
`;

const SRM_ANALYSIS = `-- analysis/experiment_results.sql
-- "treatment lifts conversion +6%, p < 0.001" — shipped to the launch review.
SELECT
  variant,
  COUNT(DISTINCT user_id)                              AS users,
  AVG(CASE WHEN converted THEN 1.0 ELSE 0 END)         AS conv_rate
FROM exposures e
JOIN conversions c USING (user_id)
GROUP BY variant;
`;

const SRM_LOG = `[experimentation review]
  control:   12,140 users   conv 8.0%
  treatment: 13,920 users   conv 8.5%   (+6% rel, p<0.001)
  reviewer:  "Result is significant. But why is treatment 53.4% of users when we
              configured a 50/50 split? Expected ~13,030 each. Chi-square SRM
              p = 4e-7. Something is off BEFORE we trust the lift."
[note] 'sticky per user' was the design; some users appear in BOTH arms' exposure
  logs. The conversion join is on user_id only (no variant), so a both-arms user's
  conversion can attach to whichever arm(s) they're exposed in.`;

const SRM_SETUP = `CREATE TABLE exposures (
  user_id  INTEGER,
  variant  VARCHAR        -- a buggy user can have BOTH 'control' and 'treatment' rows
);
CREATE TABLE conversions (
  user_id   INTEGER,
  converted BOOLEAN
);
INSERT INTO exposures VALUES
  -- clean single-arm users
  (1,'control'),(2,'control'),(3,'control'),(4,'control'),(5,'control'),
  (6,'treatment'),(7,'treatment'),(8,'treatment'),(9,'treatment'),
  -- DUAL-ARM users (logged in mid-session): appear in BOTH arms -> SRM + contamination
  (100,'control'),(100,'treatment'),
  (101,'control'),(101,'treatment'),
  (102,'control'),(102,'treatment');
INSERT INTO conversions VALUES
  (1,true),(2,false),(3,false),(4,true),(5,false),
  (6,true),(7,true),(8,false),(9,false),
  -- dual-arm users converted; their conversion is double-counted across arms
  (100,true),(101,true),(102,true);
-- Clean split would be 5 control / 4 treatment. The 3 dual-arm users inflate
-- treatment's count (and contaminate both arms' conversion), producing the SRM.
`;

/* ------------------------------------------------------------------ *
 * 9) Revenue recon mismatch — timezone RED HERRING; real cause is an  *
 *    inner join dropping rows + a late partition (hellish)            *
 * ------------------------------------------------------------------ */

const RECON_SQL = `-- models/marts/daily_revenue.sql
-- Reconciled against the payments ledger each morning. Off by a few % most days,
-- but yesterday it was off by ~38% and finance escalated.
SELECT
  o.order_date,
  SUM(o.amount) AS revenue
FROM {{ ref('fct_orders') }}        o
JOIN {{ ref('fct_payments') }}      p     -- INNER join: orders with no payment row vanish
  ON p.order_id = o.order_id
GROUP BY o.order_date
ORDER BY o.order_date;
`;

const RECON_LOG = `[finance] "daily_revenue for 2026-05-30 = \\$330; ledger says \\$530. ~38% short.
  Earlier days reconcile fine. Someone said it's a timezone/day-boundary thing
  because we're in PT and the ledger is UTC."
[data eng] Two leads on the table:
  (A) timezone: order_date is already stored as a clean PT calendar date; the ledger
      groups by the same PT date. Spot-check: no orders sit near midnight, and
      shifting +/- a day does NOT close the gap.
  (B) payments partition for 2026-05-30 landed LATE — the payments loader for the
      last hours of the day hadn't completed when the model ran, so several paid
      orders had NO row in fct_payments yet. The INNER join silently dropped them.`;

const RECON_SETUP = `CREATE TABLE fct_orders (
  order_id   INTEGER,
  order_date DATE,           -- already a clean PT calendar date (timezone is a red herring)
  amount     DECIMAL(10,2)
);
CREATE TABLE fct_payments (
  payment_id INTEGER,
  order_id   INTEGER,
  paid       BOOLEAN
);
INSERT INTO fct_orders VALUES
  -- 2026-05-29 reconciles fine (every order has a payment row)
  (1, DATE '2026-05-29', 100.00),
  (2, DATE '2026-05-29',  50.00),
  (3, DATE '2026-05-29',  80.00),
  -- 2026-05-30: true ledger total = 530. Orders 4,5,6 have payment rows (sum 330);
  -- orders 7,8 are paid but their payment rows landed LATE (missing) -> dropped.
  (4, DATE '2026-05-30', 100.00),
  (5, DATE '2026-05-30', 130.00),
  (6, DATE '2026-05-30', 100.00),
  (7, DATE '2026-05-30', 120.00),   -- payment row landed late: MISSING -> dropped by INNER join
  (8, DATE '2026-05-30',  80.00);   -- payment row landed late: MISSING -> dropped by INNER join
INSERT INTO fct_payments VALUES
  (901, 1, true),
  (902, 2, true),
  (903, 3, true),
  (904, 4, true),
  (905, 5, true),
  (906, 6, true);
-- 2026-05-29: 100+50+80 = 230, mart matches (every order has a payment row).
-- 2026-05-30: full order total (ledger) = 100+130+100+120+80 = 530. The INNER-join
-- mart only sees orders with a loaded payment row (4,5,6) = 330. Gap = orders 7,8
-- (200, ~38% short) dropped by the inner join against the late payments partition.
-- Timezone is a red herring: order_date is already a clean PT date with no midnight
-- orders, so shifting the day boundary does NOT close the 200 gap.
`;

export const INCIDENT_AE_ITEMS: ConvItem[] = [
  /* 1 — standard, FREE */
  {
    id: "inc-ae-source-freshness-gate",
    category: "incident",
    level: "mid",
    title: "Source-freshness gate halts the whole build",
    company: "B2B SaaS",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: `dbt source freshness` is failing STALE on `fivetran_orders.orders` and the failure gate is skipping the nightly `dbt build`, so every dashboard is stale. But the Fivetran connector dashboard shows a successful sync 12 minutes ago — the data IS fresh. Investigate the freshness config and the data, then submit the root cause and the fix.",
    hints: [
      "Freshness compares `max(loaded_at_field)` to now. Look at which column the source is configured to measure freshness on.",
      "Compare two timestamps in the data: when the customer placed the order (event time) vs when Fivetran loaded the row. Which one actually advances on every sync?",
      "`order_created_at` can be days old even when the row was just loaded. What's the column ELT tools set to mark load time?",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies that `loaded_at_field` points at the event-time column (`order_created_at`) instead of the load-time column",
      "Confirms with the data that `_fivetran_synced` is recent/monotonic while `order_created_at` lags by days",
      "Explains why freshness fails even though the connector synced minutes ago",
      "Fix: set `loaded_at_field` to the load/sync timestamp (`_fivetran_synced`); does not just bump `error_after`",
    ],
    incident: {
      brief:
        "`dbt source freshness` reports STALE (age 36h > error_after 12h) on `fivetran_orders.orders`, blocking the nightly build — but Fivetran synced 12 minutes ago. Find why freshness is wrong and fix it.",
      severity: "SEV-3 · pipeline-blocking",
      tier: "standard",
      artifacts: [
        { name: "models/staging/_sources.yml", kind: "config", language: "text", content: FRESHNESS_YML },
        { name: "logs/dbt-source-freshness.log", kind: "log", language: "text", content: FRESHNESS_LOG },
      ],
      sql: { setupSql: FRESHNESS_SETUP, tables: ["orders"] },
    },
  },

  /* 2 — standard */
  {
    id: "inc-ae-unknown-bucket",
    category: "incident",
    level: "mid",
    title: "'Unknown' is suddenly the #1 marketing channel",
    company: "Marketplace",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: the Revenue-by-Channel exec dashboard now shows 'Unknown' as the top channel (40% of revenue), up from ~2% last week, and Paid Search appears to have collapsed. Nobody changed the dashboard. Investigate the model and the data, then submit the root cause and the fix.",
    hints: [
      "'Unknown' usually means the channel came back NULL. A LEFT JOIN that doesn't match produces NULL — query for order rows whose `campaign_id` has no row in `dim_campaign`.",
      "Read the release note: what happened to the legacy paid_search campaign rows in `dim_campaign`? Does `stg_orders` still carry the old ids?",
      "This is a referential-integrity break from a dimension migration, not an attribution bug. Think about how the NULL channel should be coalesced/back-mapped.",
    ],
    idealAnswer: "",
    rubric: [
      "Diagnoses unmatched LEFT JOIN keys -> NULL channel -> bucketed as 'Unknown'",
      "Traces it to the dim_campaign migration deleting legacy paid_search_v1 ids that stg_orders still references",
      "Confirms with a query that the 'Unknown' revenue maps to the orphaned legacy campaign_ids",
      "Fix: back-map/alias legacy ids (or keep deprecated dim rows) so historical orders resolve; add a not-null/relationship test",
    ],
    incident: {
      brief:
        "Revenue by Channel shows 'Unknown' = 40% of revenue (was ~2%); Paid Search 'dropped'. A recent dim_campaign rebuild migrated legacy paid_search_v1 ids and deleted the old rows. stg_orders still has the old ids. Find the root cause and fix.",
      severity: "SEV-3 · exec-reporting",
      tier: "standard",
      artifacts: [
        { name: "models/marts/revenue_by_channel.sql", kind: "code", language: "sql", content: UNKNOWN_SQL },
        { name: "logs/slack-and-release-note.log", kind: "log", language: "text", content: UNKNOWN_LOG },
      ],
      sql: { setupSql: UNKNOWN_SETUP, tables: ["stg_orders", "dim_campaign"] },
    },
  },

  /* 3 — standard, FREE */
  {
    id: "inc-ae-report-doubled",
    category: "incident",
    level: "mid",
    title: "Customer report shows twice as many orders",
    company: "Marketplace",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: the customer-orders report shows 12 orders but the orders table only has 8 rows, and lifetime-value is exactly 2x for some customers and correct for others. It started after a new address feed loaded. Investigate the model and the data, then submit the root cause and the fix.",
    hints: [
      "Exactly-2x for SOME customers screams a one-to-many join fan-out. Count rows per customer in `stg_addresses`.",
      "Read the note: stg_addresses now stores billing AND shipping rows per customer. Is `customer_id` still unique there?",
      "Think about how to make the address grain one-row-per-customer before the join (pick one address_type, or dedup).",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies the join fan-out: stg_addresses now has multiple rows per customer (billing + shipping)",
      "Confirms with a query that exactly the multi-address customers are doubled",
      "Explains why some customers are correct (single address) and others 2x",
      "Fix: dedup/pick one address per customer (e.g. filter address_type, or pre-aggregate) so the join key is unique; add a uniqueness test",
    ],
    incident: {
      brief:
        "customer_orders shows 12 orders vs 8 in stg_orders; LTV is 2x for some customers. stg_addresses gained billing+shipping rows per customer last sprint. Find the fan-out and fix it.",
      severity: "SEV-3 · CRM-reporting",
      tier: "standard",
      artifacts: [
        { name: "models/marts/customer_orders.sql", kind: "code", language: "sql", content: DOUBLED_SQL },
        { name: "logs/crm-ticket.log", kind: "log", language: "text", content: DOUBLED_LOG },
      ],
      sql: { setupSql: DOUBLED_SETUP, tables: ["stg_orders", "stg_addresses"] },
    },
  },

  /* 4 — hard */
  {
    id: "inc-ae-incremental-late-updates",
    category: "incident",
    level: "senior",
    title: "Incremental mart never sees refunds",
    company: "FAANG · streaming",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: refunds and cancellations never propagate to `fct_orders`. An order placed Tuesday and refunded Thursday still shows status='completed' in the mart, though the source clearly shows 'refunded'. A full-refresh fixes it; the next incremental run diverges again. Investigate the model and the data, then submit the root cause and the fix.",
    hints: [
      "Look at the incremental WHERE clause: it filters on `created_at > MAX(created_at)`. created_at is set once at insert; what column changes when a row is UPDATED?",
      "Query the source for rows whose `updated_at` advanced but whose `created_at` is older than the mart's MAX(created_at). The watermark skips exactly those.",
      "`unique_key='order_id'` would upsert IF the row were selected — but the WHERE clause never selects updated old rows. Think about watermarking on updated_at and a lookback.",
    ],
    idealAnswer: "",
    rubric: [
      "Root cause: incremental watermark filters on created_at only, so mutated (updated) old rows are never re-selected",
      "Explains that unique_key upsert can't help because the changed rows are filtered out before the merge",
      "Confirms with a query that refunded orders have created_at <= mart MAX(created_at) but newer updated_at",
      "Explains why full-refresh masks it and incremental re-diverges",
      "Fix: watermark on updated_at (>= max(updated_at)) with a lookback window; keep unique_key for the upsert",
    ],
    incident: {
      brief:
        "fct_orders is incremental with unique_key='order_id' and WHERE created_at > MAX(created_at). Mutable orders (status flips, amount changes) update updated_at but not created_at, so refunds/cancels are never picked up. Find the root cause and the correct incremental strategy.",
      severity: "SEV-2 · finance-facing",
      tier: "hard",
      artifacts: [
        { name: "models/marts/fct_orders.sql", kind: "code", language: "sql", content: INCR_SQL },
        { name: "logs/finance-ticket.log", kind: "log", language: "text", content: INCR_LOG },
      ],
      sql: { setupSql: INCR_SETUP, tables: ["stg_orders", "fct_orders"] },
    },
  },

  /* 4b — hard (Snowflake pruning) */
  {
    id: "inc-ae-snowflake-cast-pruning",
    category: "incident",
    level: "senior",
    title: "Dashboard query scans the whole table despite a date filter",
    company: "FAANG · social",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: a hot Snowflake dashboard query 'filters to one day' but the query profile shows 100% of partitions scanned (3.9 TB, 7m41s on an XL) — no pruning. A sibling range query scans 41 partitions in 0.6s. The table is clustered on event_ts. Investigate the query and profile, then submit the root cause and the fix.",
    hints: [
      "The table is clustered on event_ts and Snowflake stores per-partition min/max of event_ts. Look at how the WHERE clause references event_ts.",
      "Wrapping a clustered column in a function (TO_DATE(event_ts)) makes the result unavailable to the optimizer at compile time, so it can't prune by the raw-column metadata.",
      "Rewrite to a sargable range on the raw column: event_ts >= '2026-05-31' AND event_ts < '2026-06-01'. Verify it returns the same rows in the console.",
    ],
    idealAnswer: "",
    rubric: [
      "Root cause: TO_DATE(event_ts) wraps the clustered column in a function, defeating micro-partition pruning",
      "Explains that Snowflake prunes on raw-column min/max metadata, which a function output is not comparable to at compile time",
      "Confirms the rewritten sargable range returns the same rows as the cast predicate",
      "Fix: sargable half-open range on the raw event_ts (>= start AND < next day); avoid functions on the filtered column",
    ],
    incident: {
      brief:
        "Snowflake query WHERE TO_DATE(event_ts) = '2026-05-31' scans all 48,212 partitions (3.9 TB). events is clustered on event_ts. A range predicate scans 41 partitions in 0.6s. Find why pruning is defeated and rewrite the predicate.",
      severity: "SEV-2 · cost+latency",
      tier: "hard",
      artifacts: [
        { name: "queries/hot_dashboard.sql", kind: "query", language: "sql", content: PRUNE_SQL },
        { name: "logs/snowflake-query-profile.log", kind: "log", language: "text", content: PRUNE_PROFILE },
      ],
      sql: { setupSql: PRUNE_SETUP, tables: ["events"] },
    },
  },

  /* 7 — hard (cost / cross join) */
  {
    id: "inc-ae-snowflake-cross-join-cost",
    category: "incident",
    level: "senior",
    title: "Warehouse credits 9x'd overnight from one model",
    company: "FAANG · streaming",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2 (cost): analytics-warehouse credits jumped 9x overnight; the `daily_user_spend` model went from 40s to 38 minutes and spilled to remote storage. The result is still 'correct' but projects +$48k/mo. No data-volume change explains 9x. Investigate the model and the data, then submit the root cause and the fix.",
    hints: [
      "Read the joins carefully. How many ON clauses are there, and which joined table has none?",
      "A JOIN with no ON clause is a cross join — every left row pairs with every right row BEFORE later predicates constrain it. Look at dim_calendar.",
      "The final GROUP BY collapses rows so the result looks right, but the cost is in the exploded intermediate cardinality. Add the missing join condition.",
    ],
    idealAnswer: "",
    rubric: [
      "Root cause: the dim_calendar JOIN has no ON clause -> accidental cross join (Cartesian product) blowing up intermediate cardinality",
      "Explains why the result is still correct (GROUP BY collapses) but the cost lives in the exploded intermediate / spill",
      "Confirms with a query that intermediate rows scale as users * calendar * matches",
      "Fix: add the missing join condition (calendar should constrain via fct_spend.spend_date, or join calendar to fct_spend, not cross); guard with a row-count/explosion test",
    ],
    incident: {
      brief:
        "daily_user_spend cross-joins dim_calendar (no ON clause) before fct_spend constrains it, exploding intermediate cardinality (~3.6e11 rows) and spilling to disk; credits 9x'd. Result is still correct after GROUP BY. Find and fix the join.",
      severity: "SEV-2 · cost",
      tier: "hard",
      artifacts: [
        { name: "models/marts/daily_user_spend.sql", kind: "code", language: "sql", content: COST_SQL },
        { name: "logs/finance-ops-and-query-history.log", kind: "log", language: "text", content: COST_LOG },
      ],
      sql: { setupSql: COST_SETUP, tables: ["dim_users", "dim_calendar", "fct_spend"] },
    },
  },

  /* 8 — hellish (A/B SRM) */
  {
    id: "inc-ae-ab-srm",
    category: "incident",
    level: "senior",
    title: "A/B winner is significant — but the split is broken",
    company: "FAANG · social",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: an experiment review says treatment lifts conversion +6% at p<0.001 and the team wants to ship. But treatment has 53.4% of users on a configured 50/50 split — a chi-square SRM at p=4e-7. Before trusting the lift, find why the arms are imbalanced. Investigate the assignment code, the analysis query, and the data, then submit the root cause and the fix.",
    hints: [
      "SRM means the result is untrustworthy regardless of the p-value — don't reason about the lift until the split is explained. Start by querying for users that appear in BOTH arms of the exposure log.",
      "Read assignment.js: the bucketing key falls back from userId to sessionId when the auth cookie is missing. What happens to a user who logs in mid-session?",
      "The analysis joins conversions on user_id only (no variant). Trace how a both-arms user's conversion attaches to multiple arms — that both inflates one arm's count and contaminates conversion.",
    ],
    idealAnswer: "",
    rubric: [
      "Treats SRM as a blocker: refuses to trust the lift/p-value until the imbalance is explained",
      "Root cause: bucketing key falls back userId -> sessionId; users who log in mid-session get bucketed under two keys and land in BOTH arms",
      "Confirms with a query that specific users appear in both 'control' and 'treatment' exposures (and their conversions are double-attached)",
      "Identifies the secondary contamination: conversion join on user_id only, no variant key",
      "Fix: one stable identity per user for bucketing (resolve identity before assignment), enforce one-arm-per-user, dedup both-arms users; re-run SRM check before reading results",
      "Does NOT chase the red herrings (it's not the +6% being 'real', not just a stats-power issue)",
    ],
    incident: {
      brief:
        "Experiment shows treatment +6% conversion, p<0.001, but treatment = 53.4% of users on a 50/50 design (SRM p=4e-7). assignment.js falls back from userId to sessionId, so mid-session logins land in both arms; the conversion join is on user_id only. Diagnose the SRM and the fix before any launch decision.",
      severity: "SEV-1 · launch-decision",
      tier: "hellish",
      artifacts: [
        { name: "experiment/assignment.js", kind: "code", language: "text", content: SRM_ASSIGN },
        { name: "analysis/experiment_results.sql", kind: "query", language: "sql", content: SRM_ANALYSIS },
        { name: "logs/experiment-review.log", kind: "log", language: "text", content: SRM_LOG },
      ],
      sql: { setupSql: SRM_SETUP, tables: ["exposures", "conversions"] },
      python: true,
    },
  },

  /* 9 — hellish (revenue recon; timezone red herring) */
  {
    id: "inc-ae-revenue-recon-late-partition",
    category: "incident",
    level: "senior",
    title: "Revenue recon is 18% short — and it's not the timezone",
    company: "Marketplace",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: daily_revenue for 2026-05-30 reconciles ~38% short vs the payments ledger ($330 vs $530); earlier days reconcile fine. The team's working theory is a PT/UTC timezone day-boundary issue. Investigate the model and the data — confirm or kill the timezone theory — then submit the real root cause and the fix.",
    hints: [
      "Test the timezone theory FIRST and explicitly: order_date is already a clean PT date and the ledger groups by the same PT date. Does shifting +/- a day close the gap? If not, drop it.",
      "Look at the join type. An INNER join to fct_payments drops any order with no matching payment row. Query for orders on 2026-05-30 that have NO row in fct_payments.",
      "Connect it to the note about the payments partition landing late: the loader for the last hours of the day hadn't finished when the model ran, so paid orders had no payment row yet and were dropped.",
    ],
    idealAnswer: "",
    rubric: [
      "Explicitly tests and REJECTS the timezone red herring (order_date already PT; shifting days doesn't close the gap)",
      "Root cause: INNER join to fct_payments drops orders whose payment row hadn't landed (late/partial payments partition)",
      "Confirms with a query that the missing revenue = the 2026-05-30 orders with no fct_payments row",
      "Explains why earlier days reconcile (their payment partitions were complete) and why it's intermittent",
      "Fix: LEFT JOIN (or revenue from orders, payments only for status) + a freshness/completeness gate on the payments partition before running; backfill once the partition lands",
      "Gets triage right: confirm/kill the timezone theory before chasing it; mitigate by holding the recon alert",
    ],
    incident: {
      brief:
        "daily_revenue (INNER join orders->payments) is ~38% short for 2026-05-30 vs ledger ($330 vs $530). Team blames PT/UTC timezone. Real cause: the payments partition landed late, so paid orders with no payment row yet are silently dropped by the inner join. Confirm/kill the timezone theory and fix.",
      severity: "SEV-1 · finance-facing",
      tier: "hellish",
      artifacts: [
        { name: "models/marts/daily_revenue.sql", kind: "code", language: "sql", content: RECON_SQL },
        { name: "logs/recon-escalation.log", kind: "log", language: "text", content: RECON_LOG },
      ],
      sql: { setupSql: RECON_SETUP, tables: ["fct_orders", "fct_payments"] },
    },
  },
];
