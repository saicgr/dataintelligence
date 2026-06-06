import "server-only";
import { GENERATED_REVIEW_SCENARIOS } from "./review-scenarios.generated.server";

/**
 * SERVER-ONLY review scenarios for the interactive review interview.
 *
 * For each review item (keyed by problemId) this holds the planted ISSUES (each
 * anchored to a line range), the escalating FOLLOW-UPS the interviewer uses when
 * the candidate comments near that line, the revealable FACTS (clarifications
 * like dataset sizes the candidate can ask about), and the grading rubric. None
 * of this ever reaches the client — the code under review lives client-side in
 * review-code.ts; the answer key (issues/followups/facts) stays here.
 *
 * GENERATED (seeded by hand for the flagship item; scripts/gen_review.py
 * regenerates from scripts/review_items.json).
 */

export interface ReviewIssue {
  /**
   * Multi-file PR review only: which file this issue lives in (matches a
   * `review.files[].name`). Omitted for single-file review items. A bug that
   * spans files is modelled as one issue per file site, linked by a shared `topic`.
   */
  file?: string;
  /** 1-indexed inclusive line range in the artifact under review. */
  lines: [number, number];
  /** Short label, e.g. "Keyless join → cartesian product". */
  topic: string;
  /** Why it's wrong / risky (interviewer + grader context). */
  why: string;
  /** The fix. */
  fix: string;
  /** Escalating probes the interviewer asks once the candidate flags this issue (≤3 used). */
  followups: string[];
  /** What a strong candidate covers across the thread (for the grader). */
  idealPoints: string[];
}

export interface ReviewScenario {
  /** Clarifications the interviewer may reveal when asked (dataset sizes, SLAs, volumes…). */
  facts: { q: string; a: string }[];
  /** Planted issues, anchored to line ranges. */
  issues: ReviewIssue[];
  /** Overall grading rubric (coverage + depth under follow-ups). */
  rubric: string[];
}

