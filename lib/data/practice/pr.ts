import type { ConvItem } from "./types";

/**
 * PR Review track ("pr") — multi-file, GitHub-style review. The candidate reviews
 * an interconnected pull request, comments across files (file + line anchored), and
 * the interviewer probes. The files live client-side in pr-review-code.ts (attached
 * in index.ts); the planted cross-file issues stay server-only in
 * review-scenarios.server.ts. Flagship is hand-authored; rest via gen_review.py.
 */
export const PR_ITEMS: ConvItem[] = [
  {
    id: "pr-recon-daily-revenue",
    category: "pr",
    level: "senior",
    title: "Review a daily revenue reconciliation PR",
    company: "Fintech",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt: [
      "**PR #482 — Add daily revenue reconciliation**",
      "",
      "A teammate opened this PR to flag when revenue in the OLTP `orders` table drifts",
      "from what lands in the warehouse `fct_orders`, paging on-call if they diverge. Three",
      "files: `extract.py` (pull both sides), `compare.py` (diff them), `job.py` (orchestrate + alert).",
      "",
      "It passes the happy-path test and looks clean — but reconciliation lives and dies on",
      "edge cases. Review it like a real PR: comment on the lines you'd block on (select a span,",
      "pick a category), and push back when the interviewer asks. There's at least one bug that",
      "only shows up when the two files interact.",
    ].join("\n"),
    hints: [
      "Reconciliation must catch discrepancies in BOTH directions — rows missing from the target AND extra/duplicate rows in it. Which join does compare.py use?",
      "These are money amounts from two systems. Look hard at how they're compared, and at how 'missing' is counted when an id can repeat.",
      "Read job.py against compare.py's return value: does the success/alert condition actually use everything the report contains?",
      "Both extract queries say CURRENT_DATE — but on which clock? created_at is UTC, order_date is local.",
    ],
    idealAnswer: "", // built server-side from the scenario issues (resolveItem in grade route)
    rubric: [
      "Catches the UTC-vs-local day-boundary skew between the two extract queries",
      "Flags the inner merge missing target-only extras/duplicates (outer join + indicator)",
      "Flags float equality on monetary amounts (compare in cents / with tolerance)",
      "Spots the row-count `missing` math breaking under duplicate keys",
      "Identifies the cross-file bug: job.py's success gate ignores `missing`/extras",
    ],
  },
];
