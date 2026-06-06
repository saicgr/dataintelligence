import type { ArcStep } from './content';
import type { TrackColorKey } from './theme';

/**
 * Pillar 1 — "Explain it fully" articulation scenarios.
 *
 * The user knows the concept but can't PRODUCE the full senior explanation under
 * pressure. Each scenario opens with teaching-expectancy framing, makes the user
 * answer out loud (produce-before-reveal), then reveals the senior "arc" and a
 * BINARY rubric (criteria-referenced, not a 1–5 vanity slider). Checklist
 * completeness feeds the spaced-repetition scheduler.
 *
 * These are bundled seeds; the build-time author/verifier pipeline emits more in
 * the same shape, shipped via the same OTA/remote path as fresh cards.
 */
export interface Scenario {
  id: string;
  domain: 'ai' | 'de';
  tk: TrackColorKey;
  tool: string;
  framing: string; // "A new hire asks you to explain…"
  prompt: string; // the thing to answer out loud
  arc: ArcStep[]; // the senior model answer, step by step
  rubric: string[]; // binary criteria to self-check against the revealed answer
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'scn-spark-oom',
    domain: 'de',
    tk: 'spark',
    tool: 'Spark',
    framing:
      'A new hire pings you: "The nightly Spark job keeps failing with an OutOfMemoryError in prod. Can you explain what\'s actually happening and how you\'d fix it?" Walk them through it end to end.',
    prompt: 'Explain why a Spark job OOMs in production — and how you diagnose and fix it.',
    arc: [
      {
        label: 'Symptom',
        body: 'An executor (or the driver) dies with OutOfMemoryError; you see failed tasks, retries, and often heavy disk spill or long GC pauses in the Spark UI before the crash.',
      },
      {
        label: 'Diagnose (before touching config)',
        body: 'Open the Spark UI. Is it the driver or an executor? Look at the stages tab for shuffle read/write size, task-level skew (one task 100× the others), spill (memory→disk), and GC time. Diagnose which component and which stage before changing anything.',
      },
      {
        label: 'Root cause (name the real one)',
        body: 'Usually one of: data skew (a hot key), an oversized broadcast join, collect()/toPandas() pulling a huge result to the driver, too few or skewed shuffle partitions, or genuinely insufficient memory. "Add more RAM" is the junior reflex — name the actual mechanism first.',
      },
      {
        label: 'Fix (match the cause)',
        body: 'Skew → salt the key or enable AQE skew join. Oversized broadcast → raise/lower the broadcast threshold or switch to sort-merge. collect-to-driver → don\'t; write out or aggregate. Too-few partitions → repartition / raise spark.sql.shuffle.partitions to fit memory. Only then consider more executor memory.',
      },
      {
        label: 'Trade-off',
        body: 'More partitions = more shuffle overhead and small-file risk; more memory = higher cost and possible GC pressure; salting adds a stage. State which you chose and why for this workload.',
      },
      {
        label: 'Prevent & quantify',
        body: 'Add spill/GC monitoring and a skew alert; pin shuffle partitions; cite before/after, e.g. "runtime 42→9 min, no spill, cluster cost down ~30%."',
      },
    ],
    rubric: [
      'Diagnosed in the Spark UI (driver vs executor, skew, spill, GC) BEFORE changing config',
      'Named the real root cause (skew / broadcast / collect-to-driver / too-few partitions) — not just "add RAM"',
      'Gave a fix that matches that specific cause',
      'Named a trade-off of the fix',
      'Quantified impact or added prevention/monitoring',
    ],
  },
  {
    id: 'scn-kafka-lag',
    domain: 'de',
    tk: 'kafka',
    tool: 'Kafka',
    framing:
      'A teammate says: "Consumer lag on our orders topic keeps growing and we\'re falling behind real-time. Explain what\'s going on and how you\'d fix it without losing or double-processing orders."',
    prompt: 'Explain growing Kafka consumer lag — diagnosis, fix, and the delivery trade-off.',
    arc: [
      { label: 'Symptom', body: 'Committed offset falls further behind the log end offset; end-to-end latency climbs; lag metric grows monotonically.' },
      { label: 'Diagnose', body: 'Is consumption < production rate? Check per-partition lag (is it ALL partitions or one hot partition = skewed keys?), consumer count vs partition count, processing time per record, and rebalance storms.' },
      { label: 'Root cause', body: 'Common: too few partitions to parallelize, a slow/blocking processing step, uneven key distribution, or frequent rebalances. Max parallelism = partition count, so extra consumers past that sit idle.' },
      { label: 'Fix', body: 'Speed up per-record work (batch/async I/O), add partitions + consumers up to the partition count, fix key skew, and tune max.poll.records / poll interval to stop rebalance churn.' },
      { label: 'Trade-off', body: 'Adding partitions breaks per-key ordering guarantees and can\'t be reduced later; more consumers help only up to partition count. Note the ordering cost.' },
      { label: 'Delivery semantics', body: 'Decide at-least-once (commit after processing, handle duplicates idempotently) vs exactly-once (transactions). Quantify: lag back to ~0, p99 latency target met.' },
    ],
    rubric: [
      'Checked per-partition lag and consumer-vs-partition count before adding consumers',
      'Named the real root cause (skew / slow processing / too few partitions / rebalances)',
      'Gave a matching fix',
      'Addressed ordering or delivery-semantics trade-off (at-least-once vs exactly-once)',
      'Quantified the target (lag ~0 / latency SLO)',
    ],
  },
  {
    id: 'scn-rag-wrong-cite',
    domain: 'ai',
    tk: 'rag',
    tool: 'RAG',
    framing:
      'PM asks: "Our RAG assistant keeps citing the wrong doc even though the right one is in the index. Explain why and how you\'d fix it — without just swapping the model."',
    prompt: 'Explain a RAG system citing the wrong document, and how you debug it.',
    arc: [
      { label: 'Symptom', body: 'Answers cite a plausible-but-wrong source; the correct doc exists in the index but isn\'t used.' },
      { label: 'Isolate retrieval vs generation', body: 'Bisect: is the correct chunk in the top-k retrieved set? If NO → retrieval bug. If YES but ignored → generation/prompt bug. The gold-context test settles it: inject the right chunk and see if the answer corrects.' },
      { label: 'Root cause (retrieval side)', body: 'Usually chunking (answer split across boundaries), embedding-model/domain mismatch, missing hybrid search for exact terms/IDs, or no re-ranker so a near-duplicate outranks the right chunk.' },
      { label: 'Fix', body: 'Tune chunking + overlap, add BM25 hybrid + RRF for exact-term queries, add a cross-encoder re-ranker over top-k, and measure recall@k on a labeled set — before touching the LLM.' },
      { label: 'Trade-off', body: 'Re-rankers add 50–200ms; hybrid adds infra; bigger k adds context cost/noise. Pick per latency budget.' },
      { label: 'Quantify', body: 'Report recall@5 and citation-accuracy before/after on a fixed eval set, not anecdotes.' },
    ],
    rubric: [
      'Isolated retrieval vs generation (e.g. gold-context injection) before blaming the model',
      'Named a real retrieval root cause (chunking / embedding mismatch / no hybrid / no re-ranker)',
      'Gave a matching fix',
      'Named a latency/cost trade-off',
      'Measured with recall@k / citation accuracy on a labeled set',
    ],
  },
];
