import "server-only";
import type { IncidentScenario } from "./incidents.server";

/**
 * SERVER-ONLY answer key for the Streaming / Kafka incident scenarios.
 * Keyed by problemId (matches INCIDENT_STREAM_ITEMS ids). Holds the diagnosed
 * root cause, fix, contributing factors, red herrings (hellish), triage order
 * (hellish), grading rubric and the facts the coach MAY reveal when asked.
 * Never reaches the client — `import "server-only"` is the enforcement boundary.
 */
export const INCIDENT_STREAM_SCENARIOS: Record<string, IncidentScenario> = {
  /* 1 · rebalance storm (hard) ─────────────────────────────────────── */
  "inc-stream-rebalance-storm": {
    actualRootCause:
      "A consumer-group rebalance storm. Each consumer pulls max.poll.records=2000 and does a synchronous ~90ms GeoIP HTTP call per record, so a single poll takes ~180s of processing. When the GeoIP service slowed this morning, batches blew past max.poll.interval.ms (300s) — the coordinator evicts the slow member, which triggers a stop-the-world rebalance under the eager RangeAssignor. Adding members (6→12) only added more join events and more eager rebalances; the group never processes a full batch between rebalances, so committed offsets don't advance and lag rises even though there are more consumers.",
    actualFix:
      "Make each poll fit the budget AND stop the stop-the-world churn: switch partition.assignment.strategy to CooperativeStickyAssignor (incremental rebalances that don't revoke everything), and either lower max.poll.records or make the GeoIP call async/batched/cached so processing time per poll stays well under max.poll.interval.ms (rule of thumb: budget ≈ 3-4× typical batch time). Add static membership (group.instance.id) so transient restarts don't rebalance, and right-size the group after the storm stops.",
    contributingFactors: [
      "max.poll.records=2000 × ~90ms synchronous GeoIP = ~180s/poll, near the 300s budget",
      "GeoIP service latency rose this morning, pushing batches past max.poll.interval.ms",
      "Eager RangeAssignor: every join/leave revokes ALL partitions (stop-the-world)",
      "Scaling up added more rebalance-triggering join events while no batch ever completed",
      "session.timeout/heartbeat are fine — the eviction is the poll-interval, not heartbeats",
    ],
    rubric: [
      "Identifies the rebalance storm: members exceed max.poll.interval.ms, get evicted, each join/leave triggers another stop-the-world rebalance",
      "Connects it to per-poll work (2000 × ~90ms GeoIP) exceeding the poll budget, worsened by the GeoIP slowdown",
      "Explains why scaling made it worse (more eager rebalances + reprocessing from last commit; no forward progress)",
      "Fix: CooperativeStickyAssignor for incremental rebalances AND shrink the batch / async the GeoIP so a poll fits the budget",
      "Mentions static membership and/or raising max.poll.interval.ms as supporting mitigations",
      "Triage: stop adding members and stabilize the group before right-sizing",
    ],
    facts: [
      { q: "How long does processing a full poll take?", a: "~180s under load: 2000 records × ~90ms GeoIP each; it spikes higher when GeoIP is slow." },
      { q: "Why does a member get evicted?", a: "It doesn't call poll() again within max.poll.interval.ms (300s) because it's still processing the previous batch; the coordinator considers it dead." },
      { q: "What assignor is in use?", a: "RangeAssignor — eager/stop-the-world: every rebalance revokes all partitions from all members." },
      { q: "Did lag actually drop at any point after scaling?", a: "No — the group rebalanced continuously and never committed a full batch, so lag only rose." },
    ],
  },

  /* 2 · poison message head-of-line blocking (hard) ────────────────── */
  "inc-stream-poison-message-hol": {
    actualRootCause:
      "A poison message at the head of partition 3. The record at offset 88142 fails to deserialize every time (duration 'NaN' can't parse to long), the consumer re-throws and re-polls the same offset forever, and never commits past it. Because Kafka guarantees per-partition ordering, every record behind 88142 is blocked (head-of-line blocking) — that's why partition 3's lag explodes while 0/1/2 stay healthy. It is NOT a slow consumer (CPU isn't pinned and the offset never moves). There is no dead-letter topic, so a permanently-failing record stalls the partition indefinitely.",
    actualFix:
      "Give failing records an exit: catch the deserialize/processing error, route the record to a dead-letter (or retry) topic with its metadata, then advance and commit past it so the partition unblocks. Bound retries (e.g. N attempts then DLQ), add an ErrorHandlingDeserializer / poison-message handler, and alert on DLQ volume. To recover now, DLQ or manually advance offset 88142 (skip-with-alert) so partition 3 drains.",
    contributingFactors: [
      "Record at offset 88142 has an unparseable field (duration 'NaN')",
      "Consumer re-throws and re-polls the same offset — no bounded retry, no skip",
      "No dead-letter / retry topic configured",
      "Kafka per-partition ordering means the bad head blocks all records behind it",
    ],
    rubric: [
      "Rejects the slow-consumer theory — the consumer is stuck re-reading offset 88142, not progressing slowly",
      "Identifies the poison message: a record that throws on every attempt, blocking the partition head",
      "Explains head-of-line blocking: per-partition ordering + uncommitted offset stalls everything behind it",
      "Root cause includes the missing DLQ — the loop re-throws and never advances past a permanently-failing record",
      "Fix: route the bad record to a DLQ/retry topic (or skip-with-alert), advance the offset, bound retries",
      "Triage: unblock the partition now (DLQ/advance 88142) before the permanent fix",
    ],
    facts: [
      { q: "Is the consumer making any progress on partition 3?", a: "No — CURRENT-OFFSET is stuck at 88142; it re-reads the same record every ~1s." },
      { q: "Is CPU the bottleneck?", a: "No, CPU is not pinned — the consumer is looping on one failing record, not doing heavy work." },
      { q: "What's wrong with the record at 88142?", a: "Its durationMs field is the string 'NaN', which can't deserialize to a long, so it throws every attempt." },
      { q: "Is there a dead-letter topic?", a: "No DLQ exists; the loop re-throws and re-polls the same offset forever." },
    ],
  },

  /* 3 · hot partition / key skew (standard) ────────────────────────── */
  "inc-stream-hot-partition": {
    actualRootCause:
      "A hot partition from key skew. The producer keys records by device vendor, and Kafka hashes the key to a fixed partition, so every device from a vendor lands on the same partition. Vendor 'acme' is ~92% of the fleet, so ~92% of traffic funnels into partition 3 while the other five partitions are nearly idle. With 6 partitions and 6 consumers you're already at the one-consumer-per-partition ceiling, so adding consumers can't help — the imbalance is in the data distribution, not the assignment.",
    actualFix:
      "Spread the load across partitions: pick a higher-cardinality partition key (e.g. device_id) so traffic distributes evenly, or salt the hot key (vendor + bucket, e.g. 'acme|0..K') and have consumers merge where vendor-level ordering matters, or use a custom partitioner. Add partitions to absorb the volume. Accept that changing the key changes ordering/co-partitioning guarantees, so only group by what truly needs per-key ordering.",
    contributingFactors: [
      "Partition key = vendor (very low cardinality / skewed)",
      "Vendor 'acme' is ~92% of devices → one hot partition",
      "6 partitions / 6 consumers already at the per-partition consumer ceiling",
      "murmur2 hashing is deterministic — same key always to the same partition",
    ],
    rubric: [
      "Recognizes one-per-partition is the consumer ceiling — more consumers can't rebalance one overloaded partition",
      "Root cause: keying by vendor sends ~92% of traffic (acme) to a single partition (hot partition / key skew)",
      "Backs it with data — GROUP BY partition / vendor shows skew on partition 3",
      "Fix: higher-cardinality key (device_id) or salt the hot key (vendor|bucket), optionally a custom partitioner",
      "Notes the trade-off: changing the key changes ordering/co-partitioning and needs more partitions",
    ],
    facts: [
      { q: "Can we just add more consumers?", a: "No — 6 partitions already have 6 consumers; a partition is consumed by at most one consumer in the group." },
      { q: "How is the partition chosen?", a: "The producer keys by vendor; Kafka hashes the key (murmur2) to a partition, so a vendor is pinned to one partition." },
      { q: "How skewed is the fleet?", a: "Vendor 'acme' is ~92% of all devices, so ~92% of traffic goes to one partition." },
      { q: "Does vendor-level ordering matter downstream?", a: "Only ordering per device matters; vendor-level co-location isn't a hard requirement, so re-keying is safe." },
    ],
  },

  /* 4 · commit-before-process (hard) ───────────────────────────────── */
  "inc-stream-commit-before-process": {
    actualRootCause:
      "The billing consumer commits offsets BEFORE doing the work (commitSync() runs right after poll(), then the charge happens). That makes delivery at-MOST-once: if the pod dies between the commit and the charge — exactly what the OOMKill at 03:11:03 did — the already-committed batch is never re-read on restart (it resumes at offset 41902, the NEXT batch). Those impressions are silently lost, which is why finance sees missing charges and zero duplicates.",
    actualFix:
      "Process THEN commit: move commitSync() to after the charge side effect so a crash mid-batch causes a re-read (at-least-once). Because that re-read can now reprocess records, make the charge idempotent — an idempotency key per impression or an upsert keyed on impression_id — so a retried batch can't double-bill. Then backfill the ~1,900 lost impressions by reprocessing from before the bad commit.",
    contributingFactors: [
      "commitSync() called immediately after poll(), before the charge",
      "OOMKill landed in the window between commit and charge",
      "Restart resumes at the committed offset, skipping the unprocessed batch",
      "No idempotency, so the naive 'commit after' fix alone would risk double-billing on retry",
    ],
    rubric: [
      "Root cause: commits offsets before charging → crash between commit and charge loses the batch (at-most-once)",
      "Maps the log: commit at 41902 → OOMKilled → restart resumes at 41902 (next batch), in-flight batch never re-read",
      "Explains why it's under-billing (missing), not double-billing",
      "Fix: process then commit (commit after the side effect) for at-least-once",
      "Adds idempotency (idempotency key / upsert) so reprocessing can't double-bill",
      "Triage: identify and backfill the lost impressions, not just flip the order",
    ],
    facts: [
      { q: "Where does the loop commit relative to the charge?", a: "It commits immediately after poll(), then charges — commit-before-process." },
      { q: "What happened at 03:11:03?", a: "The pod was OOMKilled right after committing offsets 41902 but before the batch was charged." },
      { q: "Where did the consumer resume?", a: "At offset 41902 — the next batch — so the committed-but-unbilled batch was skipped." },
      { q: "Were there any duplicate charges?", a: "No — only missing charges; this is at-most-once loss, not at-least-once duplication." },
    ],
  },

  /* 5 · "exactly-once" dupes — wrong dedup key (hellish) ────────────── */
  "inc-stream-eos-dupes-wrong-dedup-key": {
    actualRootCause:
      "Two faults stacked, and EOS hides neither. (1) enable.idempotence + transactional.id only make producer→Kafka writes exactly-once WITHIN this cluster — they do nothing about an at-least-once UPSTREAM source. The webhook ingest retried conversion C-7781 during a 5xx blip and emitted it multiple times, each with a fresh message_id. (2) The sink's dedup keys on message_id (unique per emission) instead of conversion_id (the stable business key), so every retried copy sails past the dedup, and the sink does a plain INSERT (non-idempotent). Result: the same real conversion lands as several rows → counts 12% high.",
    actualFix:
      "Dedup / upsert on the business key conversion_id, not message_id — e.g. MERGE/upsert keyed on conversion_id, or keep one row per conversion_id. Make the sink idempotent so a duplicate emission is a no-op. Backfill by collapsing existing rows to one per conversion_id and recomputing the affected counts. Optionally add idempotency at the webhook ingest, but the durable fix is keying dedup on the business key + an idempotent sink.",
    contributingFactors: [
      "Upstream webhook ingest is at-least-once and retries with a new message_id each time",
      "Dedup keyed on message_id (fresh per emission), not conversion_id (stable business key)",
      "Sink is a plain INSERT, not an upsert — non-idempotent",
      "Team trusts EOS to cover end-to-end, but it only covers in-cluster producer writes",
    ],
    redHerrings: [
      "'EOS is enabled so duplicates are impossible' — idempotence/transactions don't dedupe an at-least-once upstream source",
      "Suspecting a broken Kafka transaction / producer retry config — the producer side is fine; the dupes enter from upstream",
      "Blaming the ad-network's dashboard for under-reporting — spot-checks show our conversion_id genuinely repeats",
    ],
    triageOrder: [
      "Mitigate: freeze billing on the inflated conversion count; serve last-known-good numbers",
      "Root-cause: query duplicate conversion_ids (distinct message_ids per conversion_id) to prove the dedup key is wrong",
      "Prevent: dedup/upsert on conversion_id + idempotent sink; backfill to one row per conversion_id",
    ],
    rubric: [
      "Investigates before concluding — queries duplicate conversion_ids with distinct message_ids rather than trusting 'EOS is on'",
      "Names the EOS red herring: idempotence/transactions cover producer→Kafka in-cluster only, not an at-least-once upstream source",
      "Root cause: webhook retries reuse conversion_id with a NEW message_id; dedup keys on message_id not conversion_id",
      "Notes the sink is a plain INSERT (non-idempotent), so masked duplicates become real rows",
      "Fix: dedup/upsert on conversion_id, idempotent sink, backfill to one row per conversion_id",
      "Triage: stop billing on the inflated number first; doesn't chase 'EOS must be broken'",
    ],
    facts: [
      { q: "Does EOS cover the upstream webhook?", a: "No — idempotence and transactions cover producer→Kafka writes inside this cluster only; the webhook ingest is plain at-least-once." },
      { q: "What does the dedup key on?", a: "message_id, which the webhook assigns fresh on every emission — so retries get a new id and pass the dedup." },
      { q: "How often does C-7781 appear?", a: "Three times, each with a different message_id, all for the same real conversion (the webhook retried it during a 5xx blip)." },
      { q: "Is the sink an upsert?", a: "No, it's a plain INSERT keyed on nothing stable — non-idempotent." },
    ],
  },

  /* 6 · schema-registry incompat + tombstone (hellish) ─────────────── */
  "inc-stream-schema-registry-crash": {
    actualRootCause:
      "Two distinct failures. (1) The 12:00 producer deploy registered Profile v3 adding a REQUIRED field country_code with NO default. Under FORWARD compatibility old consumers are supposed to read new-schema data, but adding a required field with no default is not a compatible evolution the way the team assumed — old consumers can't satisfy a field they don't know — so all 8 consumers crash on deserialize. The registry compatibility check was bypassed because the producer ran with auto.register.schemas=true and CI never validated it, and the deploy order was wrong for the compat mode. (2) Separately, offset 5567 is a log-compaction TOMBSTONE (non-null key, NULL value, an account deletion). The consumer dereferences rec.value() and upserts without null-checking, so it NPEs on the tombstone even after the schema is fixed.",
    actualFix:
      "Schema: make country_code optional or give it a default (or don't make it required); enforce schema-registry compatibility checks in CI (disable blind auto.register.schemas, run a compatibility gate); follow the correct deploy order for the compat mode (for BACKWARD, upgrade consumers before producers). Tombstone: special-case null values — if rec.value() is null, treat it as a delete and skip deserialize/upsert. Roll back the producer schema to stop the crash-loop first.",
    contributingFactors: [
      "v3 added a REQUIRED field with no default — not a safe forward/backward evolution",
      "auto.register.schemas=true bypassed the compatibility gate; no CI check",
      "Deploy order wrong for the compatibility mode (producers before consumers)",
      "Topic is log-compacted; tombstones (null value) are normal but unhandled by the consumer",
      "Consumer assumes rec.value() is never null and upserts directly",
    ],
    redHerrings: [
      "'It must be a Schema Registry outage / network issue' — the registry is up; the schema itself is incompatible",
      "Blaming a corrupt broker record for offset 5567 — it's a legitimate compaction tombstone, not corruption",
      "Assuming FORWARD compat makes any additive change safe — a required no-default field is not safe",
    ],
    triageOrder: [
      "Mitigate: roll back the producer to Profile v2 (or pin/repoint consumers) to stop the org-wide crash-loop",
      "Root-cause #1: confirm v3 added a required no-default field and the compat check was bypassed",
      "Root-cause #2: identify offset 5567 as a tombstone the consumer NPEs on; handle null values",
      "Prevent: CI compatibility gate, optional/defaulted fields, correct deploy order, tombstone handling",
    ],
    rubric: [
      "Primary root cause: v3 added a REQUIRED field with no default — incompatible; old consumers can't read it",
      "Notes the process failures: registry check bypassed (auto.register.schemas) and wrong deploy order for the compat mode",
      "Schema fix: make the field optional/defaulted, enforce compatibility in CI, order the deploy correctly",
      "Spots the SECOND issue: offset 5567 is a log-compaction tombstone (null value) causing an NPE",
      "Tombstone fix: handle null value (treat as delete) before deserialize/upsert",
      "Triage: stop the crash-loop first; treats the two failures as distinct",
    ],
    facts: [
      { q: "What changed in Profile v3?", a: "It added a required field country_code with no default value." },
      { q: "Why did the compatibility check not block it?", a: "The producer ran with auto.register.schemas=true and CI had no compatibility gate, so the schema was auto-registered." },
      { q: "What is at offset 5567?", a: "A log-compaction tombstone: a record with a non-null key and a NULL value, representing an account deletion." },
      { q: "Does the consumer null-check the value?", a: "No — it dereferences rec.value() and upserts directly, so a tombstone NPEs it." },
    ],
  },

  /* 7 · windowed aggregation undercount — watermark too tight (hard) ── */
  "inc-stream-window-undercount": {
    actualRootCause:
      "The watermark / allowed-lateness is set to 5 seconds, far tighter than real arrival skew. Mobile clients buffer offline and flush 30-120s after the event_time, so by the time those events arrive the watermark has advanced well past their window and they are dropped as 'too late' (numRowsDroppedByWatermark is non-zero). Only windows containing mobile traffic undercount, by the share of late mobile events (~8-15%). The events are not lost in Kafka — they reach the job; the window discards them.",
    actualFix:
      "Widen allowed lateness to cover the real arrival delay — size it from the ingestion-lag dashboard (e.g. p99 of ingest_time − event_time, a few minutes here) rather than 5s. Accept the trade-off: looser lateness raises output latency and state size. For events beyond the bound, add a side-output / late-data sink (or a periodic reprocessing/backfill) so they're counted instead of silently dropped, and alert on numRowsDroppedByWatermark.",
    contributingFactors: [
      "withWatermark set to 5s; mobile events arrive 30-120s late",
      "Late events are dropped, not redirected — no side-output/late sink",
      "Only mobile-bearing windows undercount, proportional to late mobile share",
      "numRowsDroppedByWatermark not monitored, so the loss was invisible",
    ],
    rubric: [
      "Root cause: watermark/allowed-lateness (5s) far tighter than real skew → late mobile events dropped as 'too late'",
      "Uses evidence: numRowsDroppedByWatermark non-zero; only mobile windows undercount; ingest−event delay of 30-120s",
      "Rules out Kafka loss / SUM bug — events exist; the window discarded them",
      "Fix: raise watermark/allowed-lateness to cover real p99 arrival delay, sized from the lag dashboard",
      "Names the trade-off: looser lateness raises latency/state; mentions side-output/late sink or reprocessing for stragglers",
    ],
    facts: [
      { q: "What's the watermark set to?", a: "5 seconds of allowed lateness." },
      { q: "How late do events actually arrive?", a: "Web events are near-real-time; mobile flushes arrive 30-120s after event_time." },
      { q: "Is numRowsDroppedByWatermark zero?", a: "No — it's tens of thousands per hour, matching the undercount." },
      { q: "Are the events missing from Kafka?", a: "No, they're on the topic and reach the job; the window drops them as too late." },
    ],
  },

  /* 8 · MirrorMaker offset-translation reprocess (standard) ─────────── */
  "inc-stream-mirrormaker-reprocess": {
    actualRootCause:
      "MirrorMaker 2 offset translation is approximate, not exact. On failover the checkpoint connector translated the group's committed offset to the DR cluster, and when an exact source→target mapping isn't available MM2 deliberately resolves to an EARLIER offset (the never-skip guarantee) so consumers never lose data — but they replay some already-processed records. Coarse checkpoints (every 60s) widen that replay window. ~3,000 boundary orders were re-delivered, and because the sink is non-idempotent (createShipment makes a new shipment every call), the replay produced duplicate shipments. Nothing was lost — the consumer rewound, it didn't skip.",
    actualFix:
      "You cannot make MM2 translation exact, so design consumers to tolerate at-least-once replay on failover: make the sink idempotent — createIfAbsent / upsert keyed on order_id, or a dedup store of processed order_ids — so replayed records become no-ops. Tighten emit.checkpoints.interval.seconds to shrink the replay window, and clean up the duplicate shipments created near the boundary.",
    contributingFactors: [
      "MM2 offset translation is approximate; resolves earlier when exact mapping is missing (never-skip)",
      "emit.checkpoints.interval.seconds=60 → coarse checkpoints widen the replay window",
      "Non-idempotent sink: createShipment creates a new shipment on every call",
      "Consumer not designed to tolerate at-least-once replay on failover",
    ],
    rubric: [
      "Root cause: MM2 offset translation is approximate — on failover resolves to an earlier offset (never-skip), so boundary records replay (no loss)",
      "Notes coarse checkpointing (60s) widens the replay window",
      "Identifies the real defect as the non-idempotent sink — createShipment duplicates on replay",
      "Fix: make the sink idempotent (upsert/createIfAbsent by order_id or dedup store)",
      "Frames it correctly: can't make MM2 translation exact; design consumers to tolerate replay",
    ],
    facts: [
      { q: "Were any orders lost?", a: "No — the consumer rewound to an earlier translated offset and replayed; nothing was skipped." },
      { q: "Why does MM2 rewind?", a: "When an exact source→target offset isn't in the checkpoint map, MM2 resolves to an earlier offset so consumers never skip data — at the cost of reprocessing." },
      { q: "Is the fulfilment sink idempotent?", a: "No — createShipment creates a new shipment on every call, so replay yields duplicate shipments." },
      { q: "How wide is the replay window?", a: "Checkpoints emit every 60s, so up to ~a minute of records near the boundary can be replayed." },
    ],
  },
};
