import type { ConvItem } from "./types";

/**
 * Incident Debugging — DBA / database role. Production "find the root cause"
 * scenarios that are SQL-investigable: the candidate reads a read-only plan /
 * pg_stat / deadlock-log artifact, then confirms the row-level anomaly (dupes,
 * skew, nulls, counts) in the in-browser DuckDB console. DuckDB has no real
 * planner/locks, so the symptom is modeled via DATA + the plan/log artifact.
 * The diagnosed root cause / fix / red herrings / rubric live server-side in
 * incident-dba.server.ts (resolved by problemId) and never ship to the client.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1) Dashboard query times out after data growth — index NOT USED (cast on col)
// ─────────────────────────────────────────────────────────────────────────────
const SARG_QUERY = `-- dashboard/orders_today.sql  (the query that now times out)
-- "orders placed today" for the ops dashboard. created_at is timestamptz,
-- and there IS a btree index: CREATE INDEX idx_orders_created ON orders(created_at);
SELECT order_id, customer_id, amount
FROM orders
WHERE created_at::date = CURRENT_DATE   -- <-- cast applied to the indexed column
ORDER BY created_at DESC;
`;

const SARG_PLAN = `-- EXPLAIN (ANALYZE, BUFFERS) of the dashboard query on prod (read-only capture)
Sort  (cost=482931.10..483102.55 rows=68580 width=24)
       (actual time=8421.7..8460.3 rows=71204 loops=1)
  Sort Key: created_at DESC
  Sort Method: external merge  Disk: 4112kB
  ->  Seq Scan on orders  (cost=0.00..471299.00 rows=68580 width=24)
                          (actual time=0.04..8123.9 rows=71204 loops=1)
        Filter: ((created_at)::date = CURRENT_DATE)
        Rows Removed by Filter: 13705900
Planning Time: 0.21 ms
Execution Time: 8473.9 ms

-- NOTE: idx_orders_created EXISTS and is valid, but the planner chose a Seq Scan
-- over all ~13.7M rows. Six months ago (260k rows) this same query ran in ~40ms.
`;

const SARG_SETUP = `CREATE TABLE orders (
  order_id    INTEGER,
  customer_id INTEGER,
  amount      DECIMAL(10,2),
  created_at  TIMESTAMP
);
INSERT INTO orders VALUES
  -- "today" = 2026-06-02 : 5 rows the dashboard should return
  (1, 501, 19.99,  TIMESTAMP '2026-06-02 08:14:02'),
  (2, 502, 49.00,  TIMESTAMP '2026-06-02 09:41:55'),
  (3, 503, 9.99,   TIMESTAMP '2026-06-02 11:02:10'),
  (4, 504, 120.00, TIMESTAMP '2026-06-02 13:30:00'),
  (5, 505, 15.50,  TIMESTAMP '2026-06-02 18:59:59'),
  -- yesterday + older : the index would skip these on a range scan, but the
  -- ::date cast forces a full scan that touches every row
  (6,  506, 25.00,  TIMESTAMP '2026-06-01 23:59:59'),
  (7,  507, 80.00,  TIMESTAMP '2026-06-01 12:00:00'),
  (8,  508, 12.00,  TIMESTAMP '2026-05-31 06:00:00'),
  (9,  509, 200.00, TIMESTAMP '2026-05-15 06:00:00'),
  (10, 510, 5.00,   TIMESTAMP '2026-04-02 06:00:00'),
  (11, 511, 60.00,  TIMESTAMP '2026-01-02 06:00:00'),
  (12, 512, 70.00,  TIMESTAMP '2025-12-31 23:00:00');
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2) Deadlocks spiking — inconsistent lock ordering + long transaction
// ─────────────────────────────────────────────────────────────────────────────
const DEADLOCK_CODE = `# wallet/transfer.py — money transfer between two accounts (one tx, two UPDATEs)
def transfer(conn, from_id, to_id, cents):
    with conn.transaction():                       # one DB transaction
        # debit source, then credit destination — in the order the CALLER passed them
        conn.execute(
            "UPDATE accounts SET balance = balance - %s WHERE account_id = %s",
            (cents, from_id),                       # locks row(from_id) first
        )
        send_audit_email(from_id, to_id, cents)     # <-- network call INSIDE the tx
        conn.execute(
            "UPDATE accounts SET balance = balance + %s WHERE account_id = %s",
            (cents, to_id),                         # then locks row(to_id)
        )
`;

const DEADLOCK_LOG = `-- postgresql.log (log_lock_waits=on)  — deadlock storm during the promo
2026-06-02 14:02:11 UTC ERROR:  deadlock detected
2026-06-02 14:02:11 UTC DETAIL:  Process 22841 waits for ShareLock on transaction 99120;
        blocked by process 22907.
        Process 22907 waits for ShareLock on transaction 99118;
        blocked by process 22841.
        Process 22841: UPDATE accounts SET balance = balance + $1 WHERE account_id = 42
        Process 22907: UPDATE accounts SET balance = balance + $1 WHERE account_id = 17
2026-06-02 14:02:11 UTC HINT:  See server log for query details.
2026-06-02 14:02:11 UTC CONTEXT:  while updating tuple (0,3) in relation "accounts"
2026-06-02 14:02:11 UTC LOG:  process 22907 still waiting for ShareLock on transaction
        99118 after 1002.371 ms
-- transfer(from=17,to=42) and transfer(from=42,to=17) ran concurrently.
-- avg transaction duration jumped from 4ms to 380ms this week (see app deploy notes).
`;

const DEADLOCK_SETUP = `CREATE TABLE accounts (
  account_id INTEGER,
  owner      VARCHAR,
  balance    DECIMAL(12,2)
);
INSERT INTO accounts VALUES
  (17, 'alice', 100.00),
  (42, 'bob',   100.00),
  (58, 'carol', 250.00),
  (61, 'dave',  0.00);

-- transfer log: note the SAME pair of accounts moved money BOTH directions
-- concurrently (17->42 and 42->17), i.e. opposite lock-acquisition order.
CREATE TABLE transfer_log (
  ts        TIMESTAMP,
  from_id   INTEGER,
  to_id     INTEGER,
  cents     INTEGER,
  outcome   VARCHAR
);
INSERT INTO transfer_log VALUES
  (TIMESTAMP '2026-06-02 14:02:11', 17, 42, 500, 'deadlock_victim'),
  (TIMESTAMP '2026-06-02 14:02:11', 42, 17, 700, 'committed'),
  (TIMESTAMP '2026-06-02 14:02:12', 17, 42, 300, 'deadlock_victim'),
  (TIMESTAMP '2026-06-02 14:02:12', 42, 17, 250, 'committed'),
  (TIMESTAMP '2026-06-02 14:02:13', 58, 61, 100, 'committed'),
  (TIMESTAMP '2026-06-02 14:02:14', 17, 42, 150, 'deadlock_victim'),
  (TIMESTAMP '2026-06-02 14:02:14', 42, 17, 900, 'committed'),
  (TIMESTAMP '2026-06-02 14:02:15', 61, 58, 50,  'committed');
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3) "too many connections" — N+1 / leaked connections, missing pool release
// ─────────────────────────────────────────────────────────────────────────────
const CONN_CODE = `# api/orders.py — list orders + each order's line items (the /orders endpoint)
def list_orders(user_id):
    conn = pool.getconn()                       # grab a pooled connection
    orders = conn.execute(
        "SELECT order_id FROM orders WHERE user_id = %s", (user_id,)
    ).fetchall()

    items = []
    for (order_id,) in orders:                  # N orders ...
        c = pool.getconn()                      # <-- a NEW connection PER order
        rows = c.execute(
            "SELECT sku, qty FROM order_items WHERE order_id = %s", (order_id,)
        ).fetchall()
        items.append(rows)
        # note: 'c' is never returned to the pool

    pool.putconn(conn)                          # only the first conn is released
    return orders, items
`;

const CONN_LOG = `-- pg_stat_activity snapshot during the outage (read-only)
 state                | count
----------------------+-------
 idle                 |    96     <-- pooled conns checked out, never returned
 active               |     3
 idle in transaction  |     1
(max_connections = 100)

-- app log
[14:31:02] WARN  pool exhausted, waited 5001ms for a connection
[14:31:07] ERROR psycopg.OperationalError: FATAL: sorry, too many clients already
[14:31:07] NOTE  errors began ~10 min after the new /orders endpoint deployed.
                 connection count climbs monotonically and never drops.
`;

const CONN_SETUP = `CREATE TABLE orders (
  order_id INTEGER,
  user_id  INTEGER
);
INSERT INTO orders VALUES
  (1001, 7), (1002, 7), (1003, 7), (1004, 7), (1005, 7),
  (1006, 7), (1007, 7), (1008, 7), (1009, 7), (1010, 7),
  (1011, 7), (1012, 7);   -- one popular user has 12 orders -> 12 leaked conns/request

CREATE TABLE order_items (
  order_id INTEGER,
  sku      VARCHAR,
  qty      INTEGER
);
INSERT INTO order_items VALUES
  (1001, 'A', 1), (1001, 'B', 2),
  (1002, 'C', 1),
  (1003, 'A', 3),
  (1004, 'D', 1), (1004, 'E', 1),
  (1005, 'B', 5);
`;

// ─────────────────────────────────────────────────────────────────────────────
// 4) Stale reads after writes — read-replica lag (reading own write from replica)
// ─────────────────────────────────────────────────────────────────────────────
const REPLICA_CODE = `# profile/update.py — save profile, then re-read to render the page
def save_and_render(user_id, new_name):
    primary.execute(
        "UPDATE profiles SET display_name = %s, updated_at = now() WHERE user_id = %s",
        (new_name, user_id),
    )                                            # write goes to the PRIMARY
    # all reads are routed to the read replica for scale
    row = replica.execute(
        "SELECT display_name, updated_at FROM profiles WHERE user_id = %s", (user_id,)
    ).fetchone()                                 # <-- reads OWN write from the REPLICA
    return render(row)                           # user sees their OLD name
`;

const REPLICA_LOG = `-- replica lag dashboard (read-only)
-- SELECT now() - pg_last_xact_replay_timestamp() AS lag;   (run on the replica)
time      lag
14:00:00  0.4s
14:05:00  0.6s
14:10:00  6.2s     <-- nightly batch reindex on primary started
14:11:00  18.9s
14:12:00  31.4s
14:13:00  44.7s

[14:11:30] support  "I changed my name and saved, but the page still shows the old one.
                     If I refresh a few times it eventually updates."
[14:11:45] note     no errors, no code change today; writes succeed, reads look stale.
`;

const REPLICA_SETUP = `-- Two snapshots of the same row: what the PRIMARY has vs what the REPLICA served.
CREATE TABLE profiles_primary (
  user_id      INTEGER,
  display_name VARCHAR,
  updated_at   TIMESTAMP
);
INSERT INTO profiles_primary VALUES
  (1, 'Alex Rivera',     TIMESTAMP '2026-06-02 14:11:28'),   -- just-saved value
  (2, 'Jordan Lee',      TIMESTAMP '2026-06-01 09:00:00'),
  (3, 'Sam Park',        TIMESTAMP '2026-06-02 13:55:00');

CREATE TABLE profiles_replica (
  user_id      INTEGER,
  display_name VARCHAR,
  updated_at   TIMESTAMP
);
INSERT INTO profiles_replica VALUES
  (1, 'Alex R.',         TIMESTAMP '2026-06-02 14:10:55'),   -- STALE: pre-update name
  (2, 'Jordan Lee',      TIMESTAMP '2026-06-01 09:00:00'),
  (3, 'Sam Park',        TIMESTAMP '2026-06-02 13:55:00');
`;

// ─────────────────────────────────────────────────────────────────────────────
// 5) A fast query went slow with no code change — stale planner stats (ANALYZE)
// ─────────────────────────────────────────────────────────────────────────────
const STATS_PLAN = `-- EXPLAIN ANALYZE of the "active sessions for a tenant" query (read-only)
-- SELECT * FROM sessions s JOIN events e ON e.session_id = s.session_id
--   WHERE s.tenant_id = 88 AND s.is_active;
Nested Loop  (cost=0.42..51.10 rows=1 width=...)        -- planner thinks ~1 session
             (actual time=0.03..9120.4 rows=240000 loops=1)
  ->  Index Scan using idx_sessions_tenant on sessions s
        (estimate rows=1)  (actual rows=4000 loops=1)
  ->  Index Scan using idx_events_session on events e
        (estimate rows=1)  (actual rows=60 loops=4000)
Planning Time: 0.3 ms
Execution Time: 9143.7 ms

-- pg_stat_user_tables (read-only)
relname  | n_live_tup | n_mod_since_analyze | last_analyze        | last_autoanalyze
---------+------------+---------------------+---------------------+------------------
sessions |      4000  |             3990    | 2026-05-19 02:00:00 | (null)
-- A bulk import 2 weeks ago loaded 3,990 active sessions for tenant 88.
-- No code or schema change. Same query was <20ms before the import.
`;

const STATS_SETUP = `CREATE TABLE sessions (
  session_id INTEGER,
  tenant_id  INTEGER,
  is_active  BOOLEAN
);
-- The planner's stored stats still think tenant 88 has ~1 active session,
-- but the bulk import made it the largest tenant. Confirm the real skew:
INSERT INTO sessions VALUES
  (1, 88, true), (2, 88, true), (3, 88, true), (4, 88, true), (5, 88, true),
  (6, 88, true), (7, 88, true), (8, 88, true), (9, 88, true), (10, 88, true),
  (11, 12, true), (12, 12, false), (13, 31, true), (14, 31, true),
  (15, 7, false), (16, 7, true), (17, 99, true), (18, 99, false);

CREATE TABLE events (
  event_id   INTEGER,
  session_id INTEGER
);
INSERT INTO events VALUES
  (1, 1), (2, 1), (3, 1), (4, 2), (5, 2), (6, 3),
  (7, 4), (8, 5), (9, 6), (10, 7), (11, 8), (12, 9),
  (13, 11), (14, 13), (15, 16), (16, 17);
`;

// ─────────────────────────────────────────────────────────────────────────────
// 6) Hot partition / hot row — monotonic key / one popular row causing contention
// ─────────────────────────────────────────────────────────────────────────────
const HOTROW_CODE = `# inventory/reserve.py — flash-sale stock decrement
def reserve(conn, product_id, qty):
    with conn.transaction():
        # every buyer of the SAME hot product updates the SAME counter row
        conn.execute(
            "UPDATE inventory SET reserved = reserved + %s WHERE product_id = %s",
            (qty, product_id),                  # row(product_id) is the contention point
        )
        # also append to an event table keyed by a monotonic sequence
        conn.execute(
            "INSERT INTO reserve_events (event_id, product_id, qty) VALUES (nextval('seq'), %s, %s)",
            (product_id, qty),                  # all inserts hit the same right-most index page
        )
`;

const HOTROW_LOG = `-- pg_stat_activity / wait events during the drop (read-only)
 product_id |  waiting_backends | wait_event_type | wait_event
------------+-------------------+-----------------+------------
        900 |               312 | Lock            | tuple        <-- one product
         12 |                 1 | (null)          | (null)
         45 |                 0 | (null)          | (null)

-- p99 latency on /reserve went 30ms -> 2400ms at sale start; CPU < 40%, disk idle.
-- Lock waits are ~all on a single tuple in "inventory". 99% of orders are product 900.
-- The reserve_events insert also shows heavy buffer contention on the right-most
-- index page (monotonic event_id from the shared sequence).
`;

const HOTROW_SETUP = `CREATE TABLE inventory (
  product_id INTEGER,
  name       VARCHAR,
  reserved   INTEGER,
  stock      INTEGER
);
INSERT INTO inventory VALUES
  (900, 'Limited Sneaker', 9870, 10000),   -- THE hot row: nearly all updates land here
  (12,  'Plain Socks',     3,    5000),
  (45,  'Shoe Laces',      0,    9999);

CREATE TABLE reserve_events (
  event_id   INTEGER,   -- monotonic from a single sequence -> right-most page hotspot
  product_id INTEGER,
  qty        INTEGER
);
INSERT INTO reserve_events VALUES
  (1, 900, 1), (2, 900, 2), (3, 900, 1), (4, 900, 1), (5, 900, 3),
  (6, 900, 1), (7, 900, 2), (8, 900, 1), (9, 12, 1),  (10, 900, 1),
  (11, 900, 1), (12, 900, 2), (13, 900, 1), (14, 900, 1), (15, 45, 1),
  (16, 900, 1);
`;

// ─────────────────────────────────────────────────────────────────────────────
// 7) HELLISH — month-end report slow + double-counted. The slowness (missing
//    index) is the RED HERRING hiding a join fan-out on a non-unique key.
// ─────────────────────────────────────────────────────────────────────────────
const REPORT_QUERY = `-- finance/month_end_revenue.sql  (the report finance escalated)
-- Everyone is focused on the 90s runtime. Read the JOIN carefully.
SELECT
  o.region,
  SUM(o.amount) AS revenue
FROM orders o
JOIN order_tags t           -- one order can carry MULTIPLE tags (promo, channel, ...)
  ON t.order_id = o.order_id
WHERE o.order_month = '2026-05'
GROUP BY o.region
ORDER BY revenue DESC;
`;

const REPORT_PLAN = `-- EXPLAIN ANALYZE (read-only). Yes, it's slow — but look at the row counts.
HashAggregate  (cost=... rows=4)  (actual time=89211 ms rows=4 loops=1)
  ->  Hash Join  (actual rows=2140000 loops=1)   <-- 2.14M JOINED rows ...
        Hash Cond: (t.order_id = o.order_id)
        ->  Seq Scan on order_tags t  (actual rows=2140000)
        ->  Hash  (actual rows=900000)            <-- ... from only 900k orders
              ->  Seq Scan on orders o
                  Filter: (order_month = '2026-05')   -- no index on order_month: SLOW
Execution Time: 89211 ms

-- Finance: "report takes 90s AND the regional revenue total is ~2.4x our books."
-- The runtime is the loud problem; the 2.4x is the one that actually matters.
`;

const REPORT_SETUP = `CREATE TABLE orders (
  order_id    INTEGER,
  region      VARCHAR,
  amount      DECIMAL(10,2),
  order_month VARCHAR
);
INSERT INTO orders VALUES
  (1, 'US', 100.00, '2026-05'),
  (2, 'US', 200.00, '2026-05'),
  (3, 'EU', 50.00,  '2026-05'),
  (4, 'EU', 80.00,  '2026-05'),
  (5, 'APAC', 40.00,'2026-05'),
  (6, 'US', 100.00, '2026-04');   -- different month: filtered out

-- order_tags: NON-UNIQUE order_id. Multiple tags per order -> the join fans out
-- and each order's amount is SUMmed once PER TAG (double/triple counting).
CREATE TABLE order_tags (
  order_id INTEGER,
  tag      VARCHAR
);
INSERT INTO order_tags VALUES
  (1, 'promo'), (1, 'mobile'), (1, 'gift'),   -- order 1 counted 3x
  (2, 'promo'), (2, 'web'),                    -- order 2 counted 2x
  (3, 'web'),                                  -- order 3 counted 1x (correct)
  (4, 'promo'), (4, 'mobile'),                 -- order 4 counted 2x
  (5, 'web'), (5, 'promo');                    -- order 5 counted 2x
`;

export const INCIDENT_DBA_ITEMS: ConvItem[] = [
  // 1 ───────────────────────────────────────────────────────────────────────
  {
    id: "inc-dba-dashboard-non-sargable",
    category: "incident",
    level: "mid",
    title: "Dashboard query times out after the table grew",
    company: "SaaS · Postgres",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the ops dashboard's 'orders placed today' panel now times out (~8.5s) and pages on call. There IS a btree index on orders(created_at), and nothing about the query changed — it just got slow as the table grew to ~13.7M rows. You have the query, the EXPLAIN plan, and the data. Why is the index being ignored, and how do you fix it?",
    hints: [
      "Read the EXPLAIN: it's a Seq Scan over all 13.7M rows even though idx_orders_created exists. What is the Filter line — is the predicate on the raw column or on a function of it?",
      "An index on created_at can serve a range (created_at >= X AND created_at < Y) but NOT created_at::date = ... — wrapping the indexed column in a cast/function makes the predicate non-sargable.",
      "Rewrite the predicate as a sargable half-open range on the raw column (or add an expression index on (created_at::date)). Confirm in the console which rows 'today' should return.",
    ],
    idealAnswer: "",
    rubric: [
      "Reads the plan and notices Seq Scan despite a valid index (investigates, doesn't guess at hardware/locks)",
      "Identifies the non-sargable predicate: created_at::date = CURRENT_DATE wraps the indexed column in a cast",
      "Explains why it only hurts now — full scan cost scales with table size; at 260k rows it was cheap, at 13.7M it isn't",
      "Fix: rewrite as a half-open range on the raw column (created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + 1) so the index is used",
      "Mentions the alternative/complement: an expression index on (created_at::date), and re-running EXPLAIN to confirm an Index Scan",
    ],
    incident: {
      brief:
        "'Orders placed today' panel times out at ~8.5s and pages on call. A valid btree index on orders(created_at) exists; the query is unchanged. EXPLAIN shows a Seq Scan over ~13.7M rows. Find why the index isn't used and fix it.",
      severity: "SEV-2 · internal dashboard",
      tier: "hard",
      artifacts: [
        { name: "dashboard/orders_today.sql", kind: "query", language: "sql", content: SARG_QUERY },
        { name: "plans/explain_analyze.txt", kind: "log", language: "text", content: SARG_PLAN },
      ],
      sql: { setupSql: SARG_SETUP, tables: ["orders"] },
    },
  },

  // 2 ───────────────────────────────────────────────────────────────────────
  {
    id: "inc-dba-deadlock-lock-ordering",
    category: "incident",
    level: "senior",
    title: "Deadlock storm on the wallet transfer endpoint",
    company: "Fintech",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: 'deadlock detected' errors are spiking on the money-transfer endpoint during a promo, failing ~1 in 6 transfers. You have the transfer code, the Postgres deadlock log, and the accounts + transfer log. Find the root cause of the deadlocks and the fix.",
    hints: [
      "Read the deadlock DETAIL: two processes each hold a lock the other wants. Look at which account_ids each process is updating — what order did they lock rows in?",
      "Query transfer_log: the same pair of accounts moved money in BOTH directions concurrently (17->42 and 42->17), so they grab row locks in opposite order — the classic inconsistent-lock-ordering deadlock.",
      "Two fixes that compound: lock rows in a deterministic order (e.g. always lowest account_id first), and shorten the transaction — the send_audit_email network call inside the tx holds locks far longer and widens the deadlock window. Add bounded retry-on-deadlock.",
    ],
    idealAnswer: "",
    rubric: [
      "Reads the deadlock log and identifies the cycle: P1 holds row 17 wants 42, P2 holds row 42 wants 17",
      "Root cause: inconsistent lock-acquisition order — transfers lock rows in caller order, so opposite-direction transfers deadlock",
      "Confirms via the data that the same account pair was transferred both directions concurrently",
      "Primary fix: acquire row locks in a deterministic global order (sort account ids; always lock the lower id first)",
      "Notes the contributing factor: the network call (send_audit_email) inside the transaction holds locks ~380ms, widening the window — move it outside the tx",
      "Adds resilience: catch deadlock-detected (SQLSTATE 40P01) and retry with bounded backoff",
    ],
    incident: {
      brief:
        "'deadlock detected' is failing ~1 in 6 transfers on the wallet endpoint during a promo. The transfer code runs two UPDATEs in one transaction. Read the deadlock log + transfer history, find the root cause and the fix.",
      severity: "SEV-1 · customer-facing payments",
      tier: "hard",
      artifacts: [
        { name: "wallet/transfer.py", kind: "code", language: "python", content: DEADLOCK_CODE },
        { name: "logs/postgresql.log", kind: "log", language: "text", content: DEADLOCK_LOG },
      ],
      sql: { setupSql: DEADLOCK_SETUP, tables: ["accounts", "transfer_log"] },
    },
  },

  // 3 ───────────────────────────────────────────────────────────────────────
  {
    id: "inc-dba-too-many-connections",
    category: "incident",
    level: "mid",
    title: "'too many clients already' after a new endpoint shipped",
    company: "SaaS · Postgres",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: ~10 minutes after the new /orders endpoint deployed, the app starts throwing 'FATAL: sorry, too many clients already' and connection count climbs to max_connections and never drops. You have the endpoint code and a pg_stat_activity snapshot. Find the leak and the fix.",
    hints: [
      "Read pg_stat_activity: 96 connections sitting 'idle' (checked out of the pool but doing nothing). What grabs a connection but never returns it?",
      "Walk list_orders: it calls pool.getconn() once per order inside the loop (N+1 connections) and never calls putconn() on them — only the first conn is released.",
      "Fix: don't open a connection per row. Reuse the single connection (or batch the line items with one WHERE order_id = ANY(...) query / a JOIN), and guarantee release with a context manager / try-finally. Cap the pool too.",
    ],
    idealAnswer: "",
    rubric: [
      "Reads the pg_stat_activity snapshot: many 'idle' connections that never drop = a leak, not just load",
      "Identifies the N+1 connection pattern: pool.getconn() inside the per-order loop",
      "Spots that those per-order connections are never returned with putconn() (only the first conn is released)",
      "Fix: reuse the one connection / batch the query (WHERE order_id = ANY(...) or a JOIN) instead of one conn per row, and release via try-finally / context manager",
      "Adds prevention: bound the pool, set idle_in_transaction_session_timeout, and ties the start time to the deploy",
    ],
    incident: {
      brief:
        "10 min after /orders deployed, the app throws 'too many clients already'; connections climb to max_connections (100) and never recover. pg_stat_activity shows 96 idle connections. Find the leak and fix it.",
      severity: "SEV-1 · customer-facing",
      tier: "standard",
      artifacts: [
        { name: "api/orders.py", kind: "code", language: "python", content: CONN_CODE },
        { name: "logs/pg_stat_activity.txt", kind: "log", language: "text", content: CONN_LOG },
      ],
      sql: { setupSql: CONN_SETUP, tables: ["orders", "order_items"] },
      python: true,
    },
  },

  // 4 ───────────────────────────────────────────────────────────────────────
  {
    id: "inc-dba-replica-stale-read",
    category: "incident",
    level: "senior",
    title: "Users see their old name right after saving it",
    company: "Global marketplace",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: users report that after saving a profile change the page still shows the OLD value, and it 'fixes itself' after a few refreshes. No errors, no code change today; writes succeed. You have the save/render code, a replica-lag dashboard, and primary-vs-replica snapshots of the row. Find the root cause and the fix.",
    hints: [
      "No errors and 'fixes itself on refresh' points at timing, not a failed write. Compare profiles_primary vs profiles_replica for user 1 — what differs?",
      "The code writes to the primary but reads back from the read replica. The lag dashboard shows lag spiked to ~45s when a batch reindex started — the replica hasn't applied the write yet (read-your-own-write violation).",
      "Fix: read-after-write should be read-your-writes consistent — route the immediate re-read to the primary (or pin a short session to the primary / use the write's LSN to wait for the replica to catch up). Separately, investigate why lag spiked (the batch job on the primary).",
    ],
    idealAnswer: "",
    rubric: [
      "Recognizes the symptom (stale, self-healing, no errors) as replication lag, not data loss",
      "Identifies the read-your-own-write violation: write to primary, immediate read from a lagging replica",
      "Uses the data: confirms profiles_primary has the new value while profiles_replica still has the old one for the same user",
      "Correlates the lag spike (~45s) with the batch reindex on the primary as the contributing factor",
      "Fix: route read-after-write to the primary (or wait-for-LSN / session pinning) so users read their own writes",
      "Distinguishes the immediate mitigation (read-your-writes) from the longer fix (reduce/throttle the batch job so replica keeps up)",
    ],
    incident: {
      brief:
        "After saving a profile, users see the OLD value; it corrects after a few refreshes. No errors, no code change, writes succeed. Replica lag spiked to ~45s during a batch reindex. Find the root cause and fix.",
      severity: "SEV-2 · customer-facing",
      tier: "hard",
      artifacts: [
        { name: "profile/update.py", kind: "code", language: "python", content: REPLICA_CODE },
        { name: "logs/replica_lag.txt", kind: "log", language: "text", content: REPLICA_LOG },
      ],
      sql: { setupSql: REPLICA_SETUP, tables: ["profiles_primary", "profiles_replica"] },
    },
  },

  // 5 ───────────────────────────────────────────────────────────────────────
  {
    id: "inc-dba-stale-stats-analyze",
    category: "incident",
    level: "mid",
    title: "A fast query went slow with no code change",
    company: "SaaS · Postgres",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: a query that was <20ms is now ~9s. Nobody changed the code or schema. Two weeks ago there was a bulk data import. You have the EXPLAIN ANALYZE and pg_stat_user_tables. Why did the plan get bad, and how do you fix it?",
    hints: [
      "Read the plan: compare the planner's estimated rows to the ACTUAL rows. 'estimate rows=1' but 'actual rows=4000' — the estimate is off by orders of magnitude, so the planner picked a Nested Loop that explodes.",
      "Check pg_stat_user_tables: last_analyze is from before the bulk import and n_mod_since_analyze is huge. The planner's stored statistics are stale, so it has no idea tenant 88 is now the biggest tenant.",
      "Fix: ANALYZE the table (refresh stats) so the planner estimates correctly and switches to a hash/merge join. Then make autovacuum/autoanalyze keep up (lower scale factor) so it doesn't recur after future bulk loads.",
    ],
    idealAnswer: "",
    rubric: [
      "Compares estimated vs actual rows in the plan and sees the huge mis-estimate (rows=1 vs 4000/240000)",
      "Root cause: stale planner statistics — last_analyze predates the bulk import, n_mod_since_analyze is large",
      "Explains the consequence: bad estimate -> Nested Loop chosen where a hash/merge join is correct, hence the slowdown",
      "Confirms the real data skew (tenant 88 is now large) in the console rather than guessing",
      "Fix: run ANALYZE (or VACUUM ANALYZE) to refresh stats; verify the plan flips with EXPLAIN",
      "Prevention: tune autovacuum/autoanalyze (scale factor) so stats stay fresh after bulk loads; consider ANALYZE as a post-import step",
    ],
    incident: {
      brief:
        "A <20ms query is now ~9s with no code or schema change. A bulk import landed 2 weeks ago. EXPLAIN shows estimate rows=1 but actual rows=4000, driving a Nested Loop. Find the root cause and fix.",
      severity: "SEV-2 · API latency",
      tier: "standard",
      artifacts: [
        { name: "plans/explain_analyze.txt", kind: "log", language: "text", content: STATS_PLAN },
      ],
      sql: { setupSql: STATS_SETUP, tables: ["sessions", "events"] },
    },
  },

  // 6 ───────────────────────────────────────────────────────────────────────
  {
    id: "inc-dba-hot-row-contention",
    category: "incident",
    level: "senior",
    title: "Flash sale: latency spikes but CPU is idle",
    company: "Global marketplace",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: at flash-sale start, /reserve p99 jumps from 30ms to 2.4s, yet CPU is under 40% and disk is idle — it's not a resource problem. You have the reserve code and a pg_stat_activity wait-events snapshot. Find the contention and the fix.",
    hints: [
      "CPU idle + latency spike + Lock waits = contention, not throughput. Read the wait-events snapshot: 312 backends all waiting on a 'tuple' lock for ONE product_id.",
      "Every buyer of the hot product (900) updates the SAME inventory counter row, so the row lock serializes them. The reserve_events insert also funnels a monotonic sequence into the right-most index page (a write hotspot).",
      "Fix the hot row: reduce time the row lock is held / shard the counter (N sub-counters summed) or use an atomic/optimistic decrement, and avoid the monotonic-key index hotspot (e.g. hash/UUID key or a smarter sequence). Confirm in the console that ~all reservations target product 900.",
    ],
    idealAnswer: "",
    rubric: [
      "Rules out resource exhaustion (CPU/disk idle) and reads the wait events as lock contention",
      "Identifies the hot row: all buyers of product 900 update the same inventory counter, serializing on one tuple lock",
      "Confirms in the data that ~all reservations target a single product (skew), not spread across products",
      "Spots the second hotspot: the monotonic event_id from a shared sequence concentrates inserts on the right-most index page",
      "Fix the hot row: shorten the lock window / shard the counter into N rows summed (or atomic/optimistic update)",
      "Fix the monotonic-key hotspot: hashed/UUID key or distributed sequence to spread index inserts",
    ],
    incident: {
      brief:
        "Flash-sale /reserve p99 spikes 30ms -> 2.4s while CPU <40% and disk idle. Wait-events show 312 backends blocked on a single tuple lock in 'inventory'. Find the contention and the fix.",
      severity: "SEV-1 · customer-facing",
      tier: "hard",
      artifacts: [
        { name: "inventory/reserve.py", kind: "code", language: "python", content: HOTROW_CODE },
        { name: "logs/wait_events.txt", kind: "log", language: "text", content: HOTROW_LOG },
      ],
      sql: { setupSql: HOTROW_SETUP, tables: ["inventory", "reserve_events"] },
    },
  },

  // 7 ───────────────────────────────────────────────────────────────────────  HELLISH
  {
    id: "inc-dba-monthend-double-count",
    category: "incident",
    level: "senior",
    title: "Month-end report is slow AND the numbers are wrong",
    company: "FAANG · retail",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: finance escalated the month-end regional revenue report. It takes ~90s to run AND the regional totals are ~2.4x what the books say. Everyone is heads-down on the runtime. You have the report SQL, its EXPLAIN plan, and the data. Find the REAL root cause and the fix — and don't let the slowness distract you from what finance actually cares about.",
    hints: [
      "There are two problems and they are NOT the same bug. The slow Seq Scan (no index on order_month) explains the 90s — but speeding it up will return the SAME wrong number. Which problem does finance actually care about?",
      "Look at the plan's row counts: the join produces 2.14M rows from only 900k orders. Read the JOIN target: order_tags has multiple tags per order and a NON-UNIQUE order_id, so the join fans out and each order's amount is SUMmed once per tag.",
      "Correctness fix: collapse order_tags to one row per order before joining (or aggregate orders first / SUM(DISTINCT) won't help here — dedup by order_id). Performance fix (separate): add an index on order_month. Confirm the inflation in the console: SUM over the join vs SUM over distinct orders.",
    ],
    idealAnswer: "",
    rubric: [
      "Separates the two problems: the 90s runtime is real but is the RED HERRING; the 2.4x over-count is the bug finance cares about",
      "Resists 'just add the index' — recognizes that fixing speed leaves the wrong number unchanged",
      "Root cause of the wrong number: join fan-out on a non-unique order_id in order_tags (multiple tags per order) multiplies each order's amount",
      "Confirms the inflation in the data: SUM(amount) over the joined rows vs SUM over distinct orders (per region)",
      "Correctness fix: aggregate/dedup order_tags to one row per order (or aggregate orders before joining; don't JOIN tags just to filter)",
      "Performance fix, kept separate: add an index on order_month (and re-run EXPLAIN) so the report is also fast",
    ],
    incident: {
      brief:
        "Month-end regional revenue report runs ~90s AND totals are ~2.4x the books. The team is focused on the runtime. The query JOINs orders to order_tags. Find the real root cause and fix — without being misled by the slowness.",
      severity: "SEV-1 · finance-facing",
      tier: "hellish",
      artifacts: [
        { name: "finance/month_end_revenue.sql", kind: "query", language: "sql", content: REPORT_QUERY },
        { name: "plans/explain_analyze.txt", kind: "log", language: "text", content: REPORT_PLAN },
      ],
      sql: { setupSql: REPORT_SETUP, tables: ["orders", "order_tags"] },
    },
  },
];
