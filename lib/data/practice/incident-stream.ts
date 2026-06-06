import type { ConvItem } from "./types";

/**
 * Streaming / Kafka incident-debugging scenarios (client-visible halves). The
 * candidate reads the artifacts — mostly read-only logs (rebalance/lag/stack-trace),
 * config (consumer/producer props, registry compat) and code (consumer loop / sink) —
 * a few add an in-browser DuckDB console over an `events`/`offsets` table, then
 * submits a root cause + fix that's graded. Diagnosed answers (root cause, fix,
 * red herrings, triage) live server-side in incident-stream.server.ts (by id).
 */

/* ────────────────────────── 1 · rebalance storm ────────────────────────── */

const REBALANCE_LOG = `[10:02:11] consumer-7  INFO   subscribed to topic clicks, group=enrich, members=6
[10:02:11] coordinator INFO   group=enrich rebalance: assigning 24 partitions over 6 members
[10:05:40] ops          NOTE   lag rising, scaled group enrich 6 -> 12 to add throughput
[10:05:41] coordinator INFO   group=enrich member joined, triggering rebalance (eager)
[10:05:41] consumer-3  WARN   revoking ALL 4 partitions for rebalance (stop-the-world)
[10:05:58] coordinator WARN   member consumer-9 left group: max.poll.interval.ms exceeded
[10:05:58] coordinator INFO   group=enrich rebalance #2 (member left), reassigning 24 partitions
[10:06:15] coordinator WARN   member consumer-2 left group: max.poll.interval.ms exceeded
[10:06:15] coordinator INFO   group=enrich rebalance #3 (member left), reassigning 24 partitions
[10:06:31] coordinator WARN   member consumer-11 left group: max.poll.interval.ms exceeded
[10:06:31] coordinator INFO   group=enrich rebalance #4 ... (no batch fully processed since 10:05:41)
[10:09:00] ops          NOTE   lag is now HIGHER than before we scaled. group never stabilizes.`;

const REBALANCE_CONFIG = `# consumer.properties  (group=enrich)
group.id=enrich
max.poll.records=2000          # pull a big batch each poll
max.poll.interval.ms=300000    # 5 min budget between polls
session.timeout.ms=10000
heartbeat.interval.ms=3000
# partition.assignment.strategy left at the OLD default:
partition.assignment.strategy=org.apache.kafka.clients.consumer.RangeAssignor
enable.auto.commit=false`;

const REBALANCE_LOOP = `// enrich-consumer  (one poll loop iteration)
while (running) {
  ConsumerRecords<String,String> batch = consumer.poll(Duration.ofMillis(500));
  for (ConsumerRecord<String,String> r : batch) {           // up to 2000 records
    Enriched e = geoIpLookup(r.value());   // synchronous HTTP call to GeoIP service
    sink.write(e);                          // ~70-120ms each under load
  }
  consumer.commitSync();
}
// At ~90ms/record * 2000 records that's ~180s of processing per poll — and the
// GeoIP service slowed down this morning, pushing some batches past the budget.`;

/* ────────────────────────── 2 · poison message HOL ─────────────────────── */

const POISON_STACK = `2026-06-02T08:14:02 ERROR transcode-consumer  partition=video-events-3 offset=88142
com.fasterxml.jackson.databind.exc.InvalidFormatException:
  Cannot deserialize value of type \`long\` from String "NaN": not a valid Long value
   at MediaEvent.durationMs (MediaEvent.java:41)
   at TranscodeConsumer.handle (TranscodeConsumer.java:63)
2026-06-02T08:14:02 WARN  transcode-consumer  partition=video-events-3 retrying offset=88142 (attempt 1)
2026-06-02T08:14:03 WARN  transcode-consumer  partition=video-events-3 retrying offset=88142 (attempt 2)
2026-06-02T08:14:04 WARN  transcode-consumer  partition=video-events-3 retrying offset=88142 (attempt 3)
... (same record, same offset, looping every ~1s for 40 minutes) ...
2026-06-02T08:54:10 NOTE  partitions 0,1,2 fully caught up; partition 3 lag = 2,300,000 and climbing`;

const POISON_LOOP = `// transcode-consumer  (partition-3 is stuck; 0/1/2 are healthy)
while (true) {
  var batch = consumer.poll(Duration.ofMillis(500));
  for (var rec : batch) {
    try {
      MediaEvent e = mapper.readValue(rec.value(), MediaEvent.class); // throws on bad rec
      transcode(e);
    } catch (Exception ex) {
      log.warn("retrying offset={} (attempt {})", rec.offset(), ++attempt);
      // do NOT advance — re-poll the SAME record until it succeeds
      throw ex;   // bubble up, loop restarts from the last COMMITTED offset
    }
    consumer.commitSync(offsetsFor(rec));
  }
}
// There is no dead-letter topic. A record that never parses is re-read forever.`;

