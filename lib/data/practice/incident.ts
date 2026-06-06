import type { ConvItem } from "./types";

/**
 * Incident Debugging track — production "find the root cause" scenarios. The
 * candidate reads artifacts (code/logs/config), investigates by running SQL/Python
 * in-browser, asks the coach, then submits a root-cause + fix that's graded. The
 * diagnosed answer lives server-side in incidents.server.ts (resolved by problemId).
 * Flagship is hand-authored; the role sets come from the per-role authoring agents.
 */

const ROLLUP_SQL = `-- daily_revenue.sql  (the production daily rollup)
SELECT
  event_day,
  SUM(amount) AS revenue
FROM order_events
GROUP BY event_day
ORDER BY event_day;
`;

const DEDUP_PY = `# dedup.py — runs over the order-event stream BEFORE the rollup.
# Orders can be re-emitted on consumer retry (at-least-once delivery).
def dedup(events):
    seen = set()
    out = []
    for e in events:
        if e["event_id"] in seen:   # skip events we've already processed
            continue
        seen.add(e["event_id"])
        out.append(e)
    return out
`;

const ONCALL_LOG = `[2026-05-21 00:14:02] revenue-rollup  INFO   peak-day pipeline started
[2026-05-21 00:14:09] order-consumer  WARN   consumer group rebalanced (load spike)
[2026-05-21 00:14:09] order-consumer  WARN   reprocessing from last committed offset
[2026-05-21 00:31:55] revenue-rollup  INFO   daily revenue 2026-05-21 = $772.00
[2026-05-21 07:48:10] finance-recon   ERROR  revenue mismatch: rollup=$772.00 finance=$580.00 (+33%)
[2026-05-21 07:49:01] oncall          NOTE   amounts spot-checked, all correct. row counts look high?
`;

const SETUP_SQL = `CREATE TABLE order_events (
  event_id INTEGER,
  order_id INTEGER,
  amount   DECIMAL(10,2),
  event_day DATE,
  is_retry BOOLEAN
);
INSERT INTO order_events VALUES
  -- 2026-05-20  normal day: 5 distinct orders, no retries
  (1,  1001, 19.99,  DATE '2026-05-20', false),
  (2,  1002, 49.00,  DATE '2026-05-20', false),
  (3,  1003, 9.99,   DATE '2026-05-20', false),
  (4,  1004, 120.00, DATE '2026-05-20', false),
  (5,  1005, 15.50,  DATE '2026-05-20', false),
  -- 2026-05-21  peak day: 6 distinct orders, several re-emitted on retry (dupes)
  (6,  2001, 25.00,  DATE '2026-05-21', false),
  (7,  2001, 25.00,  DATE '2026-05-21', true),
  (8,  2002, 80.00,  DATE '2026-05-21', false),
  (9,  2002, 80.00,  DATE '2026-05-21', true),
  (10, 2002, 80.00,  DATE '2026-05-21', true),
  (11, 2003, 12.00,  DATE '2026-05-21', false),
  (12, 2004, 200.00, DATE '2026-05-21', false),
  (13, 2004, 200.00, DATE '2026-05-21', true),
  (14, 2005, 5.00,   DATE '2026-05-21', false),
  (15, 2006, 60.00,  DATE '2026-05-21', false);
`;

export const INCIDENT_ITEMS: ConvItem[] = [
  {
    id: "inc-de-prime-day-double-revenue",
    category: "incident",
    level: "senior",
    title: "Peak-day revenue is overstated by a third",
    company: "FAANG · retail",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: on peak day, the daily revenue rollup reported $772 but finance's independent total is $580 — a 33% overstatement that paged the whole org. Spot-checks show every order's amount is correct. The rollup query and the dedup step look fine at a glance. You have the order-event data, the rollup, the dedup code, and the on-call log. Investigate, then submit the root cause and the fix.",
    hints: [
      "Amounts are correct but the total is too high — so the row COUNT being summed is probably inflated. Query for duplicate order_ids on the peak day.",
      "Read dedup.py carefully: what column does it dedupe on, and is that column unique per emission or per order?",
      "Ask yourself why this only shows up on peak day — what scales with load? (Look at the consumer rebalance/retry lines in the log.)",
      "Don't get pulled into the timezone/day-boundary theory — confirm the windows line up first, then drop it.",
    ],
    idealAnswer: "", // built server-side from incidents.server.ts (resolveItem)
    rubric: [
      "Runs a query to find duplicate order_ids before concluding (investigates, doesn't guess)",
      "Root cause: at-least-once retries emit duplicate order events; dedup is keyed on event_id (unique) not order_id",
      "Explains why it only manifests at peak (retry/duplicate rate scales with load)",
      "Fix: dedup by order_id + idempotent upsert sink + backfill the day",
      "Triage: mitigate the alert before chasing root cause; doesn't chase the timezone red herring",
    ],
    incident: {
      brief:
        "Daily revenue for 2026-05-21 (peak day) reads $772; finance's independent number is $580 (+33%). Per-order amounts are all correct on spot-check. The rollup and dedup 'look fine'. Find the root cause and the fix.",
      severity: "SEV-1 · finance-facing",
      tier: "hellish",
      artifacts: [
        { name: "pipeline/daily_revenue.sql", kind: "code", language: "sql", content: ROLLUP_SQL },
        { name: "pipeline/dedup.py", kind: "code", language: "python", content: DEDUP_PY },
        { name: "logs/oncall.log", kind: "log", language: "text", content: ONCALL_LOG },
      ],
      sql: { setupSql: SETUP_SQL, tables: ["order_events"] },
      python: true,
    },
  },
];
