import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the DBA / database Incident Debugging scenarios.
 * Diagnosed root cause / fix / contributing factors / red herrings / triage /
 * rubric / coach-revealable facts, keyed by problemId (matches incident-dba.ts).
 * Never ships to the client — resolved server-side by problemId in grade/chat.
 */
export const INCIDENT_DBA_SCENARIOS: Record<string, IncidentScenario> = {
  // 1 ───────────────────────────────────────────────────────────────────────
  "inc-dba-dashboard-non-sargable": {
    actualRootCause:
      "The WHERE predicate `created_at::date = CURRENT_DATE` wraps the indexed column in a cast, making it non-sargable. The btree index on orders(created_at) can serve a range on the raw column, but not an arbitrary function of it, so the planner falls back to a Seq Scan over all ~13.7M rows. It was fast at 260k rows because even a full scan was cheap; at 13.7M rows the scan dominates and the panel times out.",
    actualFix:
      "Rewrite the predicate as a sargable half-open range on the raw column: `created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'`, which lets the planner use idx_orders_created (Index/Range Scan). Alternatively (or additionally) create an expression index `CREATE INDEX ON orders ((created_at::date))` so the existing predicate becomes sargable. Re-run EXPLAIN to confirm an Index Scan and millisecond latency.",
    contributingFactors: [
      "Predicate applies a cast (::date) to the indexed column — classic non-sargable pattern",
      "Cost of a full Seq Scan scales with table size, so the regression appeared only after the table grew (~260k -> 13.7M rows)",
      "External-merge sort on disk added latency on top of the scan",
    ],
    triageOrder: [
      "Mitigate: the panel is internal — raise the statement timeout or cache last result so it stops paging while you fix",
      "Root-cause: read EXPLAIN, confirm Seq Scan + the ::date cast in the Filter line, confirm the index exists and is valid",
      "Fix: rewrite to a half-open range (or add expression index), re-run EXPLAIN to confirm Index Scan",
    ],
    rubric: [
      "Reads the plan and notices Seq Scan despite a valid index (investigates, doesn't blame hardware/locks)",
      "Identifies the non-sargable cast on the indexed column",
      "Explains why it regressed only at scale (full-scan cost grows with row count)",
      "Fix: sargable half-open range on the raw column",
      "Mentions expression index as the complement and re-running EXPLAIN to verify",
    ],
    facts: [
      { q: "Is the index actually valid / not bloated?", a: "Yes — idx_orders_created is valid and recently rebuilt. The planner simply can't use it for a casted predicate." },
      { q: "Did anyone change the query?", a: "No. The SQL is unchanged; only the table size grew (~260k -> ~13.7M rows over six months)." },
      { q: "Is the row estimate wrong?", a: "No — estimate (68,580) is close to actual (71,204). This is sargability, not a stats problem." },
    ],
  },

  // 2 ───────────────────────────────────────────────────────────────────────
  "inc-dba-deadlock-lock-ordering": {
    actualRootCause:
      "Inconsistent lock-acquisition order. `transfer(from, to)` locks the `from` row then the `to` row, in whatever order the caller passed. When two transfers between the SAME pair run concurrently in opposite directions (17->42 and 42->17), each grabs one row and waits for the other, forming a lock cycle that Postgres breaks by killing one as the deadlock victim. The window is widened because a network call (send_audit_email) runs INSIDE the transaction, so locks are held ~380ms instead of ~4ms.",
    actualFix:
      "Acquire row locks in a deterministic global order regardless of transfer direction — e.g. sort the two account_ids and always lock the lower id first (or `SELECT ... FOR UPDATE` both rows ordered by account_id before updating). Move send_audit_email OUTSIDE the transaction so locks are held only for the two fast UPDATEs. Add bounded retry-on-deadlock (catch SQLSTATE 40P01, retry with backoff).",
    contributingFactors: [
      "Row locks taken in caller-supplied order, so opposite-direction transfers conflict",
      "A network call (send_audit_email) inside the transaction holds locks ~380ms, widening the deadlock window",
      "Promo traffic raised concurrency on the same hot account pairs",
      "No deadlock-retry logic, so victims surface as user-facing failures",
    ],
    triageOrder: [
      "Mitigate: add bounded retry-on-deadlock so transient victims auto-recover instead of failing the user",
      "Root-cause: read the deadlock DETAIL (cycle on rows 17/42), confirm opposite-direction transfers in transfer_log",
      "Fix: deterministic lock ordering (lowest account_id first) + move the email outside the tx; deploy",
    ],
    rubric: [
      "Reads the deadlock log and identifies the two-process lock cycle on rows 17 and 42",
      "Root cause: inconsistent lock ordering across opposite-direction transfers",
      "Confirms via transfer_log that the same pair moved both directions concurrently",
      "Primary fix: deterministic lock order (sort by account_id, lock lower id first)",
      "Notes the in-transaction network call lengthening lock hold time as a contributing factor",
      "Adds bounded deadlock-retry (SQLSTATE 40P01) for resilience",
    ],
    facts: [
      { q: "How long are transactions holding locks?", a: "Avg tx duration jumped 4ms -> 380ms this week — a network email call was moved inside the transaction." },
      { q: "Is it always the same accounts?", a: "The deadlocks cluster on hot account pairs being transferred both directions concurrently (e.g. 17<->42)." },
      { q: "Is there retry logic?", a: "No — a deadlock victim immediately surfaces as a failed transfer to the user." },
    ],
  },

  // 3 ───────────────────────────────────────────────────────────────────────
  "inc-dba-too-many-connections": {
    actualRootCause:
      "Connection leak via an N+1 pattern. list_orders calls pool.getconn() once PER order inside the loop and never returns those connections (only the first, top-level conn is released with putconn). Each request to a user with many orders leaks one connection per order, so the pool / server connection count climbs monotonically until it hits max_connections and Postgres rejects new clients with 'too many clients already'.",
    actualFix:
      "Stop opening a connection per row. Reuse the single connection already held (or fetch all line items in ONE query, e.g. `WHERE order_id = ANY(%s)` or a JOIN), and guarantee release with a context manager / try-finally so connections return to the pool on every path including errors. Also bound the pool size, set idle_in_transaction_session_timeout, and consider a transaction-mode pooler (PgBouncer) in front of Postgres.",
    contributingFactors: [
      "pool.getconn() inside the per-order loop (N+1 connections)",
      "Per-order connections never returned with putconn() — no try-finally/context manager",
      "Users with many orders multiply the leak (one popular user = 12 leaked conns/request)",
      "No idle/idle-in-transaction timeout to reclaim stuck connections",
    ],
    triageOrder: [
      "Mitigate: roll back the new /orders endpoint (or restart app workers) to drop the leaked connections and restore capacity",
      "Root-cause: read pg_stat_activity (96 idle, never dropping) -> leak; trace to getconn() in the loop with no putconn()",
      "Fix: reuse/batch the query + guaranteed release; bound the pool + idle timeouts; redeploy",
    ],
    rubric: [
      "Reads pg_stat_activity: many idle connections that never drop = leak, not load",
      "Identifies the N+1 connection pattern (getconn per order)",
      "Spots that per-order connections are never released",
      "Fix: reuse one connection / batch query + try-finally release",
      "Prevention: bound pool, idle_in_transaction_session_timeout, ties onset to the deploy",
    ],
    facts: [
      { q: "When did errors start?", a: "~10 minutes after the new /orders endpoint deployed; connection count climbs and never recovers." },
      { q: "Are the queries themselves slow?", a: "No — they're fast. The problem is connections are checked out and never returned, sitting idle." },
      { q: "What is max_connections?", a: "100. About 96 are idle (leaked), 3 active, 1 idle-in-transaction at the time of the snapshot." },
    ],
  },

  // 4 ───────────────────────────────────────────────────────────────────────
  "inc-dba-replica-stale-read": {
    actualRootCause:
      "Read-your-own-write violation under replication lag. The save writes to the PRIMARY but the immediate re-read is routed to a read REPLICA. A batch reindex on the primary pushed replica lag to ~45s, so the replica hadn't applied the just-committed write yet and returned the OLD value. It 'self-heals' because once the replica catches up the new value appears — explaining the no-errors, fixes-on-refresh symptom.",
    actualFix:
      "Make read-after-write read-your-writes consistent: route the immediate re-read (and reads within a short window after a write) to the PRIMARY, or pin the session to the primary briefly, or capture the write's LSN and wait for the replica to replay past it before reading. Separately, reduce the lag source — throttle/reschedule the batch reindex or give the replica more apply throughput so lag stays low.",
    contributingFactors: [
      "Writes to primary, reads to a lagging replica (no read-your-writes guarantee)",
      "Batch reindex on the primary spiked replica lag to ~45s",
      "All reads blanket-routed to the replica for scale, including read-after-write",
    ],
    triageOrder: [
      "Mitigate: route read-after-write to the primary so users immediately see their own change",
      "Root-cause: compare primary vs replica snapshot for the user, correlate with the lag spike + batch job",
      "Prevent: throttle/reschedule the batch reindex; add a lag alert and a read-your-writes policy",
    ],
    rubric: [
      "Recognizes stale + self-healing + no errors as replication lag, not data loss",
      "Identifies the read-your-own-write violation (write primary, read lagging replica)",
      "Uses the data: primary has new value, replica still has old for the same user",
      "Correlates the lag spike with the batch reindex on the primary",
      "Fix: route read-after-write to primary (or wait-for-LSN / session pinning)",
      "Separates mitigation (read-your-writes) from the longer fix (reduce lag source)",
    ],
    facts: [
      { q: "Did the write actually succeed?", a: "Yes — profiles_primary shows the new value with a fresh updated_at. The write is fine." },
      { q: "Why does it fix itself on refresh?", a: "Once the replica replays the write (lag drains), later reads return the new value. Pure timing." },
      { q: "What changed at the time?", a: "No code deploy. A nightly batch reindex on the primary started and pushed replica lag from <1s to ~45s." },
    ],
  },

  // 5 ───────────────────────────────────────────────────────────────────────
  "inc-dba-stale-stats-analyze": {
    actualRootCause:
      "Stale planner statistics. A bulk import two weeks ago loaded ~3,990 active sessions for tenant 88, but autoanalyze never ran (last_analyze predates the import, n_mod_since_analyze is ~3,990). The planner still believes the predicate matches ~1 row, so it picks a Nested Loop join; at runtime it actually drives 4,000 outer rows x ~60 inner each = ~240k iterations, turning a sub-20ms query into ~9s. No code or schema changed — only the stats went stale.",
    actualFix:
      "Run ANALYZE (or VACUUM ANALYZE) on the affected table(s) to refresh statistics; the planner will then estimate correctly and switch to a hash/merge join, restoring fast execution (verify with EXPLAIN). Prevent recurrence by tuning autovacuum/autoanalyze (lower autovacuum_analyze_scale_factor for high-churn tables) and adding an explicit ANALYZE step at the end of bulk-import jobs.",
    contributingFactors: [
      "Bulk import skewed the data (tenant 88 became the largest) without refreshing stats",
      "Autoanalyze didn't fire — last_analyze predates the import",
      "Planner mis-estimate (rows=1 vs 4000) drove a Nested Loop instead of a hash/merge join",
    ],
    triageOrder: [
      "Mitigate/Fix: run ANALYZE on the table to refresh stats — usually resolves it immediately",
      "Root-cause: compare estimated vs actual rows in EXPLAIN; check pg_stat_user_tables last_analyze / n_mod_since_analyze",
      "Prevent: tune autoanalyze scale factor; ANALYZE as a post-bulk-load step",
    ],
    rubric: [
      "Compares estimated vs actual rows and sees the orders-of-magnitude mis-estimate",
      "Root cause: stale stats (last_analyze pre-dates the bulk import)",
      "Explains bad estimate -> Nested Loop -> slowdown",
      "Confirms the real skew in the console rather than guessing",
      "Fix: ANALYZE / VACUUM ANALYZE; verify plan flips",
      "Prevention: tune autovacuum/autoanalyze; ANALYZE after bulk loads",
    ],
    facts: [
      { q: "Was the query or schema changed?", a: "No. Same SQL, same indexes. Only the data and the (now stale) statistics differ." },
      { q: "When did autoanalyze last run?", a: "last_analyze predates the bulk import; n_mod_since_analyze is ~3,990 — autoanalyze hasn't caught up." },
      { q: "Will ANALYZE be enough?", a: "Yes for this case — once stats reflect the skew the planner picks a hash/merge join. Then tune autoanalyze so it doesn't recur." },
    ],
  },

  // 6 ───────────────────────────────────────────────────────────────────────
  "inc-dba-hot-row-contention": {
    actualRootCause:
      "Hot-row (and hot-page) write contention, not resource exhaustion. ~99% of reservations are for product 900, and every buyer issues `UPDATE inventory SET reserved = reserved + n WHERE product_id = 900`, all targeting the SAME tuple. Postgres serializes concurrent writers on that row lock, so 312 backends queue on one tuple lock and p99 explodes while CPU/disk sit idle. Secondary hotspot: reserve_events uses a single monotonic sequence, so all inserts pile onto the right-most btree index page (buffer contention).",
    actualFix:
      "Reduce contention on the hot row: shorten the lock window (keep the transaction tiny — no extra work between lock and commit), and/or shard the counter into N sub-rows that are summed (or use an atomic/optimistic decrement / a queue that batches decrements). For the monotonic-key hotspot, use a hashed/UUID key or a distributed/cached sequence so inserts spread across index pages instead of hammering the right-most one.",
    contributingFactors: [
      "Extreme key skew — ~99% of writes hit one product row",
      "Single shared counter row serializes all concurrent reservations on a tuple lock",
      "Monotonic event_id from one sequence concentrates inserts on the right-most index page",
      "Flash-sale concurrency amplifies both hotspots simultaneously",
    ],
    triageOrder: [
      "Mitigate: cap concurrency / queue reservations for the hot product so the row lock isn't stampeded",
      "Root-cause: read wait events (Lock/tuple on one product) + confirm skew to product 900 in the data; rule out CPU/disk",
      "Prevent: shard the counter (or atomic decrement) + de-monotonize the event key",
    ],
    rubric: [
      "Rules out resource exhaustion (CPU/disk idle) and reads wait events as lock contention",
      "Identifies the hot row: all buyers update the same inventory counter, serializing on one tuple lock",
      "Confirms single-product skew in the data",
      "Spots the monotonic-key right-most-page insert hotspot",
      "Fix the hot row: shard the counter / atomic-optimistic update / shorter lock window",
      "Fix the monotonic key: hashed/UUID/distributed sequence",
    ],
    redHerrings: [
      "It looks like the DB is under-provisioned, but CPU <40% and disk idle rule out a capacity problem — adding hardware won't help a serialized row lock",
    ],
    facts: [
      { q: "Is the box out of CPU or I/O?", a: "No — CPU is under 40% and disk is idle. This is contention, not capacity." },
      { q: "What are the backends waiting on?", a: "Lock / tuple waits, almost all on a single row in 'inventory' for product 900." },
      { q: "How skewed is demand?", a: "~99% of reservations are for product 900; the others are essentially idle." },
    ],
  },

  // 7 ─────────────────────────────────────────────────────────────────────── HELLISH
  "inc-dba-monthend-double-count": {
    actualRootCause:
      "Join fan-out on a non-unique key — a CORRECTNESS bug hidden behind a performance symptom. The report JOINs orders to order_tags on order_id, but order_tags has multiple tags per order and a NON-UNIQUE order_id, so each order row is multiplied by its tag count. SUM(o.amount) then counts each order once PER tag, inflating regional revenue ~2.4x. The 90s runtime (a Seq Scan because order_month is unindexed) is a SEPARATE, loud problem and the red herring: fixing it makes the report fast but still wrong.",
    actualFix:
      "Fix correctness first: don't fan out on tags. Either remove the join (it isn't needed for a revenue total), or collapse order_tags to one row per order before joining (e.g. JOIN to `(SELECT DISTINCT order_id FROM order_tags)` or pre-aggregate), or aggregate orders independently — so each order's amount is summed exactly once. Separately fix performance by adding an index on orders(order_month) (and re-run EXPLAIN). Confirm both with: SUM over distinct orders per region == the books, and an Index Scan in the plan.",
    contributingFactors: [
      "order_tags.order_id is non-unique (many tags per order) — many-to-one becomes many-to-many at the SUM",
      "The tags join isn't required for a revenue total at all (it only multiplies rows)",
      "No index on orders(order_month) -> Seq Scan -> the loud 90s runtime that captures everyone's attention",
      "The team anchored on latency and never reconciled the number against the books",
    ],
    redHerrings: [
      "The 90s runtime / missing index on order_month is the obvious target, but it's the RED HERRING — speeding the query up returns the SAME inflated total",
      "Time-zone / order_month string filtering looks suspicious but the month filter is correct; the inflation is row multiplication, not the WHERE",
      "DISTINCT or SUM(DISTINCT amount) seems tempting but is wrong (two orders can share an amount) — must dedup by order_id",
    ],
    triageOrder: [
      "Reframe: there are TWO problems; finance cares about the wrong NUMBER, so fix correctness first, not the speed",
      "Root-cause: read the plan's row counts (2.14M joined from 900k orders) -> fan-out; confirm non-unique order_id in order_tags",
      "Fix correctness (dedup/remove the tags join), verify total == books; THEN add the order_month index for speed",
    ],
    rubric: [
      "Separates the two problems and names the 90s runtime as the red herring, not the bug finance cares about",
      "Resists 'just add the index' — recognizes speed won't fix the wrong number",
      "Root cause of the wrong number: join fan-out on non-unique order_id (multiple tags/order)",
      "Confirms inflation in the data: SUM over join vs SUM over distinct orders per region",
      "Correctness fix: dedup tags to one row/order or drop the unneeded join",
      "Keeps the performance fix (order_month index) separate and verifies with EXPLAIN",
    ],
    facts: [
      { q: "Is the amount per order wrong?", a: "No — per-order amounts are correct. The total is inflated because each order is summed once per tag." },
      { q: "Is the month filter wrong?", a: "No — order_month = '2026-05' is correct and excludes other months. The inflation is row multiplication from the join." },
      { q: "If I add the index, is it fixed?", a: "It gets FAST but stays WRONG. The index addresses runtime, not the fan-out that doubles the number." },
      { q: "How many tags per order?", a: "Varies — some orders have 3 tags, some 2, some 1. The join multiplies each order's amount by its tag count." },
    ],
  },
};
