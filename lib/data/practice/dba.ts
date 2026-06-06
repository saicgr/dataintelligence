import type { ConvItem } from "./types";

/**
 * DBA interview practice questions.
 * Researched from PostgreSQL docs (postgresql.org), EnterpriseDB blog,
 * DBAMantra, Percona blog, PgBouncer docs, DataCamp DBA guide,
 * MentorCruise PostgreSQL questions, and Alibaba Cloud replication guide (2023-2026).
 * Topics: EXPLAIN/query plans, index design, partitioning, replication & failover,
 * locking & MVCC, backup/PITR, connection pooling, VACUUM/bloat, query tuning.
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const DBA_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────
  {
    id: "dba-explain-basics",
    category: "dba",
    executes: false,
    free: true,
    level: "junior",
    title: "Reading a basic EXPLAIN ANALYZE output",
    company: "B2B SaaS startup · Series A",
    difficulty: "easy",
    mode: "text",
    prompt:
      "You run the following query on a 2 million-row orders table and it is slow:\n\n" +
      "SELECT order_id, total FROM orders WHERE customer_id = 42;\n\n" +
      "EXPLAIN ANALYZE returns:\n\n" +
      "Seq Scan on orders  (cost=0.00..48321.00 rows=6 width=16)\n" +
      "                    (actual time=0.041..312.4 rows=6 loops=1)\n" +
      "  Filter: (customer_id = 42)\n" +
      "  Rows Removed by Filter: 1999994\n" +
      "Planning Time: 0.8 ms  Execution Time: 312.6 ms\n\n" +
      "Walk me through what this plan tells you, why it chose a sequential scan, and what you would do to fix it.",
    hints: [
      "Look at the ratio of rows estimated vs. rows actually returned, and at how many rows were removed by the filter — that tells you how selective the predicate is.",
      "cost=0.00..48321.00 is in planner cost units (sequential page fetches). Ask yourself: does a covering index make sense here, or just a plain B-tree on customer_id?",
      "Consider whether the planner might still choose a Seq Scan even after an index exists — what table statistic or planner setting could cause that?",
    ],
    starter: "",
    idealAnswer:
      "The plan shows a full sequential scan that reads all 2 million rows and discards 1,999,994 of them, keeping only 6. That is extremely wasteful for a 0.0003% selectivity predicate. The planner chose Seq Scan because no index exists on customer_id, so it has no other option. The fix is to create a B-tree index: CREATE INDEX idx_orders_customer_id ON orders(customer_id). After ANALYZE runs (or you run ANALYZE orders manually), the planner should switch to an Index Scan or Bitmap Index Scan that reads only the 6 matching pages rather than the entire table. If order_id and total are the only selected columns, a covering index CREATE INDEX idx_orders_customer_covering ON orders(customer_id) INCLUDE (order_id, total) lets the planner do an Index Only Scan without touching the heap at all, eliminating the extra I/O hop. You can verify the improvement by re-running EXPLAIN (ANALYZE, BUFFERS) and checking that shared read drops from ~48,000 blocks to a handful. Potential gotcha: if the statistics are stale (e.g., customer_id was just loaded in bulk), the planner may still underestimate selectivity. Running ANALYZE fixes this. Also, if random_page_cost is still set to 4.0 on an SSD system, lower it to 1.1 so the planner does not penalise index scans unfairly.",
    rubric: [
      "Correctly identifies that a Seq Scan scanned all rows because no index exists on customer_id",
      "Proposes a B-tree index on customer_id and explains why it matches this query pattern",
      "Mentions a covering index (INCLUDE columns) or Index Only Scan as an optimization",
      "Explains the role of ANALYZE / statistics freshness in the planner's choice",
      "Knows how to re-verify the fix using EXPLAIN (ANALYZE, BUFFERS) and buffer hit counts",
    ],
  },
  {
    id: "dba-index-types",
    category: "dba",
    executes: false,
    free: true,
    level: "junior",
    title: "B-tree vs covering vs partial index — when to use each",
    company: "E-commerce platform · seed-stage",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Your team has a products table with 5 million rows and the following common query patterns:\n\n" +
      "1. SELECT name, price FROM products WHERE category_id = 7;\n" +
      "2. SELECT id FROM products WHERE is_active = true AND price < 50;\n" +
      "3. SELECT * FROM products WHERE sku = 'ABC-123';\n\n" +
      "There is currently only a primary key index on id. " +
      "For each query, propose the right index type (plain B-tree, covering, or partial) and explain your reasoning. " +
      "Also, describe one scenario where adding an index would actually hurt performance.",
    hints: [
      "A covering index stores extra columns in the index itself so the planner never needs to visit the heap row — useful when you SELECT a small, known column list.",
      "A partial index only indexes rows where a WHERE condition is true — think about query 2 and the selectivity of is_active = true.",
      "Indexes hurt on write-heavy tables because every INSERT/UPDATE/DELETE must also update the index. Ask yourself: what is the write:read ratio for this table?",
    ],
    starter: "",
    idealAnswer:
      "Query 1 (filter on category_id, select name and price): A covering index CREATE INDEX idx_products_cat_covering ON products(category_id) INCLUDE (name, price) enables an Index Only Scan. The planner retrieves category_id from the B-tree nodes and name/price from the INCLUDE leaf pages without touching the main heap. If the column list were large or frequently changing, a plain B-tree on category_id alone is safer. Query 2 (is_active = true AND price < 50): A partial index CREATE INDEX idx_products_active_cheap ON products(price) WHERE is_active = true is ideal. Because is_active = true might cover only 10-30% of the table, the partial index is much smaller and faster to scan than a full index on (is_active, price). The planner picks it up automatically when the query predicate matches the index condition. Query 3 (sku equality lookup): A plain B-tree unique index CREATE UNIQUE INDEX idx_products_sku ON products(sku) is correct because sku is high-cardinality and the lookup returns at most one row. When an index hurts: a table receiving 10,000 INSERTs/second with five non-selective indexes (e.g., an index on a boolean flag with 50/50 distribution) will slow down significantly because each write must update all five index structures. Additionally, a VACUUM or autovacuum pass must process bloated index pages. In that case, dropping or deferring less-selective indexes and batching inserts behind a queue can recover write throughput.",
    rubric: [
      "Recommends a covering index (INCLUDE) for query 1 with correct justification",
      "Recommends a partial index for query 2, citing the selectivity benefit",
      "Recommends a B-tree (unique) index for query 3 with the equality-lookup rationale",
      "Gives a concrete and correct example of when an index hurts (write amplification or non-selective index)",
      "Understands that partial indexes are only used when the query WHERE clause matches the index predicate",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────
  {
    id: "dba-vacuum-bloat",
    category: "dba",
    executes: false,
    free: false,
    level: "mid",
    title: "Diagnosing and resolving table bloat in PostgreSQL",
    company: "Fintech SaaS · Series B",
    difficulty: "medium",
    mode: "text",
    prompt:
      "A PostgreSQL table — transactions, currently ~50 GB on disk — started as 8 GB six months ago when it had the same number of live rows. Queries against it are getting slower week over week even though you have not changed the schema or added rows. Autovacuum is enabled. Walk me through your diagnosis and remediation plan.",
    hints: [
      "Start by confirming bloat exists: pgstattuple or pg_stat_user_tables (n_dead_tup, last_autovacuum) can tell you whether dead tuples are accumulating.",
      "Autovacuum is enabled but something is stopping it from keeping up — think about long-running transactions or misconfigured thresholds on a large table.",
      "VACUUM and VACUUM FULL have very different side effects. One can run online; the other requires an exclusive lock. Choose carefully for a production table.",
    ],
    starter: "",
    idealAnswer:
      "Step 1 — confirm bloat: run SELECT n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze FROM pg_stat_user_tables WHERE relname = 'transactions'. If n_dead_tup is large (say, millions), bloat is the cause. For a more precise bloat estimate, install pgstattuple and run SELECT * FROM pgstattuple('transactions') — it reports dead_tuple_percent and free_space_percent directly. Step 2 — find why autovacuum is not keeping up: (a) Long-running transactions: SELECT pid, now() - xact_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC. A transaction open for hours holds back the oldest xmin, so VACUUM cannot reclaim dead tuples visible to that transaction. Terminate idle-in-transaction sessions with pg_terminate_backend(). (b) Autovacuum threshold misconfigured for a large table: the default scale_factor of 0.2 means autovacuum fires at 0.2 × 50M rows = 10M dead tuples, which is far too lenient. Override for this table: ALTER TABLE transactions SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_threshold = 5000). This triggers autovacuum after ~500K dead tuples. (c) Autovacuum workers throttled by cost delay: if autovacuum_vacuum_cost_delay is too high (default 2ms), autovacuum crawls on a large table. Consider setting it to 0 or 1ms for high-update tables. Step 3 — remediation: run a manual VACUUM ANALYZE transactions first to reclaim dead tuple space and refresh statistics; this runs online without a lock. The freed space stays inside the table file (available for future inserts) but is not returned to the OS. If you need to actually shrink the file and return disk space, run VACUUM FULL transactions — but this acquires an ACCESS EXCLUSIVE lock and will block all reads and writes for the duration (possibly hours on 50 GB). Plan for a maintenance window. A less disruptive alternative is pg_repack, which rewrites the table and its indexes concurrently without a long-lived lock. Step 4 — prevention: tune per-table autovacuum thresholds for the transactions table, monitor n_dead_tup via a Prometheus pg_stat_user_tables exporter, alert if dead tuple ratio exceeds 10%, and enforce a maximum statement timeout to prevent long-running transactions from blocking autovacuum.",
    rubric: [
      "Uses pg_stat_user_tables or pgstattuple to confirm dead tuple accumulation before acting",
      "Identifies long-running transactions blocking xmin horizon as a root cause",
      "Correctly tunes per-table autovacuum thresholds (scale_factor + threshold) for a large table",
      "Distinguishes VACUUM (online, space not returned to OS) from VACUUM FULL (exclusive lock, shrinks file) and recommends pg_repack as a safer alternative",
      "Proposes a monitoring strategy (alerting on n_dead_tup ratio) to prevent recurrence",
    ],
  },
  {
    id: "dba-locking-isolation",
    category: "dba",
    executes: false,
    free: false,
    level: "mid",
    title: "Deadlock root cause and isolation level selection",
    company: "Payments platform · Series B",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your on-call team gets a Postgres ERROR: deadlock detected alert at 2 AM on the payments database. The two transactions involved are:\n\n" +
      "Txn A: UPDATE accounts SET balance = balance - 100 WHERE id = 1; then UPDATE accounts SET balance = balance + 100 WHERE id = 2;\n" +
      "Txn B: UPDATE accounts SET balance = balance - 50  WHERE id = 2; then UPDATE accounts SET balance = balance + 50  WHERE id = 1;\n\n" +
      "Explain why the deadlock happened, how PostgreSQL resolves it, and how you would fix it permanently. " +
      "Also: the product team now asks whether switching to SERIALIZABLE isolation would prevent this — how do you respond?",
    hints: [
      "Trace the lock acquisition order for each transaction step by step — deadlocks always come from acquiring the same locks in a different order.",
      "PostgreSQL detects deadlocks via a wait-for graph and resolves them by aborting the transaction with the lower cost (usually the one that did less work). One transaction must always be retried.",
      "SERIALIZABLE uses SSI (Serializable Snapshot Isolation), not traditional 2PL. It prevents anomalies differently than lock ordering. Would it prevent this specific case?",
    ],
    starter: "",
    idealAnswer:
      "Why the deadlock happens: Txn A acquires a row-level exclusive lock on account id=1 and waits to lock id=2. Txn B acquires a row-level exclusive lock on id=2 and waits to lock id=1. Each transaction is holding a lock the other needs — a classic circular dependency. Neither can proceed, so PostgreSQL detects the cycle via its wait-for graph (checked every deadlock_timeout milliseconds, default 1 second) and aborts the transaction with the lower internal cost estimate, returning ERROR: deadlock detected. That transaction must be retried by the application. Permanent fix: enforce a consistent lock acquisition order across all code paths. Both transactions should always update the lower account ID first: sort the two account IDs in ascending order before issuing UPDATEs. With both transactions touching id=1 before id=2, Txn B will simply wait behind Txn A instead of creating a cycle. This is the canonical solution for the dining philosophers / transfer problem. On SERIALIZABLE: PostgreSQL's SERIALIZABLE isolation uses Serializable Snapshot Isolation (SSI), which is MVCC-based with a predicate lock layer — not traditional two-phase locking. SSI would not prevent this deadlock; it detects anomalies (write skew, phantom reads) that violate serializability, but the deadlock here is a lock-ordering problem under write contention that occurs at the row-exclusive lock level regardless of isolation level. In fact, SERIALIZABLE mode may abort more transactions due to serialization failures (ERROR: could not serialize access), which is a different type of retry burden. The right fix remains consistent lock ordering, not a higher isolation level. For extra resilience, set a statement_timeout or lock_timeout on the payment transaction to abort quickly if waiting too long, and instrument the retry logic with exponential backoff.",
    rubric: [
      "Correctly traces the lock acquisition order for both transactions and identifies the circular wait",
      "Explains that Postgres resolves deadlocks via a wait-for graph and aborts the cheaper transaction",
      "Provides the consistent lock ordering fix (always sort IDs before updating) as the permanent solution",
      "Correctly explains that SERIALIZABLE (SSI) would not prevent this specific lock-ordering deadlock",
      "Mentions application-level retry logic and optionally lock_timeout / statement_timeout as defensive measures",
    ],
  },
  {
    id: "dba-query-tuning-workflow",
    category: "dba",
    executes: false,
    free: false,
    level: "mid",
    title: "End-to-end query tuning workflow for a slow report",
    company: "Analytics SaaS · growth stage",
    difficulty: "medium",
    mode: "text",
    prompt:
      "A nightly report query that joins four tables (events, users, campaigns, conversions — largest table is 80 million rows) was running in 4 seconds last month and now takes 90 seconds. Nothing in the application code changed. Walk me through your full query tuning workflow from first symptom to verified fix.",
    hints: [
      "Before touching indexes, check whether table statistics are stale (last ANALYZE date) — a statistics regression after a large data load is the #1 cause of sudden plan changes on large tables.",
      "Use EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) to compare buffer hit counts before and after any change — it tells you whether you fixed the I/O problem or just moved it.",
      "Join order and join algorithm (Hash Join vs. Nested Loop vs. Merge Join) are chosen by the planner based on row-count estimates. If the estimates are badly wrong, the planner picks the wrong algorithm.",
    ],
    starter: "",
    idealAnswer:
      "Step 1 — gather evidence before touching anything: check pg_stat_statements for the query's total_time, calls, mean_time, and stddev_time over the last 24 hours. Confirm the regression is real and not a one-off spike (check stddev). Step 2 — capture the current plan: run EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) during a slow execution and save it. Look for: (a) grossly wrong row estimates (planner says 100 rows, actual is 5 million), (b) Nested Loop on a large inner table (should be Hash Join), (c) 'shared read' buffer count in the thousands indicating heavy I/O. Step 3 — check statistics freshness: SELECT relname, last_analyze, last_autoanalyze, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE relname IN ('events','users','campaigns','conversions'). If last_analyze is older than the regression date or n_dead_tup is high, run ANALYZE on the affected tables. Often this alone restores the fast plan because the planner's row estimates recover. Step 4 — if statistics look fresh, compare the plan to a known-good one (get the plan from a lower environment or from pg_stat_statements historical snapshots if enabled). If the join order changed, investigate why: was the table extended (new partitions, large load)? Did default_statistics_target need increasing for a highly skewed column? Run ALTER TABLE events ALTER COLUMN campaign_id SET STATISTICS 500 and ANALYZE events to improve the histogram. Step 5 — if the plan is correct but slow due to I/O: check missing indexes (are the join columns and WHERE predicates indexed?), consider a covering index to enable Index Only Scans on the largest table, and verify work_mem is adequate for Hash Joins on 80M rows — a Hash Join spilling to disk is orders of magnitude slower (increase work_mem per session: SET work_mem = '256MB'). Step 6 — verify the fix: re-run EXPLAIN (ANALYZE, BUFFERS) and confirm execution time, buffer reads, and plan shape all improved. Re-run pg_stat_statements the next morning and confirm mean_time returned to ~4 seconds. Document the root cause, fix, and prevention steps.",
    rubric: [
      "Starts by checking pg_stat_statements or pg_stat_user_tables rather than immediately adding indexes",
      "Uses EXPLAIN (ANALYZE, BUFFERS) to capture the bad plan and identify misestimates",
      "Identifies stale statistics or a large data load as a likely root cause and uses ANALYZE to fix",
      "Discusses join algorithm selection (Hash Join vs. Nested Loop) and its sensitivity to row-count estimates",
      "Verifies the fix with a second EXPLAIN (ANALYZE, BUFFERS) run and monitoring to confirm regression is resolved",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────
  {
    id: "dba-replication-failover",
    category: "dba",
    executes: false,
    free: false,
    level: "senior",
    title: "Designing a HA replication topology — sync vs async trade-offs",
    company: "Payments fintech · Series C",
    difficulty: "hard",
    mode: "text",
    prompt:
      "You are the lead DBA for a payment processing system running on PostgreSQL. The business requires:\n\n" +
      "- RPO ≤ 2 seconds (at most 2 seconds of committed data can be lost in a failure)\n" +
      "- RTO ≤ 30 seconds (the system must accept writes again within 30 seconds of primary failure)\n" +
      "- The primary is in us-east-1; a DR site is in us-west-2 (~65ms round-trip latency)\n\n" +
      "Design the replication topology and failover mechanism. Explain your synchronous_commit setting choice, how you prevent split-brain, and what your runbook looks like for a primary failure at 3 AM.",
    hints: [
      "Full synchronous replication (synchronous_commit = on) across 65ms of WAN latency adds 65ms to every commit — evaluate whether synchronous_commit = remote_write is an acceptable middle ground for the RPO requirement.",
      "Automatic failover tools like Patroni use a distributed consensus store (etcd or Consul) to avoid split-brain — one cluster node is always the DCS-confirmed leader. Manual failover without a fencing mechanism risks a dual-primary scenario.",
      "RTO of 30 seconds means your health check interval + failover election time + application reconnection time must all fit within 30 seconds. Work backwards from there.",
    ],
    starter: "",
    idealAnswer:
      "Topology: one primary in us-east-1, one synchronous standby in us-east-1 (same AZ or cross-AZ, ~1ms RTT), and one asynchronous streaming replica in us-west-2 (DR). This three-node setup is the minimum for meeting both the RPO and the write-availability requirement. synchronous_commit setting: use synchronous_commit = remote_write on the cross-AZ in-region standby. 'remote_write' means the primary waits until the standby has written the WAL to its OS buffer (not yet fsynced), which protects against primary hardware failure (the standby has the data in memory) while adding only ~1ms per commit instead of a full round-trip. RPO for a simultaneous primary + standby failure would not be zero, but a simultaneous dual failure in the same AZ is extremely rare and 2-second RPO is still met under normal single-node failure. Do not use synchronous_commit = on to the us-west-2 replica — 65ms added to every payment commit would be unacceptable. The us-west-2 replica operates asynchronously with typical replication lag of 100-300ms; it is used for DR (can promote in us-west-2 if us-east-1 is completely lost) and for read offload. Split-brain prevention: deploy Patroni with etcd (3-node etcd cluster, quorum-based). Patroni holds a distributed lock (the leader key with a TTL of ~10-15 seconds) in etcd. A standby only promotes if it successfully acquires the leader key from etcd after the primary's key expires. Without the DCS lock, promotion is blocked. The old primary, upon losing network to etcd, will demote itself and stop accepting writes (STONITH). This eliminates dual-write scenarios. RTO breakdown for a 30-second budget: Patroni health-check interval ~5s, leader key TTL ~10s, election and promotion ~3s, application connection pool drain and reconnect ~10s. Total ≈ 28 seconds — just within budget. To further reduce RTO: set a smaller ttl (8s) and loop_wait (3s) in Patroni, pre-warm the standby to the same pg_hba.conf and postgresql.conf to avoid config differences that delay startup. Runbook for 3 AM primary failure: (1) PagerDuty alert fires when Patroni detects primary unhealthy (within 5s). (2) Patroni automatically elects the in-region standby and promotes it — no human needed for RTO. (3) On-call DBA acknowledges the alert, SSHes to the new primary, runs patronictl -c /etc/patroni.yml list to confirm the new topology, and checks replication lag on the us-west-2 replica. (4) Verifies that the application connection pool is connected to the new primary by checking application logs and pg_stat_activity on the promoted node. (5) Investigates the failed primary: if it is a transient OS crash, re-attach it as a new standby (Patroni handles re-sync via pg_basebackup or pg_rewind). If hardware failure, provision a replacement. (6) Within 24 hours, run a post-mortem and confirm the us-west-2 DR replica caught up. Backup / PITR note: continuous WAL archiving to S3 runs on the primary (and continues from the new primary after failover via archive_cleanup_command on the standby). In the worst case DR scenario where both us-east-1 nodes are lost, the us-west-2 replica is promoted and PITR from S3 WAL archive covers any gap.",
    rubric: [
      "Chooses synchronous_commit = remote_write (not 'on') for cross-AZ standby and correctly justifies the RPO vs. latency trade-off",
      "Designs a three-node topology with in-region sync standby and cross-region async DR replica",
      "Uses a consensus store (Patroni + etcd) for leader election and explains how it prevents split-brain",
      "Works backwards through the RTO budget (health check + TTL + election + reconnect) and confirms it fits in 30 seconds",
      "Provides a concrete 3 AM failover runbook with verification steps and re-attach procedure for the failed primary",
    ],
  },
  {
    id: "dba-partitioning-strategy",
    category: "dba",
    executes: false,
    free: false,
    level: "senior",
    title: "Partitioning strategy for a multi-year audit log table",
    company: "Enterprise compliance SaaS · Series D",
    difficulty: "hard",
    mode: "text",
    prompt:
      "You have an audit_log table that has grown to 1.2 TB and 8 billion rows over 4 years. Queries almost always filter by created_at (date range) and by tenant_id. Writes are append-only at 5,000 inserts/second peak. You need to: (1) keep query performance acceptable without full-table scans, (2) archive and drop data older than 2 years cheaply, and (3) avoid downtime during the migration. Design the partitioning strategy, the migration approach, and explain when partitioning would hurt rather than help.",
    hints: [
      "Declarative partitioning in Postgres 10+ supports range and list strategies — think about whether you want monthly range partitions, hash partitions by tenant_id, or a composite (range × list) approach given the two filter columns.",
      "Partition pruning only works when the query WHERE clause matches the partition key — if queries sometimes omit the created_at filter, a pure range partition on created_at will do a full fan-out across all partitions.",
      "For a zero-downtime migration from a monolithic table to a partitioned one, the typical technique is to create the partitioned table alongside the old one, backfill in batches, swap with a view, then cut over — or use pg_partman to automate partition management.",
    ],
    starter: "",
    idealAnswer:
      "Partition strategy: use declarative range partitioning on created_at at monthly granularity (CREATE TABLE audit_log_2024_01 PARTITION OF audit_log FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')). Monthly partitions are the sweet spot: small enough for fast date-range pruning and cheap DROP PARTITION, large enough that the partition metadata overhead (one entry per partition in pg_class) stays manageable (48 partitions for 4 years). Sub-partitioning by tenant_id (LIST) on each monthly partition is worth considering only if the tenant count is small (< 50) and most queries filter by both columns; otherwise, the partition tree becomes unwieldy. A better approach for tenant filtering is a composite B-tree index on (tenant_id, created_at) within each monthly partition — the planner prunes to the right monthly partition first, then uses the index. Archival strategy: to drop data older than 2 years, run DROP TABLE audit_log_2022_01 (not DELETE) — dropping a partition is an O(1) metadata operation and takes milliseconds, returning 25 GB of space immediately. Schedule this via pg_cron monthly. Migration approach (zero-downtime): (1) Create the new partitioned parent table audit_log_partitioned alongside the existing audit_log. (2) Use pg_partman to auto-create monthly partitions. (3) Backfill historical data in monthly batches: INSERT INTO audit_log_partitioned SELECT * FROM audit_log WHERE created_at >= '2022-01-01' AND created_at < '2022-02-01'. Each batch runs as a short transaction, does not block writes, and can be re-run if it fails. (4) Set up a trigger or logical replication slot on the old table to dual-write to both tables during the migration window. (5) When the backfill is complete and replication lag is zero, atomically rename: BEGIN; ALTER TABLE audit_log RENAME TO audit_log_old; ALTER TABLE audit_log_partitioned RENAME TO audit_log; COMMIT. (6) Drop the old table after a 24-hour validation window. When partitioning hurts: (a) If queries frequently omit the partition key (created_at), the planner fan-outs to all partitions — more overhead than a single-table query with an index. (b) Cross-partition queries like global COUNT(*) must visit every partition — slower than the equivalent on an unpartitioned table with a good index. (c) Partition metadata lock contention: Postgres acquires a lock on every partition during DDL statements and when the partition list changes — hundreds of partitions can cause measurable lock overhead on busy systems. (d) PgBouncer transaction mode drops session state; if the application relies on temp tables or prepared statements that reference the partitioned table, transaction pooling mode may not behave as expected.",
    rubric: [
      "Recommends monthly range partitioning on created_at and correctly explains partition pruning",
      "Explains why DROP PARTITION is the right archival mechanism (O(1), no DELETE overhead)",
      "Provides a concrete zero-downtime migration plan: backfill in batches, dual-write, atomic rename",
      "Addresses tenant_id filtering correctly — either sub-partitioning (with caveats) or a composite index within each partition",
      "Identifies at least two cases where partitioning hurts: cross-partition fan-out on keyless queries and partition metadata lock overhead",
    ],
  },
  {
    id: "dba-pitr-backup-recovery",
    category: "dba",
    executes: false,
    free: false,
    level: "senior",
    title: "Designing a PITR backup strategy and running a recovery drill",
    company: "Healthcare data SaaS · regulated · Series C",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your PostgreSQL production database holds PHI (Protected Health Information) and must meet:\n\n" +
      "- RPO ≤ 1 hour (at most 1 hour of data loss)\n" +
      "- RTO ≤ 4 hours (fully restored and serving traffic within 4 hours)\n" +
      "- 7-year backup retention\n" +
      "- Backups must be tested quarterly\n\n" +
      "A junior DBA tells you: 'We take a pg_dump every night at 2 AM — that covers us.' What is wrong with that approach, and how would you design a proper PITR-capable backup strategy? Include the recovery drill procedure.",
    hints: [
      "pg_dump at 2 AM means your RPO is up to 23 hours 59 minutes, not 1 hour. PITR requires continuous WAL archiving on top of a base backup.",
      "A backup is worthless unless it has been tested. Describe the exact restore procedure you would run in your quarterly drill — including how you verify the restored database is consistent and complete.",
      "For a regulated environment, encryption at rest and in transit for the backup files, and audit logs of who ran the restore, are non-negotiable requirements.",
    ],
    starter: "",
    idealAnswer:
      "What is wrong with nightly pg_dump: pg_dump takes a logical snapshot of the database at a point in time (2 AM). If the database fails at 1:59 AM the next day, all 23 hours 59 minutes of data since the last dump are lost — far worse than the 1-hour RPO requirement. Additionally, pg_dump does not capture WAL segments, so there is no way to replay changes to any intermediate point in time. A large database dump also takes hours to restore, threatening the 4-hour RTO. PITR strategy: (1) Base backups: use pg_basebackup (or pgBackRest, the industry-standard tool for regulated environments) to take a full base backup weekly. The base backup is a binary copy of the data directory. (2) Continuous WAL archiving: set archive_mode = on and archive_command in postgresql.conf to ship every completed WAL segment to an encrypted S3 bucket (or Azure Blob Storage) immediately as it is written. With a WAL segment size of 16 MB and a write rate of ~5 MB/s, segments archive every 3 seconds on average — giving an effective RPO well under 1 hour. To guarantee a 1-hour RPO even under light write load, set archive_timeout = 3600 (force a WAL segment switch every hour at minimum). (3) Encryption: all base backup and WAL files are encrypted with AES-256 before upload; pgBackRest supports this natively. Access to the backup S3 bucket is restricted by IAM policy to the backup user and the DBA role. (4) Retention: S3 lifecycle policy keeps backups for 7 years; pgBackRest retention configuration keeps the last 4 weekly full backups plus all WAL segments covering the retention window. Older WAL segments are expired automatically. Recovery procedure (and quarterly drill): (1) Provision a clean restore host of identical spec. (2) Install the same PostgreSQL version as production. (3) Run pgBackRest restore --type=time --target='2025-06-01 14:30:00' to restore the latest base backup and replay WAL up to the target timestamp. (4) Set recovery_target_action = promote in postgresql.conf on the restore host. (5) Start PostgreSQL; it enters recovery mode, replays WAL, and then promotes to a normal running state. (6) Validate: run a data integrity check (row counts on key tables, application smoke test, schema diff against production baseline). (7) Measure actual RTO: in our drills the 500 GB database restores in approximately 2 hours on a comparable host — well within the 4-hour window. (8) Document the drill: record start time, completion time, any WAL gaps, validation results, and the team member who performed the restore. Store in the compliance audit log. For regulated data: all restore actions are logged in CloudTrail (AWS) or equivalent, the restore host is inside the same VPC as production, and the recovered data is never allowed to leave the regulated environment without data masking.",
    rubric: [
      "Correctly identifies that nightly pg_dump violates the 1-hour RPO and explains why (no WAL replay capability)",
      "Describes continuous WAL archiving (archive_mode + archive_command or pgBackRest) as the mechanism for PITR and explains archive_timeout",
      "Covers encryption at rest and access controls for backup storage in a regulated environment",
      "Provides a step-by-step recovery procedure including pgBackRest restore with a target timestamp and the promote step",
      "Describes a quarterly drill procedure with data validation, RTO measurement, and compliance documentation",
    ],
  },
  {
    id: "dba-connection-pooling",
    category: "dba",
    executes: false,
    free: false,
    level: "mid",
    title: "Diagnosing connection exhaustion and sizing PgBouncer correctly",
    company: "Multi-tenant SaaS · Series B",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your PostgreSQL database (max_connections = 200) is used by a Node.js API that runs 50 container instances, each with a connection pool of 10. During a traffic spike you see FATAL: sorry, too many clients already errors and the app returns 500s. A colleague suggests raising max_connections to 2000. Explain why that is likely the wrong fix, describe how PgBouncer connection pooling solves this, and walk through how you would size PgBouncer for this workload.",
    hints: [
      "PostgreSQL allocates shared memory per connection (roughly 5-10 MB of working memory each). Raising max_connections from 200 to 2000 has a real memory cost and can degrade performance under high concurrency due to lock manager contention.",
      "PgBouncer sits between the app and Postgres. The app sees up to pool_size connections from PgBouncer; PgBouncer maintains a much smaller server-side pool against Postgres. Think about which pooling mode works for a stateless REST API.",
      "Transaction pooling mode is incompatible with session-level features like SET LOCAL, LISTEN/NOTIFY, and prepared statements (PREPARE/EXECUTE). Verify your Node.js driver is not using any of these before enabling transaction mode.",
    ],
    starter: "",
    idealAnswer:
      "Why raising max_connections to 2000 is wrong: PostgreSQL allocates approximately 5-10 MB of backend process overhead per connection (including shared memory structures). 2000 connections = 10-20 GB of RAM consumed just by connection overhead, before any query work is done. Beyond ~300 concurrent active connections, PostgreSQL's lock manager and memory contention cause throughput to decline rather than improve (this is well-documented in the pgBench benchmark). The root problem is not that Postgres cannot handle 2,000 connections — it is that 500 app connections (50 containers × 10) vastly exceed the number of connections that can be usefully active simultaneously on a typical 8-16 vCPU database host. Most of those connections are idle, waiting for the next HTTP request. How PgBouncer solves this: PgBouncer acts as a lightweight connection proxy. The 50 Node.js containers connect to PgBouncer (which accepts thousands of client connections cheaply, as it is a single-threaded event loop). PgBouncer maintains a much smaller pool of real server connections to Postgres — e.g., 100 — and multiplexes the 500 app connections over those 100 server connections. In transaction pooling mode, a server connection is checked out from the pool only for the duration of a single transaction, then returned immediately. This is ideal for a stateless REST API where each HTTP request runs one or a few short transactions and then releases the connection. Sizing PgBouncer: start with server_pool_size = 2 × vCPUs (for a 16-vCPU Postgres host, set pool_size = 32 per database+user pair). Monitor PgBouncer's SHOW POOLS output: if avg_wait_time climbs above 1-2ms or cl_waiting (clients queued) is consistently > 0, increase pool_size by 8-16 at a time. The client-facing listen port should be set with max_client_conn = 1000 or more — PgBouncer handles thousands of idle client connections cheaply. Caveats for Node.js: confirm the Postgres driver (node-postgres / pg) is not using PREPARE/EXECUTE SQL (prepared statements via PREPARE command — not the driver-level wire protocol parameterized queries, which are fine). SET search_path and other session-level settings are lost between transactions in transaction mode. A common pattern is to avoid SET in application code and configure search_path in the database user's default_role_search_path instead. Also set server_reset_query = DISCARD ALL in PgBouncer to reset any session state between pool assignments.",
    rubric: [
      "Explains why raising max_connections is harmful — memory overhead per backend and lock manager contention at high concurrency",
      "Correctly describes PgBouncer's role: accepting many client connections while maintaining a small server-side pool against Postgres",
      "Recommends transaction pooling mode for a stateless REST API and explains why it is more efficient than session mode",
      "Provides a concrete pool_size sizing formula (e.g., 2× vCPUs) and references SHOW POOLS metrics for tuning",
      "Identifies transaction mode incompatibilities (PREPARE/EXECUTE SQL, SET LOCAL, LISTEN) and provides workarounds",
    ],
  },
];