const SEED_SCENARIOS: Record<string, ReviewScenario> = {
  "cr-pyspark-multi-fault-perf": {
    facts: [
      { q: "How big are the datasets / row counts?", a: "customers ≈ 10M rows (~3 GB parquet); policies ≈ 2 rows — a tiny static lookup dimension." },
      { q: "What is the policies table?", a: "A small reference dimension mapping policy_id → policy_type (~2 rows)." },
      { q: "What's the join key between the tables?", a: "Both tables share policy_id." },
      { q: "What does the error / log say?", a: "An executor task died with java.lang.OutOfMemoryError: Java heap space (stage 10, task 2.0)." },
      { q: "What's the executor memory / cluster size?", a: "Modest: a handful of executors at ~4 GB heap each — not enough for one task to hold the whole dataset." },
    ],
    issues: [
      {
        lines: [1, 1],
        topic: "Wrong import path (non-runnable)",
        why: "`from spark.sql import SparkSession` imports a module that doesn't exist; it's `pyspark.sql`. The script fails at import time.",
        fix: "from pyspark.sql import SparkSession",
        followups: ["Will this script even start — what happens at import time?", "What's the correct module path?"],
        idealPoints: ["Recognises the import is wrong / the script won't run", "Gives pyspark.sql"],
      },
      {
        lines: [12, 12],
        topic: "Keyless join → cartesian product (root cause)",
        why: "`customers.join(policies)` with no `on` condition is a cross join (N×M). With ~10M × 2 it explodes intermediate data and is the primary OOM driver — and it's also logically wrong.",
        fix: "customers.join(F.broadcast(policies), on='policy_id', how='inner')",
        followups: [
          "What does a join with no join condition actually produce?",
          "customers is ~10M rows and policies is ~2 rows — what does that cross join cost?",
          "policies is tiny — what join strategy would avoid a shuffle entirely?",
          "What if policies were 50 GB instead of 2 rows — does broadcast still help, and what would you do then?",
        ],
        idealPoints: ["Spots the missing join condition / cartesian product", "Names the correct join key (policy_id)", "Broadcast join for the small side", "Knows the broadcast threshold and the fallback at scale (sort-merge / AQE skew handling)"],
      },
      {
        lines: [15, 15],
        topic: "Filter not pushed down; column-case fragility",
        why: "The filter runs AFTER the (exploded) join instead of before it, and the schema column is `region` (lowercase) — relying on Spark's default case-insensitivity is fragile.",
        fix: "Filter customers on region BEFORE the join; match the real column name `region`.",
        followups: ["Where should this filter run relative to the join, and why?", "The schema column is `region` — is `F.col(\"Region\")` safe to rely on?"],
        idealPoints: ["Predicate pushdown: filter before the join", "Flags the Region/region case risk"],
      },
      {
        lines: [18, 19],
        topic: "Two actions recompute the whole lineage",
        why: "`show(1)` and `count()` each trigger a separate job that re-reads, re-joins and re-filters; nothing is cached, and `count()` is a full scan just for a log line.",
        fix: "Remove the QA logging from the production path, or `.cache()`/`.persist()` if both are truly needed.",
        followups: ["How many Spark jobs does this trigger, and what gets recomputed each time?", "If you must keep both, how do you avoid recomputing the pipeline?"],
        idealPoints: ["Understands lazy evaluation — each action recomputes the lineage", "cache/persist or drop the logging"],
      },
      {
        lines: [22, 22],
        topic: "repartition(1) → single-task executor OOM",
        why: "`repartition(1)` forces a full shuffle into ONE partition, so a single task on one executor must hold the entire dataset in heap → java.lang.OutOfMemoryError: Java heap space (the log line). It also kills write parallelism.",
        fix: "Drop repartition(1); let Spark write multiple part-files. If a small file count is required, `coalesce(N)` with a sane N; add `.mode('overwrite')`.",
        followups: [
          "The job died with OutOfMemoryError: Java heap space — which line is the most likely cause, and why?",
          "How would you get a small number of output files WITHOUT funnelling everything into one task?",
          "coalesce vs repartition — what's the difference, and which fits here?",
        ],
        idealPoints: ["Links repartition(1) to the executor OOM", "coalesce vs repartition / let Spark write multiple files", "Adds write mode"],
      },
    ],
    rubric: [
      "Finds the keyless cartesian join (root cause) and names the correct join key",
      "Recommends a broadcast join for the tiny policies table AND knows when it stops working at scale",
      "Links repartition(1) to the executor OutOfMemoryError and proposes coalesce / multiple output files",
      "Flags predicate pushdown (filter before join) and the Region/region case issue",
      "Notes the wrong import and the double-action recompute (cache or remove QA logging)",
      "Reasons well under follow-ups about scale — e.g. what to do if the small side grows",
    ],
  },

  // ── Multi-file PR review (category "pr") — daily revenue reconciliation ──
  // Issues are file-scoped (issue.file matches a review.files[].name). The success
  // gate in job.py depends on compare.py's incomplete report — the cross-file bug.
  "pr-recon-daily-revenue": {
    facts: [
      { q: "What is this job for?", a: "A daily check that revenue in the OLTP `orders` table matches what landed in the warehouse `fct_orders`, paging on-call if they diverge." },
      { q: "What time zone is created_at?", a: "`created_at` is a UTC timestamp; the warehouse `order_date` is a date in America/New_York business time. Orders near midnight land on different calendar days in the two systems." },
      { q: "Can order_id repeat in the warehouse?", a: "Yes — a known late-arriving/replay path can land a row twice in `fct_orders` before dedup runs, so duplicates do occur." },
      { q: "Are amounts integers or floats?", a: "Dollars stored as floating-point (e.g. 19.99); they come from two systems with independent rounding." },
      { q: "How many rows per day?", a: "~200k orders/day — small enough for pandas, large enough that a few mismatches hide easily." },
    ],
    issues: [
      {
        file: "recon/extract.py",
        lines: [5, 8],
        topic: "Day-boundary mismatch (UTC vs local) → false missing/extra",
        why: "Source filters `created_at::date = CURRENT_DATE` (UTC) while the target filters `order_date = CURRENT_DATE` (local business date). Orders placed near midnight fall on different calendar days in the two systems, so they look 'missing' on one side and 'extra' on the next run. The two windows must be defined on the same clock.",
        fix: "Normalize both to the same business time zone (convert created_at to the warehouse's local date) and reconcile the same window on both sides.",
        followups: [
          "The two queries both say 'CURRENT_DATE' — are they actually selecting the same set of orders?",
          "created_at is UTC and order_date is local — what happens to an order placed at 11:50pm local?",
          "How would you make the two day-windows line up so a midnight order isn't counted as missing one day and extra the next?",
        ],
        idealPoints: ["Spots created_at(UTC) vs order_date(local) boundary skew", "Explains the midnight false-missing/false-extra", "Aligns both windows on one time zone"],
      },
      {
        file: "recon/compare.py",
        lines: [3, 3],
        topic: "Inner merge hides target-only rows (extras/dupes)",
        why: "`source.merge(target, on='order_id')` is an inner join, so rows that exist ONLY in the target (warehouse extras, double-loaded duplicates) vanish from `merged` and are never reported. Reconciliation must catch BOTH directions: missing-in-target AND extra-in-target.",
        fix: "Use an outer merge with `indicator=True` and report left_only (missing) and right_only (extra) separately.",
        followups: [
          "This is an inner join — what kind of discrepancy can it never detect?",
          "The warehouse can double-load a row — would this code ever notice an extra/duplicate?",
          "How would you report missing and extra rows separately?",
        ],
        idealPoints: ["Inner join only catches one direction", "Outer join + indicator", "Reports extras/duplicates too"],
      },
      {
        file: "recon/compare.py",
        lines: [4, 4],
        topic: "Float equality on money",
        why: "`amount_src == amount_tgt` compares floating-point dollars from two systems; 19.99 vs 19.990000001 (or different rounding) reports a spurious mismatch — or masks a real 1-cent drift. Money must be compared at fixed precision.",
        fix: "Compare in integer cents, or round to 2 dp / use a tolerance (e.g. abs(diff) < 0.005).",
        followups: [
          "These amounts are floats from two systems — is `==` safe here?",
          "What's a more robust way to compare monetary values?",
        ],
        idealPoints: ["Recognises float-equality hazard on money", "Cents/rounding/tolerance fix"],
      },
      {
        file: "recon/compare.py",
        lines: [7, 7],
        topic: "Row-count diff breaks under duplicates",
        why: "`missing = len(source) - len(merged)` assumes a clean 1:1 join. If order_id duplicates in the target, the inner merge fans out and `len(merged)` can exceed `len(source)`, making `missing` zero or negative even when rows are genuinely absent. Count by set difference of keys, not lengths.",
        fix: "missing = number of source order_ids with no match in target (set difference), independent of row counts.",
        followups: [
          "If a single order_id appears twice in the target, what does len(merged) do — and what does that make `missing`?",
          "How would you count missing rows without relying on row counts?",
        ],
        idealPoints: ["Sees the fan-out from duplicate keys", "Set-difference of ids, not length math"],
      },
      {
        file: "recon/job.py",
        lines: [6, 7],
        topic: "Success gate ignores missing/extra (cross-file)",
        why: "The on-call is paged 'clean' whenever `mismatches == 0`, but the report also carries `missing` (and, once fixed, extras) — those are ignored, so a day where 500 rows never landed is reported as healthy. This is the cross-file bug: job.py trusts an incomplete report from compare.py.",
        fix: "Gate on all discrepancy classes: alert/clean only when mismatches == 0 AND missing == 0 AND extras == 0; otherwise page with the breakdown.",
        followups: [
          "The report has a `missing` field — does this success check ever look at it?",
          "If 500 orders never reached the warehouse, what would this code do?",
          "Once compare.py also reports extras, how should this gate change?",
        ],
        idealPoints: ["Gate ignores missing (and extras)", "Connects it to compare.py's report shape", "Correct multi-condition gate"],
      },
    ],
    rubric: [
      "Catches the UTC-vs-local day-boundary skew across the two extract queries",
      "Flags the inner merge — reconciliation misses target-only extras/duplicates (needs outer + indicator)",
      "Flags float equality on money (compare in cents / with tolerance)",
      "Spots the row-count `missing` math breaking under duplicate keys (set difference instead)",
      "Identifies the cross-file bug: job.py's success gate ignores `missing`/extras from compare.py's report",
      "Reasons under follow-ups about reconciling both directions and aligning the day windows",
    ],
  },
};

export const REVIEW_SCENARIOS: Record<string, ReviewScenario> = {
  ...GENERATED_REVIEW_SCENARIOS,
  ...SEED_SCENARIOS,
};

export function getReviewScenario(problemId: string): ReviewScenario | null {
  return REVIEW_SCENARIOS[problemId] ?? null;
}

/**
 * The issue whose line range contains (or is nearest to) `line`, within a small
 * tolerance. For multi-file PR review, pass `file` to scope the search to issues
 * in that file; single-file callers omit it and only match issues with no `file`.
 */
export function issueForLine(
  scenario: ReviewScenario,
  line: number,
  tolerance = 2,
  file?: string
): ReviewIssue | null {
  let best: ReviewIssue | null = null;
  let bestDist = Infinity;
  for (const iss of scenario.issues) {
    // file-aware scoping: pr items match by filename; single-file items match the no-file issues.
    if (file !== undefined ? iss.file !== file : iss.file !== undefined) continue;
    const [a, b] = iss.lines;
    const dist = line < a ? a - line : line > b ? line - b : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = iss;
    }
  }
  return best && bestDist <= tolerance ? best : null;
}