const POISON_LAG = `# kafka-consumer-groups --describe --group transcode
TOPIC          PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
video-events   0          991240          991240          0
video-events   1          885102          885140          38
video-events   2          771904          771930          26
video-events   3          88142           2388142         2300000   <-- stuck at 88142`;

/* ────────────────────────── 3 · hot partition ──────────────────────────── */

const HOTPART_LAG = `# kafka-consumer-groups --describe --group telemetry
TOPIC      PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
sensor     0          50210           50260           50
sensor     1          50190           50250           60
sensor     2          50230           50280           50
sensor     3          12030           1462030         1450000   <-- one partition, huge lag
sensor     4          50180           50230           50
sensor     5          50220           50270           50
# 6 partitions, 6 consumers. CPU on consumer-3 is pinned; the rest are ~idle.`;

const HOTPART_PRODUCER = `// telemetry-producer — picks the partition key
String key = event.getDeviceVendor();   // "acme", "globex", "initech", ...
producer.send(new ProducerRecord<>("sensor", key, event.toJson()));
// Kafka hashes the key (murmur2) -> partition. Keying by VENDOR means every
// device from the same vendor lands on the SAME partition.
// Fleet breakdown: vendor "acme" ships ~92% of all devices.`;

const HOTPART_SETUP = `CREATE TABLE events (
  event_id    BIGINT,
  device_id   VARCHAR,
  vendor      VARCHAR,
  partition   INTEGER,
  ts          TIMESTAMP
);
INSERT INTO events VALUES
  (1, 'd-001', 'acme',   3, TIMESTAMP '2026-06-02 10:00:01'),
  (2, 'd-002', 'acme',   3, TIMESTAMP '2026-06-02 10:00:01'),
  (3, 'd-003', 'acme',   3, TIMESTAMP '2026-06-02 10:00:02'),
  (4, 'd-004', 'acme',   3, TIMESTAMP '2026-06-02 10:00:02'),
  (5, 'd-005', 'acme',   3, TIMESTAMP '2026-06-02 10:00:03'),
  (6, 'd-006', 'acme',   3, TIMESTAMP '2026-06-02 10:00:03'),
  (7, 'd-007', 'acme',   3, TIMESTAMP '2026-06-02 10:00:04'),
  (8, 'd-008', 'acme',   3, TIMESTAMP '2026-06-02 10:00:04'),
  (9, 'd-009', 'acme',   3, TIMESTAMP '2026-06-02 10:00:05'),
  (10,'d-010', 'globex', 0, TIMESTAMP '2026-06-02 10:00:05'),
  (11,'d-011', 'initech',1, TIMESTAMP '2026-06-02 10:00:06'),
  (12,'d-012', 'umbrella',2,TIMESTAMP '2026-06-02 10:00:06'),
  (13,'d-013', 'acme',   3, TIMESTAMP '2026-06-02 10:00:07'),
  (14,'d-014', 'acme',   3, TIMESTAMP '2026-06-02 10:00:07'),
  (15,'d-015', 'hooli',  4, TIMESTAMP '2026-06-02 10:00:08');
`;

/* ──────────────────── 4 · commit-before-process dupes ───────────────────── */

const COMMIT_LOOP = `// billing-consumer — charges advertisers per impression event.
while (running) {
  var batch = consumer.poll(Duration.ofMillis(200));
  consumer.commitSync();                 // (A) commit FIRST, before we do the work
  for (var rec : batch) {
    Impression imp = parse(rec.value());
    billingService.charge(imp.advertiserId, imp.costMicros);  // (B) side effect
  }
}
// If the process dies between (A) and (B), those impressions are NEVER billed
// (lost). If we move commit AFTER (B) without idempotency, a crash mid-batch
// re-bills. Today we saw the OPPOSITE complaint: some advertisers under-billed.`;

const COMMIT_LOG = `[03:11:02] billing-consumer INFO  polled 500 records, committed offsets up to 41902
[03:11:02] billing-consumer INFO  charging batch...
[03:11:03] k8s              WARN  pod billing-consumer-2 OOMKilled (memory limit)
[03:11:09] billing-consumer INFO  pod restarted, resuming from committed offset 41902
[03:11:09] billing-consumer INFO  polled 500 records starting at 41902 (the NEXT batch)
[09:30:00] finance          ERROR advertiser reconciliation: ~1,900 impressions never charged
[09:31:10] oncall           NOTE  no duplicate charges found — charges are MISSING, not doubled`;

/* ───────────── 5 · "exactly-once" emits dupes — wrong dedup key (hellish) ── */

