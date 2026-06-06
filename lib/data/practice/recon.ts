import type { ConvItem } from "./types";

/**
 * Data-reconciliation & data-correctness scenario questions — the product's
 * differentiator. Each item plants an ENGINEERED EDGE CASE that breaks the
 * naive answer (inner-join hides target-only rows, COUNT(*) lies under dup
 * keys, float == on money, UTC vs local day boundary, MERGE drops hard
 * deletes, current-flag overlaps in SCD2, etc.). Graded against idealAnswer +
 * rubric, not executed.
 *
 * Researched (2025–2026) from:
 *   https://dev3lop.com/data-reconciliation-patterns-between-source-and-target-systems/
 *   https://dqops.com/docs/categories-of-data-quality-checks/how-to-reconcile-data-and-detect-differences/
 *   https://docs.soda.io/data-testing/data-reconciliation
 *   https://medium.com/towards-data-engineering/building-idempotent-data-pipelines-a-practical-guide-to-reliability-at-scale-2afc1dcb7251
 *   https://discourse.getdbt.com/t/handling-scd-type-2-using-dbt-incremental-process/19326
 *   https://medium.com/@manjindersingh_10145/designing-robust-data-pipelines-idempotency-replays-backfills-explained-640c9920f7b9
 */
export const RECON_ITEMS: ConvItem[] = [
  // ─── 1. Source-vs-target one-to-one + the row-count-under-dups trap ──────────
  {
    id: "rec-001",
    category: "casestudy",
    level: "mid",
    title: "Source vs target: counts match, money doesn't",
    company: "Fintech",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A nightly ETL copies the operational `payments` table (Postgres) into the warehouse `fct_payments` (Snowflake). Your validation job runs `SELECT COUNT(*)` on both sides every morning; counts have matched to the row for months. Finance now reports the warehouse total revenue is ~$40k higher than the source ledger for several days last month. Counts are identical. Design the reconciliation that would have caught this, and explain what is most likely happening.",
    idealAnswer:
      "COUNT(*) parity is a near-useless check — it survives almost any value-level corruption, including duplicated rows that cancel against dropped rows, or amount mutations that change no row count. The right reconciliation is multi-level: (1) a row-count check, (2) a column-aggregate check on the money column — SUM(amount), and ideally a hash/checksum of business columns, and (3) a key-level diff (anti-join both directions on the natural key) to find source-only and target-only keys. The $40k-with-equal-counts symptom screams a value drift, not a row drift: most likely a duplicate-key collision where the load uses an INSERT (or a MERGE on the wrong key) that double-loaded some payments while the same number of distinct payments were missed, OR a units/scale bug (e.g., a partial-refund amount stored positive instead of negative, or cents-vs-dollars). The reconciliation must group by the natural key and compare COUNT and SUM per key, and must compute SUM on both sides — a SUM diff localizes it instantly. The classic trap is trusting COUNT(*); the second trap is comparing only the global SUM (which can also coincidentally net to zero) instead of a keyed/hashed comparison.",
    rubric: [
      "Calls out that COUNT(*) parity does not detect value-level drift (the core trap)",
      "Adds an aggregate check on the money column (SUM) and/or a column checksum/hash",
      "Proposes a key-level bidirectional anti-join to find source-only vs target-only keys",
      "Names a plausible root cause: duplicate rows offsetting drops, or a sign/scale (cents vs dollars, refund sign) bug",
      "Recommends comparing per-key COUNT and SUM, not just global totals (global SUM can net out)",
      "Mentions equality on money should be exact (integer cents), not float, in the comparison query",
    ],
    hints: [
      "If COUNT is equal but a total differs, the bug cannot be a simple missing/extra row — what else changes a sum without changing a count?",
      "Reconcile at the grain of the natural key, comparing both COUNT and SUM per key, not just the global numbers.",
    ],
  },

  // ─── 2. Aggregate / distinct reconciliation — the SUM-of-floats illusion ─────
  {
    id: "rec-002",
    category: "casestudy",
    level: "mid",
    title: "Aggregate recon: distinct users keeps disagreeing",
    company: "AdTech",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your daily recon compares the source events table to the warehouse rollup on three metrics: row count, SUM(spend), and COUNT(DISTINCT user_id). Row count and spend reconcile, but distinct-user counts are off by 0.5–2% every single day — sometimes warehouse is higher, sometimes source. Both queries 'look correct'. How do you reconcile this, and what is going on?",
    idealAnswer:
      "First rule out the silent killer: many warehouses (BigQuery APPROX_COUNT_DISTINCT, Snowflake/Spark HyperLogLog-backed distinct, or a dashboard that defaults to approximate) return APPROXIMATE distinct counts with a few-percent error that flips sign run to run — that alone explains a bidirectional 0.5–2% drift, and the fix is to force exact COUNT(DISTINCT) on both sides for reconciliation. If both are exact, the next culprits are normalization mismatches: trailing whitespace, case, or NULL handling on user_id (COUNT(DISTINCT) drops NULLs, so a NULL spike on one side shifts the count), and timezone/day-boundary differences pulling different events into 'today'. The correct recon does an exact distinct on both sides over an identically-defined window, and to truly localize it, materializes the set of distinct user_ids on each side and does a bidirectional anti-join to see which IDs are source-only vs target-only — that reveals whether it's a normalization issue (same user, different string) or genuinely missing/extra users. The trap is assuming COUNT(DISTINCT) is deterministic and exact; at scale it often isn't, and even when exact it's sensitive to NULLs and string normalization in ways SUM and COUNT(*) are not.",
    rubric: [
      "Identifies APPROXIMATE distinct (HLL / APPROX_COUNT_DISTINCT) as the most likely cause of small bidirectional drift",
      "Forces exact COUNT(DISTINCT) on both sides for reconciliation",
      "Notes COUNT(DISTINCT) ignores NULLs, so a NULL-key spike shifts the count",
      "Calls out string normalization (case, whitespace) producing 'same user, different value'",
      "Proposes materializing the distinct sets and anti-joining to localize source-only vs target-only IDs",
      "Considers timezone/window definition differences pulling different events into the day",
    ],
    hints: [
      "A drift that randomly changes sign each run is a strong tell — what kind of aggregate is non-deterministic across runs?",
      "How does COUNT(DISTINCT) treat NULLs and 'Bob ' vs 'bob' differently from how SUM treats them?",
    ],
  },

  // ─── 3. Idempotent backfill / replay — double-counting on re-run ─────────────
  {
    id: "rec-003",
    category: "casestudy",
    level: "senior",
    title: "The backfill that doubled last quarter's revenue",
    company: "Marketplace",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A bug in your transformation under-counted Q3 GMV. You fix the logic and run a backfill for July–September. The next morning, Q3 GMV in the dashboard is now roughly double the correct value, and a few days in the middle are triple. Walk me through why this happened and how you design the backfill so a re-run — including a partial re-run after a mid-job crash — is exactly-once.",
    idealAnswer:
      "The backfill INSERTed new rows on top of the existing (buggy) rows instead of replacing them, so every reprocessed transaction is now counted twice; the triple days are partitions that were re-run more than once after a crash/retry. Idempotency is the fix: the unit of work must be a partition (e.g., a day) and the write must be a deterministic overwrite of that partition — INSERT OVERWRITE / DELETE-by-partition-then-insert in one transaction, or a MERGE keyed on a deterministic deduplicated business key — never a bare append. The job should derive output deterministically from input so re-running the same date range yields the same bytes, and it should be safe to re-run any range without coordination. For exactly-once under retries, make each task atomic at the partition grain (stage to a temp location, then atomically swap/overwrite the target partition) so a crash mid-write leaves either the old or the new partition, never both, and never a partial double. Guard against double-counting with a reconciliation after backfill: compare per-day SUM(gmv) and row counts against the source ledger, and assert no day exceeds its source total. The traps: append-instead-of-overwrite, non-atomic writes that leave duplicates after a retry, and a non-deterministic transform (e.g., using now() or a non-stable dedup) that makes a 're-run' produce different rows.",
    rubric: [
      "Diagnoses double/triple counting as append-on-top-of-existing rows plus repeated retries of some partitions",
      "Makes the write idempotent: partition overwrite (INSERT OVERWRITE / delete-by-partition-then-insert) or keyed MERGE, never bare append",
      "Requires atomic partition swap so a mid-job crash leaves old-or-new, never a partial duplicate",
      "Requires the transform be deterministic so a re-run of the same range produces identical output",
      "Adds a post-backfill reconciliation (per-day SUM/count vs source) asserting no day exceeds source",
      "Notes a partition is the unit of replay and re-running any range must be safe without manual coordination",
    ],
    hints: [
      "What does an INSERT do to rows that are already there from the buggy run? What about a partition that got retried after a crash?",
      "Design the write so 'run this date range' produces the same result whether it's the 1st or 5th time you run it.",
    ],
  },

  // ─── 4. Late-arriving & out-of-order events — watermarks & grace ─────────────
  {
    id: "rec-004",
    category: "casestudy",
    level: "senior",
    title: "Streaming totals never match the batch ledger",
    company: "Fintech",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You run a Flink/Spark streaming job that aggregates transaction amounts into hourly windows by event time. A nightly batch job recomputes the same hourly totals from the source-of-truth table. The streaming totals are consistently a little LOW for the most recent hours and sometimes drift for older hours too. Mobile clients can send events hours late (offline mode), and a few send slightly future timestamps from bad clocks. Design the reconciliation and explain the discrepancies.",
    idealAnswer:
      "The recent-hours shortfall is the watermark/grace-period boundary: the streaming job emits a window once the watermark passes window-end + allowed lateness, so events arriving after that are dropped (or routed to a late side-output) and never make it into the closed window — hence consistently low recent totals. The fix is to set the allowed lateness / grace period to cover the realistic late tail (offline mobile = hours, so a watermark with hours of slack or a side-output that reprocesses late events), and to treat windows as provisional until the lateness horizon passes — only then is a window 'final' and comparable to batch. Out-of-order events within the grace window are fine if you key by event time, not processing time; the bad-clock future timestamps are the second trap — they advance the watermark prematurely, closing windows early and dropping otherwise on-time data, so you must clamp/validate timestamps (reject or cap future events) before they drive the watermark. The reconciliation should compare streaming vs batch ONLY for hours older than the lateness horizon (closed windows), expect mismatch inside it, and capture/route late and dropped events to a side table so they're recoverable. The classic mistakes: comparing the still-open recent window to batch, using processing-time windows, and letting future-dated events poison the watermark.",
    rubric: [
      "Attributes the recent-hour shortfall to the watermark + allowed-lateness boundary dropping late events",
      "Sets grace/allowed-lateness to cover the real late tail and treats recent windows as provisional",
      "Reconciles only closed windows (older than the lateness horizon), not the still-open recent hours",
      "Uses event-time (not processing-time) windowing for out-of-order tolerance",
      "Catches the future-timestamp trap: bad clocks advance the watermark early and must be clamped/validated",
      "Routes late/dropped events to a side-output or late table for recovery rather than silently losing them",
    ],
    hints: [
      "Why would the MOST RECENT hours specifically be low, while older hours mostly settle?",
      "What does a single event with a timestamp from next week do to an event-time watermark?",
    ],
  },

  // ─── 5. SCD Type 2 correctness — overlapping versions & current-flag bug ─────
  {
    id: "rec-005",
    category: "casestudy",
    level: "senior",
    title: "SCD2 dimension: two 'current' rows per customer",
    company: "Bank",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A point-in-time revenue report joins `fct_transactions` to a Type-2 `dim_customer` (columns: customer_id, attributes, valid_from, valid_to, is_current). Auditors find some transactions are double-counted, and a few customers show two rows with is_current = true. The SCD2 load runs hourly. Design the reconciliation/tests to catch this and explain the likely bug.",
    idealAnswer:
      "Double-counted transactions are the smoking gun for overlapping validity windows: a point-in-time join (txn.event_ts BETWEEN valid_from AND valid_to) matches two dimension versions when their [valid_from, valid_to) ranges overlap, fanning out the fact. The two-current-rows symptom is the same bug surfacing on the open end — the loader inserted a new version without closing the prior one (didn't set is_current=false / valid_to on the old row), or did the close and insert non-atomically so a retry left both. The correctness tests/recon: (1) no_overlaps — for each customer_id, assert no two versions have overlapping [valid_from, valid_to) intervals; (2) exactly_one_current — assert COUNT(*) WHERE is_current = 1 GROUP BY customer_id is exactly 1; (3) contiguity/no-gaps — each version's valid_to equals the next version's valid_from with the current row's valid_to = infinity (and use a half-open interval [from, to) so equal boundaries don't double-match); (4) is_current must agree with valid_to (is_current ⇔ valid_to is the sentinel). The fix is to make close-old + insert-new one atomic MERGE/transaction, use half-open intervals to avoid boundary double-matches, and re-run the recon after every load. Traps: inclusive BETWEEN on both ends causing boundary overlaps, non-atomic close/insert leaving two current rows, and trusting is_current without an overlap test.",
    rubric: [
      "Links double-counted facts to overlapping [valid_from, valid_to) windows fanning out the point-in-time join",
      "Adds a no-overlap test per natural key (no two versions overlap in validity)",
      "Adds an exactly-one-current test per natural key",
      "Calls out the non-atomic / missing close-of-prior-version as the two-current-rows bug",
      "Recommends half-open intervals [from, to) to avoid boundary double-matches from inclusive BETWEEN",
      "Asserts is_current is consistent with valid_to (and contiguity / no gaps between versions)",
    ],
    hints: [
      "If a single transaction joins to TWO dimension rows, what must be true about those rows' date ranges?",
      "Is your validity interval inclusive on both ends? What happens at the exact boundary timestamp?",
    ],
  },

  // ─── 6. Schema evolution / migration — dual-write cutover + rollback ─────────
  {
    id: "rec-006",
    category: "casestudy",
    level: "senior",
    title: "Renamed a column mid-migration; revenue split in two",
    company: "Marketplace",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You're migrating a pipeline to a new warehouse table that renames `amount_usd` to `gross_amount` and widens it from DECIMAL(10,2) to DECIMAL(18,4). You dual-write old and new tables during cutover. After cutover, finance says totals are slightly off and some large transactions are missing. Design the migration, the reconciliation across the rename/type change, and explain the likely failure.",
    idealAnswer:
      "The missing large transactions are an overflow/truncation symptom of the type change handled in the wrong direction: if any path still wrote into the old DECIMAL(10,2) (max ~99,999,999.99) some large values overflowed or were rejected, or a downstream cast silently truncated the widened DECIMAL(18,4) back to 2 places, dropping rows on insert error. The slight total drift is rounding from the 2→4 decimal widening if values were re-derived rather than copied. A safe migration: expand-and-contract — add the new column/table first, dual-write both, backfill the new from the old with an explicit, lossless cast (DECIMAL(10,2)→DECIMAL(18,4) is widening and safe; the reverse is not), and reconcile before any reader cuts over. The reconciliation must map the rename (compare old.amount_usd to new.gross_amount as the same logical column) and compare at full precision: per-key exact-equality on the money value (integer-cents or fixed DECIMAL, never float), plus row-count and SUM by day. Keep a rollback: readers cut over only after recon is green, and the old table keeps being written until the new one has been clean for a full cycle so you can revert instantly. Traps: assuming a rename is free (recon must alias columns), narrowing/round-tripping the type and losing precision or overflowing, and cutting readers over before the backfill is reconciled.",
    rubric: [
      "Uses expand-and-contract: add new, dual-write, backfill with explicit lossless cast, reconcile before reader cutover",
      "Diagnoses missing large rows as overflow/truncation when a value hits the narrower DECIMAL(10,2) path",
      "Diagnoses slight drift as rounding from the 2→4 decimal change when values are re-derived",
      "Reconciliation aliases the renamed column so old and new are compared as the same logical field",
      "Compares money at full precision with exact equality (fixed DECIMAL / integer cents, not float)",
      "Keeps the old table written + a rollback path until the new one reconciles clean for a full cycle",
    ],
    hints: [
      "DECIMAL(10,2) caps at about 99 million. Which transactions would silently fail to land there?",
      "A rename isn't free to a recon job — how does your comparison know amount_usd and gross_amount are the same thing?",
    ],
  },

  // ─── 7. CDC correctness — deletes/tombstones, ordering, snapshot+stream ──────
  {
    id: "rec-007",
    category: "casestudy",
    level: "senior",
    title: "CDC sink keeps resurrecting deleted rows",
    company: "Bank",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A Debezium → Kafka → warehouse CDC pipeline keeps the warehouse `accounts` table in sync. Reconciliation against the source finds (a) rows that were deleted in the source still present in the warehouse, and (b) a handful of rows showing an OLD value that the source has since updated past. Design the CDC merge and the reconciliation, and explain both bugs.",
    idealAnswer:
      "Bug (a): the consumer is ignoring tombstones/delete events — it applies inserts and updates but treats deletes as no-ops (or filters out the null-payload tombstone), so deleted rows live forever in the warehouse. The merge must handle op = 'd' (and Debezium tombstones) by deleting the key or applying a soft-delete flag. Bug (b): out-of-order application — Kafka only guarantees order within a partition, so if events for one key land on different partitions (wrong partition key) or are processed concurrently, an older update can overwrite a newer one. The fix is to partition by primary key so all events for a key are ordered, and to make the MERGE last-write-wins by source log position — keep a per-key version (LSN / SCN / source ts_ms + sequence) and only apply a change whose version is greater than the stored one, so a replayed or late older event is ignored. Initial load is the third correctness concern: the snapshot+stream merge must dedupe the overlap (snapshot rows vs streamed changes for the same key) using the same version watermark so the snapshot doesn't clobber newer streamed updates or vice versa. Reconciliation: periodic full key-set anti-join (source vs warehouse) to catch missed deletes/inserts, plus per-key value/version comparison. Traps: dropping deletes, partitioning CDC by something other than the PK (loses ordering), no monotonic version guard (stale overwrites), and a snapshot that overwrites fresher stream data at bootstrap.",
    rubric: [
      "Bug (a): consumer ignores delete ops / tombstones — merge must apply op='d' (delete or soft-delete)",
      "Bug (b): out-of-order application — Kafka orders only within a partition, so wrong partition key reorders a key's events",
      "Partition by primary key so all changes for a key are ordered",
      "Last-write-wins by source log position (LSN/SCN/ts_ms+seq), applying only changes with a higher version",
      "Snapshot+stream bootstrap dedupes the overlap by the same version watermark so snapshot doesn't clobber newer stream data",
      "Reconciliation: periodic full key-set anti-join (catches missed deletes) plus per-key value/version comparison",
    ],
    hints: [
      "What does the consumer do with a delete event or a null-payload tombstone? Easy to silently skip.",
      "Kafka guarantees ordering within a partition only — what happens if two updates to the same key land on different partitions?",
    ],
  },

  // ─── 8. Deduplication & entity resolution — fuzzy match + survivorship ──────
  {
    id: "rec-008",
    category: "casestudy",
    level: "mid",
    title: "Customer dedup that merged two different people",
    company: "Marketplace",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "You're deduping a customer master from three source systems into golden records using fuzzy matching on name + email + address. After go-live, support reports two distinct customers got merged into one (and their orders co-mingled), while some obvious duplicates were NOT merged. Design the entity-resolution + survivorship + reconciliation, and explain both failure modes.",
    idealAnswer:
      "The wrong-merge is over-matching: a fuzzy threshold that's too loose, or transitive merging (A~B, B~C ⇒ A,B,C collapse) chaining unrelated records through a common weak token (shared household address, a shared/recycled email, or 'null email' matching 'null email'). The missed duplicates are under-matching: normalization gaps (nicknames, transliteration, different address formats) or blocking that put true duplicates in different blocks so they were never compared. The design: normalize aggressively first (case, whitespace, email canonicalization, address standardization), block on a stable key to make comparison tractable, score with multiple weighted attributes (not OR-of-any-one), and require strong evidence — never merge on a single weak signal, and guard transitive closure (cap cluster size, require pairwise—not just transitive—support, manual review above a confidence band). Survivorship rules must be deterministic: pick the surviving value per attribute by source trust + recency + completeness, and KEEP the cross-reference (source IDs → golden ID) so a bad merge is reversible. Reconciliation: assert no golden record maps to conflicting hard identifiers (two different verified emails/SSNs), measure merge rate against expectation, sample clusters for precision/recall, and make merges auditable and un-mergeable. Traps: NULLs matching each other, transitive over-merge, blocking that hides true dupes, and non-reversible merges with no surviving cross-reference.",
    rubric: [
      "Wrong merge = over-matching: loose threshold or transitive chaining through a weak/shared token",
      "Missed dupes = under-matching: normalization gaps or blocking that never compares true duplicates",
      "Normalize + block + multi-attribute weighted scoring (not match-on-any-single-field)",
      "Calls out NULL/empty fields matching each other as a merge hazard",
      "Deterministic survivorship rules (source trust / recency / completeness) and a kept source-to-golden cross-reference",
      "Reconciliation makes merges reversible/auditable and asserts no golden record holds conflicting hard identifiers",
    ],
    hints: [
      "What happens when 'email is null' matches 'email is null', or when A matches B and B matches C but A and C are unrelated?",
      "Could the true duplicates simply never have been compared because they fell into different blocks?",
    ],
  },

  // ─── 9. Incremental dbt MERGE — late updates, hard deletes, full-refresh ─────
  {
    id: "rec-009",
    category: "casestudy",
    level: "senior",
    title: "dbt incremental model diverges from full-refresh",
    company: "AdTech",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your dbt incremental model uses `is_incremental()` with a filter `where updated_at > (select max(updated_at) from {{ this }})` and a merge on `order_id`. A monthly `--full-refresh` produces materially different numbers than the daily incremental build: the incremental table has stale rows and is missing some deletions. Diagnose and redesign so incremental matches full-refresh exactly.",
    idealAnswer:
      "Three classic incremental bugs. (1) The strict `>` on max(updated_at) drops late/equal-timestamp updates: any row whose updated_at equals the current max (or arrives late with a timestamp at/before the watermark) is never re-selected, so the incremental table goes stale vs full-refresh. Fix: use a lookback window (`updated_at >= max(updated_at) - interval 'N days'`) or `>=` with a dedupe, accepting reprocessing the overlap; the MERGE on order_id makes reprocessing idempotent. (2) Hard deletes are invisible to an append/merge driven by updated_at — deleted source rows simply stop appearing, so they linger in the target forever while full-refresh (which rebuilds from current source) drops them. Fix: capture deletes via CDC/soft-delete or a periodic key anti-join that removes target keys absent from source. (3) Late-arriving rows with timestamps below the watermark are missed by the same `>` filter (same root cause as 1). Redesign: incremental SELECT uses a bounded lookback for safety, MERGE upsert keyed on order_id for idempotency, and a delete-handling path (CDC tombstones or a reconciliation delete of keys missing from source). Add a recurring recon that diffs the incremental table against a full-refresh in a temp schema (or compares per-day SUM/count) and alerts on divergence. The traps: `>` instead of a lookback (loses ties/late rows), and never handling hard deletes (full-refresh handles them implicitly, incremental does not).",
    rubric: [
      "Identifies strict `>` max(updated_at) dropping equal-timestamp and late-arriving updates → stale rows",
      "Identifies that hard deletes are invisible to an updated_at-driven incremental (full-refresh drops them, incremental doesn't)",
      "Fix: bounded lookback window (or >=) plus idempotent MERGE on the unique key to absorb reprocessing",
      "Fix for deletes: CDC/soft-delete or a periodic key anti-join removing target keys missing from source",
      "Adds a recon that diffs incremental vs full-refresh (temp build or per-day SUM/count) and alerts",
      "Notes the MERGE upsert key must be the true unique key so reprocessing the overlap is idempotent",
    ],
    hints: [
      "What happens to a row whose updated_at is exactly equal to the current max — does `>` ever pick it up again?",
      "A full-refresh rebuilds from current source, so deleted rows vanish. How would an updated_at-driven incremental ever notice a deletion?",
    ],
  },

  // ─── 10. Financial precision — float == on money & rounding ─────────────────
  {
    id: "rec-010",
    category: "casestudy",
    level: "mid",
    title: "Recon flags 4,000 'mismatches' that are actually equal",
    company: "Fintech",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Your reconciliation compares per-order amounts between two systems by joining on order_id and flagging rows where `source.amount <> target.amount`. It reports ~4,000 mismatches a day, but when an analyst spot-checks them they look identical ($19.99 vs $19.99). Separately, the daily total reconciles to within a few cents but never exactly. Both systems compute amounts from line items. Diagnose and redesign the precision-correct reconciliation.",
    idealAnswer:
      "The 4,000 phantom mismatches are floating-point representation error: amounts stored or computed as FLOAT/DOUBLE, where 19.99 is not exactly representable, so `=`/`<>` on binary floats reports differences far below display precision (e.g., 19.990000000000002 vs 19.99). You must never test money for equality with float `=`; reconcile money as integer cents (or fixed DECIMAL) and compare with an exact equality, or at minimum ABS(a-b) < half a cent. The few-cents daily-total drift is a rounding-order / rounding-mode difference: one system rounds each line item then sums, the other sums then rounds (sum-then-round ≠ round-then-sum), or they use different rounding modes (half-up vs banker's). Redesign: store and compare amounts in minor units (integer cents) using DECIMAL throughout, define and standardize the rounding rule (where and how rounding happens, including currency-specific minor-unit scale — JPY has 0 decimals, BHD has 3), and reconcile per order with exact integer equality plus a separate aggregate check that accounts for the agreed rounding rule. The traps: float equality on money, comparing across currencies with different decimal scales, and assuming round-then-sum equals sum-then-round.",
    rubric: [
      "Identifies float representation error as the cause of phantom per-row mismatches (never use float = on money)",
      "Reconciles money as integer cents / fixed DECIMAL, with exact equality or a sub-cent tolerance",
      "Diagnoses the total drift as round-then-sum vs sum-then-round (and/or differing rounding modes)",
      "Standardizes the rounding rule and rounding mode across both systems",
      "Accounts for currency-specific minor-unit scale (e.g., JPY 0 decimals, BHD 3) in the comparison",
      "Separates per-row exact recon from the aggregate check that respects the agreed rounding",
    ],
    hints: [
      "Why would $19.99 'not equal' $19.99 when stored as a binary floating-point number?",
      "If each system rounds line items at a different step, does summing them produce the same total?",
    ],
  },

  // ─── 11. Timezone / day-boundary — midnight orders on the wrong day ─────────
  {
    id: "rec-011",
    category: "casestudy",
    level: "mid",
    title: "Daily revenue recon: the midnight-order mismatch",
    company: "E-commerce",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "A daily revenue reconciliation compares the source order system's 'daily total' to the warehouse 'daily revenue' table. Most days match, but specific days are off by a few thousand dollars, and the mismatch always shows up around month-end and on two days in March and November. The source stores order timestamps in UTC; the finance 'day' is US/Eastern. Diagnose and design a correct day-boundary reconciliation.",
    idealAnswer:
      "This is a UTC-vs-local day-boundary bug. Orders placed between 00:00 and ~05:00 UTC actually fall on the PREVIOUS calendar day in US/Eastern (UTC is 4–5 hours ahead), so if one side buckets by UTC date and the other by Eastern date, those late-night orders are counted on the wrong day and the two daily totals disagree — and they only NET out across the full month, which is why month-end days drift (the boundary order shifts the monthly cut). The March/November tells are DST transitions: the UTC offset changes (EST↔EDT), so a fixed offset or a naive date-cast misplaces orders on the spring-forward/fall-back days, and the fall-back hour can even occur twice locally. The fix: define the business day in ONE canonical timezone (US/Eastern, the finance day), convert UTC timestamps with a real tz-aware conversion (AT TIME ZONE / a proper tz library, NOT a fixed +/-5h offset, so DST is handled), then bucket and reconcile on that local date on both sides. Reconcile per local day with SUM and count, and specifically test the boundary: orders in the 00:00–05:00 UTC window and the two DST-transition days. Traps: comparing UTC-day totals to local-day totals, using a hard-coded offset that breaks on DST, and only checking the monthly total (which hides per-day boundary errors that net to zero).",
    rubric: [
      "Identifies the mismatch as UTC-day vs US/Eastern-day bucketing of the same orders",
      "Explains why late-night-UTC orders land on the previous local day and only net out over the month",
      "Connects March/November anomalies to DST offset changes (EST↔EDT)",
      "Converts with a real tz-aware function (AT TIME ZONE / tz library), not a fixed +/-5h offset",
      "Reconciles per LOCAL business day (single canonical tz) on both sides, with SUM and count",
      "Explicitly tests the boundary window (00:00–05:00 UTC) and the DST-transition days",
    ],
    hints: [
      "An order at 02:00 UTC — what calendar day is that in US/Eastern, and which side is bucketing it where?",
      "Why specifically March and November? What changes about the UTC offset on those weekends?",
    ],
  },

  // ─── 12. Reconciliation framework design — 1M vs 980k, dups, missing ────────
  {
    id: "rec-012",
    category: "casestudy",
    level: "senior",
    title: "Design the recon: 1M source, 980k target, 5k dups, 10k missing",
    company: "Bank",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Design a general source-to-target reconciliation framework. Concretely: source has 1,000,000 rows, target has 980,000, there are ~5,000 duplicate keys in the source, and ~10,000 source keys are missing from the target. A naive engineer joins the two tables on the key and compares row counts. Walk me through why that's wrong and how you'd build a recon that produces a trustworthy, categorized discrepancy report at scale.",
    idealAnswer:
      "The naive INNER JOIN + COUNT is wrong on multiple fronts: an inner join silently HIDES both the 10k source-only rows and any target-only rows (they don't survive the join), so the discrepancy disappears instead of surfacing; and the 5k duplicate source keys cause join FAN-OUT, multiplying matched rows so the resulting count is meaningless and can even mask the missing rows. Row-count comparison alone (1M vs 980k = 20k 'diff') also can't tell you that the gap is 10k missing + duplicate noise — net counts conflate distinct error classes. A trustworthy framework: (1) Pre-check key uniqueness on BOTH sides first — count rows vs distinct keys; the 5k source dups must be detected and quarantined (or collapsed by a survivorship rule) before any join, because dups invalidate one-to-one assumptions. (2) Use bidirectional anti-joins (or a FULL OUTER JOIN) to categorize, not an inner join: source-only (missing in target, ~10k), target-only (extras/orphans), and matched-but-different (value mismatch). (3) For matched keys, compare at the value level with a row hash/checksum of business columns (exact, type-aware, money as integer cents) rather than column-by-column. (4) Add aggregate guards — SUM and exact COUNT(DISTINCT) per partition — as a cheap tripwire, and at scale partition the recon (by date/hash bucket) and compare per-partition hashes/sums so you only drill into buckets that differ. Output a categorized report: counts and sample keys per bucket (dup, source-only, target-only, value-mismatch). Traps the naive approach hits: inner join hides non-matches, duplicate keys fan out the join and corrupt counts, and a single net row-count number conflates several distinct failure modes.",
    rubric: [
      "Explains inner join HIDES source-only and target-only rows (the discrepancy vanishes)",
      "Explains duplicate keys cause join FAN-OUT, corrupting matched counts (and detect/quarantine dups first via rows-vs-distinct)",
      "Uses bidirectional anti-joins / FULL OUTER JOIN to categorize: source-only, target-only, matched-but-different",
      "Value comparison via type-aware row hash/checksum (money as integer cents), not just key presence",
      "Aggregate tripwires (SUM, exact COUNT(DISTINCT)) and partitioned/bucketed hashing for scale",
      "Produces a categorized discrepancy report (counts + sample keys per error class), not a single net diff number",
    ],
    hints: [
      "An inner join only keeps keys present on BOTH sides — so where do the 10k missing rows show up in the result? And what do the 5k dups do to matched rows?",
      "A single '20k row difference' number hides multiple error classes — how do you separate missing vs extra vs duplicated vs value-mismatch?",
    ],
  },
];
