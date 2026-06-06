import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR — Clarify requirements first, basic ingest→transform→serve
  //          batch pipeline, partitioning concept, idempotency basics
  // ─────────────────────────────────────────────────────────────
  junior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 22,
        questionText:
          "Design a basic batch pipeline that loads daily sales data from a CSV in S3 into a data warehouse for analyst queries.",
        answerStructured:
          "- **Clarify first — before drawing anything**: How many rows per day? What is the query pattern (full-table scans vs filtered by date)? Does the CSV arrive at a fixed time? What is the freshness SLA — analysts need data by 8am?\n- **Ingest**: scheduled job (Airflow/cron) picks up the new CSV from S3 when it lands.\n- **Transform**: validate (row counts, schema check), clean, and apply business logic.\n- **Partition by date**: write output partitioned by `event_date` so queries can prune to one day.\n- **Idempotent write**: overwrite the date partition, not append — that way re-running for the same day produces the same result instead of doubling rows.\n- **Serve**: expose the partitioned table in the warehouse for BI tools.\n- **Monitor**: alert on zero rows, schema mismatch, and job failure.",
        explanationDeep:
          "The trap junior candidates fall into is drawing boxes immediately — 'S3 → Lambda → Redshift.' The senior move at every level is to spend the first two minutes asking clarifying questions, even for a simple batch pipeline. Volume determines whether you need parallelism. The access pattern determines partitioning. The freshness SLA determines whether micro-batch or a nightly run is acceptable.\n\nThe most important concept to demonstrate is idempotency: writing to a deterministic partition that you overwrite means the pipeline is safe to re-run. If you append blindly, a retry or a backfill creates duplicate rows and downstream aggregates are wrong. Overwriting the date partition is the simplest form of idempotent write at this level.\n\nPartitioning by event date (not ingest date) is also important. If the query pattern is 'show me sales for January 15th,' a partition on `event_date` lets the engine skip all other partitions. Partitioning on ingest time is a common mistake — it groups data by when it arrived, not when it happened.",
        interviewerLens:
          "I am not looking for a specific stack. I am watching whether you ask the latency SLA and access pattern questions before drawing the architecture. Then I want to hear 'idempotent write' or 'overwrite the partition' — the single concept that separates candidates who have shipped a batch pipeline from those who have only read about one. If you describe appending rows without mentioning idempotency, I will ask about it directly, and the answer you give then tells me whether you know the concept or just missed it.",
        followupChain: [
          {
            question: "What goes wrong if you append rows instead of overwriting the partition?",
            answer: "If the pipeline re-runs (due to a failure or a backfill), you get duplicate rows for that date. Downstream SUM aggregates double-count and analysts see inflated numbers. The fix is to overwrite the entire date partition so re-running always produces the same result."
          },
          {
            question: "The CSV arrives late some days. How do you handle that?",
            answer: "Use a file sensor in the scheduler that waits for the file before triggering the pipeline, rather than running on a fixed schedule. Set a timeout with an alert so the on-call team knows if the file hasn't arrived by a reasonable deadline."
          },
          {
            question: "How do you validate that the CSV loaded correctly?",
            answer: "At minimum: row count check (compare source file row count to rows written), not-null checks on required columns, and a range check on dates. Write a post-load assertion and fail the job if it does not pass so bad data never reaches analysts silently."
          }
        ],
        redFlags: [
          {
            junior: "Drawing the architecture immediately without asking any clarifying questions.",
            senior: "\"Before I draw anything — what is the freshness SLA, roughly how many rows per day, and what is the primary query pattern?\""
          },
          {
            junior: "\"I would INSERT new rows each run.\"",
            senior: "\"I would overwrite the date partition so the pipeline is safe to re-run without creating duplicates.\""
          }
        ],
        alternatePhrasings: [
          "\"Design an ETL pipeline for a daily report.\"",
          "\"We get a CSV every night from our ERP — how do you load it into the warehouse?\"",
          "\"Walk me through a basic ingest-to-serve pipeline.\""
        ],
        interviewContexts: [
          "Junior data engineer screening round at a Series A SaaS company",
          "Entry-level pipeline design question at a retail analytics team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "What does idempotency mean in a data pipeline, and how do you make a write operation idempotent?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "Not idempotent",
            lines: [
              "-- retry duplicates rows",
              "INSERT INTO sales",
              "SELECT * FROM staging;",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            label: "Idempotent",
            lines: [
              "MERGE INTO sales t",
              "USING staging s",
              "  ON t.event_id = s.event_id",
              "WHEN MATCHED THEN UPDATE SET *",
              "WHEN NOT MATCHED THEN INSERT *;",
            ],
          },
        ],
        answerStructured:
          "- **Idempotent** means running the same operation multiple times produces the same result as running it once — no duplicates, no drift.\n- For batch pipelines: **overwrite a deterministic partition** keyed on the logical date. Re-running for January 15th always replaces the January 15th partition with the correct data.\n- For row-level writes: use **MERGE/UPSERT** keyed on a unique event ID — if the row already exists, update it; if not, insert. Never blindly append.\n- Avoid using `NOW()` or wall-clock timestamps to decide what to write — the pipeline may run at different times on backfills or retries, producing different results.\n- The payoff: safe retries and backfills. If any step fails, you can re-run without manual cleanup.",
        explanationDeep:
          "Idempotency is the property that makes pipelines safe to operate in production. Network failures, retried tasks, and scheduled backfills all mean a pipeline step may run more than once for the same logical interval. If that step appends, you get doubles. If it overwrites a deterministic partition, re-running is harmless.\n\nThe two most common patterns are partition overwrite (for batch jobs that process one time-slice at a time) and MERGE on a unique key (for upsert-style CDC or streaming sinks). Both share the same principle: identify a unique 'slot' for each piece of data and make writing to that slot a replace, not an append.\n\nA subtle but important corollary: any derived timestamp inside the pipeline (like `inserted_at = NOW()`) breaks idempotency because re-runs stamp a different time. Use the logical date from the scheduler — the date the data represents — not the current wall-clock time.",
        interviewerLens:
          "I want to hear 'overwrite the partition' or 'MERGE on a unique key' — not just the definition. The dead giveaway of an inexperienced candidate is describing a pipeline that INSERT-appends and then saying 'we just make sure it only runs once.' In production, things run more than once. That is the whole problem. If you mention avoiding NOW() in favor of the logical date, you have clearly thought about this beyond the textbook definition.",
        followupChain: [
          {
            question: "Can a streaming pipeline be idempotent?",
            answer: "Yes — use at-least-once delivery from Kafka and make the consumer write idempotently: dedup on a unique event ID using MERGE/UPSERT into the sink so delivering the same event twice does not create a duplicate row."
          },
          {
            question: "What is 'exactly-once' and how does it differ from at-least-once plus idempotent writes?",
            answer: "True exactly-once guarantees the message is processed exactly once end-to-end, usually via distributed transactions. In practice most systems use at-least-once delivery (Kafka with acks=all) plus idempotent sinks — you may process the same event twice but the result is correct because the sink deduplicates. This is called effectively-exactly-once and is the pragmatic production approach."
          }
        ],
        redFlags: [
          {
            junior: "\"We make sure the pipeline only runs once.\"",
            senior: "\"In production, things fail and retry — I design writes to be idempotent so a re-run is always safe: overwrite the partition or MERGE on a unique key.\""
          },
          {
            junior: "\"I use NOW() to timestamp when rows were inserted.\"",
            senior: "\"I use the logical date from the scheduler so backfills and retries compute the correct interval, not today's timestamp.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you prevent duplicate data in a pipeline?\"",
          "\"What happens if your pipeline runs twice for the same day?\"",
          "\"How do you make a data pipeline safe to retry?\""
        ],
        interviewContexts: [
          "Junior data engineering phone screen at a fintech",
          "Asked in an ETL fundamentals round at a B2B SaaS company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "Why do we partition data in a warehouse or data lake, and what column should you typically partition on?",
        code: [
          {
            lang: "sql",
            label: "Partition + prune",
            lines: [
              "-- write split by event_date",
              "INSERT INTO sales",
              "PARTITION (event_date)",
              "SELECT *, event_date FROM src;",
              "-- reads ONE partition (pruned)",
              "SELECT * FROM sales",
              "WHERE event_date = '2026-06-03';",
            ],
          },
        ],
        answerStructured:
          "- **Partitioning** physically splits data into folders/segments by a column's value. A query with a filter on the partition key reads only matching segments — skipping the rest entirely.\n- For time-series data, **partition by date or event timestamp** (not ingest time) — it matches the most common query filter ('show me data for last week').\n- For warehouse tables, partition on the column analysts will filter most often: `event_date`, `region`, `product_category`.\n- **Trade-off**: too-fine partitioning (partition by hour on a small dataset) creates thousands of tiny files, slowing reads due to metadata overhead. Too-coarse partitioning (partition by year on a 5-year dataset) reduces the benefit.\n- **Rule of thumb**: partition on the column that appears in most WHERE clauses; aim for partitions of at least 100 MB each to avoid the small-files problem.",
        explanationDeep:
          "Partitioning is the first performance lever on any large dataset. Without it, every query reads every row. With a well-chosen partition key, the storage layer can skip entire date ranges, regions, or categories without reading them — this is called partition pruning.\n\nThe most common mistake is partitioning on ingest timestamp instead of event timestamp. Data pipelines always have some lag, so a batch that lands at 2am may contain events from the previous day. If partitioned by ingest time, those events land in today's partition; a query for 'yesterday's data' misses them. Partition on event time so data lives in the partition that matches when it happened.\n\nThe small-files problem is the other side of the coin: if you over-partition, you end up with thousands of tiny files. Columnar readers (Parquet, ORC) are optimized to read large files efficiently; reading 10,000 tiny files instead of 100 large ones means enormous metadata overhead and slow queries. Compaction jobs (OPTIMIZE in Delta Lake, merge in Hive) periodically combine small files into larger ones.",
        interviewerLens:
          "I want to hear 'partition pruning' as the motivation, and 'event time not ingest time' as the key design decision. The small-files problem is a bonus that shows you have thought about production operations beyond just the happy path. Candidates who say 'just partition by date' without thinking about which date (event vs ingest) have not been burned by late-arriving data yet.",
        followupChain: [
          {
            question: "What is the small-files problem and how do you fix it?",
            answer: "Streaming or frequent micro-batch writes create many tiny files per partition. Columnar readers are inefficient on many small files — metadata overhead dominates actual read time. Fix: run a periodic compaction job (OPTIMIZE in Delta Lake, a CTAS + overwrite for plain Parquet) to combine small files into right-sized ones. Schedule it during off-peak hours."
          },
          {
            question: "What is the difference between partitioning and clustering/sorting?",
            answer: "Partitioning physically splits files into separate folders by value — the engine can skip entire folders. Clustering (or sort orders in some engines) orders data within a partition by a secondary column so the engine can use min/max statistics to skip blocks. Both serve partition pruning at different granularities."
          }
        ],
        redFlags: [
          {
            junior: "\"I would partition by the ingest timestamp.\"",
            senior: "\"I partition by event timestamp — data should live in the partition that matches when it happened, not when the pipeline processed it.\""
          },
          {
            junior: "\"I would partition by hour to be more granular.\"",
            senior: "\"Very fine partitioning creates many tiny files, which can hurt read performance more than it helps. I aim for partitions of at least 100 MB and use compaction to manage file sizes.\""
          }
        ],
        alternatePhrasings: [
          "\"How does partitioning speed up queries?\"",
          "\"What column should you partition a 100 GB table on?\"",
          "\"Explain partition pruning.\""
        ],
        interviewContexts: [
          "Junior data engineer technical screen at a data platform team",
          "Asked at an entry-level analytics engineering loop"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you decide whether to use batch processing or streaming for a new pipeline?",
        answerStructured:
          "- **Start with the freshness SLA**: if analysts need data within hours, batch is almost always simpler, cheaper, and easier to test.\n- **Streaming is warranted only when**: sub-minute latency is a genuine product requirement — fraud detection, live alerting, real-time bidding.\n- **Micro-batch** (run every 5–15 minutes) is a pragmatic middle ground: 'fast enough' without the full operational burden of a streaming system.\n- **Operational cost of streaming**: stateful processing, watermarks for late-arriving data, exactly-once complexity, and significantly harder backfills compared to re-running a batch job.\n- **Decision rule**: ask for the real latency number first. If the answer is 'same day' or 'within an hour,' batch or micro-batch wins on every other axis.",
        explanationDeep:
          "Most 'we need real-time' requirements dissolve when you ask what the actual latency number is. 'Executives want to see today's numbers' usually means 'available by 8am' — that is a 5–8 hour SLA, well within daily batch. 'Marketing needs near-real-time' usually means 15 minutes — micro-batch handles that trivially.\n\nStreaming systems are genuinely hard to operate. State management across restarts, watermarking for late-arriving data, exactly-once semantics, and the inability to backfill by re-running a job are real costs. A daily batch job that runs in 20 minutes and costs a few dollars is almost always a better default than a streaming pipeline that costs hundreds of dollars a day and pages the on-call engineer at 3am.\n\nThe instinct to default to streaming because 'real-time is better' is a common junior signal. Senior candidates push back on the latency requirement first.",
        interviewerLens:
          "I want you to push back on the premise and ask for the real SLA before committing to streaming. If you say 'I would use Kafka and Flink' without first asking what 'real-time' means, I know you have not operated a streaming system in production. The right answer often ends with 'actually, a scheduled micro-batch job is the better choice here.'",
        followupChain: [
          {
            question: "What makes streaming pipelines harder to backfill than batch?",
            answer: "Streaming pipelines process events as they arrive; re-processing historical data means replaying the entire event log through the streaming engine, which is slow, expensive, and stateful — you must reset consumer offsets and manage state stores. Batch jobs just re-run for the target date range, which is trivial."
          }
        ],
        redFlags: [
          {
            junior: "\"I would use Kafka — real-time is always better.\"",
            senior: "\"First: what does 'real-time' mean here in minutes? Streaming adds significant operational burden; micro-batch often gets you the latency you need at a fraction of the cost.\""
          }
        ],
        alternatePhrasings: [
          "\"Do we need Kafka or a nightly Airflow job?\"",
          "\"When would you choose Flink over a batch Spark job?\"",
          "\"Our analysts say they want real-time data — what do you build?\""
        ],
        interviewContexts: [
          "Junior pipeline architecture question at a growth-stage startup",
          "System design screening at a data platform team"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "What questions do you ask before designing a data pipeline? Walk me through your requirements-gathering checklist.",
        answerStructured:
          "- **Functional**: What data? From where? How often does it arrive? Who are the consumers (analysts, ML, dashboards)?\n- **Scale**: Approximate volume — rows/day, bytes/day? How fast does it grow?\n- **Latency / freshness SLA**: When do consumers need the data? Within minutes, hours, or is daily fine?\n- **Access patterns**: What queries will be run? Point lookups, aggregations, full scans? This drives partitioning choices.\n- **Reliability**: What happens if data is late or missing? Is partial data acceptable?\n- **Exactly-once vs at-least-once**: Can consumers tolerate duplicates if deduplicated downstream, or must the pipeline guarantee no duplicates?\n- **Schema evolution**: Will the source schema change? How should the pipeline handle new or dropped columns?",
        explanationDeep:
          "The requirements-gathering phase is not just a warm-up — it directly determines every architectural decision. Volume drives whether you need distributed compute or a simple Python script. Freshness SLA drives batch vs streaming. Access patterns drive partitioning and indexing strategy. Reliability requirements drive idempotency design.\n\nCandidates who skip this phase and jump to a solution are either guessing or cargo-culting a previous architecture. The specific architecture matters far less than demonstrating that you anchor every choice to a stated requirement. An interviewer who hears 'I would partition by event date because analysts almost always filter by date range, which you confirmed' is far more impressed than one who hears 'I would partition by date because that is what you do.'",
        interviewerLens:
          "This question is really about process maturity. I want to see a structured list — not just 'I would ask about scale.' The checklist should include volume, latency, access patterns, and reliability in some form. Candidates who cover all four demonstrate they have shipped pipelines in production, where missing any of these leads to painful rework.",
        followupChain: [
          {
            question: "The business says they want 'real-time' but cannot say exactly what that means. What do you do?",
            answer: "Ask for the consequence of a delay. 'What happens if the data is 15 minutes late? An hour late? A day late?' The answer reveals the real SLA. Often 'real-time' means 'not yesterday' — a freshness requirement of minutes to hours, not seconds."
          }
        ],
        redFlags: [
          {
            junior: "Jumping to a technology choice without asking any clarifying questions.",
            senior: "Asking for volume, latency SLA, consumer access patterns, and reliability requirements before proposing anything."
          }
        ],
        alternatePhrasings: [
          "\"A product manager asks you to build a data pipeline. What is your first question?\"",
          "\"How do you scope a data engineering project?\"",
          "\"What do you need to know before starting a pipeline design?\""
        ],
        interviewContexts: [
          "Junior system design screen at a B2B analytics company",
          "Asked as an opener for a pipeline design interview at a mid-size SaaS"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["Batch Processing", "Streaming Processing"],
        asked: 13,
        questionText:
          "Batch processing vs streaming — what are the real trade-offs, and when does each win?",
        answerStructured:
          "- **Batch**: processes a bounded dataset on a schedule. Simple, cheap, deterministic, easy to test and backfill. Latency is bounded by the schedule (minutes to hours).\n- **Streaming**: processes an unbounded sequence of events as they arrive. Low latency (seconds to sub-minute), but adds operational burden: stateful processing, watermarks, checkpoint management, harder backfills.\n- **Micro-batch**: runs a batch job on a short interval (every 5–15 minutes). Gets 'fast enough' latency with batch's simplicity — the pragmatic middle for most 'near-real-time' use cases.\n- **Batch wins when**: SLA is hours or more, backfill is common, team is small, or data arrives in bulk files.\n- **Streaming wins when**: latency must be sub-minute (fraud detection, live alerting), data is truly continuous (IoT, clickstreams), or downstream consumers act on individual events.\n- **Cost**: batch compute runs for minutes and stops; streaming runs 24/7. Streaming can be 10–100x more expensive at moderate volumes.",
        explanationDeep:
          "The most common mistake is treating streaming as the default because it sounds more modern. In practice, the vast majority of analytics pipelines have SLAs of 15 minutes or more, which micro-batch handles trivially at a fraction of the cost and operational complexity.\n\nStreaming's hidden costs: state stores that must be checkpointed and recovered on restart; watermarks defining how long to wait for late events; exactly-once semantics requiring distributed transactions or idempotent sinks; and backfills that require replaying the full event log through the streaming engine. Batch jobs just re-run for the target date.\n\nThe right framing: streaming is a tool for a specific SLA requirement, not a general improvement. If the SLA does not require sub-minute latency, you are paying for complexity without benefit.",
        interviewerLens:
          "I am looking for an honest trade-off discussion, not a declaration that one is better. The key insight I want to hear is that micro-batch covers most 'near-real-time' requirements without streaming complexity. Naming the hidden costs of streaming (state, watermarks, backfill difficulty, cost) signals production experience. If you say 'streaming is always better' you have not been on-call for a Flink job at 3am.",
        followupChain: [
          {
            question: "How do you backfill a streaming pipeline?",
            answer: "You reset Kafka consumer offsets to the desired start position and replay events through the streaming engine, managing any state carefully. It is much harder than batch backfill — this is one of the strongest arguments for batch or micro-batch when streaming latency is not truly required."
          }
        ],
        redFlags: [
          {
            junior: "\"Streaming is always better — lower latency.\"",
            senior: "\"Streaming wins on latency, but adds stateful complexity, hard backfills, and 24/7 compute cost. I choose it only when the SLA genuinely requires sub-minute freshness.\""
          }
        ],
        alternatePhrasings: [
          "\"Why would you choose Spark batch over Flink streaming?\"",
          "\"What are the downsides of building a streaming pipeline?\"",
          "\"Our SLA is 15 minutes — streaming or batch?\""
        ],
        interviewContexts: [
          "Junior system design comparison question at a data engineering screen",
          "Asked in an architecture trade-off round at a growth-stage startup"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Design a pipeline to ingest data from a REST API daily.",
        "How would you handle schema changes (new columns, dropped columns) in a batch pipeline?",
        "Design a simple data quality check system for a batch ETL.",
        "How do you monitor a batch pipeline in production?",
        "What is a dead-letter queue and when do you use one?"
      ],
      decisions: [
        "Pull ingestion vs push ingestion — which is safer for backfills?",
        "Parquet vs CSV for warehouse storage — when does format matter?",
        "When do you add an orchestration tool (Airflow) vs a simple cron job?"
      ],
      quickRef: [
        "What does idempotent mean in the context of a data pipeline?",
        "Why partition by event time rather than ingest time?",
        "What is partition pruning?",
        "What causes the small-files problem?",
        "What is a freshness SLA?",
        "Batch vs micro-batch vs streaming in one sentence each?",
        "What is a dead-letter queue?",
        "What is a data quality check?",
        "What does a file sensor do in Airflow?",
        "What is ETL vs ELT?"
      ],
      redFlags: [
        {
          junior: "Drawing an architecture before asking any clarifying questions.",
          senior: "Spending two minutes on SLA, volume, access patterns, and reliability before proposing anything."
        },
        {
          junior: "\"I would INSERT new rows each run.\"",
          senior: "\"I would overwrite the date partition — idempotent writes make retries and backfills safe.\""
        },
        {
          junior: "\"Streaming is more modern so I would use Kafka.\"",
          senior: "\"What is the actual latency SLA in minutes? If hours is acceptable, batch is far simpler and cheaper.\""
        },
        {
          junior: "\"I would partition by hour to get more granularity.\"",
          senior: "\"Very fine partitions create tiny files. I target at least 100 MB per partition and add a compaction job.\""
        },
        {
          junior: "\"Real-time just means fast.\"",
          senior: "\"I ask for the specific latency number first — most 'real-time' requirements turn out to be minutes, which micro-batch handles without streaming complexity.\""
        },
        {
          junior: "\"I use NOW() to timestamp when records were processed.\"",
          senior: "\"I use the logical date from the scheduler so backfills reproduce the correct interval, not today's timestamp.\""
        }
      ],
      checklist: [
        "Always clarify SLA, volume, and access patterns before designing",
        "Know the idempotency pattern: overwrite the partition, not append",
        "Understand partition pruning and why event time beats ingest time",
        "Be able to explain the small-files problem and its fix (compaction)",
        "Know when micro-batch is a better choice than true streaming"
      ],
      behavioral: [
        "Tell me about a pipeline you built end-to-end — what worked and what would you do differently?",
        "Describe a time data was wrong in production — how did you find it and fix it?",
        "How do you explain a pipeline failure to a non-technical stakeholder?"
      ],
      reverse: [
        "What orchestration tool is the team using — Airflow, Prefect, or something else?",
        "What is the typical data volume for a pipeline in this role?",
        "What does the on-call rotation look like for pipeline failures?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID — Durable log to decouple ingest from processing,
  //        idempotency + late-arriving data, batch vs streaming,
  //        deduplication, partitioning + the small-files problem
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 28,
        questionText:
          "Design a pipeline that ingests 10 million user events per day from a mobile app and makes them queryable within 15 minutes. Walk me through your design.",
        answerStructured:
          "- **Clarify first**: 10M events/day is ~120 events/sec average — a manageable rate. But peak traffic? Is 15 minutes a hard SLA or a target? What queries will analysts run (filter by user_id, by event type, aggregated daily counts)?\n- **Ingest via a durable log**: mobile clients → API gateway → **Kafka** (or Kinesis). The log decouples producers from consumers — a downstream processing outage does not drop events, and you can replay from the log on failure.\n- **Process with micro-batch**: a consumer (Spark Structured Streaming or Flink in micro-batch mode) reads from Kafka every 5 minutes, applies enrichment and deduplication, and writes to storage.\n- **Deduplication**: mobile clients retry on network failure, so events arrive multiple times. Dedup on a client-generated `event_id` using MERGE/UPSERT into the sink table.\n- **Handle late-arriving data**: a **lookback window** on the watermark (e.g., events up to 1 hour late are accepted and merged into the correct partition).\n- **Storage/serving**: write to a lakehouse (Delta/Iceberg) partitioned by `event_date`. Run a compaction job every hour to merge small files.\n- **Monitor**: Kafka consumer lag is the leading indicator — alert if lag grows beyond the 15-minute SLA.",
        explanationDeep:
          "The durable log (Kafka or Kinesis) is the architectural pivot point for mid-level design. Without it, mobile clients write directly to storage or a processing service — if that service goes down, events are lost. The log absorbs bursts, decouples producers from consumers, and enables replay: if the processing job crashes, reset the offset and reprocess from where it left off.\n\nDeduplication is the second key concept. Mobile clients retry on network failure, meaning the same event can arrive multiple times. A pipeline that appends blindly creates duplicate rows and wrong aggregates downstream. The pattern is at-least-once delivery from Kafka plus idempotent writes in the sink: MERGE on `event_id` so duplicate events update the existing row rather than creating a new one.\n\nLate-arriving data is real in mobile: a user opens the app on a plane, generates events, and they sync hours later. A watermark-based approach accepts events up to a configured delay (1 hour is common); events beyond that are either dropped, sent to a side-output for separate handling, or picked up by a nightly batch reprocessing job. The choice depends on how much accuracy is required and the cost of reprocessing.",
        interviewerLens:
          "I am listening for three things in order: whether you clarify the SLA and access pattern before drawing; whether you name the durable log (Kafka) and explain *why* it decouples ingest from processing (not just 'it is scalable'); and whether you address deduplication and late-arriving data unprompted. Mid-level candidates who get all three have clearly operated this kind of pipeline in production. The candidate who says 'write directly from the API to the database' has not thought about what happens when the database is down.",
        followupChain: [
          {
            question: "Why use Kafka rather than writing directly to the data warehouse?",
            answer: "The warehouse is not designed for high-volume concurrent writes from mobile clients. Kafka buffers ingestion, absorbs traffic spikes, decouples the write path from the processing path (warehouse maintenance does not drop events), and provides replay on processing failure. The warehouse is the serving layer, not the ingestion buffer."
          },
          {
            question: "How do you handle a case where the processing job crashes mid-run?",
            answer: "Because we use at-least-once delivery from Kafka and idempotent MERGE writes, we reset the consumer offset to the last committed position and reprocess. Duplicate events from the replay MERGE into existing rows — the result is identical to a clean run. This is the core value of idempotent design."
          },
          {
            question: "Analysts say query performance has degraded over two months. What do you check first?",
            answer: "Almost certainly the small-files problem from micro-batch writes. Each 5-minute micro-batch creates a new file per partition; after two months there are hundreds of tiny files per date partition. Run OPTIMIZE (Delta) or a Parquet compaction job to merge them. Then check partition pruning — make sure queries filter on the partition column."
          }
        ],
        redFlags: [
          {
            junior: "\"I would write directly from the API to the warehouse.\"",
            senior: "\"The warehouse is not an ingestion buffer. I put Kafka between the API and processing — it absorbs spikes, decouples failure domains, and enables replay without dropping events.\""
          },
          {
            junior: "\"Mobile clients send events exactly once.\"",
            senior: "\"Mobile clients retry on network failure — I design for at-least-once delivery and make writes idempotent via MERGE on event_id.\""
          }
        ],
        alternatePhrasings: [
          "\"Design a near-real-time analytics pipeline for a mobile app.\"",
          "\"We collect clickstream events from millions of users — how do you ingest and serve them?\"",
          "\"Build a pipeline that needs 15-minute freshness at moderate scale.\""
        ],
        interviewContexts: [
          "Mid-level data engineer system design at a Series B consumer app",
          "Pipeline design round at a mobile analytics company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 23,
        questionText:
          "How do you handle late-arriving data in a streaming or micro-batch pipeline?",
        code: [
          {
            lang: "pyspark",
            label: "Watermark + dedup",
            lines: [
              "(events",
              " .withWatermark('event_ts',",
              "                '1 hour')",
              " .dropDuplicates(['event_id']))",
              "# events >1h late are dropped",
            ],
          },
        ],
        answerStructured:
          "- **Late-arriving data** = events with an event timestamp older than the current processing time. Common causes: mobile apps syncing offline, network delays, upstream retries.\n- **Watermarks**: define a threshold (e.g., 1 hour) — events older than that threshold are considered 'too late' and either dropped or routed to a side output. Events within the threshold are accepted and merged into the correct partition.\n- **Lookback window for micro-batch**: re-process not just the current partition but also the trailing N hours. A dbt incremental model that filters `event_date >= max_watermark - interval '3 hours'` catches late arrivals automatically.\n- **Nightly reprocessing**: for accuracy-critical use cases (billing, finance), a nightly batch job reprocesses the prior 24 hours from the raw event log, overwriting affected partitions with the corrected data.\n- **Append-only + read-time dedup**: append late events with their original timestamps and deduplicate at query time — simpler but shifts cost to reads.\n- **Decision**: watermarks for dashboards (some staleness is fine); nightly reprocessing for financial systems (must be exactly right).",
        explanationDeep:
          "Late-arriving data is one of the most common production problems in event-driven pipelines and one of the most frequently underestimated. Mobile apps are the worst offender: users go offline, generate events, and sync hours or days later. A pipeline that ignores this will produce wrong daily aggregates — an event from Tuesday appears in Wednesday's partition because the pipeline processes it on Wednesday.\n\nThe watermark is the first tool: it is a time boundary that tells the streaming engine 'I am willing to wait this long for late events.' Events within the watermark window are accepted and merged into the correct time window; events beyond it are either dropped or sent to a side output for manual handling or nightly correction. The watermark is a correctness-vs-latency trade-off: a longer watermark means more correct data but higher latency in closing windows.\n\nFor batch/micro-batch pipelines, the lookback window achieves the same effect differently: instead of filtering only the current micro-batch, extend the filter back by a configurable window (3 hours, 1 day) to pick up late arrivals that were not visible when their partition was last written. Combined with an idempotent MERGE on event_id, this converges to correct results as late events arrive.",
        interviewerLens:
          "The word I am waiting for is 'watermark' and the concept of the lookback window for batch pipelines. If you only describe appending events with their original timestamps and hoping for the best, you have not dealt with late-arriving data in anger. The follow-up I set is 'what is the cost of a longer watermark?' — the answer is latency (you must wait longer before closing a window to emit results), which reveals whether you understand the correctness-vs-freshness trade-off.",
        followupChain: [
          {
            question: "What is the cost of setting a very long watermark?",
            answer: "Higher latency: you cannot emit results for a time window until the watermark has passed it, so a 4-hour watermark means dashboard results are always at least 4 hours old. It also increases state size in the streaming engine — all events within the window must be held in memory or state store."
          },
          {
            question: "How do you handle an event that arrives 3 days late — beyond any reasonable watermark?",
            answer: "Route it to a side output or dead-letter partition. A nightly or weekly batch reprocessing job reads the raw event log for the affected date and overwrites those partitions with the corrected data. For financial systems this is mandatory; for dashboards many teams accept the small error."
          },
          {
            question: "How does your dbt incremental model handle late arrivals?",
            answer: "Use a lookback window: the watermark filter is `event_time >= (SELECT max(event_time) FROM {{ this }}) - interval '3 hours'` rather than just `>= max(event_time)`. This re-processes the trailing window on every run, picking up late arrivals. Combined with a unique_key for MERGE, late events update the correct row rather than creating duplicates."
          }
        ],
        redFlags: [
          {
            junior: "\"Events always arrive in order so this is not a concern.\"",
            senior: "\"In practice mobile clients sync offline events hours or days late. I design with a watermark and a lookback window so late events are merged into the correct partition.\""
          },
          {
            junior: "\"I would just append late events with their original timestamps.\"",
            senior: "\"Appending without dedup creates duplicate rows. I use MERGE on event_id so late events update the existing record rather than creating a second one, and I reprocess affected partitions for accuracy-critical metrics.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you deal with out-of-order events in a pipeline?\"",
          "\"What is a watermark and why do you need one?\"",
          "\"Mobile events arrive hours late — what do you do?\""
        ],
        interviewContexts: [
          "Mid-level system design round at a consumer tech company",
          "Streaming interview at a fintech processing transaction events"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 19,
        questionText:
          "Your streaming pipeline produces thousands of tiny Parquet files per day. Analysts say queries are slow. Diagnose and fix it.",
        code: [
          {
            lang: "sql",
            label: "Compact tiny files",
            lines: [
              "-- merge into ~128-256MB files",
              "OPTIMIZE events",
              "WHERE event_date = '2026-06-03';",
              "",
              "-- then reclaim old files",
              "VACUUM events;",
            ],
          },
        ],
        answerStructured:
          "- This is the **small-files problem**: micro-batch or streaming writes create one file per micro-batch per partition. After days/weeks, a single date partition has thousands of tiny files.\n- **Why it is slow**: columnar readers (Spark, Athena, BigQuery) are optimized for reading large files. Each tiny file incurs file-open overhead and a metadata request to object storage — thousands of files mean thousands of round trips before reading a single byte.\n- **Fix 1: OPTIMIZE / compaction job**: run `OPTIMIZE` in Delta Lake, or a Spark job that reads and rewrites each partition into right-sized files (128–256 MB each). Schedule it off-peak, after the day's data is complete.\n- **Fix 2: Increase micro-batch interval**: if you are writing every 30 seconds, increase to every 5 minutes — fewer, larger files per batch.\n- **Fix 3: Auto-compaction**: Delta Lake supports auto-optimize on write, which compacts incrementally after each write.\n- **Verify**: before/after query times and the number of files per partition (list the S3 prefix).",
        explanationDeep:
          "The small-files problem is the single most common performance issue I see after teams successfully launch a streaming pipeline. The pipeline works, data arrives on time, and then six weeks later analyst queries go from 10 seconds to 3 minutes. The culprit is almost always partition directories with thousands of tiny files.\n\nThe mechanism: each micro-batch commit creates a new file. A pipeline running every minute, writing to daily partitions, produces 1,440 files per day per partition. Athena and Spark must list all of them, open each one, read the footer to get the column statistics, and then decide which to read. At 10,000 files per partition, this metadata overhead dominates actual data reading.\n\nThe fix is compaction: periodically merge tiny files into right-sized ones (128–256 MB for S3/HDFS, matching the HDFS block size). In Delta Lake, `OPTIMIZE` does this and also Z-orders the data if you specify a column. The compaction job reads the partition and writes it back as a smaller number of larger files, updating the Delta transaction log. Subsequent queries read 10 files instead of 10,000 and run 10–100x faster.\n\nThe root-cause fix is to write less frequently or coalesce files before writing. But compaction is necessary regardless, because even well-sized batches eventually produce enough files over time.",
        interviewerLens:
          "I want to hear 'small-files problem' within the first sentence — the symptom (slow queries after a streaming pipeline runs for weeks) is a well-known pattern and naming it signals production experience. Then I want the OPTIMIZE/compaction fix and the mechanism (metadata overhead, not just 'too many files'). Candidates who say 'add more compute' or 'increase the warehouse size' have not operated a data lake in production.",
        followupChain: [
          {
            question: "How does OPTIMIZE in Delta Lake work?",
            answer: "OPTIMIZE reads files in a partition and rewrites them into larger right-sized files (typically 1 GB target), updating the transaction log atomically. Old files become part of the history (accessible via time travel) but are no longer read by new queries. VACUUM removes old files beyond the retention period."
          },
          {
            question: "Does compaction break time travel?",
            answer: "No — Delta Lake's transaction log retains all previous file versions. Time travel queries point to the old log entries and read the original small files. VACUUM removes old files only after the configured retention period (default 7 days), so time travel works until VACUUM runs."
          }
        ],
        redFlags: [
          {
            junior: "\"I would add more compute or a larger warehouse.\"",
            senior: "\"This is the small-files problem. I would run OPTIMIZE/compaction to merge tiny files into right-sized ones — more compute does not help when the bottleneck is file metadata overhead.\""
          },
          {
            junior: "\"I would just increase the partition granularity.\"",
            senior: "\"Finer partitioning makes more partitions with fewer files each — but does not fix the per-partition file count. Compaction is the right lever.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the small-files problem and how do you fix it?\"",
          "\"Our Delta Lake queries got slow after we launched a streaming pipeline — why?\"",
          "\"How does OPTIMIZE work and when do you run it?\""
        ],
        interviewContexts: [
          "Mid-level data engineering performance question at a lakehouse team",
          "Asked at a Databricks-heavy interview at a Series C company"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "How do you decide between at-least-once and exactly-once delivery semantics for a data pipeline?",
        code: [
          {
            lang: "sql",
            label: "Idempotent sink",
            lines: [
              "-- duplicate deliveries converge",
              "MERGE INTO facts t",
              "USING batch s",
              "  ON t.event_id = s.event_id",
              "WHEN NOT MATCHED THEN INSERT *;",
            ],
          },
        ],
        answerStructured:
          "- **At-least-once**: the system guarantees every event is delivered, but may deliver duplicates (retries). Requires an idempotent consumer to handle duplicates correctly.\n- **Exactly-once**: every event is delivered and processed exactly once — no duplicates, no drops. Achieved via distributed transactions or two-phase commit. Higher latency and complexity.\n- **Effectively-exactly-once**: at-least-once delivery + idempotent sink (MERGE on event_id). The practical production approach — you may process the same event twice, but the result is correct because the sink deduplicates.\n- **Choose exactly-once when**: money movement, billing, financial reconciliation — where duplicates would cause real financial errors that are hard to reverse.\n- **Choose at-least-once + idempotent sink when**: analytics, dashboards, ML features — where a correctly handled duplicate is fine and the overhead of true exactly-once is not justified.\n- Kafka transactions enable exactly-once within the Kafka ecosystem; Flink supports end-to-end exactly-once via checkpointing + idempotent sinks. Both add latency.",
        explanationDeep:
          "True exactly-once semantics in a distributed system is theoretically possible but practically expensive. The standard approach for most production pipelines — including Kafka's own 'exactly-once' feature — is really at-least-once delivery combined with idempotent writes: the message may be delivered more than once, but a MERGE/UPSERT on a unique key ensures the result is the same as if it were delivered once. This is 'effectively exactly-once.'\n\nThe decision comes down to what happens if a duplicate slips through. For a dashboard showing daily page views, a duplicate event means the count is off by one in a billion — acceptable. For a payment transaction, a duplicate means a customer is charged twice — not acceptable. The cost of the deduplication infrastructure must be weighed against the cost of an uncaught duplicate.\n\nFlink's exactly-once guarantee uses distributed checkpointing: the job snapshots its state atomically at regular intervals and, on recovery, rolls back to the last checkpoint, replaying events from there. This adds latency (checkpoint interval is added to event latency) and requires sinks that support transactional writes or idempotent behavior.",
        interviewerLens:
          "I want to hear the distinction between true exactly-once (expensive, transactional) and effectively-exactly-once (at-least-once + idempotent sink). Candidates who say 'you should always use exactly-once' have not paid a streaming infrastructure bill. The right answer is context-driven: exactly-once for money movement, effectively-exactly-once for analytics. Bonus for naming Flink checkpointing as the mechanism for streaming exactly-once.",
        followupChain: [
          {
            question: "How do you implement effectively-exactly-once in a Kafka-to-warehouse pipeline?",
            answer: "At-least-once delivery from Kafka (acks=all, enable.idempotence=true on the producer), and an idempotent sink in the consumer: MERGE/UPSERT keyed on a unique event_id. If the same event is delivered twice, the second MERGE updates the existing row with identical data — the result is the same as a single delivery."
          }
        ],
        redFlags: [
          {
            junior: "\"Always use exactly-once — it is safer.\"",
            senior: "\"Exactly-once adds latency and complexity. For analytics I use at-least-once plus idempotent MERGE — the result is correct at a fraction of the cost. I reserve true exactly-once for financial transactions.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the difference between at-least-once and exactly-once?\"",
          "\"Does your pipeline guarantee no duplicate rows?\"",
          "\"When would you pay for exactly-once semantics?\""
        ],
        interviewContexts: [
          "Mid-level streaming pipeline design at a payments company",
          "Kafka architecture question at a Series B fintech"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "Push vs pull ingestion — which pattern do you use and when?",
        answerStructured:
          "- **Push**: the source system initiates the transfer, sending data to your pipeline on its schedule. Common pattern: a vendor drops files to S3, or sends webhooks to an API endpoint.\n- **Pull**: your pipeline initiates the transfer, polling or querying the source on your schedule. You control the cadence and the data window. Examples: polling a REST API, querying a source database.\n- **Push wins when**: the source has push-native capabilities (webhooks, S3 drops, Kafka topics), or you have no access to the source system's database, or data should arrive as fast as it is generated.\n- **Pull wins when**: you need to control the backfill window and schedule, the source supports efficient incremental queries (e.g., `WHERE updated_at > last_run`), or the source does not support push natively.\n- **Backfill consideration**: pull is much easier to backfill — you adjust the query window. Push requires the source to re-send historical data, which it may not support.\n- **Hybrid**: many CDC tools (Debezium) use a log-based pull — they pull from the database transaction log, combining high-frequency capture with your control over the consumer offset.",
        explanationDeep:
          "The push vs pull decision is really about who controls the schedule and what the source can support. Push gives the source control — if the vendor changes their schedule or fails to deliver, your pipeline stalls. Pull gives your pipeline control — you decide when to ask for data and for what time window, which is essential for reliable backfills.\n\nBackfillability is the clearest differentiator. With pull, backfilling is trivial: change the query window to cover the historical range and re-run. With push, you depend on the source to re-send historical data — many webhook-based sources do not support this at all, making historical corrections painful or impossible.\n\nThe safest production pattern is often a hybrid: the source pushes data to a durable landing zone (S3, a Kafka topic), and your pipeline pulls from that landing zone on its own schedule. This combines push's low-latency delivery with pull's control over processing cadence and replay.",
        interviewerLens:
          "I want to hear the backfill argument — it is the clearest reason to prefer pull control when possible. Candidates who understand that push-native sources are often impossible to backfill have dealt with a vendor integration that broke production data. The hybrid pattern (push to durable storage, pull from storage) is a senior-level synthesis that shows architectural maturity.",
        followupChain: [
          {
            question: "A vendor sends data via webhook but sometimes drops events. How do you handle this?",
            answer: "Write incoming webhooks to a durable queue (SQS, Kafka) immediately on receipt, and process from the queue asynchronously. If the webhook is re-delivered, the idempotent consumer deduplicates. For missed events, either request a replay from the vendor or accept the gap and flag it in monitoring."
          }
        ],
        redFlags: [
          {
            junior: "\"Push is better — lower latency.\"",
            senior: "\"Push gives lower latency but puts schedule control in the source. Pull gives us control over cadence and backfills. For vendor integrations I often use a hybrid: they push to S3, we pull from S3 on our schedule.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you design an ingestion pattern for a vendor feed?\"",
          "\"What is the difference between polling and webhooks for ingestion?\"",
          "\"How would you backfill data from an API you have been polling?\""
        ],
        interviewContexts: [
          "Mid-level data engineering design round at a SaaS company",
          "Asked at an integration-heavy interview at a marketplace company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Lambda Architecture", "Kappa Architecture"],
        asked: 20,
        questionText:
          "Lambda architecture vs Kappa architecture — what is the difference, and when would you use each?",
        answerStructured:
          "- **Lambda**: two parallel pipelines — a **batch layer** (accurate, processes historical data, runs slowly) and a **speed layer** (real-time, processes recent data, may have approximations). A serving layer merges results from both. Used when batch accuracy and real-time latency are both required simultaneously.\n- **Kappa**: a **single streaming pipeline** for everything. Historical reprocessing is done by replaying the event log (e.g., Kafka from offset 0) through the same streaming job. Eliminates the dual codebase.\n- **Lambda wins when**: reprocessing petabytes historically through a streaming engine is too slow or expensive, batch and streaming results must be merged at query time, or you are adding real-time capability to an existing batch system.\n- **Kappa wins when**: the team can replay historical data through the streaming engine affordably, you want one codebase and one deployment, and streaming correctness is sufficient for all use cases.\n- **Modern default (2024–2026)**: most new systems favor Kappa or a lakehouse pattern (Delta/Iceberg with streaming ingest + batch compaction) over Lambda because maintaining two codebases with different semantics creates reconciliation bugs in production.\n- **Key Lambda problem**: when batch and speed layers produce different numbers, debugging which is correct is painful.",
        explanationDeep:
          "Lambda architecture was the dominant pattern from roughly 2013–2020 because batch systems (Hadoop) were the only reliable way to process large historical data sets accurately, while streaming systems (Storm, early Kafka Streams) handled real-time but could not reprocess at scale. The serving layer merged approximate real-time results with accurate batch results.\n\nThe fundamental problem with Lambda is that two codebases computing the same business logic in two different systems (Spark batch + Flink streaming) inevitably diverge. A bug fix to the batch layer must be replicated to the streaming layer. When the numbers differ — and they will — debugging which layer is correct is extremely painful.\n\nKappa solves this by eliminating the batch layer: use streaming for everything, and replay the full event log through the streaming pipeline for historical reprocessing. The problem is that replaying petabytes through a streaming engine is slower and more expensive than a Spark batch job optimized for large datasets.\n\nThe modern resolution is the lakehouse pattern: streaming writes to Delta/Iceberg tables using at-least-once delivery with MERGE, and a periodic batch compaction job optimizes the storage layout. This gives you near-real-time ingest with batch-level query performance and a single logical pipeline — effectively Kappa with batch-optimized storage.",
        interviewerLens:
          "The signal I am looking for is that you name the Lambda problem (two codebases diverge, semantic bugs are hard to debug) and why Kappa is the modern default for new systems. Candidates who advocate for Lambda without mentioning the dual-codebase maintenance burden have not shipped both in production. Naming the lakehouse pattern as the practical evolution of Kappa shows you are current with 2024–2026 architectural thinking.",
        followupChain: [
          {
            question: "What happens when the batch layer and speed layer in Lambda produce different numbers?",
            answer: "This is the Lambda reconciliation problem. In theory the batch layer corrects the speed layer over time. In practice, debugging which is right requires tracing through two different codebases with different semantics, different state management, and different failure modes. It is extremely painful and a primary reason teams move to Kappa or lakehouse."
          },
          {
            question: "How does the lakehouse pattern (Delta/Iceberg) relate to Kappa?",
            answer: "The lakehouse is Kappa with batch-optimized storage. Streaming writes flow into Delta/Iceberg via MERGE (idempotent), providing near-real-time freshness. A periodic OPTIMIZE/compaction job runs in the background to merge small files and sort data, giving batch-quality read performance. One pipeline, one codebase, good latency and good performance."
          }
        ],
        redFlags: [
          {
            junior: "\"Lambda is better because you get both batch accuracy and real-time.\"",
            senior: "\"Lambda's two codebases diverge and reconciliation bugs are painful. For new systems I default to Kappa or a lakehouse pattern — one pipeline, one source of truth.\""
          },
          {
            junior: "\"Kappa means you run Kafka.\"",
            senior: "\"Kappa means a single streaming pipeline for both real-time and historical reprocessing — the tech stack is secondary. The key property is one codebase, no separate batch layer.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I build separate batch and real-time pipelines or one pipeline?\"",
          "\"What replaced Lambda architecture in modern data stacks?\"",
          "\"Our speed layer and batch layer give different numbers — what do we do?\""
        ],
        interviewContexts: [
          "Mid-level system design comparison at a data platform interview",
          "Architecture round at a streaming-heavy Series B company",
          "Asked at a lakehouse migration interview"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Design a CDC pipeline from a Postgres database to a data warehouse.",
        "How would you build a deduplication system for a high-volume event stream?",
        "Design a data quality monitoring system that alerts on anomalies.",
        "How do you handle schema evolution in a Kafka-based pipeline?",
        "Design a backfill strategy for a 2-year historical dataset."
      ],
      decisions: [
        "When do you choose Kafka over a managed queue like SQS or Pub/Sub?",
        "MERGE vs INSERT OVERWRITE PARTITION — when does each make sense?",
        "How do you choose a watermark duration for a streaming pipeline?"
      ],
      quickRef: [
        "What does a durable log (Kafka) buy you over direct writes?",
        "What is a watermark in streaming?",
        "At-least-once vs exactly-once vs effectively-exactly-once?",
        "What is consumer lag and why does it matter?",
        "What is the small-files problem?",
        "Lambda vs Kappa in one sentence each?",
        "What is CDC (change data capture)?",
        "What is a lookback window in a micro-batch pipeline?",
        "Push vs pull ingestion — which is easier to backfill?",
        "What is OPTIMIZE in Delta Lake?"
      ],
      redFlags: [
        {
          junior: "\"Write events directly from the API to the database.\"",
          senior: "\"Put a durable log (Kafka/Kinesis) between the API and the database — it decouples failure domains and enables replay.\""
        },
        {
          junior: "\"Events always arrive in order.\"",
          senior: "\"Mobile clients and distributed sources send out-of-order events — I design with a watermark and a lookback window.\""
        },
        {
          junior: "\"Lambda is the standard architecture.\"",
          senior: "\"Lambda's dual codebase creates reconciliation bugs. For new systems I use Kappa or a lakehouse pattern.\""
        },
        {
          junior: "\"Always use exactly-once delivery.\"",
          senior: "\"Exactly-once adds latency and complexity. At-least-once plus idempotent MERGE is the practical production pattern for most analytics use cases.\""
        },
        {
          junior: "\"Query performance is fine now.\"",
          senior: "\"I schedule a compaction job from day one — small files from micro-batch writes will degrade performance within weeks if unchecked.\""
        },
        {
          junior: "\"Push ingestion is better — it is real-time.\"",
          senior: "\"Push gives lower latency but cedes schedule control. For backfillability I prefer pull or a hybrid: source pushes to durable storage, I pull from there.\""
        }
      ],
      checklist: [
        "Explain why the durable log decouples ingest from processing",
        "Know the watermark concept and the correctness-vs-latency trade-off",
        "Be able to describe at-least-once + idempotent MERGE = effectively-exactly-once",
        "Understand the small-files problem and when to run compaction",
        "Know Lambda vs Kappa trade-offs and why Kappa/lakehouse is the modern default"
      ],
      behavioral: [
        "Tell me about a pipeline you designed that had to handle late-arriving data — what did you build?",
        "Describe a time you discovered a deduplication bug in production — how did you find it and fix it?",
        "A time you pushed back on a streaming requirement and proposed a simpler solution — what happened?"
      ],
      reverse: [
        "Do you use a durable log for ingest or write directly to the warehouse?",
        "What is the current strategy for handling late-arriving data?",
        "Have you hit the small-files problem? How did you address it?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR — Design a 1B-events/day pipeline, exactly-once vs
  //          at-least-once, compaction/OPTIMIZE, backfill-safe
  //          design, lambda vs kappa, metrics backend, feature store
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 31,
        questionText:
          "Design a data pipeline that processes 1 billion events per day and makes aggregated metrics available to analysts within 5 minutes. Walk me through the full design.",
        answerStructured:
          "- **Clarify first (spend 3–5 minutes)**: 1B events/day = ~11,600 events/sec average, but what is peak? Are metrics pre-aggregated or ad-hoc? 5-minute SLA on aggregates or on raw events? What is the query pattern (time-series by minute, by user, by event type)? Retention requirements?\n- **Estimate**: 1B events × 1 KB average = ~1 TB/day raw. Aggregated metrics are orders of magnitude smaller.\n- **Ingest layer**: events → **Kafka** (200–400 partitions, keyed by `user_id` for ordering within user). Kafka provides buffering, replay, and decoupling. Producers use `acks=all` and `enable.idempotence=true`.\n- **Processing layer**: **Flink** (or Spark Structured Streaming) with 5-minute tumbling windows. Computes per-event-type counts, user-level aggregates, and percentiles. Uses checkpointing (every 30 seconds) for fault tolerance.\n- **Deduplication**: mobile clients retry — dedup on `event_id` using a Flink operator backed by RocksDB state store, with a 1-hour TTL to bound state size.\n- **Storage for metrics**: write aggregated results to a time-series-optimized store (ClickHouse or Druid for sub-second query latency) or to Delta Lake for flexible SQL queries.\n- **Raw event archival**: raw events land in Delta/Iceberg on S3 (partitioned by `event_date/hour`), compacted hourly. This enables backfill and ad-hoc analysis.\n- **Backfill safety**: the raw event log (Kafka retention 7 days, S3 archival indefinite) is the source of truth. Any downstream reprocessing re-reads from S3, not from Kafka.\n- **Observability**: Kafka consumer lag (alert if > 2 minutes), checkpoint duration, Flink job health, and aggregate row-count anomaly detection.",
        explanationDeep:
          "The senior move on a problem at this scale is to spend the first few minutes on numbers and requirements before drawing a single box. 11,600 events/sec average masks a peak that may be 3–10x higher. At 100,000 events/sec, a single Kafka consumer is not enough — you need hundreds of partitions and a distributed streaming engine. At average traffic, a micro-batch Spark job might be sufficient. That clarification changes the design significantly.\n\nThe architectural choices that separate senior from mid: (1) Flink with checkpointing rather than Spark micro-batch, because at this scale 5-minute latency requires a true streaming engine with sub-minute checkpoints, not a batch job; (2) dual storage — a hot path to ClickHouse/Druid for low-latency metric queries and a cold path to Delta Lake for ad-hoc SQL and backfill; (3) treating Kafka + S3 raw archival as the source of truth so any downstream consumer can be reprocessed independently without replaying Kafka (which may have shorter retention).\n\nExactly-once at this scale: Flink's two-phase commit + transactional sinks gives exactly-once end-to-end, but adds latency equal to the checkpoint interval. For a 5-minute metric SLA, at-least-once Flink + idempotent MERGE into the metric store is the practical choice — duplicate event counts are rare and the merge handles them. For billing-critical metrics, exactly-once with longer latency is justified.\n\nBackfill safety: design the pipeline so the S3 raw archive is the canonical replay source. Kafka has bounded retention; S3 does not. Any time you need to reprocess — a bug fix, a schema change, a new metric — you read from S3, not Kafka. This means the Kafka consumer offsets are ephemeral; the S3 files are the system of record.",
        interviewerLens:
          "I am watching five things: (1) do you clarify scale and peak before drawing; (2) do you estimate the numbers (1 TB/day, 11,600 events/sec); (3) do you justify every architectural choice by tying it to the stated requirements; (4) do you name exactly-once vs effectively-exactly-once and when each applies; (5) do you distinguish raw archival on S3 from the serving store. Candidates who jump to 'Kafka → Spark → S3' without the clarification phase, the back-of-envelope math, or the dual-store reasoning are giving a mid-level answer to a senior question. The backfill-safety point (S3 as canonical replay source, not Kafka) is the clearest senior signal I look for.",
        followupChain: [
          {
            question: "How do you handle a bug in the Flink job that caused wrong aggregates for the past 3 days?",
            answer: "Fix the bug and deploy the corrected job. Re-read the affected 3 days of raw events from S3 (not Kafka, which may have expired those offsets), run them through the corrected job with backfill logic, and overwrite the affected metric partitions with the corrected aggregates. Because writes are idempotent (MERGE on time window + metric key), the backfill converges to correct results. Alert stakeholders about the correction."
          },
          {
            question: "At 100,000 events/sec, how many Kafka partitions do you need?",
            answer: "Each Kafka partition can typically handle 10–30 MB/sec depending on message size and broker hardware. At 100,000 events × 1 KB = 100 MB/sec, you need at minimum 4–10 partitions for throughput, but for consumer parallelism you want enough partitions to feed all Flink task managers. A typical starting point is 100–400 partitions; you can increase later (accepting that key-to-partition mapping changes for new messages)."
          },
          {
            question: "How do you handle schema evolution — a new event field added — without breaking the pipeline?",
            answer: "Use a schema registry (Confluent Schema Registry) with Avro or Protobuf and enforce backward compatibility: new fields must have defaults so old consumers can still read new messages. In the pipeline, select columns explicitly (never schema-on-read with SELECT *), so adding a new field does not break existing aggregations. Store raw events with their original schema so you can re-derive new fields on backfill."
          }
        ],
        redFlags: [
          {
            junior: "Drawing the architecture immediately without estimating the numbers.",
            senior: "\"11,600 events/sec average — what is peak? That determines whether micro-batch or true streaming is required, and how many partitions.\""
          },
          {
            junior: "\"I would store everything in Kafka.\"",
            senior: "\"Kafka has bounded retention and is not a long-term archive. Raw events land in S3 (Delta/Iceberg) as the canonical replay source; Kafka is the transit buffer.\""
          },
          {
            junior: "\"I would use exactly-once to be safe.\"",
            senior: "\"Exactly-once adds checkpoint-interval latency. For a 5-minute aggregate SLA I use at-least-once Flink plus idempotent MERGE — correct result at lower latency. For billing metrics I would pay for exactly-once.\""
          }
        ],
        alternatePhrasings: [
          "\"Design a clickstream analytics pipeline at scale.\"",
          "\"We process 1 billion events per day — walk me through your architecture.\"",
          "\"How do you build a near-real-time metrics backend at high volume?\""
        ],
        interviewContexts: [
          "Senior/staff data engineer system design at a large consumer tech company",
          "Platform engineering loop at a company with 100M+ daily active users",
          "Staff DE design round at a Series D fintech"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "Design a feature store for a machine learning platform that serves both batch training and real-time inference.",
        code: [
          {
            lang: "sql",
            label: "Point-in-time join",
            lines: [
              "SELECT l.*, f.value",
              "FROM labels l JOIN features f",
              "  ON f.entity_id = l.entity_id",
              " AND f.ts <= l.label_ts  -- no leak",
              "QUALIFY row_number() OVER (PARTITION",
              "  BY l.id ORDER BY f.ts DESC) = 1;",
            ],
          },
        ],
        answerStructured:
          "- **Clarify**: How many features? What entities (user, item, session)? What is the inference latency SLA (5ms? 50ms?)? How often are features updated (real-time vs daily)? What is the training data volume and lookback window?\n- **Core problem**: training-serving skew — features used at training time must exactly match what is available at inference time, otherwise the model learns on data it will never see in production.\n- **Offline store** (for training): Delta/Hive table on S3 partitioned by entity and date. Supports **point-in-time joins** — when building a training dataset for event X at time T, join only feature values that existed before T, not the current value. This is the critical correctness property.\n- **Online store** (for real-time inference): Redis or DynamoDB keyed by entity_id, holding only the latest feature values. Target <5ms read latency.\n- **Dual-write pipeline**: Flink (or Spark Streaming) computes features and writes to both stores simultaneously — online store gets the latest value, offline store gets a timestamped snapshot.\n- **Batch backfill**: Spark job computes historical features from raw event logs and populates the offline store with point-in-time snapshots for past dates.\n- **Prevent skew**: use the same feature computation code (Python UDFs or SQL logic) for both batch and streaming. If they diverge, you have training-serving skew — the model performs well in training and poorly in production.",
        explanationDeep:
          "The feature store pattern solves two related problems: (1) making features efficiently available at inference time without recomputing them on each request; and (2) ensuring training data reflects what the model would have seen at inference time — the point-in-time correctness problem.\n\nPoint-in-time joins are the conceptually hardest part. When you build a training dataset for a label event (e.g., a purchase at 3pm Tuesday), you must join the features as they were at 3pm Tuesday — not their current values. If you join current feature values, you are leaking future information into training (future-data leakage), and the model learns that the feature at value X correlates with purchase, but in production that value is only known after the fact. The offline store must be designed with timestamps so this join is possible.\n\nDual-write consistency is the operational challenge. If the Flink job writes to Redis (online) but fails before writing to Delta (offline), the offline store falls behind and training data is stale. The mitigating pattern is to write to a Kafka topic as the source of truth, and have separate consumers write to Redis and Delta — if either consumer fails, it replays from Kafka. This is the same durable-log decoupling principle applied to the feature store.\n\nThe shared computation code constraint is the hardest to maintain in practice. Teams drift: the batch job computes a rolling 30-day average one way; the streaming job computes it slightly differently (different handling of NULLs, different window semantics). Even a small divergence causes the model to perform differently offline vs online. Feature platform teams invest heavily in ensuring a single feature definition runs in both contexts.",
        interviewerLens:
          "Training-serving skew and point-in-time joins are the concepts I am specifically listening for. Candidates who describe 'an online store and an offline store' without mentioning point-in-time joins have read a blog post about feature stores but have not implemented one. The dual-write consistency problem (and its Kafka-mediated solution) is the senior signal — it shows you have thought about what happens when one write succeeds and the other fails.",
        followupChain: [
          {
            question: "What is training-serving skew and why is it dangerous?",
            answer: "Training-serving skew is the discrepancy between feature values at training time and inference time. If training uses the feature value as of today but the model serves using a value computed differently in real-time, the model learned a pattern it will never see in production. It manifests as a model that performs well offline but poorly online — one of the hardest bugs to diagnose."
          },
          {
            question: "How do you handle a feature that requires data from multiple entities (user + item interaction)?",
            answer: "Cross-entity features are typically computed in batch (Spark join of user and item tables) and stored in the offline store keyed by the combination. For online serving, either pre-materialize the cross-entity feature into a Redis key (user_id + item_id) or recompute it at inference time from individual entity features — the latter adds latency but avoids a combinatorial explosion of stored features."
          }
        ],
        redFlags: [
          {
            junior: "\"I would just query the database at inference time to get the latest features.\"",
            senior: "\"Querying a transactional database at 5ms inference latency at scale is not viable, and it does not solve training-serving skew. You need a dedicated online store (Redis) and offline store with point-in-time join support.\""
          },
          {
            junior: "Describing an online and offline store without mentioning point-in-time joins.",
            senior: "\"The critical property of the offline store is point-in-time joins — training data must reflect the feature values that existed at label time, not their current values, to prevent future-data leakage.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you build a real-time ML serving infrastructure?\"",
          "\"What is a feature store and when do you need one?\"",
          "\"Design the data layer for an ML platform that trains and serves models.\""
        ],
        interviewContexts: [
          "Senior data engineer / ML platform interview at a tech company with a large ML team",
          "Staff engineer system design for an ML infrastructure role",
          "Asked at a real-time personalization company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 21,
        questionText:
          "Design a metrics and dashboard backend for a SaaS product with 50,000 business customers, each needing real-time and historical views of their own usage data.",
        answerStructured:
          "- **Clarify**: number of metrics, freshness SLA (1 minute? 5 minutes?), cardinality (how many customers × how many metrics × time granularity), retention window, multi-tenancy isolation requirements, and whether customers can run ad-hoc queries.\n- **Estimate**: 50,000 customers × 100 metrics × 1,440 minutes/day = 7.2 billion metric-minute rows/day if storing raw per-minute data. Aggregation to hourly/daily dramatically reduces this.\n- **Pre-aggregation is the key design choice**: do not store raw events per customer and query them in real time — pre-aggregate to the coarsest resolution that meets the freshness SLA.\n- **Ingest**: events → Kafka, partitioned by customer_id for per-tenant ordering.\n- **Real-time aggregation**: Flink or Spark Streaming computes rolling per-customer metric aggregates (counts, sums, percentiles) and writes to a **time-series store** (ClickHouse, TimescaleDB, or Druid) for low-latency dashboard queries.\n- **Historical store**: raw events archived to Delta/Iceberg on S3 for ad-hoc SQL and metric recomputation.\n- **Multi-tenancy**: partition by `customer_id` in both stores; row-level security in the serving layer so Customer A cannot query Customer B's data.\n- **Dashboard API**: thin API layer reads from the time-series store for real-time views, from the historical store for long-range queries. Use a read-through cache for common dashboard loads.",
        explanationDeep:
          "The core trade-off in a multi-tenant metrics backend is pre-aggregation vs raw storage. Storing per-minute raw events for 50,000 customers would produce billions of rows per day and require full-table scans per customer per dashboard load — unacceptable for a sub-second dashboard SLA. Pre-aggregating to per-minute or per-hour metric buckets reduces storage by orders of magnitude and makes dashboard queries trivially fast (read a few hundred rows per customer per time range instead of millions of raw events).\n\nThe cardinality estimation is critical and often skipped. 50,000 customers × 100 metrics × 60 minutes/hour × 24 hours = 7.2 billion rows/day at 1-minute granularity. At hourly: 120 million rows/day — manageable. At daily: 5 million rows/day — trivial. The correct granularity is the minimum that satisfies the product's time-series chart resolution. If charts are hourly, store hourly. If charts are daily, store daily and compute on the fly for the last hour from raw events.\n\nTime-series-optimized databases (ClickHouse, Druid, TimescaleDB) are the right tool for this serving layer — they use columnar storage, time-based partitioning, and can answer range queries like 'give me all hourly metrics for customer X for the past 30 days' in milliseconds where a general-purpose warehouse would take seconds.\n\nMulti-tenancy isolation is the other senior concern: partition keys ensure scans do not cross customer boundaries, and the API layer must enforce row-level authorization so one customer's queries can never touch another's data, even through a crafty API call.",
        interviewerLens:
          "The cardinality estimate is the first thing I look for — candidates who do the math on 50,000 customers × 100 metrics × time granularity and realize pre-aggregation is mandatory are thinking like architects, not just engineers. The time-series store choice (ClickHouse/Druid rather than a general warehouse) shows operational depth. Multi-tenancy isolation — and the explicit mention of row-level security — is the third signal that you have shipped a B2B product where customer data must be strictly separated.",
        followupChain: [
          {
            question: "A customer complains their dashboard is missing data for the last 10 minutes. How do you debug it?",
            answer: "Check in order: (1) Kafka consumer lag for the customer's partition — is the pipeline backed up? (2) The streaming job's last checkpoint time — did it restart? (3) Row counts in the time-series store for the customer's recent windows — are rows missing or zeroed? (4) The raw event log — did events actually arrive? This isolates whether the problem is ingestion, processing, or storage."
          },
          {
            question: "How do you add a new metric type without reprocessing all historical data?",
            answer: "Store raw events in the historical Delta/Iceberg archive indefinitely. To add a new metric, write a batch job that reads the raw events for the desired historical window and populates the new metric in the time-series store. Existing metrics are unaffected. This is why the raw archive is the system of record — new metric definitions can always be backfilled."
          }
        ],
        redFlags: [
          {
            junior: "\"I would query raw events per customer on every dashboard load.\"",
            senior: "\"At 50,000 customers and 100 metrics, querying raw events per load is not viable. Pre-aggregate to hourly buckets in the time-series store — dashboard queries become reads of a few hundred rows, not millions.\""
          },
          {
            junior: "\"I would use PostgreSQL for the metrics store.\"",
            senior: "\"PostgreSQL is a great transactional database but struggles with time-series range scans at this cardinality. ClickHouse or Druid is optimized for exactly this — columnar, time-partitioned, sub-second range queries at high cardinality.\""
          }
        ],
        alternatePhrasings: [
          "\"Design the backend for a SaaS analytics dashboard.\"",
          "\"How do you build a multi-tenant metrics system?\"",
          "\"Our customers each need their own usage dashboard — how do you architect it?\""
        ],
        interviewContexts: [
          "Senior data engineer system design at a B2B SaaS company",
          "Staff engineer design round for a product analytics platform",
          "Asked at a company building a developer-facing analytics product"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "How do you design a backfill-safe data pipeline from the start? What properties must it have?",
        code: [
          {
            accent: "bug",
            lang: "python",
            label: "Breaks backfill",
            lines: [
              "# backfill of Jan 15 run today",
              "# writes TODAY into Jan 15 slot",
              "day = date.today()",
            ],
          },
          {
            accent: "fix",
            lang: "airflow",
            label: "Backfill-safe",
            lines: [
              "# scheduler's logical date",
              "day = '{{ ds }}'  # e.g. Jan 15",
              "# same input -> same output",
            ],
          },
        ],
        answerStructured:
          "- **Backfill-safe** means: re-running the pipeline for any historical time range produces the same correct output as if the pipeline had run correctly on that date. No duplicates, no data loss, no wrong aggregates.\n- **Property 1 — Idempotent writes**: every write overwrites a deterministic, keyed slot (partition or unique key). Re-running for date X overwrites the date-X partition with the correct data.\n- **Property 2 — Use logical time, not wall-clock time**: all date filters, partition keys, and `inserted_at` columns use the scheduler's logical date (the date the data represents), not `NOW()`. Otherwise a backfill of January 15th computes February's data.\n- **Property 3 — Source of truth is immutable**: raw events live in append-only storage (S3 + Delta, Kafka archival). Downstream derived tables can always be regenerated from the raw layer.\n- **Property 4 — Independent partition processing**: each date partition is computed independently from the raw source, not derived from the previous day's derived table. A bug in the derived layer cannot corrupt prior raw data.\n- **Property 5 — Schema and logic versioning**: backfilling with the new code must produce results consistent with the original run or explicitly signal that they differ (and mark the partition as reprocessed).\n- **Test for it**: run the pipeline twice for the same date — assert the output is byte-for-byte identical.",
        explanationDeep:
          "Backfill-safety is the difference between a pipeline that can be corrected after a bug and one that requires manual data surgery. Every production pipeline will eventually need a backfill: a bug fix, a schema change, a data quality issue, a new business metric that needs historical computation. If the pipeline was not designed to be rerun safely, each backfill becomes a risky and manual operation.\n\nThe idempotency property is necessary but not sufficient. You also need logical time consistency: if the pipeline uses `WHERE event_time > NOW() - interval '1 day'` instead of `WHERE event_time >= '2024-01-15' AND event_time < '2024-01-16'`, a backfill run on February 1st will process February 1st's data for the January 15th slot — silently wrong. This is one of the most common pipeline bugs I have seen.\n\nThe 'independent from derived tables' property is equally important. Some pipelines derive today's data from yesterday's derived table (e.g., a running total). When you backfill from two years ago, each partition depends on the previous one — you cannot parallelize, and a single wrong partition corrupts all subsequent ones. Design pipelines to compute each partition from the raw source independently. Running totals belong in the serving layer (query time), not in the storage layer.\n\nThe test is simple: run the pipeline for date X, record the output, run it again, assert the output is identical. If that test fails, the pipeline is not backfill-safe.",
        interviewerLens:
          "I am listening for logical time vs wall-clock time — that single point separates engineers who have actually backfilled a pipeline from those who have not. The 'independent from derived tables' property is the second senior signal: pipelines that derive today's output from yesterday's derived table cannot be parallelized on backfill and propagate errors forward. If you mention the 'run it twice and assert identical output' test, you have a production-quality testing discipline that most candidates lack.",
        followupChain: [
          {
            question: "How do you backfill a pipeline that computes a rolling 7-day average?",
            answer: "Compute the rolling average at read time (query time), not store time. Store the raw daily values and compute the 7-day window in the serving SQL or BI layer. If you materialize it, re-run from the earliest affected date (start date minus 7 days) so every 7-day window has all 7 days of correct input data."
          },
          {
            question: "Your pipeline depends on data from an upstream source that only retains 90 days of history. How do you handle a backfill request for 2 years?",
            answer: "This is why you archive raw events independently of the upstream source. If your pipeline reads from the upstream API directly, you are at the mercy of their retention. Archive raw events to your own immutable store (S3 + Delta) as they arrive, so you can always replay from your archive regardless of the upstream retention window."
          }
        ],
        redFlags: [
          {
            junior: "\"I use NOW() to get the current date in the pipeline.\"",
            senior: "\"Using NOW() breaks backfills — a run for January 15th executed today produces today's data in the January 15th slot. I use the logical date passed by the scheduler.\""
          },
          {
            junior: "\"Each day's table derives from the previous day's derived table.\"",
            senior: "\"Chained derived tables cannot be safely parallelized on backfill and propagate errors forward. I compute each partition from the raw source independently — running totals belong in the serving layer.\""
          }
        ],
        alternatePhrasings: [
          "\"What makes a data pipeline safe to backfill?\"",
          "\"We have a bug in our pipeline from 6 months ago — how do you fix the historical data?\"",
          "\"How do you design pipelines so you can re-run them for historical dates?\""
        ],
        interviewContexts: [
          "Senior data engineer system design at a data quality-focused company",
          "Staff engineer design interview at an analytics platform",
          "Asked at a company with strict audit and financial data requirements"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 19,
        questionText:
          "How do you choose between at-least-once + idempotent writes and true exactly-once semantics for a high-volume pipeline?",
        code: [
          {
            lang: "pyspark",
            label: "foreachBatch MERGE",
            lines: [
              "def upsert(df, _id):",
              "  df.createOrReplaceTempView('u')",
              "  spark.sql('''MERGE INTO t USING u",
              "    ON t.event_id = u.event_id",
              "    WHEN NOT MATCHED THEN INSERT *''')",
              "(stream.writeStream",
              "  .foreachBatch(upsert).start())",
            ],
          },
        ],
        answerStructured:
          "- **True exactly-once**: distributed transactions or two-phase commit ensure each event is processed and written exactly once. Flink achieves this via periodic checkpointing + transactional sink commits. Latency = checkpoint interval (typically 30–60 seconds). Higher infrastructure cost.\n- **At-least-once + idempotent sink (effectively-exactly-once)**: deliver at-least-once via Kafka (acks=all, idempotent producer); make the sink write idempotent via MERGE/UPSERT on a unique event_id. Duplicate deliveries converge to the same result. Lower latency, lower cost, simpler to operate.\n- **Choose true exactly-once when**: financial transactions, billing, deduplication is extremely hard (events do not have stable unique IDs), or the cost of a delivered duplicate is irreversible (charging a customer twice).\n- **Choose effectively-exactly-once when**: analytics, ML features, dashboards — a handled duplicate has no business consequence, and the lower latency and simpler operation outweigh the theoretical guarantee.\n- **Most production systems**: use effectively-exactly-once. True exactly-once is reserved for money movement and compliance-critical paths.\n- **Cost of true exactly-once**: checkpoint interval added to latency, transactional sink support required, significantly harder to debug on failure.",
        explanationDeep:
          "The confusion around exactly-once in distributed systems comes from conflating the guarantee at different layers. Kafka producers can be idempotent (acks=all + enable.idempotence=true), preventing producer retries from creating duplicates within Kafka. Kafka consumers can commit offsets transactionally alongside sink writes. But 'exactly-once end-to-end' also includes the processing logic between consumer and sink — and any stateful operations in that processing.\n\nFlink's exactly-once mode uses distributed snapshots (Chandy-Lamport algorithm): every checkpoint atomically snapshots the job's state and the Kafka consumer offsets. If the job fails, it restores to the last checkpoint and replays events from that offset. For the sink to be truly exactly-once, it must support transactional writes (Kafka as a sink, Delta Lake with transactional commits, or a database supporting two-phase commit).\n\nThe pragmatic perspective: at the scale of 1 billion events per day, a 0.001% duplicate rate from at-least-once delivery is 1 million potentially duplicated events. If each is correctly handled by an idempotent MERGE, the downstream metric is correct. If the event has no stable ID and cannot be MERGE'd idempotently, you have a real problem — but the fix is to assign stable IDs at the source, not to adopt true exactly-once end-to-end.\n\nAt-least-once + idempotent MERGE is the industry standard for analytics pipelines at scale. True exactly-once is for billing and financial reconciliation where the audit trail must show each event processed exactly once.",
        interviewerLens:
          "The phrases I am listening for: 'effectively-exactly-once,' 'idempotent MERGE on event_id,' and 'Flink checkpointing.' Candidates who say 'you should always use exactly-once' have not operated Flink at scale and seen what checkpoint recovery looks like when a job fails mid-window. The nuance I want is a clear criterion for when each choice is correct, not a blanket preference for one.",
        followupChain: [
          {
            question: "How does Flink implement exactly-once end-to-end?",
            answer: "Flink uses the Chandy-Lamport distributed snapshot algorithm. Checkpoint barriers flow through the pipeline; each operator snapshots its state when it receives the barrier. The Kafka source commits the offset at checkpoint time. The sink uses a two-phase commit: it pre-commits data on checkpoint and finalizes the commit when the checkpoint completes. If the job fails, it restores to the last completed checkpoint and replays from there — no duplicates in the sink."
          },
          {
            question: "What happens if your event stream does not have stable unique IDs?",
            answer: "You cannot implement effectively-exactly-once without stable IDs. The fix is to generate a deterministic ID at the source (hash of the payload + timestamp + source identifier) before events enter the pipeline. Without this, MERGE has no key to dedup on and you must use true exactly-once, or accept duplicates."
          }
        ],
        redFlags: [
          {
            junior: "\"Always use exactly-once — it is the safest.\"",
            senior: "\"Exactly-once adds checkpoint latency and requires transactional sink support. For analytics I use at-least-once with idempotent MERGE — the result is correct at lower cost. Exactly-once for billing and financial transactions only.\""
          },
          {
            junior: "\"At-least-once means you get duplicates.\"",
            senior: "\"At-least-once with idempotent MERGE means duplicates are handled — the second delivery of the same event_id updates the same row rather than creating a new one. The result is effectively the same as exactly-once for analytics use cases.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you pay for Flink exactly-once over at-least-once?\"",
          "\"How do you prevent duplicate counts in a high-volume streaming pipeline?\"",
          "\"What is effectively-exactly-once and how do you implement it?\""
        ],
        interviewContexts: [
          "Senior data engineer streaming design at a payments company",
          "Staff engineer platform design at a high-volume event pipeline team",
          "Asked in a Flink architecture review at a Series C fintech"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "When would you apply OPTIMIZE and Z-ordering (or liquid clustering) to a Delta Lake table, and what are the costs?",
        code: [
          {
            lang: "sql",
            label: "Scoped OPTIMIZE",
            lines: [
              "-- recent partition only",
              "OPTIMIZE events",
              "WHERE event_date >= '2026-06-01'",
              "ZORDER BY (user_id);",
              "-- or adaptive (Delta 3.0+):",
              "ALTER TABLE events",
              "CLUSTER BY (user_id);",
            ],
          },
        ],
        answerStructured:
          "- **OPTIMIZE**: compacts many small files in a partition into fewer large files (targeting ~1 GB each). Run it after streaming ingestion creates a backlog of tiny files, or on a schedule (daily/hourly). Cost: reads all files in the target partition and rewrites them — significant I/O on large tables.\n- **Z-ordering**: co-locates related data by ordering rows on a multi-dimensional Z-curve across specified columns. The engine can then skip entire file ranges when filtering on those columns (data skipping). Use on columns that are frequently filtered but not the partition key (e.g., `user_id` when the table is partitioned by date).\n- **Liquid clustering** (Delta 3.0+): an adaptive replacement for Z-ordering that automatically reorganizes data based on access patterns without manual column specification. Prefer it for new tables on Databricks when it is available.\n- **When to run OPTIMIZE**: after high-frequency writes (streaming or micro-batch), when analyst query times have degraded, before a major query workload (e.g., before a quarterly report run).\n- **Cost trade-off**: OPTIMIZE rewrites data — compute and I/O cost proportional to partition size. On a 10 TB table, a full OPTIMIZE is very expensive. Use `WHERE` to target only recently modified partitions (`OPTIMIZE table WHERE event_date >= current_date - 7`).\n- **VACUUM**: removes old files beyond the retention window (default 7 days) that OPTIMIZE and streaming writes leave behind. Run VACUUM after OPTIMIZE to reclaim storage. Do not run VACUUM before verifying time-travel queries are not needed within the retention window.",
        explanationDeep:
          "OPTIMIZE and Z-ordering are complementary operations that address different performance problems. OPTIMIZE fixes the small-files problem — too many files per partition slowing metadata and read overhead. Z-ordering fixes the data-skipping problem — data within a file is not co-located by query filter columns, so the engine must read most of a file even if the filter matches only a few rows.\n\nThe typical senior design decision: run OPTIMIZE on a schedule (hourly for high-ingestion partitions, daily for older partitions) with a WHERE clause to target only recently modified partitions. Apply Z-ordering on columns that appear in the most common WHERE clauses but are not the partition key. If the table is partitioned by date and queries also filter on `user_id`, Z-order on `user_id` — this co-locates rows for the same user within files, allowing file-level skipping when filtering on user.\n\nLiquid clustering is the evolution: instead of manual Z-order column specification, the Databricks runtime tracks query predicates and reorganizes data incrementally to match observed access patterns. It also decouples clustering from write-time decisions, making it easier to change the clustering strategy without full rewrites.\n\nThe cost conversation is important: OPTIMIZE is not free. On a 10 TB table partitioned by date with 1,000 date partitions, running a full OPTIMIZE rewrites 10 TB of data. Use targeted OPTIMIZE (WHERE on recent partitions) as the default, and full OPTIMIZE only when starting a major compaction effort.",
        interviewerLens:
          "I want to hear the distinction between OPTIMIZE (file count problem) and Z-order (data co-location for skipping) — they solve different problems and are often needed together. Candidates who mention targeting recent partitions with WHERE (rather than running OPTIMIZE on the whole table) have operated Delta at scale and understand the cost. Liquid clustering as the modern alternative shows you are current with Delta's evolution.",
        followupChain: [
          {
            question: "After running OPTIMIZE, when do you run VACUUM and what is the risk?",
            answer: "Run VACUUM after confirming no time-travel queries need data older than the retention window (default 7 days). If you run VACUUM prematurely, you delete old file versions and break time travel for those versions. The safe pattern: wait the retention period after OPTIMIZE before vacuuming, and never set the retention below 7 days unless you have confirmed no time-travel workloads exist."
          },
          {
            question: "How does Z-ordering improve query performance on a specific example?",
            answer: "Table partitioned by date, 1 billion rows, 100 GB per date partition. Query: WHERE event_date = '2024-01-15' AND user_id = 'abc123'. Without Z-order, the engine reads all 100 GB to find rows for that user. With Z-order on user_id, rows for user 'abc123' are co-located in a small number of files; the engine reads 1–2 files instead of the full partition — 50x reduction in I/O."
          }
        ],
        redFlags: [
          {
            junior: "\"I would run OPTIMIZE on the whole table every day.\"",
            senior: "\"Full table OPTIMIZE rewrites all data — very expensive on a large table. I target recent partitions with WHERE and run full OPTIMIZE only when compaction is critically needed.\""
          },
          {
            junior: "\"OPTIMIZE and Z-ordering are the same thing.\"",
            senior: "\"OPTIMIZE fixes file count — compacting many small files into fewer large ones. Z-ordering is a separate step that co-locates data by column for skipping. They are complementary but solve different problems.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you improve query performance on a Delta Lake table at scale?\"",
          "\"When do you run OPTIMIZE on a Delta table?\"",
          "\"What is Z-ordering and when does it help?\""
        ],
        interviewContexts: [
          "Senior data engineer Databricks design round at a lakehouse team",
          "Asked at a Delta Lake architecture interview at a Series D company",
          "Staff DE platform design at a company with 100+ TB Delta tables"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Lambda Architecture", "Kappa Architecture"],
        asked: 22,
        questionText:
          "Lambda vs Kappa architecture at senior level: given a system processing 500 billion events per month, when would you choose each, and what are the trade-offs you would fight for in a design review?",
        answerStructured:
          "- **Lambda**: a batch layer computes accurate historical aggregates over the full dataset; a speed layer computes real-time approximations; a serving layer merges both. The batch layer runs as Spark jobs; the speed layer runs as Flink jobs. Two codebases.\n- **The Lambda problem at scale**: when the batch layer takes 6 hours to recompute all aggregates and the speed layer takes 30 seconds, you have a 6-hour window where the serving layer merges a 6-hour-old batch result with a 30-second-old speed result. The merge logic is subtle and error-prone. When the two produce different numbers, debugging requires tracing through two different codebases.\n- **Kappa at 500B events/month**: replaying 500B events through Flink from Kafka offset 0 may be slower and more expensive than a Spark batch backfill — this is the core Kappa limitation at scale. Kafka retention must cover the replay window.\n- **Lakehouse as the practical Kappa**: Flink writes to Delta/Iceberg using at-least-once + MERGE; OPTIMIZE runs hourly to compact files; historical reprocessing reads from the S3 archive (Spark batch), not from Kafka. One logical pipeline, batch-quality read performance, no dual codebase.\n- **Design review arguments**: against Lambda — the dual codebase always diverges; against pure Kappa — at petabyte scale, replaying through Flink is slower than Spark batch; for lakehouse — single codebase, open format, batch-optimized reads, streaming freshness.\n- **When Lambda is still valid**: legacy systems where a batch layer already exists and streaming is being added incrementally, or systems where batch accuracy is strictly required and real-time approximation is acceptable to serve simultaneously.",
        explanationDeep:
          "The Lambda vs Kappa debate at senior level is not an academic comparison — it is a design-review argument about operational burden and correctness guarantees. Lambda's original motivation was that Hadoop batch was reliable and accurate but slow; Storm/early Kafka Streams were fast but approximate. The speed layer provided 'good enough' recent data while the batch layer was catching up.\n\nThe world has changed. Modern streaming engines (Flink) with exactly-once semantics are no longer approximate. Modern open table formats (Delta, Iceberg) support both streaming ingestion and Spark batch compaction. The result is that the lakehouse pattern effectively is Kappa: Flink writes streaming data into Delta with sub-minute latency; Spark batch OPTIMIZE jobs compact and Z-order the data hourly for read performance. No separate batch layer, no serving-layer merge, no dual codebase. This is the design most engineering teams building greenfield systems in 2024–2026 choose.\n\nThe one remaining Lambda use case is where reprocessing hundreds of terabytes historically is a regular occurrence and doing it through Flink (limited by streaming engine throughput) is materially slower or more expensive than doing it through a Spark batch job optimized for large sequential reads. In that case, a hybrid where the batch layer is Spark reading from S3 and the speed layer is Flink reading from Kafka — with Delta as the merge point — is a defensible design. But this is Lake-house Lambda, not the original Hadoop Lambda, and the codebase divergence is minimized by sharing the transformation logic in Python functions called by both.",
        interviewerLens:
          "At senior level I am not testing whether you know the definitions — I am testing whether you can hold a design review argument. I want you to tell me what you would fight for and why, given the specific constraints (500B events/month, which is petabyte scale). The candidates who impress me are the ones who say 'for this scale I would fight against pure Lambda because of the dual-codebase reconciliation problem, and against pure Kappa because replay at petabyte scale through Flink is slower than Spark batch, and for a lakehouse hybrid where Flink provides freshness and Spark provides compaction and backfill.' That is a nuanced, trade-off-aware position, not a tribal preference.",
        followupChain: [
          {
            question: "How do you handle a case where the Flink speed layer and Spark batch layer produce different numbers in a Lambda system?",
            answer: "This is the Lambda reconciliation problem. The batch layer is the source of truth by design — when it catches up, its result overwrites the speed-layer approximation in the serving layer. But debugging why they differ requires tracing the same business logic through two codebases, often revealing subtle semantic differences (NULL handling, window boundaries, late-event behavior). The long-term fix is to unify the transformation logic in a shared library called by both, or to migrate to lakehouse where there is only one pipeline."
          },
          {
            question: "How does Apache Iceberg differ from Delta Lake for the Kappa/lakehouse pattern?",
            answer: "Both provide ACID transactions, time travel, and streaming + batch read/write on open columnar files. Delta Lake is Databricks-native (though open source) with deeper Spark/Flink integration and mature OPTIMIZE + liquid clustering tooling. Iceberg is a broader open standard supported by Snowflake, AWS (Athena, EMR), Dremio, and Flink natively — better for multi-engine environments. For a pure Databricks stack, Delta is the natural choice. For a multi-cloud or multi-engine environment, Iceberg's engine-neutrality is a meaningful advantage."
          }
        ],
        redFlags: [
          {
            junior: "\"Lambda is better because you always have accurate batch data.\"",
            senior: "\"Lambda's accuracy comes with a dual codebase that always diverges. For new systems I fight for the lakehouse pattern — single pipeline, streaming freshness, batch-optimized reads, no reconciliation problem.\""
          },
          {
            junior: "\"Kappa means everything is in Kafka.\"",
            senior: "\"Kappa means a single logical pipeline; Kafka is just the transit buffer. The lakehouse pattern realizes Kappa by writing streaming data to Delta/Iceberg with Spark batch for compaction and historical reprocessing — no replay through Flink required for petabyte-scale backfills.\""
          }
        ],
        alternatePhrasings: [
          "\"Should we use Lambda or Kappa for our new data platform?\"",
          "\"Why did Lambda architecture fall out of favor?\"",
          "\"How does the lakehouse pattern relate to Kappa architecture?\""
        ],
        interviewContexts: [
          "Staff/principal data engineer architecture review at a large tech company",
          "System design interview at a data platform company (Databricks-adjacent)",
          "Architecture design round for a greenfield data platform at a Series D startup"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Design a GDPR-compliant right-to-be-forgotten system for a petabyte-scale data lake.",
        "How do you design a multi-region active-active data pipeline with consistency guarantees?",
        "Design a data mesh architecture for a large enterprise with 20+ independent data domains.",
        "How do you implement schema evolution for a Kafka-based pipeline without downtime?",
        "Design a cost-optimization strategy for a 50 TB/day data platform on AWS."
      ],
      decisions: [
        "When do you choose ClickHouse vs Druid vs BigQuery for a real-time analytics serving layer?",
        "Delta Lake vs Apache Iceberg vs Apache Hudi — how do you choose an open table format?",
        "Flink vs Spark Structured Streaming for a new high-volume streaming pipeline?"
      ],
      quickRef: [
        "What is the Chandy-Lamport snapshot algorithm in Flink?",
        "What is a point-in-time join in a feature store?",
        "OPTIMIZE vs VACUUM in Delta Lake — what does each do?",
        "What is liquid clustering and how does it improve on Z-ordering?",
        "What is training-serving skew?",
        "Exactly-once vs effectively-exactly-once — one sentence each?",
        "What is backpressure in a streaming pipeline?",
        "What makes a pipeline backfill-safe?",
        "What is the Lambda reconciliation problem?",
        "What is a schema registry and why do you need one at scale?"
      ],
      redFlags: [
        {
          junior: "Jumping to architecture without estimating scale numbers.",
          senior: "\"11,600 events/sec average — what is peak? Let me estimate the throughput and storage requirements before choosing between micro-batch and true streaming.\""
        },
        {
          junior: "\"Store everything in Kafka for replay.\"",
          senior: "\"Kafka has bounded retention. Raw events archive to S3 (Delta/Iceberg) as the canonical replay source; Kafka is the transit buffer.\""
        },
        {
          junior: "\"Lambda is the proven architecture.\"",
          senior: "\"Lambda's dual codebase always diverges. For greenfield systems in 2024-2026, the lakehouse pattern (streaming ingest + batch compaction on Delta/Iceberg) delivers both freshness and accuracy without the reconciliation problem.\""
        },
        {
          junior: "\"Exactly-once is always better.\"",
          senior: "\"True exactly-once adds checkpoint latency and transactional sink requirements. At-least-once with idempotent MERGE is correct for analytics and costs less. I reserve exactly-once for financial transactions.\""
        },
        {
          junior: "Describing a feature store without mentioning point-in-time joins.",
          senior: "\"The critical property of the offline store is point-in-time correctness — training data must reflect features as they existed at label time, not their current values. Otherwise you leak future data into training.\""
        },
        {
          junior: "\"Run OPTIMIZE on the whole Delta table daily.\"",
          senior: "\"Full table OPTIMIZE rewrites all data. I target only recently modified partitions with WHERE and only run a full compaction when critically necessary.\""
        }
      ],
      checklist: [
        "Estimate scale (events/sec, bytes/day) before proposing an architecture",
        "Know when at-least-once + idempotent MERGE is sufficient vs when exactly-once is required",
        "Understand the Lambda reconciliation problem and why lakehouse/Kappa is the modern default",
        "Be able to design a feature store with point-in-time joins and dual online/offline stores",
        "Know OPTIMIZE vs Z-order vs liquid clustering and when each applies"
      ],
      behavioral: [
        "Describe the most complex data system you have designed — what would you do differently now?",
        "Tell me about a time you made an architectural decision that turned out to be wrong at scale — how did you correct it?",
        "A time you pushed back on a design choice from a senior stakeholder — how did you make the case and what happened?"
      ],
      reverse: [
        "Is the current architecture Lambda, Kappa, or something else — and what are the pain points with it?",
        "What is the largest single pipeline by volume, and where does it currently bottleneck?",
        "How does the team approach exactly-once guarantees — is there a policy or is it decided per pipeline?"
      ]
    }
  }
};