const EOS_PRODUCER = `# producer.properties  — the team believes this gives "exactly once".
enable.idempotence=true
acks=all
transactional.id=conversion-tx-1
# NOTE: idempotence/transactions only cover producer->Kafka writes WITHIN this
# cluster. The UPSTREAM source (a webhook ingest) is plain at-least-once and can
# emit the SAME conversion twice with DIFFERENT message ids on its own retries.`;

const EOS_SINK = `# sink.py — writes conversions to the warehouse 'conversions' table.
def write(conversion):
    # "dedup so we never double-count" — keyed on the Kafka message_id.
    if conversion["message_id"] in already_seen:
        return
    already_seen.add(conversion["message_id"])
    warehouse.insert("conversions", conversion)   # plain INSERT, not an upsert
# message_id is assigned fresh by the webhook ingest on EVERY emission, so a
# retried conversion arrives with a NEW message_id and sails past the dedup.
# The business key is conversion_id (stable per real conversion).`;

const EOS_LOG = `[reporting] WARN  conversion counts 12% above the ad-network's own dashboard
[oncall]    NOTE  EOS is "on" (idempotence + transactions). So why duplicates?
[oncall]    NOTE  spot-check: conversion_id C-7781 appears 3x, each with a different message_id
[oncall]    NOTE  upstream webhook retried C-7781 twice during a 5xx blip last night`;

const EOS_SETUP = `CREATE TABLE conversions (
  message_id    VARCHAR,    -- fresh per emission (webhook assigns it)
  conversion_id VARCHAR,    -- STABLE business key per real conversion
  advertiser    VARCHAR,
  value_usd     DECIMAL(10,2),
  emitted_at    TIMESTAMP
);
INSERT INTO conversions VALUES
  ('m-1001','C-7781','acme',  40.00, TIMESTAMP '2026-06-01 23:05:01'),
  ('m-1002','C-7781','acme',  40.00, TIMESTAMP '2026-06-01 23:05:09'),  -- retry, new msg id
  ('m-1003','C-7781','acme',  40.00, TIMESTAMP '2026-06-01 23:05:14'),  -- retry, new msg id
  ('m-1004','C-7782','globex',12.50, TIMESTAMP '2026-06-01 23:06:00'),
  ('m-1005','C-7783','acme',  9.99,  TIMESTAMP '2026-06-01 23:06:30'),
  ('m-1006','C-7784','initech',75.00,TIMESTAMP '2026-06-01 23:07:10'),
  ('m-1007','C-7784','initech',75.00,TIMESTAMP '2026-06-01 23:07:21'),  -- retry, new msg id
  ('m-1008','C-7785','globex',5.00,  TIMESTAMP '2026-06-01 23:08:00'),
  ('m-1009','C-7786','acme',  20.00, TIMESTAMP '2026-06-01 23:08:40'),
  ('m-1010','C-7787','hooli', 33.00, TIMESTAMP '2026-06-01 23:09:00');
`;

/* ──────────────── 6 · schema-registry incompat + tombstone (hellish) ────── */

const SR_STACK = `2026-06-02T12:00:31 FATAL profile-consumer  group=profile partition=user-profiles-2
org.apache.kafka.common.errors.SerializationException: Error deserializing key/value
Caused by: org.apache.avro.AvroTypeException:
  Found user.Profile, expecting user.Profile, missing required field: country_code
   at io.confluent.kafka.serializers.AbstractKafkaAvroDeserializer.deserialize
2026-06-02T12:00:31 ERROR profile-consumer  consumer crashed, all 8 instances in crash-loop
2026-06-02T12:01:10 NOTE  producers were deployed 12:00 with Profile v3 (added required field country_code)
2026-06-02T12:03:44 NOTE  some consumers ALSO crash on a record with a NULL value at offset 5567 (?)`;

const SR_CONFIG = `# schema-registry compatibility for subject user-profiles-value
compatibility: FORWARD
# v2 (live): { name, email, plan }                              all consumers read this
# v3 (just registered + deployed to producers):
#   { name, email, plan, country_code: string }   <-- REQUIRED, no default
# FORWARD = consumers on the OLD schema can read data from the NEW schema...
# ...but adding a REQUIRED field with no default is NOT forward-compatible the way
# the team assumed: old consumers can't supply/skip a required field they don't know.
# The registry check was SKIPPED in CI (auto.register.schemas=true on the producer).`;

const SR_TOMBSTONE = `// user-profiles is a LOG-COMPACTED topic (cleanup.policy=compact).
// A delete is published as a "tombstone": a record with a non-null KEY and a
// NULL VALUE. The Avro value deserializer is called on every record value...
ConsumerRecords<String, Profile> batch = consumer.poll(...);
for (var rec : batch) {
  Profile p = rec.value();         // NULL for a tombstone -> NPE downstream
  upsertProfile(rec.key(), p);     // assumes value is never null
}
// Offset 5567 is a tombstone (account deletion). Even after the schema is fixed,
// this NULL-value record still breaks consumers that don't special-case tombstones.`;

