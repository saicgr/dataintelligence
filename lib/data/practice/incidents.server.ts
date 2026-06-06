import "server-only";
import { GENERATED_INCIDENTS } from "./incidents.generated.server";
import { INCIDENT_DE_SCENARIOS } from "./incident-de.server";
import { INCIDENT_AE_SCENARIOS } from "./incident-ae.server";
import { INCIDENT_STREAM_SCENARIOS } from "./incident-stream.server";
import { INCIDENT_MLE_SCENARIOS } from "./incident-mle.server";
import { INCIDENT_AIE_SCENARIOS } from "./incident-aie.server";
import { INCIDENT_DBA_SCENARIOS } from "./incident-dba.server";
import { INCIDENT_SRE_SCENARIOS } from "./incident-sre.server";

/**
 * SERVER-ONLY answer key for the Incident Debugging track.
 *
 * For each incident (keyed by problemId) this holds the diagnosed root cause, the
 * fix, contributing factors, any red herrings (for hellish incidents), the triage
 * order, the grading rubric, and the facts the coach MAY reveal when asked. None of
 * this reaches the client — the brief, artifacts and investigation data live on the
 * item (client-visible); the diagnosis lives here. `import "server-only"` is the
 * enforcement boundary. Resolved by problemId in grade/route.ts + chat/route.ts.
 */
export interface IncidentScenario {
  actualRootCause: string;
  actualFix: string;
  contributingFactors: string[];
  /** Plausible-but-wrong leads (hellish incidents). The grader penalizes chasing these. */
  redHerrings?: string[];
  /** The order a strong responder acts in — usually mitigate → root-cause → prevent. */
  triageOrder?: string[];
  /** Coverage + depth the grader scores against. */
  rubric: string[];
  /** Clarifications the coach may reveal when asked (never the root cause itself). */
  facts?: { q: string; a: string }[];
}

const SEED_INCIDENTS: Record<string, IncidentScenario> = {
  // Flagship hand-authored hellish incident — proves the format end-to-end.
  // (Investigate via the SQL console: orders vs warehouse fct_orders.)
  "inc-de-prime-day-double-revenue": {
    actualRootCause:
      "The streaming order-aggregation is at-least-once and the daily revenue rollup SUMs an `events` stream that contains duplicate order events (same order_id, different event_id) emitted on consumer retries. Under normal load dupes are rare and a downstream dedup step hides them; on peak day the retry rate spikes, so duplicates exceed what the (wrongly-keyed) dedup catches and revenue is overstated. The dedup is keyed on event_id (always unique) instead of order_id, so it never actually dedupes orders.",
    actualFix:
      "Dedup on the business key (order_id), not event_id — e.g. keep the last event per order_id (or SUM over a DISTINCT-by-order_id set), and make the sink idempotent (MERGE/upsert by order_id). Backfill the affected day by recomputing from a deduped set.",
    contributingFactors: [
      "At-least-once delivery from the source stream",
      "Dedup keyed on event_id (unique per emission) rather than order_id",
      "Only manifests at peak because retry rate (hence duplicate rate) scales with load",
    ],
    redHerrings: [
      "The timezone/day-boundary on the rollup looks suspicious but the windows line up correctly — not the cause",
      "A recent price change is coincidental; per-order amounts are correct, it's the row COUNT that's inflated",
    ],
    triageOrder: [
      "Mitigate: hold/flag the revenue alert and serve last-known-good, don't let bad numbers page finance",
      "Root-cause: query the events for duplicate order_ids on the peak day, confirm dedup key is wrong",
      "Prevent: dedup by order_id + idempotent upsert sink + a row-count vs distinct-order_id assertion",
    ],
    rubric: [
      "Investigates rather than guesses — runs a query to find duplicate order_ids before concluding",
      "Identifies the at-least-once + duplicate-events root cause (not the timezone red herring)",
      "Spots that the dedup is keyed on the wrong column (event_id vs order_id)",
      "Explains WHY it only shows at peak (retry rate scales with load)",
      "Proposes a correct fix: dedup by order_id + idempotent sink + backfill",
      "Gets triage order right: mitigate the alert before chasing root cause",
    ],
    facts: [
      { q: "How big is peak day vs normal?", a: "~20× order volume; retries (and thus duplicate events) rise super-linearly under that load." },
      { q: "Are the per-order amounts correct?", a: "Yes — spot-checks show amounts are right; the inflation is in the number of rows summed." },
      { q: "Is there a dedup step?", a: "Yes, there's a dedup before the rollup — it keys on event_id." },
      { q: "Do the day windows line up across systems?", a: "Yes, both use the same business-local day; the boundary is not the issue." },
    ],
  },
};

export const INCIDENT_SCENARIOS: Record<string, IncidentScenario> = {
  ...GENERATED_INCIDENTS,
  ...INCIDENT_DE_SCENARIOS,
  ...INCIDENT_AE_SCENARIOS,
  ...INCIDENT_STREAM_SCENARIOS,
  ...INCIDENT_MLE_SCENARIOS,
  ...INCIDENT_AIE_SCENARIOS,
  ...INCIDENT_DBA_SCENARIOS,
  ...INCIDENT_SRE_SCENARIOS,
  ...SEED_INCIDENTS,
};

export function getIncidentScenario(problemId: string): IncidentScenario | null {
  return INCIDENT_SCENARIOS[problemId] ?? null;
}
