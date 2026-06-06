import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR  — topics, partitions, producers, consumers, offsets,
  //           what a consumer group is, basic delivery semantics
  // ─────────────────────────────────────────────────────────────
  junior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 28,
        questionText:
          "What is a Kafka topic, a partition, and a consumer group? How do they fit together?",
        answerStructured:
          "- A **topic** is a named, durable log that producers write to and consumers read from — think of it as a category for a stream of events.\n- A **partition** is an ordered, append-only sub-log within a topic. Each partition is an independent sequence, so a topic with N partitions is N parallel ordered logs, not one global ordered log.\n- A **consumer group** is a set of consumers that collectively read a topic. Kafka assigns each partition to **at most one consumer** within a group at a time, so the group reads the topic as a whole without duplicating work.\n- Consequence: **partition count caps consumer parallelism**. A topic with 6 partitions can be consumed in parallel by at most 6 consumers in a group. The 7th consumer sits idle.\n- **Offsets** track each consumer group's position in each partition — a durable, per-(group, partition) bookmark. Kafka does not delete messages after consumption; consumers advance their own offsets.",
        explanationDeep:
          "The mental model that clicks for most people: a topic is a book, partitions are chapters, and each consumer in a group owns a chapter. Two consumers can't read the same chapter simultaneously (within one group), but two *different* groups can each read every chapter independently — that's why Kafka supports multiple independent downstream consumers (a stream processor, a data warehouse loader, and a monitoring system can all read the same topic without affecting each other).\n\nThe offset is the key to Kafka's durability story at the consumer side. Because consumers own their offsets (stored in an internal Kafka topic called `__consumer_offsets`), a consumer can crash and resume from exactly where it left off. The broker doesn't need to know when a message was 'consumed' — retention is time- or size-based, entirely decoupled from consumption.\n\nThe partition-count-equals-max-parallelism rule is the most important thing to internalize before any Kafka design conversation. Under-partition a topic early and you can't scale out consumers later without accepting a remap of keys.",
        interviewerLens:
          "I want three things answered without prompting: (1) ordering is per-partition, not global; (2) at most one consumer per partition per group; (3) offsets are per-group-per-partition, owned by the consumer. If I get all three I know this person won't make the classic 'Kafka is a global ordered queue' design mistake. The idle-7th-consumer example is a quick signal that they've thought about real capacity limits, not just textbook definitions.",
        followupChain: [
          {
            question: "Can two consumer groups read the same topic? What happens to their offsets?",
            answer: "Yes — each group maintains completely independent offsets. Group A and Group B can both read the same topic from the beginning, at their own paces, and neither affects the other. That's a core Kafka advantage over traditional queues that delete messages after one consumer reads them."
          },
          {
            question: "What happens if you add an 8th consumer to a group reading a 6-partition topic?",
            answer: "The 8th consumer gets no partition assigned and sits idle. You cannot get more parallel consumers than partitions. To gain more parallelism you must increase the partition count — but that has ordering implications for keyed producers."
          },
          {
            question: "Why does Kafka store offsets in a topic rather than on the broker?",
            answer: "It gives offset storage the same durability guarantees as message data: replication, compaction (keeping only the latest offset per group-partition), and replaying history. It also decouples broker restarts from consumer state."
          },
        ],
        redFlags: [
          {
            junior: "\"Kafka keeps all messages in a single ordered queue.\"",
            senior: "\"Ordering is per-partition only. A topic with multiple partitions is multiple independent ordered logs — global order requires a single partition.\""
          },
          {
            junior: "\"I can add more consumers whenever I need more throughput.\"",
            senior: "\"Consumers in a group are capped at the number of partitions — extra consumers sit idle. To add parallelism I need to increase partitions, which has remap consequences for keyed topics.\""
          },
        ],
        alternatePhrasings: [
          "\"Explain how Kafka distributes work across consumers.\"",
          "\"What is an offset in Kafka?\"",
          "\"How does Kafka differ from a traditional message queue?\"",
        ],
        interviewContexts: [
          "Junior DE screen at a Series B streaming-data startup",
          "Asked in every Kafka fundamentals interview across 2024-2025 loops",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "Walk me through what happens when a producer sends a message to Kafka. What is the role of the partition key, and how does Kafka route the message?",
        code: [
          {
            lang: "python",
            label: "Key routes the partition",
            lines: [
              "from confluent_kafka import Producer",
              "p = Producer({'bootstrap.servers':'b'})",
              "# same key -> one partition, ordered",
              "p.produce('orders', key='cust-42',",
              "          value=b'paid')",
              "# null key -> round-robin / sticky",
              "p.produce('orders', value=b'log')",
            ],
          },
        ],
        answerStructured:
          "- The producer picks a **target partition** before sending. The routing logic:\n  - If a **key** is provided: `partition = hash(key) % numPartitions` — all messages with the same key land on the same partition, preserving order for that key.\n  - If no key is provided: the default partitioner distributes round-robin (or with the sticky batching strategy in recent Kafka versions for better throughput).\n- The message goes to the **partition leader** on the broker that owns that partition. Replicas on other brokers follow asynchronously.\n- The broker writes the message to the partition log and returns an acknowledgment to the producer (per the `acks` setting).\n- The **key choice** is the most consequential producer decision: choose a key that groups everything that must stay ordered (e.g., `user_id`, `order_id`), or leave keyless if ordering doesn't matter and you want even distribution.\n- Beware: a **skewed key** (e.g., one key representing a mega-customer with 80% of traffic) creates a **hot partition** — one partition/consumer handles the bulk of the load.",
        explanationDeep:
          "The key is not just a label — it is the partition routing function. Every design decision about keys flows from the single constraint: all records with the same key land on the same partition, and that partition is assigned to one consumer at a time. So the key determines both ordering and load distribution simultaneously.\n\nThis dual role creates a tension: the key that gives you correct ordering (user_id to keep all events for a user in sequence) is also the key that can cause hot partitions (if one user generates far more events than others). The design challenge is picking a key that is both semantically correct for ordering and cardinality-high enough to distribute load evenly.\n\nThe sticky partitioner (Kafka 2.4+, default in 3.x) is an improvement for keyless producers: instead of round-robining message by message, it fills a batch to one partition before switching. This produces larger, more efficient batches with better throughput, while still distributing load over time.",
        interviewerLens:
          "I want to hear 'hash of key mod partition count' for keyed messages and an understanding that the key controls both ordering and load distribution. The hot-partition awareness is the differentiator at even the junior level — it tells me they've read about real Kafka issues, not just the happy path. Sticky partitioner knowledge is a bonus that shows currency with recent Kafka versions.",
        followupChain: [
          {
            question: "Your producer is sending without a key. How does the message get routed?",
            answer: "With no key, the partitioner distributes messages across partitions — round-robin in older versions, sticky batching in Kafka 2.4+. Sticky fills a batch on one partition then switches, improving throughput versus per-message round-robin. No ordering guarantee across messages."
          },
          {
            question: "What is the difference between the partition leader and a follower?",
            answer: "The leader handles all reads and writes for that partition. Followers replicate from the leader. If the leader fails, an in-sync follower is promoted to leader. Producers always write to the leader; consumers typically read from the leader (though follower reads are possible with KIP-392)."
          },
        ],
        redFlags: [
          {
            junior: "\"The key is just metadata attached to the message.\"",
            senior: "\"The key is the partition routing function — hash(key) % numPartitions. It directly controls which partition the message lands on, which controls ordering and load balance.\""
          },
          {
            junior: "\"I'll use user_id as the key and not worry about distribution.\"",
            senior: "\"User_id is often right for ordering, but I check cardinality and distribution — one whale user generating 80% of events creates a hot partition that one consumer handles alone.\""
          },
        ],
        alternatePhrasings: [
          "\"How does Kafka decide which partition to write a message to?\"",
          "\"Why do you choose a partition key?\"",
          "\"What is a hot partition and how does it happen?\"",
        ],
        interviewContexts: [
          "Junior data engineer loop at a payments fintech",
          "Kafka fundamentals screen at a logistics data platform",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "What are the three Kafka delivery semantics — at-most-once, at-least-once, and exactly-once — and what do you get by default?",
        code: [
          {
            lang: "python",
            label: "Idempotent (default) vs EOS",
            lines: [
              "# 3.0+: dedupes retries per session",
              "conf = {'enable.idempotence': True,",
              "        'acks': 'all'}",
              "# full exactly-once also needs:",
              "conf['transactional.id'] = 'svc-1'",
            ],
          },
        ],
        answerStructured:
          "- **At-most-once**: the producer sends and does not wait for acknowledgment (or commits the consumer offset *before* processing). Messages may be lost on failure, but are never duplicated. Default producer `acks=0`.\n- **At-least-once**: the producer retries on failure (`acks=1` or `acks=all`, retries enabled). Messages are never lost, but a retry after a network timeout can write the same message twice. This is the most common production default — consumers must be idempotent or deduplicate.\n- **Exactly-once** (EOS): requires the **idempotent producer** (`enable.idempotence=true`) plus the **transactional API** (`transactional.id` set). The broker deduplicates retried batches using a producer ID + sequence number. Reads-process-writes are atomic across partitions. More complex and slightly lower throughput (~3% overhead vs `acks=all`).\n- **Default behavior** (Kafka 3.0+): `enable.idempotence=true` is on by default, giving per-session exactly-once production. Full EOS for a consume-transform-produce pipeline still requires transactions.\n- **Practical rule**: use at-least-once + idempotent consumers for most pipelines; escalate to transactions only for money-movement or audit-critical flows where downstream deduplication is not feasible.",
        explanationDeep:
          "The delivery semantic is a two-sided contract: the producer side (how it sends and retries) and the consumer side (when it commits the offset relative to when it processes the message). At-most-once on the consumer side means committing the offset before processing — if the consumer crashes mid-processing, the message is gone forever. At-least-once means committing after processing — if the consumer crashes after processing but before committing, the message is reprocessed.\n\nThe idempotent producer solves producer-side duplication caused by retries: Kafka assigns each producer a unique Producer ID (PID) and tracks sequence numbers per (PID, partition). If a batch arrives twice due to a retry after a network timeout, the broker detects the duplicate sequence number and discards the second write without error. This is the default in Kafka 3.0+ and costs almost nothing.\n\nFull exactly-once across a consume-transform-produce loop requires transactions: the commit of the output messages and the consumer offset commit happen atomically under one transaction ID. If anything fails, the whole transaction rolls back. This is more complex to implement and has ~15-30% throughput cost at short commit intervals, so it is reserved for pipelines where duplicate records cannot be tolerated downstream.",
        interviewerLens:
          "I want the three semantics named with their failure modes, not just the names. 'At-least-once because retries' is the answer; 'it might send twice' is the proof. For a junior, I don't expect full transaction mechanics — I want them to know that at-least-once is the practical default and that it requires idempotent consumers. The distinction between idempotent producer (deduplicates retries within a session) vs full transactions (atomic cross-partition reads+writes) is a mid-senior signal.",
        followupChain: [
          {
            question: "What is an idempotent consumer and how do you make one?",
            answer: "An idempotent consumer produces the same result whether it processes a message once or many times. You achieve this by keying writes on a business unique key (order_id, event_id) and using UPSERT / MERGE semantics in the destination — processing the same record twice just overwrites with the same data."
          },
          {
            question: "When would you accept at-most-once semantics?",
            answer: "When loss is tolerable and latency is critical: real-time dashboards, metrics aggregations, clickstream sampling. Missing 0.01% of clicks is acceptable; adding 5ms of latency per message is not."
          },
        ],
        redFlags: [
          {
            junior: "\"Kafka guarantees exactly-once by default.\"",
            senior: "\"By default (Kafka 3.0+) the producer is idempotent, which prevents retry duplicates per session — but full exactly-once across a consume-process-produce loop requires explicit transactions.\""
          },
          {
            junior: "\"At-least-once is fine — duplicates don't matter.\"",
            senior: "\"At-least-once requires idempotent consumers or deduplication logic downstream — the duplicate *will* arrive eventually during retries or rebalances.\""
          },
        ],
        alternatePhrasings: [
          "\"What does at-least-once delivery mean in Kafka?\"",
          "\"How can Kafka produce duplicate messages?\"",
          "\"What is the default Kafka delivery guarantee?\"",
        ],
        interviewContexts: [
          "Junior DE screen at a data-platform startup",
          "Asked in every Kafka delivery-semantics fundamentals loop",
        ],
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "How do you decide what to use as the partition key for a new Kafka topic?",
        code: [
          {
            lang: "python",
            label: "Compound key for a skewed value",
            lines: [
              "# whale user_id -> one hot partition",
              "p.produce('t', key=user_id, value=v)",
              "# spread it: user_id + bucket",
              "b = hash(order_id) % 8",
              "key = f'{user_id}:{b}'",
              "p.produce('t', key=key, value=v)",
              "# now per-(user,bucket) ordering only",
            ],
          },
        ],
        answerStructured:
          "- **Ask two questions first**: (1) What records must stay in order relative to each other? (2) How is the traffic distributed across possible key values?\n- The key should be the **ordering unit**: if all events for one `user_id` must be processed in order, key on `user_id`. If per-`order_id` ordering is what matters, key on `order_id`.\n- The key must have **high cardinality and even distribution**: a key with only a few distinct values (e.g., `region` with 3 values) concentrates traffic into 3 partitions max, wasting others. A key whose traffic is heavily skewed (one value generates 80% of messages) creates a hot partition.\n- **No key needed** when: ordering is irrelevant and you only care about throughput/even distribution — leave it null and let the partitioner distribute.\n- If the natural ordering key is skewed, consider a **compound key** (e.g., `user_id + bucket`) or accept that ordering is only approximate and distribute more evenly.\n- Changing the key later is painful: it requires rerouting all producers and breaks in-flight ordering guarantees.",
        explanationDeep:
          "The key decision is a permanent one (for the life of that topic's partition assignment), so it deserves careful thought up front. The two axes — ordering semantics and load distribution — are often in tension. The key that gives you perfect per-entity ordering is also the key that concentrates load if entity traffic is uneven.\n\nIn practice, I look at the p99 message volume per key value. If the top 1% of keys generate 50%+ of traffic, a pure entity key will create hot partitions. The compound key approach (e.g., appending a bucket ID 0-9 to the user_id) spreads load across 10x more partitions per entity, at the cost of losing strict global ordering for that entity — you'd need to merge 10 ordered sub-streams if you ever need total order for that user. That trade-off is usually acceptable for analytics pipelines but not for financial transaction processing.",
        interviewerLens:
          "I'm checking whether the candidate thinks about both dimensions simultaneously — ordering and distribution. Naming only one without the other shows incomplete design thinking. The 'changing the key is painful later' point is a production wisdom signal: candidates who've operated Kafka know that rekeying a high-volume topic mid-stream is a migration project, not a config change.",
        followupChain: [
          {
            question: "What is a hot partition and how would you detect one?",
            answer: "A hot partition receives significantly more messages than others — one consumer handles disproportionate load and lags behind while other consumers are idle. Detect via consumer lag metrics: if one partition consistently has growing lag while others are near zero, that partition is hot. Also check broker-side bytes-in per partition."
          },
        ],
        redFlags: [
          {
            junior: "\"I'd just key on whatever field is most convenient.\"",
            senior: "\"I'd key on the ordering unit and check that it has high cardinality and even distribution — a skewed key creates a hot partition that one consumer handles alone.\""
          },
        ],
        alternatePhrasings: [
          "\"Why does partition key choice matter?\"",
          "\"How do you avoid hot partitions in Kafka?\"",
          "\"Should I use a key or send messages without a key?\"",
        ],
        interviewContexts: [
          "Junior Kafka design question at a streaming analytics startup",
          "New topic design discussion at a real-time data platform",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "When would you use a compacted topic versus a retention-based topic in Kafka?",
        code: [
          {
            lang: "python",
            label: "Compacted topic + tombstone",
            lines: [
              "# topic config: keep latest per key",
              "# cleanup.policy = compact",
              "p.produce('profiles', key='u1',",
              "          value=b'{...}')",
              "# delete a key: None payload (tombstone)",
              "p.produce('profiles', key='u1',",
              "          value=None)",
            ],
          },
        ],
        answerStructured:
          "- **Retention-based** (default): Kafka deletes messages after a time period (`retention.ms`) or size limit (`retention.bytes`) is reached. Good for event streams where you care about *what happened* in a window of time — click events, logs, sensor readings.\n- **Compacted** (`cleanup.policy=compact`): Kafka retains only the **latest message per key**, indefinitely. Old values for a key are garbage-collected, but the current value is always available. Good for topics that represent **current state** — user profiles, account balances, feature flags.\n- **Tombstones**: to delete a key from a compacted topic, produce a message with that key and a `null` value. The compactor eventually removes the key.\n- **Hybrid** (`compact,delete`): compaction + time-based deletion — useful when you want current state but don't need history older than N days.\n- **Decision rule**: event stream with a time window → retention. Current-state snapshot → compaction. Kafka Streams changelog topics use compaction by design.",
        explanationDeep:
          "Log compaction is how Kafka supports a use-case that looks like a key-value store: always have the latest value for any key, even after the raw event stream has aged out. This is how Kafka Streams materializes its state stores — each change to the internal KTable is written as a message; compaction keeps only the latest, so the store can be rebuilt by replaying just the compacted log.\n\nThe tombstone mechanism (null value for a key) is the delete operation. Without it, compaction would keep a stale value forever even after the entity is deleted. Once a tombstone is committed, the compactor first retains the tombstone for a configurable delete retention period, then discards both the tombstone and the old values — completing the logical delete.\n\nA practical pitfall: compaction is not instantaneous. Kafka compacts in the background; a key may still have old values visible until the next compaction cycle runs. Don't assume a compacted topic is always fully up-to-date at any moment — there is an eventual-consistency lag between writing and compaction completing.",
        interviewerLens:
          "I want 'retention for event streams, compaction for current state' with a concrete example. Kafka Streams changelog knowledge is a bonus. The tombstone mechanism is a mid-level detail — knowing it shows you've actually configured or debugged compacted topics, not just read the docs.",
        followupChain: [
          {
            question: "How do you delete a record from a compacted topic?",
            answer: "Produce a message with the same key and a null value (tombstone). The log compactor sees this as a deletion marker and eventually removes both the tombstone and any older values for that key after the delete retention period."
          },
        ],
        redFlags: [
          {
            junior: "\"Compaction just removes old messages to save space.\"",
            senior: "\"Compaction retains the *latest value per key* indefinitely — it's not size reduction, it's a current-state guarantee. Retention deletes by time/size regardless of key.\""
          },
        ],
        alternatePhrasings: [
          "\"What is log compaction in Kafka?\"",
          "\"When would you set cleanup.policy=compact?\"",
          "\"How does Kafka Streams persist state?\"",
        ],
        interviewContexts: [
          "Kafka topic design question at a junior DE interview",
          "Asked in a Kafka fundamentals screen at a streaming platform",
        ],
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["Kafka", "Kinesis"],
        asked: 12,
        questionText:
          "Kafka vs Amazon Kinesis — what are the main differences and when would you choose each?",
        answerStructured:
          "- **Kafka**: open-source, self-managed (or managed via Confluent/MSK). Maximum control, lowest predictable latency (<5ms), highest throughput. Rich ecosystem: Kafka Connect, Kafka Streams, Schema Registry. **Requires operational expertise** — you own brokers, replication, upgrades.\n- **Kinesis**: fully managed AWS service, serverless-friendly. Zero broker ops. Native integration with Lambda, Glue, Firehose, S3. **Scaling is coarser**: shards are the unit of parallelism, and resharding (adding capacity) takes minutes and can disrupt consumers. Harder to replay large historical windows.\n- **Retention**: Kafka configurable up to unlimited (with tiered storage); Kinesis default 24 hours, max 365 days — less flexible.\n- **Ordering**: both guarantee per-partition/per-shard ordering. Key routing logic is similar.\n- **Cost**: Kinesis is pay-per-shard-hour + PUT payload units — can get expensive at high throughput. Kafka on MSK or self-hosted is cheaper at scale but has ops overhead.\n- **Choose Kafka** when: high throughput, low latency, need Kafka ecosystem, or org is cloud-agnostic. **Choose Kinesis** when: deep AWS integration is paramount, ops burden is unacceptable, and throughput stays within shard limits.",
        explanationDeep:
          "The fundamental trade-off is operational simplicity versus control. Kinesis is the right answer for an AWS-native team that wants streaming without hiring a Kafka expert — zero infrastructure to manage, built-in scaling within limits, and native connectors to every AWS service. The cost of that simplicity is flexibility: resharding is slower and more disruptive than adding Kafka partitions, retention is capped and less configurable, and the ecosystem is narrower.\n\nKafka wins when you need the ecosystem. Kafka Connect has hundreds of source and sink connectors. Kafka Streams and ksqlDB are powerful stream processing layers that don't exist in the Kinesis world. If you're doing complex fan-out (one topic powering a Flink job, a warehouse loader, a real-time alerting system, and a search index), Kafka's consumer group model handles that elegantly. Kinesis can do it too but requires more glue.\n\nModern MSK (Amazon Managed Streaming for Kafka) blurs the line: you get Kafka semantics on managed infrastructure. Many teams land on MSK when they want Kafka's model without managing brokers themselves.",
        interviewerLens:
          "I'm not looking for a winner — I'm looking for 'it depends on ops maturity and AWS coupling.' If you immediately say 'Kafka is always better,' you haven't valued your ops team's time. If you say 'Kinesis is fine,' you haven't thought about the throughput ceiling or ecosystem limits. The MSK middle-ground answer shows real-world exposure.",
        followupChain: [
          {
            question: "What is Confluent Cloud and how does it change the Kafka vs Kinesis decision?",
            answer: "Confluent Cloud is fully managed Kafka — you get Kafka's full semantics and ecosystem without managing brokers. It shifts the Kafka vs Kinesis decision to Kafka semantics vs AWS-native integration, with both having managed infrastructure. Confluent tends to win when you're cloud-agnostic or need the Confluent ecosystem (KSQL, Schema Registry as a service)."
          },
        ],
        redFlags: [
          {
            junior: "\"We're on AWS so we should use Kinesis.\"",
            senior: "\"AWS doesn't require Kinesis — MSK gives Kafka on AWS. I'd choose based on throughput needs, ecosystem requirements, ops budget, and whether Kinesis's scaling model fits the traffic pattern.\""
          },
        ],
        alternatePhrasings: [
          "\"Why would you pick Kafka over a managed service like Kinesis?\"",
          "\"We're on AWS — should we use Kinesis or MSK?\"",
        ],
        interviewContexts: [
          "Junior DE interview at an AWS-native startup",
          "Streaming tool selection question at a data engineering loop",
        ],
      },
    ],
    topics: {
      moreDeepDives: [
        "What is the `__consumer_offsets` topic and how does Kafka use it?",
        "Walk me through what happens when a Kafka broker fails.",
        "What is a Kafka rebalance and what triggers one?",
        "How does the consumer poll loop work — what is `max.poll.interval.ms`?",
        "What is consumer lag and how do you monitor it?",
        "How does Kafka retain messages — what controls when messages are deleted?",
      ],
      decisions: [
        "Keyed vs keyless producer — how do you decide?",
        "When does a single-partition topic make sense?",
        "At-most-once vs at-least-once — when is data loss acceptable?",
      ],
      quickRef: [
        "What guarantees ordering in Kafka?",
        "What is a consumer group?",
        "What is an offset?",
        "What does the partition key control?",
        "What is log compaction?",
        "At-most-once vs at-least-once in one sentence each",
        "What is a tombstone in a compacted topic?",
        "What is a partition leader?",
        "How many consumers can read one partition in a single group?",
        "What is the default cleanup.policy for a Kafka topic?",
      ],
      redFlags: [
        {
          junior: "\"Kafka guarantees global ordering across a topic.\"",
          senior: "\"Ordering is per-partition only — I key on the entity that must stay ordered so its messages land on one partition.\""
        },
        {
          junior: "\"I can just add more consumers to scale up.\"",
          senior: "\"Consumers are bounded by partition count — the Nth+1 consumer sits idle. Scaling requires adding partitions, which has key-remap consequences.\""
        },
        {
          junior: "\"Kafka deletes messages after they are consumed.\"",
          senior: "\"Kafka deletes by time or size, not by consumption — consumers advance their own offsets independently of retention.\""
        },
      ],
      checklist: [
        "Explain topic/partition/consumer-group triangle with the parallelism cap",
        "Know how partition key routing works (hash % N) and hot-partition risk",
        "Be able to name all three delivery semantics with their failure modes",
        "Know compaction vs retention and the tombstone mechanism",
        "Understand offset ownership: consumer-owned, stored in __consumer_offsets",
      ],
      behavioral: [
        "Tell me about a time you designed or reviewed a Kafka topic schema — what tradeoffs did you make?",
        "Describe a data pipeline you built that used Kafka — what was the consumer group setup?",
        "How would you explain Kafka partitions to a non-technical teammate?",
      ],
      reverse: [
        "What delivery semantics do your current Kafka consumers use?",
        "How many partitions do your highest-throughput topics have today?",
        "Is there a Schema Registry in place, and is Avro or Protobuf the standard?",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // MID  — partitioning & ordering (per-partition only), consumer
  //        parallelism cap, delivery semantics at-least/exactly-once,
  //        consumer lag, rebalancing, ISR introduction
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 26,
        questionText:
          "How does Kafka partitioning interact with ordering guarantees and consumer parallelism? What breaks when you add partitions to a live topic?",
        code: [
          {
            lang: "python",
            label: "Adding partitions remaps the hash",
            lines: [
              "h = hash('cust-42')   # fixed per key",
              "h % 12   # -> partition 3",
              "# grow topic 12 -> 16 partitions:",
              "h % 16   # -> partition 7  (moved!)",
              "# in-flight order for cust-42 splits",
            ],
          },
        ],
        answerStructured:
          "- **Ordering is per-partition, not per-topic.** A topic with 12 partitions is 12 independent ordered logs — there is no guaranteed order across partitions.\n- **Parallelism is bounded by partition count.** A consumer group can have at most one active consumer per partition, so 12 partitions = max 12 parallel consumers. Additional consumers in the group sit idle.\n- The **key determines the partition**: `partition = hash(key) % numPartitions`. All messages with the same key land on the same partition, preserving order for that entity.\n- **Adding partitions to a live topic remaps the hash function.** Because `numPartitions` changes, a key that previously hashed to partition 3 might now hash to partition 7. Messages in flight for that key span two partitions, breaking the ordering guarantee. Any consumer that depends on sequential order for a key will see out-of-order messages during the transition.\n- **Consequence**: partition count is an up-front capacity decision. The standard advice is to over-partition by 2-3x anticipated parallelism rather than under-partition and remap later.",
        explanationDeep:
          "This is the question that separates engineers who have read about Kafka from engineers who have operated it. The partition remap on resize is the gotcha that catches teams off guard: they hit a throughput ceiling, add partitions, and their downstream consumers start seeing ordering violations for keys that straddle the old and new partitions.\n\nThe safe way to increase partitions on a production topic is to do it during a maintenance window, drain in-flight messages for affected keys, and ensure consumers are stateless (or can handle out-of-order events gracefully) before the remap takes effect. Some teams instead spin up a new topic with more partitions and migrate producers, keeping the old topic alive until all consumer lag drains to zero.\n\nThe over-provisioning principle (Confluent recommends 2-3x the number of brokers as a starting point for high-throughput topics) is specifically to avoid being forced into a remap. Unused partitions cost very little — a few extra file handles and metadata overhead on the broker — while the remap cost in production can be significant.",
        interviewerLens:
          "The two-sentence answer I need: 'ordering is per-partition, not per-topic' and 'adding partitions remaps the hash function and breaks ordering for in-flight keys.' If I hear both unprompted, this person has run Kafka under real load. The follow-up trap is 'so just add lots of partitions upfront, right?' — I want to hear the overhead trade-off too: too many partitions increases broker file handles, replication overhead, and rebalance duration.",
        followupChain: [
          {
            question: "A single consumer can't keep up with a high-volume partition. What are your options?",
            answer: "First, increase partition count so more consumers can share the load — accepting the remap trade-off. Second, optimize the consumer's processing (batching, parallelizing work within the consumer). Third, fan out within the consumer: read from Kafka in one thread and push to a local work queue processed by a thread pool. If the consumer writes to a database, that write throughput is often the real bottleneck — optimize that layer before adding partitions."
          },
          {
            question: "Why does Confluent recommend 2-3x brokers as a partition count heuristic?",
            answer: "With more partitions than brokers, leadership of partitions distributes more evenly across brokers, balancing both write throughput and replication load. Too few partitions per broker leaves broker capacity underutilized. The exact number should be derived from throughput math: target MB/s per topic divided by single-partition consumer throughput."
          },
          {
            question: "What is the rebalancing cost of adding many partitions?",
            answer: "When consumers rebalance (on join, leave, or partition change), the group coordinator must assign all partitions across all consumers. More partitions means more coordination overhead and a longer stop-the-world pause (with the eager rebalance protocol). With cooperative sticky rebalancing (default in Kafka 3.0+), only affected partitions are reassigned, reducing but not eliminating this cost."
          },
        ],
        redFlags: [
          {
            junior: "\"Just add partitions whenever you need more throughput.\"",
            senior: "\"Adding partitions remaps the hash function and breaks ordering for in-flight keyed messages — it's an up-front decision, not a live knob.\""
          },
          {
            junior: "\"Kafka guarantees order across the whole topic.\"",
            senior: "\"Order is per-partition only. Cross-partition ordering requires a single-partition topic or application-level sequencing.\""
          },
        ],
        alternatePhrasings: [
          "\"How do you scale Kafka consumers?\"",
          "\"What happens when you add partitions to a topic with a keyed producer?\"",
          "\"How do you guarantee ordering in Kafka at scale?\"",
        ],
        interviewContexts: [
          "Mid-level DE interview at a payments company (2024)",
          "Streaming platform design round at a Series C startup",
          "Asked at a real-time data infrastructure team at a logistics company",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 21,
        questionText:
          "What is consumer lag, how do you monitor it, and how do you diagnose whether it is a consumer problem or a producer problem?",
        code: [
          {
            lang: "python",
            label: "Inspect per-partition lag",
            lines: [
              "# kafka-consumer-groups.sh --describe \\",
              "#   --group g1 --bootstrap-server b:9092",
              "# PARTITION CURRENT  LOG-END  LAG",
              "#   0        980     1000     20",
              "#   3        100     5000   4900  <- hot",
            ],
          },
        ],
        answerStructured:
          "- **Consumer lag** = `(Log End Offset of partition) - (Last Committed Offset of the consumer group for that partition)`. It measures how many messages the consumer group has yet to process.\n- **Monitor via**: `kafka-consumer-groups.sh --describe`, the JMX metric `kafka.consumer.consumer-fetch-manager-metrics:records-lag-max`, or purpose-built tools like **Burrow**, Confluent Control Center, or Datadog's Kafka integration.\n- **Diagnosing the root cause**:\n  1. **Is lag growing uniformly across all partitions?** → The consumer is simply slower than the producer. Add consumers (up to the partition count), optimize processing logic, or scale the downstream system (e.g., destination database throughput).\n  2. **Is lag growing on one partition only?** → Hot partition. One consumer handles disproportionate load. The key distribution is skewed. Solution: better key choice or repartition.\n  3. **Is lag spiking then recovering?** → Bursty producer or garbage collection pause in the consumer. Check producer throughput spikes and consumer GC logs.\n  4. **Is lag stable (not growing) but high?** → The consumer is keeping pace but started behind, or a previous backlog hasn't drained. Check if a consumer was down recently.\n- **Producer-side check**: compare the topic's `bytes-in-per-second` rate before and during the lag event. If the producer rate is unchanged and the consumer is slower, the consumer is the problem.",
        explanationDeep:
          "Consumer lag is the leading indicator of pipeline health. A lag of zero means real-time; a lag growing without bound means the consumer will fall arbitrarily far behind and your pipeline's freshness SLA will eventually be violated.\n\nThe hot-partition diagnosis is the trickier case and the one most often missed. If you see lag on partition 2 growing while partitions 0, 1, 3-11 are at zero, the bottleneck is not the overall consumer group throughput — it's the load imbalance. Adding consumers won't fix it because partition 2 can only have one consumer. The fix is upstream: change the partition key to distribute traffic more evenly, or add more partitions (accepting the remap trade-off).\n\nBurrow (LinkedIn's open-source consumer lag evaluator) is worth knowing by name — it models lag as a sliding window and distinguishes between a consumer that is just slow but making progress versus one that is stuck or falling behind at an accelerating rate. It alerts on trend, not just absolute value. Many teams use it alongside standard JMX metrics.",
        interviewerLens:
          "The split-by-partition diagnosis is the senior tell. Candidates who just say 'add more consumers' haven't debugged lag from a hot partition. I'll ask: 'you added consumers and lag still grows on partition 3 — what now?' The answer is key skew, not more consumers, and I want them to get there quickly.",
        followupChain: [
          {
            question: "A consumer group has been down for 6 hours. When it comes back, it has massive lag. What do you do?",
            answer: "Assess whether you need to catch up or reset. Catching up: let it run — it will drain the backlog if it can process faster than the current producer rate. Reset: if the lag represents stale data you don't need to process (e.g., hourly metrics that are now outdated), reset the offset to the latest position with --reset-offsets --to-latest. Use reset carefully — it permanently skips messages."
          },
          {
            question: "What is the high watermark and how does it relate to lag?",
            answer: "The high watermark (HW) is the offset of the last message replicated to all in-sync replicas. Consumers can only read up to the HW — they cannot read messages the leader has written but replicas haven't acknowledged yet. The log end offset (LEO) may be ahead of the HW under heavy load. True consumer lag is measured against the HW, not the LEO."
          },
        ],
        redFlags: [
          {
            junior: "\"Just add more consumers to reduce lag.\"",
            senior: "\"Adding consumers helps if lag is uniform across partitions. If it's isolated to one partition, that's key skew — more consumers can't help because only one consumer can read that partition.\""
          },
          {
            junior: "\"I'd check lag with the consumer application metrics.\"",
            senior: "\"I'd check per-partition lag with kafka-consumer-groups or Burrow, then look at the producer rate to distinguish consumer bottleneck from producer spike.\""
          },
        ],
        alternatePhrasings: [
          "\"How do you monitor a Kafka pipeline's health?\"",
          "\"Your consumer group is falling behind — walk me through diagnosing it.\"",
          "\"What is the difference between log end offset and committed offset?\"",
        ],
        interviewContexts: [
          "Mid-level DE on-call readiness question at a streaming data company",
          "Operational Kafka question at a fintech platform interview",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "What is a consumer group rebalance, what triggers one, and how does it impact your pipeline? What is cooperative sticky rebalancing?",
        code: [
          {
            lang: "python",
            label: "Minimize rebalance impact",
            lines: [
              "conf = {",
              " 'partition.assignment.strategy':",
              "     'cooperative-sticky',",
              " 'max.poll.interval.ms': 600000,",
              " 'session.timeout.ms': 45000,",
              "}",
            ],
          },
        ],
        answerStructured:
          "- A **rebalance** is the redistribution of partition assignments across consumers in a group. During an eager (classic) rebalance, **all consumers stop processing**, return their partitions, and wait for the group coordinator to issue new assignments. This is a stop-the-world event.\n- **Triggers**: a consumer joins or leaves the group; a consumer fails to poll within `max.poll.interval.ms` (default 5 minutes); a new partition is added to a subscribed topic; a consumer sends a heartbeat late enough to be considered dead.\n- **Eager rebalancing** (classic protocol): all consumers revoke all partitions simultaneously, causing a processing gap proportional to the group size. In large groups or with slow consumer startup, this can mean tens of seconds of zero throughput.\n- **Cooperative sticky rebalancing** (Kafka 2.4+, `CooperativeStickyAssignor`, default in 3.0+): only the partitions that need to move are revoked. Consumers that keep their current assignments continue processing. This is incremental — it may take 2-3 rebalance rounds to reach the final state, but there is no full stop-the-world.\n- **Minimize rebalances by**: tuning `session.timeout.ms` and `heartbeat.interval.ms` to avoid false deaths; setting `max.poll.interval.ms` high enough for your slowest processing batch; using CooperativeStickyAssignor.\n- `max.poll.records` controls how many records one poll() call returns — reducing it can prevent processing taking longer than `max.poll.interval.ms` and triggering spurious rebalances.",
        explanationDeep:
          "The rebalance is Kafka's mechanism for fault tolerance and elastic scaling, but it is a double-edged sword. Adding consumers to scale out also triggers a rebalance, temporarily pausing all consumers in the group. For high-throughput, latency-sensitive pipelines, a 30-second rebalance gap is unacceptable during a scaling event.\n\nCooperative sticky rebalancing solves this by changing the protocol: instead of 'everyone stops and we reassign everything,' it is 'only tell me which partitions I need to give up.' Consumers that keep their assignments never stop. The trade-off is slightly more rebalance rounds (the coordinator has to negotiate which partitions move in phases), but processing throughput is maintained throughout.\n\nA common production pitfall: a consumer takes too long to process a large batch and exceeds `max.poll.interval.ms`. Kafka declares that consumer dead and triggers a rebalance. The consumer finishes processing, tries to commit its offset, and finds it has been evicted from the group — it then re-joins, triggering another rebalance. The fix is either to reduce batch size (`max.poll.records`) or to increase `max.poll.interval.ms` to account for the real processing time.",
        interviewerLens:
          "The word I am listening for is 'stop-the-world' to describe eager rebalancing, and 'incremental' or 'only moves affected partitions' for cooperative. Candidates who describe cooperative rebalancing accurately have kept up with Kafka's evolution post-2.4. The max.poll.interval.ms gotcha is a production experience signal — it's a subtle interaction between consumer processing time and group membership that trips up many teams.",
        followupChain: [
          {
            question: "How do you configure a consumer to use cooperative sticky rebalancing?",
            answer: "Set `partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor` in the consumer configuration. In Kafka 3.0+ this is the default. If upgrading a running consumer group, you need to do a rolling migration: add the cooperative assignor alongside the classic assignor for a few rebalance cycles until all consumers have switched."
          },
          {
            question: "What is max.poll.interval.ms and why can setting it too low cause rebalances?",
            answer: "max.poll.interval.ms is the maximum time between two poll() calls before Kafka considers the consumer dead and triggers a rebalance. If your processing logic takes longer than this (long database writes, slow external API calls), the consumer exceeds the timeout mid-processing, gets ejected from the group, and a rebalance fires. Fix: set this to exceed your worst-case processing time, or reduce max.poll.records to make each batch process faster."
          },
        ],
        redFlags: [
          {
            junior: "\"Rebalancing is just Kafka redistributing partitions — it's automatic and fine.\"",
            senior: "\"Eager rebalancing is a stop-the-world event for the whole group — I tune session/poll timeouts and use cooperative sticky rebalancing to minimize the impact.\""
          },
          {
            junior: "\"I'll add more consumers to handle the load and not worry about the rebalance.\"",
            senior: "\"Every consumer add triggers a rebalance. With eager protocol, the whole group pauses. That's why I'd use cooperative sticky and pre-provision enough partitions rather than scaling up during a traffic spike.\""
          },
        ],
        alternatePhrasings: [
          "\"What is a Kafka rebalance and how do you reduce its impact?\"",
          "\"Why does my consumer group pause when I add a new consumer?\"",
          "\"What is max.poll.interval.ms and why does it matter?\"",
        ],
        interviewContexts: [
          "Mid-level Kafka operational interview at a data platform team",
          "Streaming pipeline reliability question at a Series B company",
        ],
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 19,
        questionText:
          "How do you choose the right Kafka delivery semantic for a new pipeline — at-least-once vs exactly-once? Walk me through the decision.",
        code: [
          {
            lang: "python",
            label: "At-least-once + idempotent sink",
            lines: [
              "conf = {'acks': 'all',",
              "        'enable.idempotence': True,",
              "        'retries': 2147483647}",
              "# sink dedupes on a business key:",
              "# INSERT ... ON CONFLICT (id)",
              "#   DO UPDATE SET ...",
            ],
          },
        ],
        answerStructured:
          "- **Start with the cost of duplicates in the downstream system.**\n  - Duplicates are **cheap to handle**: idempotent destination (database UPSERT on a unique key, idempotent REST API) → use **at-least-once**. It is simpler, cheaper (~3% overhead vs acks=all), and covers the vast majority of pipelines.\n  - Duplicates are **impossible to handle** downstream (money movement, audit log where reprocessing creates incorrect financial records, exactly-counted metrics) → use **exactly-once (EOS)**.\n- **At-least-once recipe**: enable `acks=all`, `retries=Integer.MAX_VALUE`, `enable.idempotence=true` (deduplicates retries within a session). Make consumers idempotent via UPSERT on a business unique key.\n- **Exactly-once recipe**: add `transactional.id` to the producer, call `beginTransaction()` / `commitTransaction()`, and commit the consumer offset inside the same transaction. Both output messages and offset commits are atomic — either both commit or both roll back.\n- **EOS cost**: ~3% throughput reduction vs `acks=all` for the idempotent producer alone; 15-30% for full transactions with short commit intervals. Longer transaction intervals (e.g., 1-5 seconds) reduce the overhead significantly.\n- **EOS scope**: the transactional guarantee is Kafka-to-Kafka (read from topic A, write to topic B, commit offset for A atomically). If the final sink is a database, you need the database to participate in the transaction (2PC) or use application-level deduplication at the sink.",
        explanationDeep:
          "The framing I use: exactly-once is expensive — not prohibitively, but meaningfully — and it is only necessary when the downstream system cannot tolerate or deduplicate duplicates. Most pipelines land at at-least-once + idempotent destination because idempotent UPSERTs are cheap and the throughput cost of transactions is real.\n\nThe transactional guarantee scope is the key nuance often missed: Kafka transactions are Kafka-native. They guarantee atomic reads and writes *within Kafka* — the consumer offset and the output message commit as one unit. If the pipeline writes to Postgres instead of a Kafka topic, Kafka transactions alone don't protect that write. You'd need either a 2PC with Postgres (complex, rare) or an outbox pattern where the canonical write happens in the database and Kafka is populated via CDC.\n\nA practical middle path: if your consumer is writing to Postgres, use at-least-once in Kafka and make the Postgres write idempotent (INSERT ... ON CONFLICT DO UPDATE on the event's unique ID). This is simpler than full transactions and covers 95% of real use cases that might initially seem to need EOS.",
        interviewerLens:
          "I am listening for 'it depends on whether the downstream can tolerate duplicates' — not a blanket 'use exactly-once always' or 'at-least-once is fine.' The EOS scope limitation (Kafka-to-Kafka only) is the question I follow up with: 'your sink is a Postgres table — does your Kafka transaction cover the Postgres write?' Candidates who say yes haven't understood the boundary of the guarantee.",
        followupChain: [
          {
            question: "Your pipeline writes Kafka-consumed records to a Postgres table. You need exactly-once. How do you achieve it?",
            answer: "Kafka transactions alone don't cover a Postgres write. Options: (1) Use at-least-once in Kafka and make the Postgres write idempotent (INSERT ... ON CONFLICT DO UPDATE on a business unique key). (2) Outbox pattern: write to Postgres atomically with the business logic, then CDC the Postgres table to Kafka — the source of truth is Postgres, not Kafka. (3) Two-phase commit (complex, rarely used in practice)."
          },
          {
            question: "What is zombie fencing in Kafka transactions?",
            answer: "A zombie producer is an old producer instance that was thought to have failed but is still running and trying to commit messages from a stale transaction. Kafka fences zombies by incrementing the producer epoch for a given transactional.id on each new producer initialization. The broker rejects writes from any producer with a lower epoch — the zombie's commits are discarded."
          },
        ],
        redFlags: [
          {
            junior: "\"Always use exactly-once to be safe.\"",
            senior: "\"EOS has a 15-30% throughput cost at short commit intervals — I use it only when the downstream truly can't tolerate duplicates. At-least-once + idempotent destination covers most cases.\""
          },
          {
            junior: "\"Setting enable.idempotence=true gives me exactly-once.\"",
            senior: "\"Idempotence prevents retry duplicates within a session — it's per-producer, not a full pipeline guarantee. True EOS for a consume-process-produce loop requires transactions.\""
          },
        ],
        alternatePhrasings: [
          "\"When do you need Kafka transactions?\"",
          "\"How do you prevent duplicate records in a Kafka pipeline?\"",
          "\"What is the exactly-once producer setting?\"",
        ],
        interviewContexts: [
          "Mid-level DE interview at a fintech payments company (2024)",
          "Streaming architecture design question at a data infrastructure team",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you decide how many partitions a new Kafka topic should have? Walk me through the math and the trade-offs.",
        code: [
          {
            lang: "python",
            label: "Partition count from throughput",
            lines: [
              "import math",
              "target = 200   # MB/s",
              "per_part = 15  # MB/s/partition",
              "n = math.ceil(target / per_part)  # 14",
              "n = max(n, consumers)  # >= parallelism",
              "n *= 2  # 2-3x headroom, no remap later",
            ],
          },
        ],
        answerStructured:
          "- **Throughput-based formula**: `partitions = ceil(target_MB_per_second / single_partition_throughput_MB_per_second)`. A single partition typically handles 10-20 MB/s on modern hardware depending on message size, compression, and consumer processing speed. Measure your specific case.\n- **Parallelism target**: partitions must be >= the number of consumers you want to run simultaneously. If you anticipate needing 12 parallel consumers at peak, you need at least 12 partitions.\n- **Over-provision**: start at 2-3x anticipated parallelism, because adding partitions later remaps the hash function and breaks ordering for keyed topics.\n- **Upper bound trade-offs**:\n  - Each partition requires an open file descriptor on the broker.\n  - Leader election during broker failure takes longer with many partitions.\n  - Rebalances take longer with more partitions (less critical with cooperative sticky).\n  - End-to-end latency increases with many partitions if `linger.ms` is nonzero (producer waits to fill batches).\n- **Confluent's heuristic**: start with `numBrokers * replicationFactor * 2` or 10-30 partitions for an average topic, and increase only if throughput analysis demands it.\n- **Key distribution**: if using a key, partition count should be a multiple of the expected number of distinct key values if possible, to ensure even distribution.",
        explanationDeep:
          "The partition count decision is one of the few permanent architectural choices in Kafka — it can be changed, but not without consequences. Over-provisioning is the standard advice because the cost of an extra partition is low (a few MB of metadata, extra file handles), while the cost of an under-partitioned topic is either a hard throughput ceiling or a painful repartition migration.\n\nThe throughput formula requires empirical data. A partition's throughput capacity depends on the message size (small messages → more overhead per byte), consumer processing time (if the consumer takes 10ms per message, throughput is capped at 100 messages/s regardless of broker speed), and compression ratio. Benchmarking with production-representative data gives you a real number to plug into the formula.\n\nA common mistake is setting partition count = number of current consumers. That leaves no room to scale the consumer group without adding partitions. The 2-3x over-provisioning gives elastic headroom.",
        interviewerLens:
          "I want the throughput formula attempted (even approximately) and the remap-on-resize risk named. Candidates who say 'just set it to 32' without reasoning haven't designed a production Kafka topic from first principles. The trade-off list (file handles, election time, rebalance overhead) shows they understand that more partitions is not always better.",
        followupChain: [
          {
            question: "You have a topic with 6 partitions and need to double throughput. You can't add more consumers per partition. What do you do?",
            answer: "You need to add partitions — but you must account for the key remap. Options: (1) If ordering can tolerate a brief disruption: add partitions, drain in-flight messages, then reroute producers. (2) Create a new 12-partition topic, migrate producers to it, and run old + new consumers in parallel until the old topic drains. (3) If feasible, pause producers during the repartition — safest for ordered pipelines."
          },
        ],
        redFlags: [
          {
            junior: "\"I'd set partitions to however many consumers I have.\"",
            senior: "\"I'd over-provision 2-3x for headroom. Partitions = consumers is too tight — adding one consumer triggers a repartition if you've left no room.\""
          },
          {
            junior: "\"More partitions is always better for throughput.\"",
            senior: "\"More partitions increases file handles, rebalance time, and election time. I size to 2-3x anticipated parallelism and no more.\""
          },
        ],
        alternatePhrasings: [
          "\"How many partitions should I create for a new topic?\"",
          "\"Walk me through the Kafka partition sizing decision.\"",
          "\"Why can't I just add partitions whenever I need more throughput?\"",
        ],
        interviewContexts: [
          "Mid-level DE Kafka design round at a streaming analytics company",
          "New topic creation design discussion at a data platform team",
        ],
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["acks=all", "acks=1"],
        asked: 16,
        questionText:
          "acks=all vs acks=1 in Kafka — what is the durability difference, and when do you choose each?",
        code: [
          {
            accent: "bug",
            lang: "python",
            label: "Unsafe: ISR can degrade silently",
            lines: [
              "# ISR can shrink to 1 -> silent",
              "# leader-only durability",
              "conf = {'acks': 'all'}",
            ],
          },
          {
            accent: "fix",
            lang: "python",
            label: "Safe: fail-fast on too few ISRs",
            lines: [
              "conf = {'acks': 'all'}  # producer",
              "# broker/topic side, RF=3:",
              "# min.insync.replicas = 2",
              "# now fewer ISRs -> write fails fast",
            ],
          },
        ],
        answerStructured:
          "- **acks=1**: the broker leader acknowledges the write after writing to its own log, before any followers replicate. If the leader fails immediately after acknowledgment but before followers catch up, that message is **lost**. Lower latency (~40-50% less than acks=all on a 3-replica cluster).\n- **acks=all (acks=-1)**: the leader waits until all **in-sync replicas (ISR)** have written the message before acknowledging. Survives leader failure — any ISR member can take over with the full message. **Highest durability guarantee.**\n- **Combine with `min.insync.replicas`**: with `acks=all` alone, if the ISR shrinks to 1 replica (the leader), the guarantee degrades to leader-only. Setting `min.insync.replicas=2` on the broker/topic causes the producer to receive a `NotEnoughReplicasException` if fewer than 2 replicas are in sync — fail-fast rather than silently accept a weaker guarantee.\n- **Production standard**: `acks=all` + `min.insync.replicas=2` + replication factor 3. This tolerates 1 broker failure with no data loss.\n- **acks=0**: fire-and-forget, no acknowledgment at all. Used only for high-volume, loss-tolerant metrics (telemetry, clickstream sampling).\n- **Latency cost**: Confluent benchmarks show acks=all is ~2.5x higher latency than acks=1 for 1KB messages on a 3-broker cluster.",
        explanationDeep:
          "The acks setting is the single most important producer configuration for durability. The catch with acks=all alone is the ISR-shrink scenario: if network issues cause followers to fall behind and exit the ISR, the ISR can temporarily be just the leader. In that state, acks=all is effectively acks=1 — the guarantee silently degrades. min.insync.replicas is the safety net: it refuses to acknowledge a write if the ISR is too small, surfacing the degraded state as an error rather than accepting a weaker guarantee silently.\n\nThe latency trade-off is real: ~2.5x higher latency at acks=all is significant for synchronous producers in latency-sensitive applications (sub-10ms end-to-end). For most batch and streaming ETL pipelines, that extra latency is acceptable. For a real-time bidding system where 5ms matters, acks=1 with acceptable message loss (or an async retry buffer) may be the right call.\n\nNote that acks=all does not imply exactly-once. It prevents loss during leader failover, but a producer retry on timeout can still write a duplicate. That is what enable.idempotence adds on top.",
        interviewerLens:
          "I want three things: (1) acks=1 loses messages on leader failover, (2) acks=all waits for ISR, (3) min.insync.replicas prevents silent degradation when ISR shrinks. The third point is the senior differentiator — most people know acks=all, fewer know that it silently becomes acks=1 without min.insync.replicas protecting the ISR size.",
        followupChain: [
          {
            question: "What is the ISR and what determines whether a replica is in it?",
            answer: "The In-Sync Replica set is the set of replicas fully caught up with the leader's log within `replica.lag.time.max.ms` (default 30 seconds). A follower that falls behind — due to slow disk, network issues, or broker overload — is removed from the ISR. Once it catches up, it's added back. Only ISR members can be elected leader when the current leader fails, preventing data loss."
          },
          {
            question: "What happens if min.insync.replicas=2 and a second broker goes down?",
            answer: "The ISR shrinks to 1 (just the leader). New produce requests with acks=all fail with NotEnoughReplicasException. Existing messages already committed to the ISR are safe. The topic becomes read-only (existing consumers still work) but write-unavailable until the second broker recovers or the setting is relaxed. This is fail-safe by design."
          },
        ],
        redFlags: [
          {
            junior: "\"acks=all means messages can never be lost.\"",
            senior: "\"acks=all waits for the ISR, but if the ISR shrinks to 1 without min.insync.replicas set, you silently get leader-only durability. The full safe config is acks=all + min.insync.replicas=2 + replication factor 3.\""
          },
          {
            junior: "\"I'd use acks=1 to avoid the latency hit.\"",
            senior: "\"acks=1 loses messages on leader failover — for financial data that's unacceptable. I'd accept the 2.5x latency cost of acks=all for durable data, and reserve acks=1 for loss-tolerant high-volume telemetry.\""
          },
        ],
        alternatePhrasings: [
          "\"How do you configure Kafka for zero data loss?\"",
          "\"What is acks=all and when is it not enough?\"",
          "\"Explain min.insync.replicas and when you would use it.\"",
        ],
        interviewContexts: [
          "Mid-level DE Kafka durability question at a fintech (2024-2025)",
          "Kafka broker configuration deep-dive at a data infrastructure interview",
        ],
      },
    ],
    topics: {
      moreDeepDives: [
        "How does the high watermark protect consumers from reading uncommitted data?",
        "Explain Kafka's leader election mechanism when a broker fails.",
        "What is the sticky partitioner and how does it improve throughput vs round-robin?",
        "How do you handle a poison pill message that crashes your consumer repeatedly?",
        "What is the dead letter queue (DLQ) pattern in Kafka and how do you implement it?",
        "How does Kafka Connect simplify source and sink integration?",
      ],
      decisions: [
        "acks=all vs acks=1 — how do you choose based on SLA?",
        "When do you add partitions to a live topic vs spin up a new topic?",
        "When is a compacted topic the right model over a retention-based topic?",
      ],
      quickRef: [
        "What is ISR?",
        "What does min.insync.replicas do?",
        "What triggers a consumer group rebalance?",
        "What is max.poll.interval.ms?",
        "What is consumer lag?",
        "What does acks=all guarantee?",
        "What is the difference between LEO and high watermark?",
        "What is CooperativeStickyAssignor?",
        "What is enable.idempotence?",
        "What is transactional.id used for?",
      ],
      redFlags: [
        {
          junior: "\"Adding partitions is safe and doesn't affect anything.\"",
          senior: "\"Adding partitions remaps hash(key) % N — ordering breaks for in-flight keyed messages. It's an up-front capacity decision.\""
        },
        {
          junior: "\"acks=all means exactly-once.\"",
          senior: "\"acks=all prevents loss on leader failover but doesn't prevent retry duplicates — that requires enable.idempotence or transactions.\""
        },
        {
          junior: "\"I'll add more consumers to fix consumer lag.\"",
          senior: "\"First I check whether lag is uniform or isolated to one partition. Isolated = hot partition = key skew. More consumers don't help there.\""
        },
      ],
      checklist: [
        "Ordering-is-per-partition + remap-on-resize consequence",
        "Consumer lag diagnosis: uniform vs per-partition",
        "Rebalance protocols: eager vs cooperative sticky",
        "acks=all + min.insync.replicas=2 + RF=3 as the durable config",
        "At-least-once + idempotent consumer vs EOS transaction decision framework",
      ],
      behavioral: [
        "Tell me about a time you debugged a Kafka consumer lag issue — what was the root cause?",
        "Describe a Kafka topic design decision you made — what partitions/key did you choose and why?",
        "A time you had to balance throughput vs durability in a streaming pipeline.",
      ],
      reverse: [
        "What rebalance protocol do your Kafka consumers use — eager or cooperative?",
        "How do you monitor consumer lag in production — Burrow, Datadog, or something else?",
        "What delivery semantics do your most critical Kafka pipelines use?",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR  — exactly-once (idempotent producer + transactions) when
  //           needed, partition-count capacity decisions + remap
  //           consequences, hot-partition mitigation, ISR/acks/durability
  //           tuning, log compaction vs retention deep-dive
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 23,
        questionText:
          "Walk me through how Kafka achieves exactly-once semantics end-to-end. When does the guarantee hold, and where does it break down?",
        code: [
          {
            lang: "python",
            label: "Atomic consume-process-produce",
            lines: [
              "p.init_transactions()",
              "p.begin_transaction()",
              "p.produce('out', value=transform(msg))",
              "# offsets committed inside the txn:",
              "p.send_offsets_to_transaction(",
              "    offsets, c.consumer_group_metadata())",
              "p.commit_transaction()",
            ],
          },
        ],
        answerStructured:
          "- EOS requires two layers: **idempotent producer** + **transactional API**.\n- **Idempotent producer** (`enable.idempotence=true`): Kafka assigns each producer a unique Producer ID (PID) and tracks a monotonically increasing sequence number per (PID, partition). On a retry, the broker sees the duplicate sequence number and discards the second write without error. Cost: ~3% throughput reduction vs acks=all. Default in Kafka 3.0+.\n- **Transactions** (`transactional.id`): extends idempotence to atomic multi-partition writes. A transaction coordinator (broker-side) manages a two-phase commit — output messages to multiple partitions and the consumer offset commit happen atomically. Either all commit or all roll back.\n- **Zombie fencing**: if a producer restarts with the same `transactional.id`, the broker increments the producer epoch. The broker rejects writes from any lower-epoch (zombie) producer instance, preventing stale transactions from committing.\n- **Where the guarantee holds**: Kafka-to-Kafka pipelines. The transaction atomically commits output topic writes and the consumer offset — so a crash and restart produces no duplicate in the output topic and resumes from the right offset.\n- **Where it breaks down**: if the sink is external (Postgres, S3, REST API), Kafka transactions do not cover that write. The sink must be idempotent (INSERT ON CONFLICT) or you must use an outbox/CDC pattern to keep Kafka as the source of truth.\n- **EOS throughput cost**: ~3% for idempotent producer vs acks=all, ~15-30% for short transaction commit intervals (100ms). At 1-5 second intervals, overhead approaches negligible for large messages.",
        explanationDeep:
          "The sequence-number mechanism is elegant: instead of a distributed consensus protocol for every message, the broker keeps a simple per-(PID, partition) counter. A retry arrives with the same sequence number; the broker already recorded that number as committed and returns a success acknowledgment without writing again. The PID + sequence is persisted to the replicated log itself, so even a leader failover doesn't lose the dedup state.\n\nThe transaction coordinator is a specific broker partition (selected by hashing the transactional.id) that maintains a state machine: BEGIN → PREPARE_COMMIT → COMMITTED (or ABORTED). The two-phase commit ensures the transaction log record is durable before the actual commit happens. Consumer groups configured to read with `isolation.level=read_committed` will not see messages from open or aborted transactions — they wait for the committed marker before surfacing the messages. Consumers configured with `read_uncommitted` (the default) will see all messages including those from aborted transactions.\n\nThe zombie fencing story is often the most memorable: a producer node hangs, the system assumes it failed and starts a new producer with the same transactional.id. The new producer's initialization increments the epoch. If the zombie node recovers and tries to commit its open transaction, the broker rejects it (wrong epoch) — the zombie's work is safely discarded. This prevents double-commits from split-brain scenarios.\n\nThe boundary condition — EOS is Kafka-to-Kafka — is the most common misconception in interviews. Teams implement transactions thinking they get an end-to-end guarantee, then discover their Postgres sink sees duplicates on a consumer crash because the DB write happened but the offset commit rolled back.",
        interviewerLens:
          "I want three things named: PID + sequence number (idempotent producer), transaction coordinator + two-phase commit (transactions), and zombie fencing via epoch. The EOS boundary question ('does this cover my Postgres sink?') is my follow-up. Candidates who say 'yes it covers any sink' haven't designed a real exactly-once pipeline. The read_committed isolation level is a bonus signal that they've actually configured a transactional consumer.",
        followupChain: [
          {
            question: "Your pipeline writes Kafka-consumed records to a Postgres table and you need zero duplicates. Kafka transactions don't cover Postgres. What do you do?",
            answer: "Three options: (1) At-least-once in Kafka + idempotent Postgres write using INSERT ... ON CONFLICT DO UPDATE ON (event_id) — the cleanest for most cases. (2) Outbox pattern: write to Postgres transactionally with the business logic (the Postgres transaction is the source of truth), then CDC the Postgres table to Kafka. The Kafka message is derived from a committed Postgres row — no duplicates possible. (3) Two-phase commit with XA transactions — complex, rarely used in practice outside of JEE contexts."
          },
          {
            question: "What is read_committed isolation level on the consumer side?",
            answer: "A Kafka consumer with isolation.level=read_committed only receives messages from committed transactions. It will buffer (not surface) messages from open or aborted transactions until a commit or abort marker arrives. This prevents consumers from reading data that was later rolled back. The default is read_uncommitted — consumers see all messages including those from aborted transactions, which will have a corresponding abort marker but the consumer sees the data."
          },
          {
            question: "How does the producer epoch prevent zombie producers from committing?",
            answer: "Each transactional.id has an associated epoch, persisted in the transaction coordinator. When a new producer initializes with a given transactional.id, the coordinator increments the epoch and tells the producer its new epoch. The coordinator and all brokers reject any write or commit request from a producer with a lower epoch — those are from zombie instances that either failed or were fenced out. The zombie's open transaction is aborted by the new producer's initialization."
          },
        ],
        redFlags: [
          {
            junior: "\"enable.idempotence=true gives exactly-once for my full pipeline.\"",
            senior: "\"Idempotence deduplicates retries within a session per partition — it does not make a consume-process-produce loop atomic. That requires transactions.\""
          },
          {
            junior: "\"Kafka transactions cover my Postgres sink.\"",
            senior: "\"Kafka transactions are Kafka-native — they commit output topic writes and consumer offsets atomically. A Postgres write is outside that boundary. I'd make the Postgres write idempotent or use an outbox pattern.\""
          },
          {
            junior: "\"I'd always use exactly-once for any important data.\"",
            senior: "\"EOS has a 15-30% throughput cost at short commit intervals. I use it for Kafka-to-Kafka pipelines where downstream can't deduplicate. For database sinks, at-least-once + idempotent UPSERT is simpler and faster.\""
          },
        ],
        alternatePhrasings: [
          "\"Explain how Kafka exactly-once semantics work under the hood.\"",
          "\"What is zombie fencing and why does it matter?\"",
          "\"We need zero duplicates in a Kafka streaming pipeline — walk me through your design.\"",
        ],
        interviewContexts: [
          "Senior DE streaming design at a payments fintech (2024)",
          "Kafka architecture deep-dive at a Series D data infrastructure company",
          "Asked at a Confluent partner company senior DE loop",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 19,
        questionText:
          "A single Kafka partition is becoming a hot partition, causing consumer lag on that partition while others are idle. Walk me through diagnosing and mitigating it without breaking downstream ordering guarantees.",
        code: [
          {
            lang: "python",
            label: "Sub-partition the hot key",
            lines: [
              "# all of one key -> one partition",
              "# add a bucket to spread the load",
              "bucket = hash(event_id) % 10",
              "key = f'{user_id}:{bucket}'",
              "p.produce('events', key=key,",
              "          value=v)",
              "# trade: per-(user,bucket) order only",
            ],
          },
        ],
        answerStructured:
          "- **Diagnose**: check per-partition consumer lag via `kafka-consumer-groups.sh --describe`. A hot partition shows growing lag on partition N while other partitions are near zero. Confirm by checking broker-side `BytesInPerSec` per partition — one partition will dominate.\n- **Root cause**: the partition key has a highly skewed value distribution. One key (or a small set of keys) generates the majority of messages. Because `partition = hash(key) % N`, all those messages land on one partition.\n- **Mitigations (ordered by impact on ordering guarantees)**:\n  1. **Compound key / sub-partitioning** (`user_id + bucket_0..9`): spread load across 10x more partitions per entity. Downstream consumers must merge 10 ordered sub-streams if total per-user ordering is required — acceptable if only local ordering within a time window matters.\n  2. **Custom partitioner**: override the default hash partitioner to detect hot keys and route them to multiple partitions using the hot-key's own sub-key. Requires a custom `Partitioner` implementation.\n  3. **Producer-side salting without ordering need**: if the consuming application can handle out-of-order events for this key, append a random salt to the key. Distributes load evenly; destroys ordering for that key.\n  4. **Increase partitions**: adds more parallelism, but the key still hashes to the same partition unless the key itself changes. Does not fix skew — only helps if the issue is insufficient partitions for non-skewed keys.\n  5. **Back pressure / rate limit at the producer**: slow the producer for the hot key, buying time for the consumer to drain — a band-aid, not a fix.\n- **Always state the ordering trade-off**: sub-partitioning preserves per-sub-key ordering but not global per-entity ordering. If the business requires strict per-user ordering, options are limited — a single-partition topic or application-level sequencing at the consumer.",
        explanationDeep:
          "Hot partitions are fundamentally a key distribution problem, not a Kafka problem. Kafka dutifully routes all messages for a given key to the same partition — if one key dominates traffic, one partition handles it. The partition is assigned to one consumer, which is now overwhelmed while others idle. No amount of adding consumers fixes this because of the one-consumer-per-partition rule.\n\nThe sub-partitioning / compound key approach is the most production-viable fix when some ordering guarantee must be preserved. Instead of `user_id`, the key becomes `user_id:0` through `user_id:9` (or however many sub-buckets you need). Messages for a given user now land across 10 partitions, with 10 consumers handling them in parallel. The trade-off: within each sub-partition, messages are ordered; globally across sub-partitions, they are not. If the business logic only needs per-event-type ordering within a user session (not strict global chronological ordering), this is fine.\n\nIf strict global ordering for the hot key is non-negotiable, you're in a difficult position: Kafka's model doesn't support it without a single partition. In that case, the consumer-side option is to read from all partitions and reorder before processing (using event timestamps and a reordering buffer), accepting a processing latency equal to the buffer window. This shifts the ordering burden from Kafka to the application.",
        interviewerLens:
          "The question is a trap for candidates who say 'add more consumers' — I want to hear immediately that one-consumer-per-partition means more consumers don't help for hot partition lag. Then I want a real mitigation: compound key, custom partitioner, or salting with an honest statement of the ordering trade-off. Candidates who give a mitigation without naming the ordering impact haven't thought through the downstream consequences.",
        followupChain: [
          {
            question: "You've implemented a compound key (user_id:bucket). How does your consumer reconstruct per-user ordering?",
            answer: "If per-user total ordering is required: maintain a reordering buffer per user, tagged with event sequence numbers or timestamps. Events from all 10 sub-partitions flow into the buffer; the consumer emits events in order once a watermark confirms no earlier events are outstanding. This adds latency equal to the watermark window. If per-user ordering within a window (not globally) is sufficient, process each sub-partition independently — much simpler."
          },
          {
            question: "What metrics would you set up to detect a hot partition before it causes lag?",
            answer: "Monitor per-partition bytes-in-per-second on the broker side — alert when any single partition receives more than 2x the average partition rate. Also monitor per-partition consumer lag with a proportional alert (lag on one partition > 10x the median partition lag). This catches skew before it becomes a production incident."
          },
        ],
        redFlags: [
          {
            junior: "\"I'd add more consumers to handle the hot partition.\"",
            senior: "\"More consumers don't fix a hot partition — only one consumer can read that partition. The fix is upstream: change the key to distribute load, at the cost of defining the ordering trade-off.\""
          },
          {
            junior: "\"I'd just increase the number of partitions.\"",
            senior: "\"Adding partitions doesn't fix key skew — a skewed key still hashes to a single partition. I need to change the key itself, accepting the ordering implications.\""
          },
        ],
        alternatePhrasings: [
          "\"One Kafka partition has growing lag while others are idle — what do you do?\"",
          "\"How do you mitigate partition skew in Kafka?\"",
          "\"We have one whale customer generating 80% of our event volume — how does that affect our Kafka design?\"",
        ],
        interviewContexts: [
          "Senior DE interview at an ad-tech company with large advertiser accounts (2024)",
          "Streaming platform design review at a Series C fintech",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 17,
        questionText:
          "How do ISR, acks, min.insync.replicas, and unclean leader election interact to determine Kafka's durability and availability trade-offs? Give me a concrete failure scenario.",
        code: [
          {
            lang: "python",
            label: "Fail-fast, no acknowledged loss",
            lines: [
              "# producer",
              "conf = {'acks': 'all'}",
              "# broker / topic:",
              "# replication.factor = 3",
              "# min.insync.replicas = 2",
              "# unclean.leader.election.enable=false",
            ],
          },
        ],
        answerStructured:
          "- **ISR (In-Sync Replicas)**: the set of replicas fully caught up with the leader within `replica.lag.time.max.ms`. Only ISR members can be elected leader on failover, preventing data loss.\n- **acks=all**: the producer waits for all ISR members to acknowledge. If ISR = {leader + 2 followers} and all three write, the message survives any single-broker loss.\n- **The silent degradation trap**: with acks=all alone, if followers fall behind and ISR shrinks to {leader only}, acks=all becomes effectively acks=1 — the guarantee degrades silently.\n- **min.insync.replicas (minISR)**: the broker rejects produce requests (with `NotEnoughReplicasException`) when ISR size < minISR. Setting `minISR=2` with RF=3 means: Kafka refuses writes if fewer than 2 replicas are in sync — fail-fast, not silent degradation.\n- **Unclean leader election** (`unclean.leader.election.enable`, default false): if all ISR members fail and only out-of-sync replicas remain, Kafka can (if enabled) elect an out-of-sync replica as leader. This restores availability at the cost of data loss — the new leader is missing messages the old leader acknowledged. Default false = prefer unavailability over data loss.\n- **Concrete scenario**: RF=3, minISR=2, acks=all. Brokers 1 (leader) and 2 (ISR) are running. Broker 3 is lagging (not in ISR). If Broker 2 goes down, ISR = {Broker 1}. New produces fail with NotEnoughReplicasException — the topic is write-unavailable. Broker 1 serves existing consumer reads. When Broker 2 recovers, it rejoins the ISR, and writes resume. No data is lost; availability was sacrificed.",
        explanationDeep:
          "The durability matrix is: acks=all + minISR=2 + RF=3 + unclean=false is the 'no data loss, possible write unavailability' configuration. This is the standard for financial and audit data. The trade-off is explicit: if too many brokers fail, you get a write outage rather than data corruption.\n\nRelaxing any of these has cascading effects. acks=1 drops the ISR guarantee entirely — a message acknowledged by the leader can be lost on leader failover. Enabling unclean leader election allows the system to elect an out-of-sync broker, recovering availability at the price of potentially losing the messages that were only on the old leader. Setting minISR=1 allows the ISR to shrink to 1 (just the leader) without blocking writes — equivalent to removing the minISR protection.\n\nThe operational consequence of minISR=2 is important to communicate: during a broker maintenance window on a 3-broker cluster, bringing down Broker 3 shrinks ISR to 2, which is still fine. Bringing down Broker 2 next shrinks ISR to 1, triggering NotEnoughReplicasException — the topic is now write-unavailable. Operations teams must do rolling restarts carefully, or temporarily reduce minISR during maintenance (accepting the risk window).",
        interviewerLens:
          "The scenario I want walked through: RF=3, minISR=2, one broker fails — ISR shrinks to 2, still functional. Second broker fails — ISR=1, writes fail with NotEnoughReplicasException, consumers still read, no data loss. If the candidate gets through that without prompting, they understand the availability/durability trade-off. The unclean leader election mention (and knowing the default is false) shows they've read the operations guide, not just the developer docs.",
        followupChain: [
          {
            question: "Under what circumstances would you enable unclean leader election?",
            answer: "When availability is more important than durability — for example, a metrics or logging topic where losing a few seconds of data is tolerable but a write outage causes operational blindness. Never for financial, audit, or transactional data. The default (false) is correct for most production topics."
          },
          {
            question: "What happens to consumers when a Kafka leader fails and a new ISR member is elected?",
            answer: "Consumers experience a brief pause while leader election completes (typically <1 second to a few seconds for modern Kafka). The new leader serves reads from the point the old leader was replicated to all ISR members — the high watermark. Messages the old leader had above the high watermark (not yet replicated) are truncated to maintain ISR consistency."
          },
        ],
        redFlags: [
          {
            junior: "\"acks=all is enough for zero data loss.\"",
            senior: "\"acks=all waits for the ISR, but ISR can shrink to 1 without minISR protecting it. The full safe config is acks=all + minISR=2 + RF=3 + unclean.leader.election.enable=false.\""
          },
          {
            junior: "\"I'd enable unclean leader election so we never have downtime.\"",
            senior: "\"Unclean leader election trades data loss for availability. For financial data, a write outage is preferable to silent message loss. I'd only enable it for loss-tolerant topics like telemetry.\""
          },
        ],
        alternatePhrasings: [
          "\"How do you configure Kafka for zero data loss?\"",
          "\"What is unclean leader election and when would you enable it?\"",
          "\"Walk me through a Kafka broker failure — what happens to messages?\"",
        ],
        interviewContexts: [
          "Senior DE infrastructure interview at a financial data platform (2024)",
          "Kafka durability design discussion at a Series D company",
          "Asked in a senior SRE+DE hybrid interview at a streaming company",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "When is log compaction the right choice over time-based retention, and what are the operational gotchas of compacted topics?",
        answerStructured:
          "- **Use compaction when**: the topic represents **current state** indexed by a key (user profile, account balance, feature flag, Kafka Streams changelog). Consumers need to replay to get the current value per key, not the full history.\n- **Use retention when**: the topic is an **event stream** where every event matters within a time window (transaction logs, audit events, clickstream). Consumers replay to reprocess history, not to rebuild a key-value snapshot.\n- **Hybrid** (`cleanup.policy=compact,delete`): compaction + time-based delete. Keeps current state per key, but purges records older than the retention period. Useful when you want a current-state view but don't need keys that haven't been updated in > N days.\n- **Operational gotchas**:\n  - **Compaction is eventually consistent**: the log cleaner runs in the background. A key may have multiple older values visible until the next compaction cycle. Consumers reading a partially-compacted log may see 'deleted' keys until the tombstone is cleaned up.\n  - **Tombstone retention window**: after producing a null-value tombstone, Kafka retains it for `delete.retention.ms` (default 24 hours) before purging both the tombstone and old values. Consumers must read within this window to see the delete; otherwise they miss it.\n  - **Compaction cannot guarantee the log gets small immediately**: large topics with high-cardinality keys compact slowly. Disk space usage can remain high during heavy-write periods.\n  - **Consumer offset resets**: a consumer seeking to the beginning of a compacted topic gets the compacted view — it won't see the full history. This is correct behavior but surprises teams expecting to replay all events.\n  - **Log cleaner threads**: a misconfigured or overwhelmed log cleaner (too few threads, too much data) falls behind, allowing old values to accumulate. Monitor `kafka.log.LogCleaner:log-cleaner-max-clean-time-secs`.",
        explanationDeep:
          "The conceptual model for compacted topics is a distributed, durable key-value store backed by a Kafka log. Kafka Streams relies on this: every state update to a KTable is written as a message; the compacted changelog topic always holds the latest value per key. A new Kafka Streams instance replays the compacted changelog to restore state without needing the full uncompacted history.\n\nThe tombstone-timing issue is the most common production surprise. Teams produce a tombstone to 'delete' an entity from the compacted topic, but if any consumer was down for longer than `delete.retention.ms`, it will never see the tombstone — the null value has been cleaned up by the time the consumer reconnects. That consumer's state will have a stale positive value for the deleted entity. The fix is to ensure consumers are robust to missed tombstones (periodic full snapshot reconciliation) or to extend `delete.retention.ms` to comfortably exceed the longest expected consumer downtime.\n\nThe compaction vs retention decision also affects offset management. A retention-based topic shrinks from the front as old segments are deleted — the earliest available offset advances over time. A compacted topic always starts at offset 0 in theory (the compacted view is present), but the actual offsets are non-contiguous (compacted segments may skip offset numbers). Consumers using absolute offset positions must be aware of this.",
        interviewerLens:
          "I want 'current-state per key' as the compaction use case articulated clearly, and at least two operational gotchas named (eventual consistency of compaction, tombstone timing). The Kafka Streams changelog use case shows production experience. The tombstone-timing issue signals that they've hit it in production — it's not in the marketing docs.",
        followupChain: [
          {
            question: "A consumer needs to rebuild state from a compacted topic but was down for 3 days and the tombstone retention was 24 hours. What happened to its state?",
            answer: "The consumer missed the tombstone — it was cleaned up after 24 hours. When the consumer replays the compacted topic, it will not see the delete marker for that key, so its local state retains the stale positive value. Fix: extend delete.retention.ms to exceed expected consumer downtime, or implement a periodic reconciliation against an authoritative source of truth."
          },
          {
            question: "How does Kafka's log cleaner decide which segments to compact?",
            answer: "The log cleaner tracks a 'dirty ratio' per partition: dirty bytes (messages after the last compacted offset) / total log size. It prioritizes partitions with the highest dirty ratio. The cleaner copies clean segments, deduplicating by keeping only the latest value per key, and produces a new set of compacted segments. Active (head) segments are never compacted — only closed (rolled) segments."
          },
        ],
        redFlags: [
          {
            junior: "\"Compaction is just a way to save disk space.\"",
            senior: "\"Compaction provides a per-key current-state guarantee — it's a semantic choice, not a storage optimization. Retention deletes by time regardless of key; compaction keeps the latest value per key indefinitely.\""
          },
          {
            junior: "\"After a tombstone, the key is immediately deleted from the topic.\"",
            senior: "\"Compaction is eventual — the tombstone and old values persist for at least delete.retention.ms (default 24h) before the log cleaner removes them. Consumers offline longer than that miss the delete.\""
          },
        ],
        alternatePhrasings: [
          "\"When would you choose cleanup.policy=compact over the default?\"",
          "\"How does Kafka Streams persist state across restarts?\"",
          "\"What happens to a tombstone in a compacted topic?\"",
        ],
        interviewContexts: [
          "Senior DE Kafka design at a Kafka Streams-heavy platform",
          "Streaming state management question at a real-time ML feature platform",
        ],
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you approach capacity planning for a new Kafka cluster? What are the key variables and how do they interact?",
        code: [
          {
            lang: "python",
            label: "Disk must include the RF multiplier",
            lines: [
              "tput = 100      # MB/s produced",
              "days = 7",
              "sec = days*24*3600",
              "raw = tput*sec/1e6  # ~60 TB (no RF!)",
              "disk = raw*3*1.25   # RF=3 +25% -> 227 TB",
            ],
          },
        ],
        answerStructured:
          "- **Input variables**: target message throughput (MB/s), message size (affects broker I/O pattern), replication factor (multiplies disk and network write load), retention period (drives disk requirement), number of partitions (drives file handle count and memory).\n- **Broker disk**: `disk = throughput_MB_per_second * retention_seconds * replication_factor`. Add 20-30% headroom. SSD strongly preferred for low-latency; HDD works for high-throughput/high-retention with larger `log.segment.bytes`.\n- **Broker network**: total network throughput = (producer MB/s + consumer MB/s * num_consumer_groups) * replication_factor. A broker producing 100 MB/s with RF=3 and 2 consumer groups requires ~500 MB/s of network bandwidth (100 in + 300 replicate + 200 consumer out).\n- **Partition-to-broker ratio**: Confluent recommends < 4,000 partitions per broker as a soft limit; beyond this, leader election time and metadata overhead degrade. JVM heap pressure also increases with partition count.\n- **Number of brokers**: `ceil(peak_throughput_MB_per_second / single_broker_throughput_MB_per_second)`, then add at least one for RF=3 (need 3 brokers minimum to tolerate one failure without data loss).\n- **Consumer sizing**: each consumer thread should process more than the per-partition produce rate. Size consumers to clear lag faster than the retention window.\n- **Ongoing monitoring**: broker disk fill rate, ISR shrink alerts, network saturation, partition leader imbalance, log cleaner lag (for compacted topics).",
        explanationDeep:
          "The disk calculation is where most teams under-provision. Replication is invisible at design time but doubles or triples disk usage — a topic with RF=3 stores 3 copies across the cluster. With a 7-day retention period and 500 MB/s producer throughput: 500 MB/s * 604,800 seconds * 3 = ~900 TB of total cluster disk. That surprises teams who think they need 300 TB.\n\nNetwork bandwidth is the other surprise. Replication traffic (leader-to-follower) is internal but consumes the same NIC bandwidth as external producer/consumer traffic. A broker that is both a heavy producer destination and a replication source can saturate its NIC, causing ISR shrink and downstream lag. Isolating the replication network from the client network (different NICs) or capping replication bandwidth (`replica.fetch.max.bytes`) can help during catch-up events.\n\nThe 4,000 partitions/broker limit is a practical JVM and OS constraint. Each partition is a directory with multiple segment files; too many partitions cause high file descriptor usage, slow `ls` on the data directory, and JVM GC pressure from the in-memory partition metadata structures. Monitoring partition count growth is as important as monitoring disk fill rate.",
        interviewerLens:
          "I want the disk formula with replication factor included — candidates who forget to multiply by RF dramatically underestimate storage. The network bandwidth accounting (producer + replicas + consumers) is the second capacity trap. If I hear both, I know they've built or planned a real Kafka cluster. The 4,000 partition/broker heuristic is a bonus that shows they know platform limits, not just theory.",
        followupChain: [
          {
            question: "A broker is running out of disk faster than expected. What do you check?",
            answer: "Verify: (1) actual producer throughput vs plan — may have grown faster than modeled. (2) Replication factor — confirm it's as planned; if RF was bumped, disk usage multiplies. (3) Retention settings per topic — an under-supervised topic may have retention=forever (7 days is not the default for all topics). (4) Log cleaner lag — if compacted topics are not being cleaned, old segments accumulate. Use kafka-log-dirs.sh to get per-topic per-partition disk usage."
          },
        ],
        redFlags: [
          {
            junior: "\"I'd size for the producer throughput times the retention period.\"",
            senior: "\"Disk = throughput * retention * replication factor. Forgetting the RF multiplier dramatically underestimates storage — a RF=3 cluster needs 3x the raw produce throughput in disk.\""
          },
          {
            junior: "\"More partitions means more brokers.\"",
            senior: "\"The broker count is driven by throughput per broker capacity, not partition count directly — though staying under ~4,000 partitions per broker is a practical JVM/OS limit.\""
          },
        ],
        alternatePhrasings: [
          "\"How do you size a Kafka cluster for a new workload?\"",
          "\"Walk me through Kafka disk capacity planning.\"",
          "\"What limits the number of partitions per broker?\"",
        ],
        interviewContexts: [
          "Senior DE infrastructure interview at a streaming data platform",
          "Kafka cluster design discussion at a platform engineering team",
        ],
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 18,
        questionText:
          "You are designing a Kafka-based event streaming platform for a financial institution. Walk me through how you would set delivery semantics, durability, partition strategy, and monitoring from first principles.",
        answerStructured:
          "- **Delivery semantics**: exactly-once for the core transaction topics (payment events, ledger updates) — idempotent producer + transactions, read_committed consumers. At-least-once + idempotent UPSERT for analytics/derived topics where deduplication is cheap.\n- **Durability**: `acks=all` + `min.insync.replicas=2` + `replication.factor=3` + `unclean.leader.election.enable=false` on all financial topics. Fail-fast (NotEnoughReplicasException) is preferable to silent data loss.\n- **Partition strategy**: key on `account_id` for per-account ordering. Analyze transaction volume distribution — if a small set of high-volume accounts creates hot partitions, use compound key (`account_id:bucket_0..3`). Size partitions at 2-3x peak parallelism, over-provisioned up front.\n- **Exactly-once sink**: transactions cover Kafka-to-Kafka. For the database sink (account balance updates), use an outbox pattern — write to Postgres atomically in the business transaction, CDC the outbox table to Kafka. No duplicate risk at the sink.\n- **Retention**: financial events retained for 7 years (regulatory requirement) — use Confluent tiered storage or Kafka with S3 cold storage offload. Hot tier: 30 days on broker SSD. Cold tier: long-term object storage.\n- **Monitoring**: per-partition consumer lag (Burrow), ISR shrink alerts (immediate page), producer error rate (NotEnoughReplicasException, timeout), end-to-end latency SLO (p99 < 500ms), broker disk fill rate with 48-hour alert threshold.",
        explanationDeep:
          "This question is about architectural judgment, not recall. The trap is over-engineering: not every topic in a financial platform needs full EOS. Audit log topics that are consumed by a data warehouse can use at-least-once + idempotent UPSERT — EOS transactions would add cost and complexity without meaningful benefit since the warehouse handles dedup on the business key.\n\nThe outbox pattern is the key insight for the database sink. Kafka transactions guarantee Kafka-to-Kafka atomicity; they do not coordinate with Postgres. An outbox pattern inverts the dependency: the business transaction in Postgres is the source of truth, and Kafka is populated from it via CDC (Debezium, etc.). This is more operationally complex (CDC pipeline to maintain) but is the production-grade approach for financial institutions that cannot tolerate duplicate financial events.\n\nRegulatory retention (7 years for many financial records) is incompatible with standard Kafka broker storage at high volume — you'd need petabytes of broker-attached SSD. Tiered storage (Confluent's implementation or open-source kafka-tiered-storage) offloads cold segments to S3 or GCS, keeping only recent data on the broker. Consumers can still replay from the cold tier transparently.",
        interviewerLens:
          "The architectural maturity signal is differentiating which topics need EOS and which don't, rather than applying EOS everywhere. The outbox pattern for the database sink separates candidates who have deployed real financial Kafka systems from those who've only done lab exercises. Regulatory retention with tiered storage shows awareness of the operational reality of 7-year retention — that's a production concern, not a tutorial topic.",
        followupChain: [
          {
            question: "How do you test that your exactly-once guarantees hold in production?",
            answer: "Chaos testing: kill a broker mid-transaction and verify the consumer group sees no duplicates and no missing messages in the output topic. Use a canary producer that writes a known sequence; a canary consumer verifies the sequence is complete and non-duplicated. Monitor transaction abort rate — a high abort rate indicates producer failures or broker instability causing excessive rollbacks."
          },
          {
            question: "A regulatory audit requires replaying 3 years of financial events. Your broker retention is 30 days. How do you replay?",
            answer: "Via tiered storage: Confluent Tiered Storage or open-source tiered storage offloads segments older than 30 days to S3. Consumers can seek to historical offsets and retrieve from S3 transparently. Alternatively, the data warehouse (Snowflake, BigQuery) has the archival copy — replay from there if Kafka tiered storage is not in place, accepting that you lose Kafka's consumer group semantics for the historical replay."
          },
        ],
        redFlags: [
          {
            junior: "\"I'd use exactly-once for everything to be safe.\"",
            senior: "\"EOS has cost and complexity. I'd use it for the transaction topics where duplicates are financially harmful. Analytics/derived topics can use at-least-once + idempotent UPSERT — simpler and faster.\""
          },
          {
            junior: "\"Kafka transactions cover our Postgres account balance updates.\"",
            senior: "\"Kafka transactions are Kafka-native. For the Postgres sink, I'd use an outbox pattern — write to Postgres in the business transaction, CDC it to Kafka. The Postgres row is the source of truth.\""
          },
        ],
        alternatePhrasings: [
          "\"Design a Kafka-based payment event pipeline with zero data loss.\"",
          "\"How do you ensure Kafka reliability in a compliance-heavy environment?\"",
          "\"Walk me through a production-grade Kafka deployment for a fintech.\"",
        ],
        interviewContexts: [
          "Senior / staff DE system design at a financial institution (2024-2025)",
          "Kafka platform design round at a Series D payments company",
        ],
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "How do you decide between using Kafka Streams, Apache Flink, or Spark Structured Streaming for a new stream processing job?",
        answerStructured:
          "- **Kafka Streams**: library (not a cluster), JVM only, tightly coupled to Kafka. Best for: Kafka-to-Kafka transformations, simple stateful aggregations (windowed counts, joins of two Kafka topics), small-to-medium throughput. **Zero additional infrastructure** — runs inside your existing application. Native exactly-once with Kafka transactions.\n- **Apache Flink**: dedicated streaming cluster, rich stateful processing, low-latency, excellent exactly-once with checkpointing to external storage (S3, HDFS). Best for: complex event processing, large stateful joins, high-throughput pipelines, multi-source fan-in. More operational overhead.\n- **Spark Structured Streaming**: micro-batch (default) or continuous processing. Best for: teams already on Spark/Databricks who want to use the same framework for batch and streaming, and where micro-batch latency (seconds) is acceptable. Excellent for joining a stream against a large static dataset. Weaker low-latency story than Flink.\n- **Decision framework**:\n  - Kafka-to-Kafka, simple logic, low ops overhead → **Kafka Streams**\n  - Complex stateful processing, very low latency (<100ms), multi-source → **Flink**\n  - Team is on Databricks, streaming + batch parity, latency in seconds → **Spark Structured Streaming**\n- **EOS**: all three support it natively, but via different mechanisms (Kafka transactions for Kafka Streams, checkpointing for Flink, write-ahead log + idempotent sinks for Spark).",
        explanationDeep:
          "The Kafka Streams vs Flink distinction is the most commonly asked senior streaming architecture question. Kafka Streams wins on operational simplicity: it is a library, not a cluster. You embed it in a Java/Kotlin service, deploy it like any microservice, and get Kafka's consumer group model for free. No YARN, no Kubernetes cluster manager for the streaming layer, no scheduler to maintain. The trade-off is expressiveness: Kafka Streams handles joins, windowed aggregations, and simple stateful operations well, but lacks the rich operator ecosystem (CEP, complex temporal joins, iterative processing) of Flink.\n\nFlink's checkpointing is the mechanism behind its exactly-once guarantee for stateful processing: periodically, Flink snapshots the entire state of all operators to an external store. On recovery, it restores from the last checkpoint and replays input events. The checkpoint interval controls the recovery latency (shorter = less replay needed = faster recovery, but more checkpoint overhead). Flink's 'exactly-once' for sinks depends on the sink connector supporting two-phase commit or idempotent writes.\n\nSpark Structured Streaming is the pragmatic choice for Databricks-native teams because it uses the same DataFrame API and runs on the same cluster as batch jobs. For teams doing combined batch + streaming (Lambda or Kappa architecture), unifying on Spark reduces the cognitive overhead of operating two different processing frameworks. The latency floor (micro-batch = seconds, not milliseconds) is the key limitation.",
        interviewerLens:
          "I want the operational complexity gradient named: Kafka Streams < Spark Streaming < Flink, and a concrete use case for each. Candidates who say 'Flink is always best' haven't valued the Kafka Streams zero-infrastructure story. Candidates who say 'use Spark for everything' haven't thought about Flink's latency advantage. The honest answer names the team context as the deciding factor.",
        followupChain: [
          {
            question: "When would you NOT use Kafka Streams?",
            answer: "When you need non-JVM languages, multi-source joins (Kafka Streams joins are limited to two Kafka topics; joining a Kafka topic with a JDBC source requires Flink or Spark), iterative/ML processing, or when the stateful processing is too heavy for embedding in a microservice (large state stores that exceed local disk). Also if the team doesn't use Java/Kotlin/Scala."
          },
        ],
        redFlags: [
          {
            junior: "\"Always use Flink for streaming — it's the most powerful.\"",
            senior: "\"Flink is operationally heavy. For Kafka-to-Kafka with simple logic, Kafka Streams is zero additional infrastructure and natively EOS. I'd only add Flink for complex stateful processing or sub-100ms latency requirements.\""
          },
        ],
        alternatePhrasings: [
          "\"Kafka Streams vs Flink — when would you choose each?\"",
          "\"We need stream processing. Should we use Flink or Spark?\"",
          "\"What stream processing framework would you recommend for a Kafka-based platform?\"",
        ],
        interviewContexts: [
          "Senior DE streaming framework selection at a real-time data platform",
          "Architecture design round at a ML feature engineering team using Kafka",
        ],
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Kafka", "Pulsar"],
        asked: 14,
        questionText:
          "Kafka vs Apache Pulsar — what are the architectural differences, and when would you actually choose Pulsar over Kafka?",
        answerStructured:
          "- **Architecture**: Kafka is a monolithic broker — the broker handles both compute (serving reads/writes) and storage (persisting to disk). Pulsar separates these: **stateless brokers** handle compute, **Apache BookKeeper** (Bookies) handle durable storage. Brokers can be independently scaled and restarted without data movement.\n- **Scaling**:\n  - Kafka: adding brokers requires partition reassignment (moving data) to rebalance load — disruptive and slow on large topics.\n  - Pulsar: adding brokers is instant (stateless), adding bookies adds storage capacity. No data migration needed.\n- **Multi-tenancy and geo-replication**: Pulsar has native namespaces, tenants, and geo-replication built into the core. Kafka implements multi-tenancy through naming conventions; geo-replication requires MirrorMaker 2 or Confluent Replicator.\n- **Tiered storage**: Pulsar has native tiered storage (offloading to S3/GCS) as a core feature. Kafka added tiered storage as a plugin (Confluent) or community KIP-405.\n- **Ecosystem maturity**: Kafka's ecosystem (Connect, Streams, Schema Registry, hundreds of connectors) is significantly more mature and widely deployed.\n- **Choose Pulsar when**: you need true elastic scaling without partition reassignment, native multi-tenancy, geo-replication as a first-class feature, or you are building a cloud-native SaaS messaging platform. **Choose Kafka when**: ecosystem maturity, community support, operational tooling breadth, or existing Kafka investment is the priority — which is the majority of data engineering contexts.",
        explanationDeep:
          "The key architectural distinction is the storage/compute separation. Kafka's broker-coupled storage means that when you lose a broker, you lose the partition leader AND the storage simultaneously — replication handles this, but it means broker identity is stateful. In Pulsar, brokers are completely stateless: losing a broker means another broker picks up those topics immediately, reading from the same Bookie storage nodes. This makes horizontal scaling and rolling upgrades significantly simpler.\n\nThe partition reassignment problem in Kafka is concrete: if you add a broker to a 10-broker cluster running 200 TB of data, you need to manually (or via kafka-reassign-partitions.sh) move partitions to the new broker to utilize it. This involves transferring actual data across the network — potentially TBs of traffic. In Pulsar, adding a broker requires no data migration; new topics are assigned to the new broker automatically via the ownership model.\n\nDespite these architectural advantages, Pulsar's adoption remains significantly lower than Kafka's in data engineering contexts. The ecosystem gap is real: Kafka Connect has hundreds of connectors, Schema Registry is battle-tested at massive scale, Kafka Streams is widely used. Pulsar has equivalents, but they are less mature and have smaller communities. For most data engineering teams evaluating the choice in 2024-2026, Kafka (or managed Kafka via Confluent/MSK) remains the pragmatic default unless the specific Pulsar advantages are needed.",
        interviewerLens:
          "I want the storage/compute separation named as Pulsar's core architectural differentiator — that's the insight that makes the scaling story make sense. The partition reassignment pain point in Kafka is a production experience signal; candidates who've scaled Kafka clusters know this is a real operational cost. The ecosystem gap (favoring Kafka) shows honest assessment rather than pure technical idealism.",
        followupChain: [
          {
            question: "Does Pulsar support Kafka's consumer group semantics?",
            answer: "Yes, via the Kafka-on-Pulsar (KoP) protocol handler — Pulsar can speak the Kafka protocol, allowing Kafka clients to connect to a Pulsar cluster unchanged. This is Pulsar's migration story: run Kafka clients against Pulsar without modifying producers/consumers. The mapping is imperfect at the edges (some Kafka Admin API features are unsupported), but covers the common produce/consume path."
          },
        ],
        redFlags: [
          {
            junior: "\"Pulsar is just a newer Kafka — it's better in every way.\"",
            senior: "\"Pulsar has architectural advantages for elastic scaling and native multi-tenancy, but Kafka's ecosystem and operational tooling are significantly more mature. I'd choose Pulsar for cloud-native SaaS messaging; Kafka for most data engineering stacks.\""
          },
          {
            junior: "\"Kafka and Pulsar are basically the same.\"",
            senior: "\"The core architectural difference is storage/compute separation in Pulsar vs coupled broker-storage in Kafka — that's what makes Pulsar's horizontal scaling story and the partition-reassignment-free scaling work.\""
          },
        ],
        alternatePhrasings: [
          "\"Why would you consider Pulsar over Kafka?\"",
          "\"What is the main architectural advantage of Pulsar?\"",
          "\"We're designing a multi-tenant messaging platform — Kafka or Pulsar?\"",
        ],
        interviewContexts: [
          "Senior DE architecture interview at a cloud-native data platform (2024)",
          "Streaming platform tool selection at a SaaS infrastructure team",
        ],
      },
    ],
    topics: {
      moreDeepDives: [
        "How does Kafka's two-phase commit for transactions work at the broker level?",
        "Walk me through Kafka's controller election mechanism and what happens when the controller broker fails.",
        "How do you implement a Kafka-to-database pipeline with exactly-once semantics using the outbox pattern?",
        "Explain Kafka's tiered storage — how does it work and what are the trade-offs?",
        "How do you do a zero-downtime partition key change on a high-throughput production topic?",
        "What is Kafka's KRaft mode (replacing ZooKeeper) and what operational benefits does it bring?",
      ],
      decisions: [
        "When is a single-partition topic the right answer despite the throughput ceiling?",
        "How do you decide between Kafka Streams and Flink for stateful stream processing?",
        "When does the outbox pattern beat Kafka transactions for sink durability?",
      ],
      quickRef: [
        "What is the difference between idempotent producer and transactional producer?",
        "What is producer epoch and how does zombie fencing use it?",
        "What is read_committed isolation level on the consumer?",
        "Disk formula for Kafka capacity planning?",
        "When does acks=all silently become acks=1?",
        "What is unclean leader election and when is it dangerous?",
        "How does Pulsar's architecture differ from Kafka's?",
        "What is the log cleaner and how does it compact messages?",
        "What is delete.retention.ms and why does it matter for tombstones?",
        "What is the 4,000 partitions/broker heuristic about?",
      ],
      redFlags: [
        {
          junior: "\"enable.idempotence=true gives me exactly-once for my full pipeline.\"",
          senior: "\"Idempotence deduplicates retries within a session per partition. A consume-process-produce loop needs transactions to be atomic — idempotence alone is not enough.\""
        },
        {
          junior: "\"Kafka transactions cover my Postgres sink.\"",
          senior: "\"Kafka transactions are Kafka-native. For a database sink, I use an idempotent UPSERT or an outbox pattern — the database transaction is the source of truth.\""
        },
        {
          junior: "\"More partitions always improve throughput.\"",
          senior: "\"Partitions above ~4,000 per broker degrade leader election time, increase JVM GC pressure, and slow rebalances. I size to 2-3x parallelism headroom, not more.\""
        },
        {
          junior: "\"I'd enable unclean leader election so we never have downtime.\"",
          senior: "\"Unclean leader election trades data loss for availability. For financial data, a write outage is preferable to silent message loss.\""
        },
        {
          junior: "\"Pulsar is architecturally superior so we should use it.\"",
          senior: "\"Pulsar's storage/compute separation is a real advantage for elastic scaling, but Kafka's ecosystem is significantly more mature. I'd choose based on whether those specific advantages outweigh the ecosystem gap.\""
        },
      ],
      checklist: [
        "EOS: PID + sequence (idempotent) + transaction coordinator + zombie fencing",
        "ISR + acks=all + minISR=2 + RF=3 + unclean=false as the durable config",
        "Hot partition diagnosis and compound-key mitigation with ordering trade-off",
        "Capacity planning: disk = throughput * retention * RF; network = producer + consumer*groups + replicas",
        "Kafka vs Pulsar: storage/compute separation is the key architectural diff",
        "EOS boundary: Kafka transactions are Kafka-native; database sinks need outbox or idempotent writes",
      ],
      behavioral: [
        "Tell me about the most complex Kafka system you've designed or operated — what were the durability and ordering requirements?",
        "Describe a time you had to migrate a Kafka topic with a live producer — how did you handle the transition?",
        "A production Kafka pipeline had data loss. Walk me through how you diagnosed and fixed it.",
      ],
      reverse: [
        "Are your most critical Kafka topics using EOS or at-least-once — and how was that decision made?",
        "How do you handle partition count growth — do you over-provision upfront or add partitions when needed?",
        "Is there a schema registry and schema evolution story, or are producers and consumers free to change message formats?",
      ],
    },
  },
};