/* ───────────────────── 7 · windowed aggregation undercount ──────────────── */

const WINDOW_CODE = `# stream job — 1-minute tumbling count of events per minute.
# Mobile clients buffer offline and flush late; broker/processing adds delay too.
agg = (events
   .withWatermark("event_time", "5 seconds")     # tolerate only 5s of lateness
   .groupBy(window("event_time", "1 minute"))
   .count())
# Anything whose event_time is more than 5s behind the max seen event_time is
# dropped as "too late" and never counted. Mobile flushes routinely arrive
# 30-120s late, so those events silently vanish from the per-minute counts.`;

const WINDOW_LOG = `[metrics] numTotalStateRows ok, but per-minute counts ~8-15% below the raw topic count
[metrics] "numRowsDroppedByWatermark" = 41,902 over the last hour   <-- not zero!
[oncall]  NOTE  raw topic has N events for 10:00-10:01; the window emitted N*0.88
[oncall]  NOTE  ingestion-lag dashboard shows mobile events landing 30-120s after event_time`;

const WINDOW_SETUP = `CREATE TABLE events (
  event_id   BIGINT,
  event_time TIMESTAMP,   -- when it happened on the device
  ingest_time TIMESTAMP,  -- when the stream actually saw it
  source     VARCHAR
);
INSERT INTO events VALUES
  -- window 10:00:00-10:01:00. max event_time seen drives the watermark.
  (1, TIMESTAMP '2026-06-02 10:00:05', TIMESTAMP '2026-06-02 10:00:06', 'web'),
  (2, TIMESTAMP '2026-06-02 10:00:20', TIMESTAMP '2026-06-02 10:00:21', 'web'),
  (3, TIMESTAMP '2026-06-02 10:00:30', TIMESTAMP '2026-06-02 10:00:31', 'web'),
  (4, TIMESTAMP '2026-06-02 10:00:45', TIMESTAMP '2026-06-02 10:00:46', 'web'),
  (5, TIMESTAMP '2026-06-02 10:00:55', TIMESTAMP '2026-06-02 10:00:56', 'web'),
  -- mobile flushes: event_time is IN the window but they ARRIVE very late...
  (6, TIMESTAMP '2026-06-02 10:00:10', TIMESTAMP '2026-06-02 10:01:35', 'mobile'),  -- 85s late
  (7, TIMESTAMP '2026-06-02 10:00:18', TIMESTAMP '2026-06-02 10:01:50', 'mobile'),  -- 92s late
  (8, TIMESTAMP '2026-06-02 10:00:40', TIMESTAMP '2026-06-02 10:02:05', 'mobile'),  -- 85s late
  (9, TIMESTAMP '2026-06-02 10:00:50', TIMESTAMP '2026-06-02 10:02:20', 'mobile'),  -- 90s late
  -- next-window event whose arrival pushed the watermark forward, evicting the above
  (10,TIMESTAMP '2026-06-02 10:01:30', TIMESTAMP '2026-06-02 10:01:31', 'web');
`;

/* ─────────────────── 8 · MirrorMaker offset-translation reprocess ────────── */

const MM2_CONFIG = `# MirrorMaker 2 (primary -> dr)  cross-cluster replication
clusters = primary, dr
primary->dr.enabled = true
primary->dr.topics = orders
# Checkpoint connector translates committed consumer offsets between clusters.
# IMPORTANT: when an exact source->target offset isn't in the checkpoint map,
# MM2 translates to an offset that is ALWAYS EARLIER than the true position
# (never-skip guarantee) -> consumers REPLAY some already-processed records.
sync.group.offsets.enabled = true
emit.checkpoints.interval.seconds = 60     # checkpoints only every 60s -> coarse`;

const MM2_LOG = `[14:00:00] ops        NOTE  primary cluster lost; failed consumers over to DR cluster
[14:00:05] orders-consumer INFO  starting on DR, resolved translated offset for group=fulfil
[14:00:05] orders-consumer INFO  resuming orders-0 at offset 880100 (translated)
[14:00:30] fulfilment ERROR  duplicate fulfilment: order O-55012 shipped twice
[14:00:31] fulfilment ERROR  duplicate fulfilment: order O-55013 shipped twice
[14:02:00] oncall     NOTE  ~3,000 orders near the failover boundary re-processed.
[14:02:30] oncall     NOTE  no orders were LOST; the consumer rewound, it didn't skip.`;

