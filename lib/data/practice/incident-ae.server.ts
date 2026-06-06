import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the Analytics Engineer incident scenarios.
 * Keyed by the same problemIds as INCIDENT_AE_ITEMS in incident-ae.ts. None of this
 * (root cause, fix, red herrings, triage, facts) reaches the client; it's resolved
 * server-side by problemId in grade/route.ts + chat/route.ts. redHerrings + triageOrder
 * are populated for the hellish-tier scenarios.
 */
export const INCIDENT_AE_SCENARIOS: Record<string, IncidentScenario> = {
  /* 1 — standard */
  "inc-ae-source-freshness-gate": {
    actualRootCause:
      "The source's `loaded_at_field` is set to `order_created_at` — the business EVENT time (when the customer placed the order), which can be days old — instead of the warehouse LOAD time. dbt freshness computes `max(loaded_at_field)` and compares it to now; since the newest order event is ~36h old, freshness fails STALE even though Fivetran loaded every row minutes ago. Freshness is measuring the wrong clock.",
    actualFix:
      "Point `loaded_at_field` at the load/sync timestamp the ELT tool sets (here `_fivetran_synced`), which advances monotonically on every sync. Re-run `dbt source freshness`; it now reflects when data was LOADED, not the age of the newest business event.",
    contributingFactors: [
      "Conflating event time (order_created_at) with load time (_fivetran_synced)",
      "Order event times are naturally bursty/back-dated, so the newest event can be hours-to-days old even on a healthy connector",
      "The freshness gate (error_after) halts `dbt build`, amplifying a config mistake into a full pipeline stall",
    ],
    rubric: [
      "Identifies that `loaded_at_field` points at the event-time column (`order_created_at`) instead of the load-time column",
      "Confirms with the data that `_fivetran_synced` is recent/monotonic while `order_created_at` lags by days",
      "Explains why freshness fails even though the connector synced minutes ago",
      "Fix: set `loaded_at_field` to the load/sync timestamp (`_fivetran_synced`); does not just bump `error_after`",
    ],
    facts: [
      { q: "What does dbt freshness actually compute?", a: "max(loaded_at_field) vs current_timestamp, compared against warn_after/error_after." },
      { q: "Is the connector actually broken?", a: "No — Fivetran's last successful sync was 12 minutes ago; every row's _fivetran_synced is recent." },
      { q: "Why is order_created_at old?", a: "It's the business event time (checkout). Orders are bursty and can be back-dated; the newest event is ~36h old." },
    ],
  },

  /* 2 — standard */
  "inc-ae-unknown-bucket": {
    actualRootCause:
      "A dim_campaign rebuild migrated the legacy `paid_search_v1` campaign_ids to new ids and DELETED the old rows, but `stg_orders` still carries the historical (legacy) campaign_id values. The mart LEFT JOINs orders to dim_campaign, so those historical orders no longer match — `channel` comes back NULL and the dashboard's COALESCE/label buckets NULLs as 'Unknown'. The revenue didn't move; the dimension key broke.",
    actualFix:
      "Restore the mapping so historical orders resolve: either back-map legacy campaign_ids to the new ids (a crosswalk/seed) or keep the deprecated dim_campaign rows (soft-delete instead of hard delete) so the LEFT JOIN still matches. Add a relationships/not-null test on campaign_id to catch orphaned keys in CI. Then 'Unknown' returns to ~2% and Paid Search reappears.",
    contributingFactors: [
      "Hard-deleting dimension rows that fact rows still reference (referential-integrity break)",
      "Dashboard silently coalesces NULL channel into an 'Unknown' bucket, masking the orphaned-key signal",
      "No relationships test between stg_orders.campaign_id and dim_campaign.campaign_id",
    ],
    rubric: [
      "Diagnoses unmatched LEFT JOIN keys -> NULL channel -> bucketed as 'Unknown'",
      "Traces it to the dim_campaign migration deleting legacy paid_search_v1 ids that stg_orders still references",
      "Confirms with a query that the 'Unknown' revenue maps to the orphaned legacy campaign_ids",
      "Fix: back-map/alias legacy ids (or keep deprecated dim rows) so historical orders resolve; add a not-null/relationship test",
    ],
    facts: [
      { q: "Did revenue actually change?", a: "No — total revenue is unchanged; it just moved from 'Paid Search' into 'Unknown'." },
      { q: "Which orders are 'Unknown'?", a: "The ones whose campaign_id (100/101/102) has no row in dim_campaign after the migration." },
      { q: "Was the dashboard changed?", a: "No. The mart's underlying dim_campaign keys changed; the dashboard logic is the same." },
    ],
  },

  /* 3 — standard */
  "inc-ae-report-doubled": {
    actualRootCause:
      "stg_addresses changed grain: it now stores both a 'billing' and a 'shipping' row per customer (an address_type column added last sprint), so `customer_id` is no longer unique there. The mart joins orders to addresses on customer_id, so each order for a customer with two address rows fans out into two rows — exactly doubling orders and lifetime-value for those customers, while single-address customers stay correct.",
    actualFix:
      "Collapse stg_addresses to one row per customer before the join — e.g. filter to a single address_type (or pivot billing/shipping into columns, or pre-aggregate). Then the join key is unique and the fan-out disappears. Add a dbt uniqueness test on the address grain so a future grain change fails CI instead of silently doubling the report.",
    contributingFactors: [
      "A grain change in stg_addresses (one row -> two rows per customer) without a corresponding model/test update",
      "Joining on a key assumed unique but now one-to-many",
      "No uniqueness test on the join key to catch the regression",
    ],
    rubric: [
      "Identifies the join fan-out: stg_addresses now has multiple rows per customer (billing + shipping)",
      "Confirms with a query that exactly the multi-address customers are doubled",
      "Explains why some customers are correct (single address) and others 2x",
      "Fix: dedup/pick one address per customer (e.g. filter address_type, or pre-aggregate) so the join key is unique; add a uniqueness test",
    ],
    facts: [
      { q: "Which customers are doubled?", a: "Exactly those with two address rows (billing+shipping): 101 and 104. Single-address customers are correct." },
      { q: "Did the orders table change?", a: "No — stg_orders still has 8 rows; the duplication is created by the join." },
    ],
  },

  /* 4 — hard */
  "inc-ae-incremental-late-updates": {
    actualRootCause:
      "The incremental filter is `WHERE created_at > (SELECT MAX(created_at) FROM this)`. `created_at` is set once at insert and never changes; mutations (refund/cancel/amount change) only advance `updated_at`. So when an old order is UPDATED, its created_at is still <= the mart's MAX(created_at) and the WHERE clause never re-selects it — the update is skipped forever. `unique_key='order_id'` can't help because the changed row is filtered out before the merge step ever runs. Only brand-new rows (newer created_at) flow through.",
    actualFix:
      "Watermark on the mutation timestamp: `WHERE updated_at >= (SELECT MAX(updated_at) FROM this) - <lookback>` (a small lookback window to absorb late/clock-skewed updates), keeping `unique_key='order_id'` so re-selected rows upsert in place. Backfill the missed mutations with one `--full-refresh`, then incrementals stay correct. (For high-churn tables, an explicit snapshot/CDC strategy is the robust option.)",
    contributingFactors: [
      "Mutable source rows (status/amount change in place) with a created_at that never moves",
      "Incremental watermark chosen on created_at rather than updated_at",
      "unique_key gives a false sense of safety — it only upserts rows the WHERE clause actually selects",
      "full-refresh masks the bug, so it looks 'fixed' until the next incremental run",
    ],
    rubric: [
      "Root cause: incremental watermark filters on created_at only, so mutated (updated) old rows are never re-selected",
      "Explains that unique_key upsert can't help because the changed rows are filtered out before the merge",
      "Confirms with a query that refunded orders have created_at <= mart MAX(created_at) but newer updated_at",
      "Explains why full-refresh masks it and incremental re-diverges",
      "Fix: watermark on updated_at (>= max(updated_at)) with a lookback window; keep unique_key for the upsert",
    ],
    facts: [
      { q: "What's the difference between created_at and updated_at here?", a: "created_at is set once at insert; updated_at advances on every mutation (refund, cancel, amount change)." },
      { q: "Why does full-refresh fix it?", a: "Full-refresh re-reads the whole source (no WHERE filter), so it picks up the current status of every row — then the next incremental diverges again." },
      { q: "Does unique_key='order_id' merge the refunds?", a: "No. The merge only sees rows the WHERE clause selected; refunded old rows are filtered out before the merge." },
    ],
  },

  /* 4b — hard (Snowflake pruning) */
  "inc-ae-snowflake-cast-pruning": {
    actualRootCause:
      "The predicate wraps the clustered column in a function: `WHERE TO_DATE(event_ts) = '2026-05-31'`. Snowflake prunes micro-partitions using the per-partition min/max of the RAW event_ts, but it cannot evaluate `TO_DATE(event_ts)` against that metadata at compile time (the function output isn't in the metadata), so it gives up on pruning and scans 100% of partitions. The query is functionally correct but does a full-table scan.",
    actualFix:
      "Make the predicate sargable on the raw column with a half-open range: `WHERE event_ts >= '2026-05-31' AND event_ts < '2026-06-01'`. This compares directly against the partition min/max, so Snowflake prunes to the relevant partitions (41 vs 48,212). General rule: never wrap the filtered/clustered column in a function or cast; apply the transform to the constant instead.",
    contributingFactors: [
      "Function/cast applied to the clustered column rather than to the constant",
      "Clustering on event_ts is wasted because the predicate is non-sargable",
      "Cost/latency invisible until profiled — the query 'works', it's just scanning everything",
    ],
    rubric: [
      "Root cause: TO_DATE(event_ts) wraps the clustered column in a function, defeating micro-partition pruning",
      "Explains that Snowflake prunes on raw-column min/max metadata, which a function output is not comparable to at compile time",
      "Confirms the rewritten sargable range returns the same rows as the cast predicate",
      "Fix: sargable half-open range on the raw event_ts (>= start AND < next day); avoid functions on the filtered column",
    ],
    facts: [
      { q: "Does the rewrite change the result?", a: "No — the half-open range returns the exact same rows as TO_DATE(event_ts) = '2026-05-31'." },
      { q: "Why does the sibling range query prune?", a: "It compares raw event_ts to constants, which Snowflake can match against per-partition min/max metadata at compile time." },
      { q: "Would adding a cluster key help?", a: "The table is already clustered on event_ts — the problem is the predicate, not the clustering." },
    ],
  },

  /* 7 — hard (cost / cross join) */
  "inc-ae-snowflake-cross-join-cost": {
    actualRootCause:
      "The model joins dim_users, dim_calendar, and fct_spend, but the dim_calendar JOIN has NO `ON` clause — it's an accidental cross join (Cartesian product). Every user row is paired with every calendar date BEFORE fct_spend constrains anything, so intermediate cardinality explodes (users x calendar x matched-spend), spilling to remote storage and burning ~9x the credits. The final GROUP BY collapses the rows so the RESULT is still correct, hiding the blow-up — the cost lives entirely in the exploded intermediate.",
    actualFix:
      "Add the missing join condition so calendar is constrained, not crossed: join dim_calendar via the spend date (e.g. fct_spend JOIN dim_calendar ON dim_calendar.calendar_date = fct_spend.spend_date), or drop dim_calendar if spend_date already carries the date. After the fix, intermediate cardinality is bounded by the matched spend rows and the model returns to ~40s. Add a regression guard (a row-count / explosion-factor assertion, or require ON clauses in review/CI).",
    contributingFactors: [
      "JOIN written without an ON clause -> implicit cross join Snowflake executes faithfully",
      "GROUP BY collapses the explosion so the output looks correct and the bug passes review",
      "No row-count / cost guardrail to catch a cardinality blow-up before it bills",
    ],
    rubric: [
      "Root cause: the dim_calendar JOIN has no ON clause -> accidental cross join (Cartesian product) blowing up intermediate cardinality",
      "Explains why the result is still correct (GROUP BY collapses) but the cost lives in the exploded intermediate / spill",
      "Confirms with a query that intermediate rows scale as users * calendar * matches",
      "Fix: add the missing join condition (calendar should constrain via fct_spend.spend_date, or join calendar to fct_spend, not cross); guard with a row-count/explosion test",
    ],
    facts: [
      { q: "Is the output wrong?", a: "No — the GROUP BY collapses the duplicates so the final numbers are correct; only the cost/runtime exploded." },
      { q: "What blew up the cost?", a: "Intermediate join cardinality: users x calendar dates (cross join) before fct_spend constrained it, causing a spill to remote storage." },
      { q: "Which join is broken?", a: "The dim_calendar join — it has no ON clause. The fct_spend join is fine." },
    ],
  },

  /* 8 — hellish (A/B SRM) */
  "inc-ae-ab-srm": {
    actualRootCause:
      "Sample-ratio mismatch from a bucketing identity bug. assignment.js keys the 50/50 hash on `userId ? userId : sessionId`. A user who is logged-out early in a session is bucketed by sessionId, then logs in and is re-bucketed by userId — two different keys, two independent hashes, so the same person can land in BOTH arms across their events. These dual-arm users inflate one arm's distinct-user count (here treatment), producing the SRM (chi-square p=4e-7). On top of that, the analysis joins conversions on user_id ONLY (no variant), so a dual-arm user's conversion attaches to whichever arm(s) they're exposed in — contaminating both arms' conversion rates. Because there's SRM, the +6% lift and its p-value are not trustworthy at all.",
    actualFix:
      "Bucket on a single stable identity: resolve identity (logged-in user id, or a durable pre-login id stitched to the user) BEFORE assignment, and make assignment sticky/idempotent so a user is only ever in one arm. Remove/repair dual-arm users from the analysis (dedup to first valid exposure), and join conversions on (user_id, variant) so a conversion can't attach to the wrong arm. Re-run the SRM check; only read the lift once the split passes. Until then, do NOT ship on this result.",
    contributingFactors: [
      "Bucketing key falls back userId -> sessionId, so identity isn't stable across login",
      "Assignment isn't enforced one-arm-per-user / idempotent across the login transition",
      "Conversion join keyed on user_id only (no variant), enabling cross-arm conversion attribution",
      "Logged-in transition mid-session is exactly when the two keys diverge",
    ],
    redHerrings: [
      "'The +6% is significant (p<0.001) so it's real' — irrelevant under SRM; the imbalance invalidates the inference",
      "'Treatment is just more popular / users self-selected' — it's a deterministic split, not self-selection; the imbalance is a bucketing bug",
      "'Underpowered / need more sample' — more data won't fix a systematic assignment bias",
      "'Bot filtering removed users unevenly' — nothing in the artifacts points to bots; the dual-key fallback explains it",
    ],
    triageOrder: [
      "Block the launch decision: SRM present -> result is untrustworthy, communicate that first",
      "Quantify the SRM and find the both-arms users (query exposures for user_ids in both 'control' and 'treatment')",
      "Root-cause to the userId/sessionId fallback in assignment.js and the variant-less conversion join",
      "Fix assignment (stable identity, one arm per user) + analysis (join on user_id+variant, dedup), re-run SRM, then re-read the lift",
    ],
    rubric: [
      "Treats SRM as a blocker: refuses to trust the lift/p-value until the imbalance is explained",
      "Root cause: bucketing key falls back userId -> sessionId; users who log in mid-session get bucketed under two keys and land in BOTH arms",
      "Confirms with a query that specific users appear in both 'control' and 'treatment' exposures (and their conversions are double-attached)",
      "Identifies the secondary contamination: conversion join on user_id only, no variant key",
      "Fix: one stable identity per user for bucketing (resolve identity before assignment), enforce one-arm-per-user, dedup both-arms users; re-run SRM check before reading results",
      "Does NOT chase the red herrings (it's not the +6% being 'real', not just a stats-power issue)",
    ],
    facts: [
      { q: "What does SRM mean for the result?", a: "The observed/expected split differs more than chance (p=4e-7); the randomization is broken, so the lift and its p-value can't be trusted." },
      { q: "Which users break it?", a: "Users 100/101/102 appear in BOTH 'control' and 'treatment' exposures — they were bucketed once by sessionId (logged-out) and again by userId (logged-in)." },
      { q: "Why does the conversion get double-counted?", a: "The conversion join is on user_id only (no variant), so a dual-arm user's conversion attaches to every arm they're exposed in." },
      { q: "Is the timezone or sample size the issue?", a: "No — it's a deterministic assignment/identity bug, not power or timing." },
    ],
  },

  /* 9 — hellish (revenue recon; timezone red herring) */
  "inc-ae-revenue-recon-late-partition": {
    actualRootCause:
      "Two real things, one red herring. The model INNER JOINs fct_orders to fct_payments, so any order with no matching payment row is silently dropped. For 2026-05-30 the payments partition landed LATE — the loader for the last hours of the day hadn't completed when the model ran — so several already-paid orders had no fct_payments row yet and were dropped by the inner join, producing the 18% shortfall. The timezone/day-boundary theory is a RED HERRING: order_date is already a clean PT calendar date and the ledger groups by the same PT date, so shifting +/- a day does not close the gap. Earlier days reconcile because their payment partitions were complete when the model ran.",
    actualFix:
      "Stop dropping unpaid-in-the-warehouse orders: LEFT JOIN orders to payments (or source revenue from fct_orders and use payments only to derive status), so a missing/late payment row no longer deletes the order's revenue. Gate the model on payments-partition completeness/freshness (don't run daily_revenue until the 2026-05-30 payments partition is fully loaded), and backfill/re-run once the partition lands. Add a recon assertion (orders-with-no-payment count) so a late partition is surfaced, not silently dropped.",
    contributingFactors: [
      "INNER join treats 'payment row not loaded yet' the same as 'order not paid' and drops the row",
      "Payments partition for the affected day landed late / partially when the model ran",
      "No completeness/freshness gate on the payments source before the recon model runs",
      "The plausible PT/UTC timezone story distracts from the join+lateness cause",
    ],
    redHerrings: [
      "PT/UTC timezone day-boundary: order_date is already a clean PT date and the ledger uses the same PT date; shifting the boundary does NOT close the gap",
      "'Amounts are wrong / a price change' — per-order amounts are correct; it's rows being dropped, not mis-valued",
      "'Duplicate payments inflating/deflating' — there are no dup payment rows; rows are MISSING, not duplicated",
    ],
    triageOrder: [
      "Mitigate: hold the recon alert / don't let an incomplete-partition number page finance as final",
      "Confirm or KILL the timezone theory first (shift the boundary, check midnight orders) before chasing it",
      "Root-cause: query 2026-05-30 orders with no fct_payments row; tie to the late payments partition + inner join",
      "Fix: LEFT JOIN (or order-sourced revenue) + a payments-partition completeness gate; backfill once the partition lands",
    ],
    rubric: [
      "Explicitly tests and REJECTS the timezone red herring (order_date already PT; shifting days doesn't close the gap)",
      "Root cause: INNER join to fct_payments drops orders whose payment row hadn't landed (late/partial payments partition)",
      "Confirms with a query that the missing revenue = the 2026-05-30 orders with no fct_payments row",
      "Explains why earlier days reconcile (their payment partitions were complete) and why it's intermittent",
      "Fix: LEFT JOIN (or revenue from orders, payments only for status) + a freshness/completeness gate on the payments partition before running; backfill once the partition lands",
      "Gets triage right: confirm/kill the timezone theory before chasing it; mitigate by holding the recon alert",
    ],
    facts: [
      { q: "Does shifting the day boundary close the gap?", a: "No. order_date is already a clean PT date and the ledger uses the same PT date; no orders sit near midnight. Timezone is not the cause." },
      { q: "Which orders are missing from the mart for 2026-05-30?", a: "The orders with no row in fct_payments yet (the late-landing payments partition) — they're dropped by the INNER join." },
      { q: "Why did earlier days reconcile?", a: "Their payments partitions were fully loaded when the model ran, so every order matched a payment row." },
      { q: "Are the per-order amounts wrong?", a: "No — amounts are correct; the shortfall is dropped rows, not mis-valued ones." },
    ],
  },
};