const MM2_SINK = `// orders-consumer — the fulfilment side effect is NOT idempotent.
void handle(Order o) {
  shipmentService.createShipment(o.id());   // creates a NEW shipment every call
  consumer.commitSync();
}
// On replay (after MM2 translates to an earlier offset), createShipment() runs
// again for orders already shipped -> duplicate shipments. An idempotent sink
// (upsert/createIfAbsent by order_id) would absorb the replay safely.`;

export const INCIDENT_STREAM_ITEMS: ConvItem[] = [
  /* 1 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-rebalance-storm",
    category: "incident",
    level: "senior",
    title: "We scaled consumers up and lag got WORSE",
    company: "FAANG · search",
    difficulty: "hard",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: lag on the click-enrichment consumer group was climbing, so ops doubled the consumers from 6 to 12 to add throughput. Instead lag went HIGHER and the group never stabilizes — members keep leaving and rejoining. Investigate the rebalance log, consumer config and poll loop, then submit the root cause and the fix.",
    hints: [
      "Read the rebalance log top-to-bottom: how often is the group rebalancing, and does any batch ever finish processing between rebalances?",
      "Look at the per-poll work: max.poll.records × time-per-record. Does that exceed max.poll.interval.ms? What happens to a member that blows the budget?",
      "Two settings interact: the assignment strategy (eager RangeAssignor = stop-the-world) and the poll budget. Adding members under an eager assignor while processing is slow = a storm.",
    ],
    idealAnswer: "",
    rubric: [
      "Identifies the rebalance storm: members exceed max.poll.interval.ms, get evicted, every join/leave triggers another stop-the-world rebalance",
      "Connects it to per-poll work (max.poll.records=2000 × ~90ms GeoIP) exceeding the 5-min poll budget, worsened when GeoIP slowed",
      "Explains WHY scaling made it worse (more eager rebalances + each member now reprocesses from last commit; no forward progress)",
      "Fix: switch to CooperativeStickyAssignor (incremental rebalances) AND reduce max.poll.records / speed up or async the GeoIP call so a poll fits the budget",
      "Mentions static membership (group.instance.id) and/or raising max.poll.interval.ms as supporting mitigations",
      "Triage: stop adding members; stabilize the group first, then right-size",
    ],
    incident: {
      brief:
        "Consumer group 'enrich' had rising lag. Ops scaled 6→12 consumers; lag got worse and the group rebalances continuously (members keep getting evicted). Find the root cause and the fix.",
      severity: "SEV-2 · pipeline-delay",
      tier: "hard",
      artifacts: [
        { name: "logs/rebalance.log", kind: "log", language: "text", content: REBALANCE_LOG },
        { name: "config/consumer.properties", kind: "config", language: "text", content: REBALANCE_CONFIG },
        { name: "src/EnrichConsumer.java", kind: "code", language: "typescript", content: REBALANCE_LOOP },
      ],
    },
  },

  /* 2 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-poison-message-hol",
    category: "incident",
    level: "mid",
    title: "One partition's lag explodes while the rest are fine",
    company: "Streaming video",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the transcode consumer's lag dashboard shows partitions 0,1,2 healthy but partition 3 lag climbing into the millions and never recovering. The on-call's first theory is 'partition 3's consumer is just slow'. Investigate the stack trace, the consumer loop and the lag table, then submit the root cause and the fix.",
    hints: [
      "It looks like a slow consumer, but check the stack trace: is it making progress, or re-reading the SAME offset over and over?",
      "Find the offset in the error and compare it to CURRENT-OFFSET for partition 3 in the lag table. Has the committed offset moved at all?",
      "Kafka preserves order within a partition — a record that never succeeds blocks every record behind it (head-of-line blocking). What's missing that would let the consumer skip it?",
    ],
    idealAnswer: "",
    rubric: [
      "Rejects the 'slow consumer' theory — recognizes the consumer is stuck re-reading one offset (88142), not making slow progress",
      "Identifies the poison message: a record that throws on every deserialize/process attempt, blocking the partition head",
      "Explains head-of-line blocking: Kafka's per-partition ordering means nothing behind the bad record can advance; offset never commits",
      "Root cause includes the missing dead-letter path — the loop re-throws and never advances past a permanently-failing record",
      "Fix: route the failing record to a DLQ / retry topic (or skip-with-alert) so the offset can advance; bound retries; add poison-message handling",
      "Triage: unblock the partition now (DLQ the bad offset or manually advance) before designing the permanent fix",
    ],
    incident: {
      brief:
        "Transcode consumer: partitions 0/1/2 are caught up, partition 3 lag is 2.3M and climbing. CPU is not pinned. 'It's just a slow consumer.' Find the real root cause and the fix.",
      severity: "SEV-2 · partial-outage",
      tier: "hard",
      artifacts: [
        { name: "logs/transcode.stacktrace.log", kind: "log", language: "text", content: POISON_STACK },
        { name: "src/TranscodeConsumer.java", kind: "code", language: "typescript", content: POISON_LOOP },
        { name: "logs/consumer-group-lag.txt", kind: "log", language: "text", content: POISON_LAG },
      ],
    },
  },

  /* 3 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-hot-partition",
    category: "incident",
    level: "mid",
    title: "Six consumers, but only one is on fire",
    company: "IoT platform",
    difficulty: "medium",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-3: the telemetry topic has 6 partitions and 6 consumers, but five sit idle while consumer-3 is pinned at 100% CPU and partition 3's lag is 1.45M. Adding more consumers won't help (you already have one per partition). Investigate the lag table, the producer's partition-key choice and the events table, then submit the root cause and the fix.",
    hints: [
      "Adding consumers can't help past one-per-partition. So the imbalance is in how DATA is distributed across partitions, not how consumers are assigned.",
      "Look at how the producer chooses the key. Kafka hashes the key to a partition — same key always lands on the same partition. Query the events table: GROUP BY partition (and by vendor) to see the skew.",
      "One key value carries the vast majority of traffic (a 'hot key'). Think salting the hot key, a better-cardinality key, or a custom partitioner.",
    ],
    idealAnswer: "",
    rubric: [
      "Recognizes one-per-partition is the consumer ceiling — more consumers can't rebalance a single overloaded partition",
      "Root cause: keying by vendor sends ~92% of traffic (vendor 'acme') to one partition (hot partition / key skew)",
      "Backs it with the data — GROUP BY partition / vendor shows the skew concentrated on partition 3",
      "Fix: choose a higher-cardinality key (e.g. device_id) or salt the hot key (vendor|bucket) so traffic spreads; optionally a custom partitioner",
      "Notes the trade-off: changing the key changes ordering/co-partitioning guarantees and needs more partitions to absorb the load",
    ],
    incident: {
      brief:
        "Topic 'sensor': 6 partitions, 6 consumers. Five consumers idle; consumer-3 pinned, partition-3 lag 1.45M. More consumers won't help. Find the root cause and the fix.",
      severity: "SEV-3 · degraded",
      tier: "standard",
      artifacts: [
        { name: "logs/consumer-group-lag.txt", kind: "log", language: "text", content: HOTPART_LAG },
        { name: "src/TelemetryProducer.java", kind: "code", language: "typescript", content: HOTPART_PRODUCER },
      ],
      sql: { setupSql: HOTPART_SETUP, tables: ["events"] },
    },
  },

  /* 4 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-commit-before-process",
    category: "incident",
    level: "senior",
    title: "Advertisers are being under-billed",
    company: "AdTech",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: finance reconciliation found ~1,900 impressions that were never charged — money on the floor. There are NO duplicate charges, only missing ones. The billing consumer 'looks at-least-once'. Investigate the consumer loop and the log, then submit the root cause and the fix.",
    hints: [
      "The complaint is MISSING charges, not duplicates. So the loss happens between committing the offset and doing the work. What order does the loop do those two things in?",
      "Walk the failure: the loop commits offsets, THEN charges. What's the state if the pod dies (OOMKilled) right after the commit?",
      "Committing before processing turns at-least-once into at-MOST-once. The fix flips the order AND makes the side effect safe to repeat.",
    ],
    idealAnswer: "",
    rubric: [
      "Root cause: the loop commits offsets BEFORE charging, so a crash between commit and charge loses that batch (at-most-once, not at-least-once)",
      "Maps the log: commit at offset 41902 → OOMKilled → restart resumes at 41902 (the NEXT batch), so the in-flight batch is never re-read",
      "Explains why it's under-billing (missing), not double-billing (the committed-but-unprocessed records are skipped forever)",
      "Fix: process THEN commit (commit after the side effect) to get at-least-once",
      "Adds idempotency for the charge (idempotency key per impression / upsert) so the now-possible reprocessing doesn't double-bill",
      "Triage: identify and backfill the lost impressions; doesn't just flip the order and walk away",
    ],
    incident: {
      brief:
        "Billing consumer: ~1,900 impressions never charged, zero duplicate charges. Money is being lost, not double-counted. Find the root cause and the fix.",
      severity: "SEV-1 · revenue-loss",
      tier: "hard",
      artifacts: [
        { name: "src/BillingConsumer.java", kind: "code", language: "typescript", content: COMMIT_LOOP },
        { name: "logs/billing.log", kind: "log", language: "text", content: COMMIT_LOG },
      ],
    },
  },

  /* 5 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-eos-dupes-wrong-dedup-key",
    category: "incident",
    level: "senior",
    title: "'Exactly-once' is on, yet conversions are double-counted",
    company: "AdTech",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: conversion counts are 12% above the ad-network's own dashboard — advertisers are billed for conversions that happened once. The team insists this is impossible: exactly-once is enabled (idempotence + transactions) AND there's a dedup step. Investigate the producer config, the sink dedup, the log and the conversions table, then submit the root cause and the fix.",
    hints: [
      "Read exactly what EOS covers: enable.idempotence + transactional.id protect producer→Kafka writes WITHIN this cluster. Does that say anything about what the UPSTREAM source emits?",
      "The dedup looks airtight — until you check WHAT it keys on versus what's actually stable. Query the table: GROUP BY conversion_id and count distinct message_id. Then GROUP BY message_id.",
      "Two traps stacked: an at-least-once UPSTREAM source emitting the same conversion with a fresh id, and a dedup keyed on that ever-changing id instead of the business key. EOS hides nothing here.",
    ],
    idealAnswer: "",
    rubric: [
      "Investigates before concluding — queries duplicate conversion_ids (each with distinct message_ids) rather than trusting 'EOS is on'",
      "Names the EOS red herring: idempotence/transactions only cover producer→Kafka within the cluster; they don't dedupe an at-least-once UPSTREAM source",
      "Root cause: webhook ingest retries emit the same conversion_id with a NEW message_id, and the sink dedups on message_id (always unique) not conversion_id (the business key)",
      "Notes the sink is a plain INSERT (non-idempotent), so the masked duplicates land as real rows",
      "Fix: dedup / upsert on conversion_id (MERGE by business key), make the sink idempotent; backfill by collapsing to one row per conversion_id",
      "Triage: stop billing on the inflated number first; doesn't chase the 'EOS must be broken' lead",
    ],
    incident: {
      brief:
        "Conversion counts 12% high; advertisers over-billed. EOS (idempotence + transactions) is enabled AND there's a message_id dedup. conversion_id C-7781 appears 3×. Find the root cause and the fix.",
      severity: "SEV-1 · over-billing",
      tier: "hellish",
      artifacts: [
        { name: "config/producer.properties", kind: "config", language: "text", content: EOS_PRODUCER },
        { name: "src/sink.py", kind: "code", language: "python", content: EOS_SINK },
        { name: "logs/reporting.log", kind: "log", language: "text", content: EOS_LOG },
      ],
      sql: { setupSql: EOS_SETUP, tables: ["conversions"] },
    },
  },

  /* 6 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-schema-registry-crash",
    category: "incident",
    level: "senior",
    title: "Every profile consumer crash-looped right after a deploy",
    company: "Streaming video",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-1: at 12:00 a producer deploy went out and within seconds all 8 profile consumers entered a deserialize crash-loop; profile updates stopped org-wide. After someone reverts the schema, a SECOND class of crash appears on one specific record. Investigate the stack trace, the registry compat config and the consumer code, then submit the root cause and the fix.",
    hints: [
      "The crash is a deserialize error: 'missing required field country_code'. The producers added a REQUIRED field with no default. Check the registry's compatibility mode and whether that change is actually compatible.",
      "FORWARD vs BACKWARD matters here, and so does the deploy order (producers vs consumers first). Also: was the registry compatibility check even enforced, or did auto.register.schemas bypass it?",
      "After the schema is reverted, one record at offset 5567 still crashes. The topic is log-compacted — what kind of record has a non-null key and a NULL value, and does the consumer handle it?",
    ],
    idealAnswer: "",
    rubric: [
      "Primary root cause: producers registered/deployed Profile v3 adding a REQUIRED field with no default — not a forward/backward-compatible change the way the team assumed; old consumers can't read it",
      "Notes process failures: registry compat check bypassed (auto.register.schemas=true) and wrong deploy order for the chosen compat mode",
      "Correct fix for the schema: make the new field optional / give it a default (or remove required), enforce compatibility in CI, and order the deploy correctly (consumers before producers for backward)",
      "Spots the SECOND, separate issue: offset 5567 is a log-compaction TOMBSTONE (non-null key, NULL value); the consumer NPEs because it doesn't special-case null values",
      "Fix for the tombstone: handle null value (treat as delete) before deserializing/upserting",
      "Triage: stop the crash-loop (revert producer schema / pin consumers) before the deeper fixes; treats the two failures as distinct",
    ],
    incident: {
      brief:
        "12:00 producer deploy → all 8 profile consumers crash-loop on deserialize ('missing required field country_code'); profile updates halt. After revert, one record (offset 5567) still crashes. Find both root causes and the fix.",
      severity: "SEV-1 · full-outage",
      tier: "hellish",
      artifacts: [
        { name: "logs/profile-consumer.stacktrace.log", kind: "log", language: "text", content: SR_STACK },
        { name: "config/schema-registry.yaml", kind: "config", language: "text", content: SR_CONFIG },
        { name: "src/ProfileConsumer.java", kind: "code", language: "typescript", content: SR_TOMBSTONE },
      ],
    },
  },

  /* 7 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-window-undercount",
    category: "incident",
    level: "senior",
    title: "Per-minute counts are ~10% low and nobody knows why",
    company: "IoT platform",
    difficulty: "hard",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the per-minute windowed event count is consistently 8-15% below the raw count on the topic, but only for windows with mobile traffic. The job 'looks correct'. Investigate the streaming code, the metrics log and the events table, then submit the root cause and the fix.",
    hints: [
      "Check the watermark / allowed-lateness setting against how late events actually arrive. The metrics log even has a 'numRowsDroppedByWatermark' counter — is it zero?",
      "Mobile clients buffer offline and flush 30-120s late, but the watermark tolerates only 5s. Query the events table: which rows have (ingest_time - event_time) bigger than the lateness budget?",
      "It's not data loss in Kafka — the events are there; the window dropped them as 'too late'. The fix widens allowed lateness to match real arrival skew (with the latency/state trade-off in mind).",
    ],
    idealAnswer: "",
    rubric: [
      "Root cause: the watermark / allowed-lateness (5s) is far tighter than real arrival skew, so late mobile events are dropped as 'too late' and excluded from the window count",
      "Uses evidence: numRowsDroppedByWatermark is non-zero, and only mobile-bearing windows undercount; query shows ingest_time − event_time of 30-120s on mobile rows",
      "Rules out Kafka data loss / a SUM bug — the events exist on the topic; the window discarded them",
      "Fix: increase the watermark/allowed-lateness to cover the real p99 arrival delay (e.g. a few minutes), sized from the lag dashboard",
      "Names the trade-off: looser lateness raises latency and state size; mentions a side-output / late-data sink or reprocessing for events beyond the bound",
    ],
    incident: {
      brief:
        "Windowed per-minute counts run 8-15% below the raw topic count, only for windows containing mobile traffic. Job looks correct. Find the root cause and the fix.",
      severity: "SEV-2 · data-quality",
      tier: "hard",
      artifacts: [
        { name: "src/window_agg.py", kind: "code", language: "python", content: WINDOW_CODE },
        { name: "logs/streaming-metrics.log", kind: "log", language: "text", content: WINDOW_LOG },
      ],
      sql: { setupSql: WINDOW_SETUP, tables: ["events"] },
      python: true,
    },
  },

  /* 8 ───────────────────────────────────────────────────────────── */
  {
    id: "inc-stream-mirrormaker-reprocess",
    category: "incident",
    level: "mid",
    title: "After DR failover, thousands of orders shipped twice",
    company: "FAANG · search",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "SEV-2: the primary Kafka cluster failed and consumers were cut over to the DR cluster (replicated by MirrorMaker 2). Right after failover, ~3,000 orders near the boundary were fulfilled twice — no orders were lost, they were reprocessed. Investigate the MM2 config, the failover log and the consumer sink, then submit the root cause and the fix.",
    hints: [
      "The log is explicit: the consumer RESUMED at a translated offset and nothing was lost — it rewound. Read what MM2 guarantees when an exact offset translation isn't available.",
      "MM2 offset translation is not exact: when the precise mapping is missing it resolves to an EARLIER offset (never-skip), so some already-processed records get replayed. Coarse checkpoints (every 60s) widen the replay window.",
      "Replay is unavoidable with MM2; the real defect is downstream. Look at the sink — is createShipment idempotent? What absorbs a replay safely?",
    ],
    idealAnswer: "",
    rubric: [
      "Root cause: MM2 offset translation is approximate — on failover it resolves to an earlier offset (never-skip guarantee), so records near the boundary are replayed (no loss)",
      "Notes coarse checkpointing (emit.checkpoints.interval.seconds=60) widens the replay window",
      "Identifies the actual defect as the NON-idempotent sink: createShipment makes a new shipment on every call, so replay = duplicate shipments",
      "Fix: make the sink idempotent — upsert / createIfAbsent keyed on order_id (or a dedup store) so replayed records are absorbed",
      "Frames it correctly: you can't make MM2 translation exact; design consumers to tolerate at-least-once replay on failover",
    ],
    incident: {
      brief:
        "DR failover via MirrorMaker 2: ~3,000 boundary orders fulfilled twice; none lost (the consumer rewound, didn't skip). Find the root cause and the fix.",
      severity: "SEV-2 · duplicate-side-effects",
      tier: "standard",
      artifacts: [
        { name: "config/mm2.properties", kind: "config", language: "text", content: MM2_CONFIG },
        { name: "logs/failover.log", kind: "log", language: "text", content: MM2_LOG },
        { name: "src/OrdersConsumer.java", kind: "code", language: "typescript", content: MM2_SINK },
      ],
    },
  },
];
