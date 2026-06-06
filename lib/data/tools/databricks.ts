import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR — Delta Lake vs Parquet, notebooks/clusters basics,
  //          medallion bronze/silver/gold concept, time travel syntax
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
          "What does Delta Lake give you over plain Parquet files on cloud storage?",
        code: [
          {
            lang: "sql",
            label: "Delta-only ops on a Parquet table",
            lines: [
              "-- _delta_log/*.json tracks commits",
              "MERGE INTO tgt t USING src s",
              "  ON t.id = s.id",
              "  WHEN MATCHED THEN UPDATE SET *",
              "  WHEN NOT MATCHED THEN INSERT *;",
              "SELECT * FROM tgt VERSION AS OF 3;",
              "-- impossible on plain Parquet",
            ],
          },
        ],
        answerStructured:
          "- **ACID transactions** via a JSON-based transaction log (`_delta_log/`). Every write either fully commits or does not appear at all — no partial/corrupt state.\n- **Time travel**: query any prior snapshot with `VERSION AS OF 5` or `TIMESTAMP AS OF '2024-01-01'`. Huge for audits and accidental-overwrite recovery.\n- **Schema enforcement**: a write that doesn't match the table schema is rejected before any files are written. Parquet just accepts whatever you throw at it.\n- **Upserts and deletes** (`MERGE`, `UPDATE`, `DELETE`): plain Parquet is append-or-overwrite only, making CDC and GDPR deletes painful.\n- **Read performance**: Delta adds per-file min/max statistics that allow data skipping; OPTIMIZE compacts small files. Parquet has no built-in compaction.\n- **Open format**: Delta tables are Parquet files underneath — other engines (Spark, Trino, Flink) can read them directly.",
        explanationDeep:
          "The mental model is: Delta Lake = Parquet + a transaction log. The `_delta_log` directory sits alongside the Parquet data files. Every write operation creates a new numbered JSON file in that directory recording what files were added or removed. The engine always reads this log first to find the current valid set of files, which is how it provides a consistent view under concurrent writers and enables time travel to any prior version.\n\nDay-to-day, the wins that matter most are MERGE and schema enforcement. Without MERGE, CDC from an upstream database requires a full overwrite or a bespoke dedup process. With MERGE, you express the CDC logic declaratively and Delta handles the file rewriting atomically. Schema enforcement means a malformed upstream payload gets rejected at the table boundary rather than silently poisoning downstream queries.\n\nThe performance side is also real: streaming and frequent small-batch writes create thousands of tiny Parquet files, each with filesystem overhead. Delta’s OPTIMIZE command compacts these into right-sized files (typically 128MB–1GB) and rebuilds the min/max statistics, letting the engine skip entire files for filtered queries.",
        interviewerLens:
          "I want to hear ACID plus the transaction log named explicitly — not just ‘Delta is better than Parquet.’ The second tell is a concrete use case: CDC MERGE or a GDPR delete. If you mention schema enforcement and time travel alongside ACID, you’ve clearly operated a lakehouse and not just read the marketing page. ‘Delta is just Parquet but faster’ is the junior red flag.",
        followupChain: [
          {
            question: "How does the `_delta_log` enable time travel?",
            answer: "Each write appends a numbered JSON file to `_delta_log`. To query version N, the engine replays log entries 0 through N to determine which Parquet files were valid at that point, then reads only those files. Every 10 commits a Parquet checkpoint file is created to speed up log replay for old versions."
          },
          {
            question: "What does VACUUM do and why do you need to be careful with it?",
            answer: "VACUUM removes Parquet files that are no longer referenced by any current or recent version in the transaction log. By default it retains 7 days of history. Running VACUUM with a shorter retention window — especially VACUUM RETAIN 0 HOURS — destroys time-travel history and can break concurrent readers still referencing older snapshots."
          },
          {
            question: "Can a non-Databricks engine read a Delta table?",
            answer: "Yes. Delta tables are standard Parquet files plus the `_delta_log`. Engines with a Delta connector (Apache Spark, Trino, Flink, DuckDB, pandas via `deltalake` library) can read them. Some engines require the Delta reader protocol version to be compatible with their implementation."
          }
        ],
        redFlags: [
          {
            junior: "\"Delta is just Parquet but faster.\"",
            senior: "\"Delta adds ACID transactions via a transaction log, MERGE, time travel, and schema enforcement on top of Parquet — fundamentally different guarantees, not just speed.\""
          },
          {
            junior: "\"I’d overwrite the whole Parquet table to do an update.\"",
            senior: "\"In Delta I’d use MERGE or UPDATE — those rewrite only the affected files rather than the whole table, and they’re atomic.\""
          }
        ],
        alternatePhrasings: [
          "\"Why use a lakehouse instead of files in S3?\"",
          "\"What problem does Delta Lake solve?\"",
          "\"Explain the difference between a Delta table and a Parquet table.\""
        ],
        interviewContexts: [
          "Asked in nearly every junior/mid Databricks data engineering screen",
          "Came up at a lakehouse-migration team interview (Series B data platform)"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "Describe the medallion architecture (bronze / silver / gold). What goes in each layer and why?",
        answerStructured:
          "- **Bronze (raw)**: ingest data exactly as it arrives from the source — no transformations, no filtering. Add metadata columns (ingestion timestamp, source system, file name). This layer is the permanent audit record.\n- **Silver (cleansed)**: apply parsing, type-casting, deduplication, and joins to produce a cleaned, conformed, queryable table. CDC MERGE logic runs here to keep silver current without full rebuilds.\n- **Gold (curated/aggregated)**: purpose-built aggregations, business-metric tables, and wide denormalized tables for specific teams or use cases (dashboards, ML feature stores). Optimized for read performance with OPTIMIZE + clustering.\n- **Why three layers**: separating concerns means a schema change upstream only forces you to reprocess from bronze onward, not rebuild gold from scratch. Each layer can be independently tested and monitored.",
        explanationDeep:
          "The medallion pattern is fundamentally about fault isolation and reproducibility. Bronze is the ledger: every raw record is preserved in its original form. If something goes wrong in silver or gold, you reprocess from bronze rather than re-fetching from the source system. This makes the pipeline deterministic and auditable.\n\nSilver is where data quality work lives: deduplication, NULL handling, referential integrity joins, schema normalization. Getting silver right means gold is just aggregation — which is far easier to test and rerun. A common junior mistake is doing too much in bronze (applying business logic) or in gold (joining raw tables), which breaks the separation.\n\nGold tables are the product: they serve dashboards, reports, and ML pipelines. They should be wide, pre-joined, and clustered for the specific query patterns of their consumers. The cost of maintaining three layers pays off in debuggability — when a metric looks wrong, you can trace it back through silver to bronze and pinpoint exactly where data drifted.",
        interviewerLens:
          "I’m checking whether you understand the purpose of each layer, not just the names. ‘Bronze is raw, silver is clean, gold is aggregated’ is the textbook answer. The senior signal is explaining *why* — fault isolation, reprocessing from bronze, separation of quality vs business logic. Candidates who can describe what CDC MERGE looks like in silver have clearly built a real medallion pipeline.",
        followupChain: [
          {
            question: "When would you skip the silver layer?",
            answer: "For simple, low-volume pipelines where bronze data is already clean and conformed — e.g., a trusted internal API with a stable schema. Even then, I’d keep the bronze layer as the raw audit record and go straight to gold, but skip the intermediate cleaning step. As soon as data quality is uncertain, silver earns its cost."
          },
          {
            question: "How does Auto Loader fit into the medallion pattern?",
            answer: "Auto Loader is the standard ingestion mechanism from cloud storage into the bronze layer. It uses Structured Streaming to incrementally detect and process new files as they land, without listing the entire directory on each run. Bronze becomes a streaming Delta table, and downstream silver jobs can also run as streams or micro-batch jobs against it."
          }
        ],
        redFlags: [
          {
            junior: "\"Bronze is raw, silver is cleaner, gold is final.\" (No explanation of why)",
            senior: "\"Bronze preserves the source record for reprocessing; silver enforces quality and schema; gold serves specific consumers. The layers isolate failures and make pipelines deterministic.\""
          }
        ],
        alternatePhrasings: [
          "\"Explain the lakehouse data layers.\"",
          "\"How would you structure a Databricks ETL pipeline?\"",
          "\"What is the bronze/silver/gold pattern and when would you use it?\""
        ],
        interviewContexts: [
          "Junior data engineering screen at a financial services company",
          "Asked in every Databricks-platform interview at the junior-to-mid level"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "What is Delta Lake time travel and how do you use it in practice?",
        code: [
          {
            lang: "sql",
            label: "Recover an accidental overwrite",
            lines: [
              "DESCRIBE HISTORY sales;",
              "-- find good version, e.g. 41",
              "SELECT * FROM sales",
              "  VERSION AS OF 41;  -- verify",
              "RESTORE TABLE sales",
              "  TO VERSION AS OF 41;",
              "-- new commit -> old files, instant",
            ],
          },
        ],
        answerStructured:
          "- Time travel lets you query or restore a Delta table at any prior version or timestamp without restoring backups.\n- **By version**: `SELECT * FROM my_table VERSION AS OF 10` — reads the table as of commit version 10.\n- **By timestamp**: `SELECT * FROM my_table TIMESTAMP AS OF '2024-06-01 00:00:00'` — reads the nearest version at or before that time.\n- **Restore a table**: `RESTORE TABLE my_table TO VERSION AS OF 10` — rolls the table back (creates a new commit, preserving history).\n- **History**: `DESCRIBE HISTORY my_table` shows all versions, their timestamps, and operations.\n- **Retention**: versions are available until VACUUM removes the underlying Parquet files. Default retention is 7 days (`delta.logRetentionDuration`).\n- **Use cases**: recovering an accidental overwrite/delete, reproducing a report from a specific date, auditing what changed between versions.",
        explanationDeep:
          "Time travel works because Delta never deletes files on write — it only adds new files and marks old ones as removed in the transaction log. Until VACUUM cleans them up, those old files are still on storage, and the engine can reconstruct any prior view by replaying the log up to the desired version.\n\nThe practical use cases are more valuable than the syntax. An accidental `DELETE FROM` or `OVERWRITE` without a WHERE clause is one of the most stressful incidents in data engineering. With Delta, you `DESCRIBE HISTORY` to find the version just before the accident, `SELECT COUNT(*)` on that version to confirm it looks right, then `RESTORE TABLE TO VERSION AS OF` to create a new commit that points to those files. The restore is instant (just a log entry) and auditable.\n\nFor reproducible reporting, time travel means you can lock a report to a specific table version and rerun it months later with the same result, even if the live table has been updated. This is especially important for regulatory and financial reports.",
        interviewerLens:
          "I want the correct syntax (VERSION AS OF / TIMESTAMP AS OF) and a real use case beyond ‘you can look at old data.’ The RESTORE TABLE for accidental-delete recovery is the scenario every interviewer has in mind. Knowing that VACUUM limits how far back you can go — and that you’d increase retention before a risky operation — shows production experience.",
        followupChain: [
          {
            question: "What happens if you try to time-travel to a version that VACUUM has cleaned up?",
            answer: "You’ll get an error: the Parquet files for that version no longer exist on storage even though the log entry does. You can’t travel beyond the VACUUM retention window. To preserve longer history, increase `delta.logRetentionDuration` and `delta.deletedFileRetentionDuration` before running VACUUM."
          },
          {
            question: "How do you audit what changed between two versions of a Delta table?",
            answer: "Use `DESCRIBE HISTORY my_table` for operation-level audit. For row-level changes, enable the Change Data Feed (`delta.enableChangeDataFeed = true`) and query `table_changes('my_table', version1, version2)` which returns rows with a `_change_type` column (insert/update_preimage/update_postimage/delete)."
          }
        ],
        redFlags: [
          {
            junior: "\"You can only look at old data, you can’t restore it.\"",
            senior: "\"RESTORE TABLE creates a new commit that points to the prior version’s files — it’s an instant, auditable rollback, not a file copy.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you recover from an accidental DELETE in Delta Lake?\"",
          "\"What is time travel and how does it work under the hood?\"",
          "\"How would you reproduce a report from 3 months ago on a live Delta table?\""
        ],
        interviewContexts: [
          "Junior Databricks engineer screen at a data platform startup",
          "Asked in incident-recovery scenario questions at mid-market data teams"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "When would you use an all-purpose cluster vs a job cluster in Databricks, and why does it matter for cost?",
        answerStructured:
          "- **All-purpose cluster**: starts once, stays running, shared by multiple users via interactive notebooks. Billed by DBU (Databricks Unit) at the higher all-purpose rate while it’s alive — even when idle.\n- **Job cluster**: created fresh when a job starts, terminated the moment the job completes. Billed only for runtime at the lower job-cluster DBU rate.\n- **Cost difference**: job clusters are typically 40–60% cheaper per DBU than all-purpose, and have zero idle cost. A production ETL pipeline left on an all-purpose cluster overnight can burn credits for hours doing nothing.\n- **Rule**: use all-purpose clusters for interactive development and exploration; use job clusters for every scheduled/automated production job.\n- **Third type (SQL warehouse)**: optimized for BI SQL queries; separate billing via SQL compute. Use for dashboards and ad-hoc analyst queries, not Spark code.",
        explanationDeep:
          "The most common Databricks cost mistake is running production jobs on an all-purpose cluster that was originally spun up for development. It never gets terminated, accumulates idle hours, and the team doesn’t notice until the cloud bill arrives.\n\nJob clusters are ephemeral by design — they start with a clean environment, run the job, and die. This also has a reliability benefit: no shared state, no notebook sessions or libraries from other users polluting the environment. For scheduled production pipelines, job clusters are the clear default.\n\nAll-purpose clusters earn their cost when multiple analysts are actively using them interactively throughout the day, amortizing the startup latency. But they must have auto-termination configured (e.g., terminate after 30–60 minutes of inactivity) to avoid runaway costs when everyone goes home.",
        interviewerLens:
          "I’m listening for the cost differential (job cluster DBU rate is lower + no idle cost) and the rule of thumb: production jobs = job clusters, interactive dev = all-purpose. Candidates who say they always use all-purpose clusters for convenience have never owned a Databricks bill. The auto-termination point is a bonus that shows production awareness.",
        followupChain: [
          {
            question: "How do you pass parameters to a job cluster at runtime?",
            answer: "Via Databricks Workflows job parameters — passed as key-value pairs that the notebook reads with `dbutils.widgets.get()`, or as task values passed between tasks in a multi-task workflow with `dbutils.jobs.taskValues`. Job clusters can also receive cluster-level init scripts and library configurations defined in the job spec."
          },
          {
            question: "What is a SQL Warehouse and when do you use it instead of a cluster?",
            answer: "SQL Warehouses are purpose-built for SQL analytics — they use Photon (Databricks’ vectorized query engine) and support concurrency scaling. Use them for BI tools (Tableau, Looker), SQL analytics notebooks, and Databricks SQL dashboards. They’re not suitable for running arbitrary PySpark code — for that, you still need a cluster."
          }
        ],
        redFlags: [
          {
            junior: "\"I use an all-purpose cluster for everything so I don’t have to wait for startup.\"",
            senior: "\"All-purpose clusters are for interactive dev; every production job gets a job cluster to avoid idle billing at the higher DBU rate.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you reduce Databricks compute cost?\"",
          "\"What’s the difference between a cluster type in Databricks?\"",
          "\"Why do production jobs use job clusters?\""
        ],
        interviewContexts: [
          "Asked at a cloud cost optimization interview at a Series B data team",
          "Junior Databricks engineer screen — almost always comes up"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 10,
        questionText:
          "How do you decide what format to use when writing data in Databricks — Delta, Parquet, CSV, or JSON?",
        answerStructured:
          "- **Delta Lake**: default for any table you need to query, update, or manage over time. ACID, schema enforcement, time travel, MERGE. Use for bronze/silver/gold layers.\n- **Parquet**: use for staging files or handoffs to external systems that don’t support Delta. Fast columnar reads, no transaction guarantees.\n- **CSV / JSON**: use at the ingestion boundary only — reading raw upstream files. Never store processed data as CSV; no schema, slow to read, large on disk.\n- **Decision rule**: if data will be queried or updated in Databricks, always write Delta. If handing data off to a non-Delta-capable system, write Parquet. CSV/JSON are source formats, not destination formats.\n- For external sharing across organizations, consider **Delta Sharing** (open protocol to share live Delta tables without copying data).",
        explanationDeep:
          "The key insight is that format is a destination decision, not a source one. Upstream systems send you whatever they send — JSON events, CSV exports, Parquet dumps — and you read those. But everything you write inside Databricks should be Delta by default unless there’s a specific reason not to.\n\nCSV stored in a data lake is an anti-pattern: no schema, no stats, large file sizes, slow reads, no ACID. Teams that persist processed data as CSV are usually carrying over habits from on-prem ETL where CSV was the lingua franca. In a lakehouse, there is no reason for it.\n\nParquet has a legitimate role as a handoff format when a downstream system (a Spark job at a partner, an external ML tool) doesn’t have a Delta reader. For everything internal, Delta’s transaction guarantees and performance features make it strictly better.",
        interviewerLens:
          "I’m checking whether you default to Delta for internal data and can explain why CSV/JSON are source-not-destination formats. Candidates who say ‘I use Parquet because it’s fast’ for all writes don’t yet understand what Delta adds. The Delta Sharing mention shows awareness of modern data sharing patterns.",
        followupChain: [
          {
            question: "Can you read a Delta table from outside Databricks?",
            answer: "Yes — Delta tables are standard Parquet files + the `_delta_log`. Any engine with a Delta connector (Spark, Trino, Flink, DuckDB) can read them. Delta Sharing lets you share read access to live tables with external parties without copying files."
          }
        ],
        redFlags: [
          {
            junior: "\"I store everything as CSV for portability.\"",
            senior: "\"CSV is a source format only. Inside Databricks I write Delta for queryability, ACID, and performance; Parquet only for external handoffs that don’t support Delta.\""
          }
        ],
        alternatePhrasings: [
          "\"What file format do you use in a Databricks lakehouse?\"",
          "\"When would you choose Parquet over Delta?\""
        ],
        interviewContexts: [
          "Junior Databricks screen at a data engineering bootcamp hire",
          "Asked when discussing ingestion pipeline design"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["Delta Lake", "Apache Parquet"],
        asked: 20,
        questionText:
          "Delta Lake vs plain Parquet on S3 — when would each be the right choice?",
        answerStructured:
          "- **Delta Lake**: choose when you need ACID transactions, concurrent writes without corruption, upserts/deletes (MERGE/UPDATE/DELETE), schema enforcement, time travel, or automatic file compaction. This covers virtually all production lakehouse use cases.\n- **Plain Parquet**: choose for read-only static datasets, one-time exports, or handoffs to systems that have no Delta connector. Also valid as a wire format between systems (e.g., Spark writing files consumed by a non-Delta Spark job).\n- **Key Parquet limitations**: no transactions (two concurrent writers can corrupt each other), no row-level updates or deletes, no schema enforcement on write, no built-in compaction, no version history.\n- **Practical default**: if you’re in a Databricks or Spark environment, always start with Delta. The only reason to write raw Parquet is external interoperability.",
        explanationDeep:
          "Parquet itself is a brilliant columnar format — efficient compression, predicate pushdown via column metadata, and wide ecosystem support. Delta Lake doesn’t replace Parquet; it uses Parquet as its data format and adds a management layer (the transaction log) on top.\n\nThe distinction matters for concurrent writes. In a pure-Parquet data lake, two Spark jobs writing to the same prefix at the same time can overwrite each other’s files. There is no conflict detection. Delta’s optimistic concurrency control detects conflicts and fails one of the writers, preserving consistency.\n\nFor a junior engineer, the practical answer is: if someone asks you to store data in the lakehouse, write Delta. If someone gives you Parquet files to read, read them. The format is mostly a concern at write time, and Delta is the right choice for writes unless constrained by an external system.",
        interviewerLens:
          "I want to hear that Delta is Parquet-underneath-plus-a-transaction-log, not that they’re fundamentally different file formats. And I want to hear at least one concrete scenario where raw Parquet is appropriate (external handoff, read-only static dataset). ‘Parquet is legacy, always use Delta’ misses the nuance.",
        followupChain: [
          {
            question: "Can you convert an existing Parquet table to Delta in place?",
            answer: "Yes: `CONVERT TO DELTA parquet.`path/to/table`` adds the `_delta_log` to existing Parquet files without rewriting them. The data files stay as-is; the log is synthesized from the existing file listing. After conversion you get all Delta features going forward."
          }
        ],
        redFlags: [
          {
            junior: "\"Parquet is legacy, Delta replaced it.\"",
            senior: "\"Delta uses Parquet as its data format and adds a transaction log on top. Parquet is still the right choice for external handoffs and read-only datasets.\""
          }
        ],
        alternatePhrasings: [
          "\"What’s the difference between storing data as Parquet vs Delta?\"",
          "\"Why did we move from Parquet to Delta Lake?\""
        ],
        interviewContexts: [
          "Junior data engineer interview at a company migrating from S3/Parquet to a Databricks lakehouse"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is schema enforcement vs schema evolution in Delta Lake?",
        "Walk me through what happens when two Spark jobs write to the same Delta table concurrently.",
        "What is Auto Loader and how does it differ from a batch file listing?",
        "Explain what a checkpoint file in `_delta_log` does and why it exists.",
        "What is the Change Data Feed (CDF) and when would you enable it?",
        "How do you configure a Delta table to auto-compact small files on write?",
        "What is the difference between DESCRIBE HISTORY and DESCRIBE DETAIL on a Delta table?",
        "What Databricks notebook languages are available and when would you choose each?",
        "How do you mount cloud storage in Databricks and what is the newer alternative (Unity Catalog volumes)?",
        "What is dbutils and what are its main namespaces?"
      ],
      decisions: [
        "All-purpose cluster vs job cluster vs SQL warehouse — which workload gets which?",
        "Delta vs Parquet vs CSV — when is each the right destination format?",
        "When should the bronze layer be a streaming table vs a batch-loaded table?"
      ],
      quickRef: [
        "What is the `_delta_log` directory?",
        "Syntax to query a Delta table at version 5?",
        "What does OPTIMIZE do to a Delta table?",
        "VACUUM default retention period?",
        "What is a job cluster vs an all-purpose cluster?",
        "Bronze / silver / gold in one sentence each?",
        "What does Auto Loader’s `cloudFiles` format do?",
        "What is schema enforcement in Delta Lake?",
        "What runtime is Databricks built on top of?",
        "What are DBUs?"
      ],
      redFlags: [
        {
          junior: "\"Delta is just faster Parquet.\"",
          senior: "\"Delta adds ACID transactions, MERGE, time travel, and schema enforcement via a transaction log — fundamentally different guarantees.\""
        },
        {
          junior: "\"I use all-purpose clusters for production jobs.\"",
          senior: "\"Production jobs use job clusters — lower DBU rate and zero idle cost. All-purpose is for interactive development.\""
        },
        {
          junior: "\"I store processed data as CSV for portability.\"",
          senior: "\"CSV is a source-ingestion format only. Inside the lakehouse I write Delta; Parquet only for external handoffs.\""
        }
      ],
      checklist: [
        "Know what the `_delta_log` is and how it enables ACID + time travel",
        "Be able to recite the medallion layers and the purpose of each",
        "Know the job cluster vs all-purpose cluster cost story",
        "Know time travel syntax (VERSION AS OF / TIMESTAMP AS OF)",
        "Understand VACUUM retention and why it limits time travel"
      ],
      behavioral: [
        "Tell me about a pipeline you built on Databricks — walk me through the layers.",
        "Describe a time you had to recover data from an accidental overwrite.",
        "How did you explain the lakehouse concept to a non-technical stakeholder?"
      ],
      reverse: [
        "Are you on Unity Catalog or the legacy metastore?",
        "What does your medallion architecture look like today?",
        "How are job clusters provisioned — fixed config or autoscaling?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID — ACID via transaction log internals, MERGE/upserts,
  //       Auto Loader, job vs all-purpose clusters, schema evolution
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
          "How does Delta Lake actually implement ACID transactions? Walk me through what happens when a MERGE runs.",
        code: [
          {
            lang: "sql",
            label: "MERGE rewrites only matched files",
            lines: [
              "MERGE INTO target t",
              "USING updates u ON t.id = u.id",
              "WHEN MATCHED THEN UPDATE SET *",
              "WHEN NOT MATCHED THEN INSERT *;",
              "-- one commit JSON records",
              "-- removed + added files atomically",
              "-- untouched files stay as-is",
            ],
          },
        ],
        answerStructured:
          "- Delta uses a **transaction log** (`_delta_log/`) — a sequence of JSON commit files. Each commit atomically records what Parquet files were added and removed, plus metadata changes.\n- **Atomicity**: when a write starts, Delta writes new Parquet data files to the table directory but does NOT register them. The commit only becomes visible when the JSON commit file is successfully written. If the job crashes before the commit, the orphaned Parquet files are simply ignored (and eventually cleaned by VACUUM).\n- **Isolation**: Delta uses **optimistic concurrency control**. Two concurrent writers each read the current log version, do their work, then attempt to commit at the next version number. If two commits race to the same version, the second one detects the conflict (the log file already exists), retries with conflict checking, and either succeeds (if the operations touched different data) or fails with a conflict error.\n- **MERGE execution**: Delta reads the source; for matched rows it identifies the affected Parquet files, rewrites them with the changes (new files), and records the old files as removed and new files as added in one atomic JSON commit. Unaffected files are untouched.",
        explanationDeep:
          "The critical insight is that Delta’s “ACID” is not a database engine in the traditional sense — there’s no lock manager or WAL. Atomicity is achieved by making the commit log entry the source of truth: a file exists as far as Delta is concerned only when the log entry says it exists. This is why a partial write (e.g., 3 of 10 Parquet files written before a crash) doesn’t corrupt the table — no log entry ever referenced those partial files, so they’re invisible.\n\nFor MERGE specifically: Delta computes a join between the source and the target to identify matching rows. It then groups the affected rows by which target Parquet files they live in. Each of those files gets rewritten (the matched rows updated/deleted, unmatched rows kept as-is). New Parquet files replace the old ones. The transaction log commit atomically records the full set of “remove old files, add new files” instructions. If the cluster dies mid-MERGE, no partial commit is recorded and the table is unchanged.\n\nThe checkpoint files (written every 10 commits) exist for read performance: instead of replaying 1000 JSON commit files to reconstruct the current state, the engine reads the latest checkpoint (a Parquet summary of all active files up to that point) plus just the JSON commits since the checkpoint.",
        interviewerLens:
          "The key discriminator is whether you understand the log-as-source-of-truth model. ‘Delta has ACID because it’s a database’ is wrong. ‘Delta has ACID because the commit log is the single source of truth and writes are only visible after a successful log entry’ is correct. The MERGE file-rewriting story — identifying affected Parquet files, rewriting them, atomically committing adds + removes — is the mid-level signal. If you mention optimistic concurrency control and checkpoint files, you’ve demonstrated you’ve actually read the internals.",
        followupChain: [
          {
            question: "What happens when two concurrent writers try to MERGE into the same Delta table?",
            answer: "Delta uses optimistic concurrency. Both writers read the current log version, do their work, and attempt to write the next commit version. The first writer wins. The second detects that the version file already exists, reads the first writer’s commit to check for conflicts, and either succeeds (if the operations touched non-overlapping files) or fails with a ConcurrentModificationException. The application must handle the retry."
          },
          {
            question: "How does a checkpoint file speed up table reads?",
            answer: "Instead of replaying potentially thousands of JSON commit files to find the current set of valid Parquet files, the engine reads the latest Parquet checkpoint (written every 10 commits by default) which summarizes all active files up to that commit, then only replays the JSON files since the checkpoint. For a table with thousands of commits, this can reduce log read time from seconds to milliseconds."
          },
          {
            question: "What is Change Data Feed and how does it relate to MERGE?",
            answer: "CDF (`delta.enableChangeDataFeed = true`) makes Delta record row-level changes (insert, update_preimage, update_postimage, delete) in a hidden `_change_data` directory alongside the commit. After a MERGE, you can query `table_changes('my_table', fromVersion, toVersion)` to see exactly which rows changed. This is the Delta-native CDC mechanism, useful for propagating changes downstream without re-reading the full table."
          }
        ],
        redFlags: [
          {
            junior: "\"Delta has ACID because it’s built on top of a database engine.\"",
            senior: "\"Delta achieves ACID via the transaction log: a write only becomes visible when the commit JSON file is written. There’s no traditional lock manager — it’s optimistic concurrency with conflict detection on commit.\""
          },
          {
            junior: "\"MERGE rewrites the whole table.\"",
            senior: "\"MERGE identifies which target Parquet files contain matching rows, rewrites only those files, and atomically commits the removes + adds in the log. Unaffected files are untouched.\""
          }
        ],
        alternatePhrasings: [
          "\"How does Delta Lake prevent data corruption with concurrent writes?\"",
          "\"What is the Delta transaction log and how does it work?\"",
          "\"Walk me through what happens under the hood when you run a MERGE statement on a Delta table.\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a fintech using Databricks for CDC pipelines",
          "Asked in a ‘Delta Lake internals’ deep-dive at a Series C data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "Walk me through how you’d implement a CDC (change data capture) pipeline from a Postgres source into a Delta Lake silver table using MERGE.",
        code: [
          {
            lang: "pyspark",
            label: "Dedup-to-latest, then MERGE per op",
            lines: [
              "# in foreachBatch: dedup to latest",
              "# op per id, then branched merge:",
              "(tgt.alias('t')",
              "  .merge(latest.alias('s'),'t.id=s.id')",
              "  .whenMatchedDelete('s.op = \"D\"')",
              "  .whenMatchedUpdateAll()",
              "  .whenNotMatchedInsertAll().execute())",
            ],
          },
        ],
        answerStructured:
          "- **Capture**: extract changes from Postgres using Debezium or a similar CDC tool. Changes land in Kafka or as files in cloud storage with operation type (INSERT/UPDATE/DELETE) and a before/after image.\n- **Ingest to bronze**: use Auto Loader (`cloudFiles` format) or Kafka connector to stream raw CDC events into a bronze Delta table. Append-only; preserve the raw change record.\n- **Apply to silver via MERGE**: read bronze CDC events, filter to the latest operation per primary key in the micro-batch (to handle rapid insert-then-update on the same key), then:\n  - `WHEN MATCHED AND op = 'DELETE' THEN DELETE`\n  - `WHEN MATCHED AND op IN ('UPDATE') THEN UPDATE SET *`\n  - `WHEN NOT MATCHED AND op = 'INSERT' THEN INSERT *`\n- **Idempotency**: use a high-watermark or Structured Streaming checkpoint so restarting the job doesn’t re-apply already-processed changes.\n- **Schema evolution**: enable `mergeSchema = true` if the source schema can change; use strict schema enforcement if it should not.",
        explanationDeep:
          "The MERGE statement is what makes Delta Lake viable as a CDC target. Without it, you’d have to overwrite the whole silver table on every batch or maintain a complex deduplication scheme. With MERGE, you express the CDC logic declaratively: match on the primary key, then branch on the operation type.\n\nThe critical detail in a streaming CDC pattern is handling multiple operations on the same key within a single micro-batch. If a row is inserted and then immediately updated in the same batch, a naive MERGE may process the insert first and then the update, or process them in the wrong order. The correct approach is to deduplicate within the batch: for each primary key, keep only the latest operation (by event timestamp or CDC sequence number) before feeding to MERGE.\n\nFor idempotency: Structured Streaming with a checkpoint directory ensures exactly-once semantics at the batch level. Even if the job crashes mid-MERGE and restarts, it replays from the checkpoint and re-applies the same batch. Because MERGE is idempotent when the source data hasn’t changed, this is safe.\n\nSilver should be the current state of the source table — fully applied, deduplicated, with the same primary key uniqueness guarantees as the source. Gold then aggregates from that clean silver layer.",
        interviewerLens:
          "I’m listening for the three MERGE branches (insert, update, delete by operation type) and the within-batch deduplication step. Candidates who skip the dedup step have built CDC pipelines that produce wrong results when the source emits rapid change sequences. The idempotency through Structured Streaming checkpoints shows production pipeline experience.",
        followupChain: [
          {
            question: "How does Auto Loader handle schema evolution in the source files?",
            answer: "Auto Loader has two schema inference modes. `addNewColumns` automatically adds new columns to the target table when they appear in source files — good for tolerant pipelines. `failOnNewColumns` (default) rejects batches with unexpected columns — good for strict pipelines. The inferred schema is stored in a configurable schema location and updated incrementally."
          },
          {
            question: "What is the `_rescued_data` column in Auto Loader?",
            answer: "`_rescued_data` is a special column Auto Loader adds to capture any fields in the source data that don’t match the inferred/defined schema. Instead of dropping or erroring on unexpected fields, Auto Loader puts them in this JSON column. Useful for schema drift tolerance in bronze ingestion."
          },
          {
            question: "How would you make a MERGE idempotent if you can’t use Structured Streaming?",
            answer: "Track processed batch IDs or high-watermarks in a separate Delta control table. Before running MERGE, check whether the current batch has already been applied. If yes, skip. This is a manual checkpoint pattern for batch CDC jobs that don’t use Spark Streaming."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d overwrite the silver table on each CDC batch.\"",
            senior: "\"Full overwrites are expensive and non-atomic on large tables. I’d use MERGE to apply only the changed rows, matching on primary key and branching on operation type.\""
          },
          {
            junior: "\"I’d apply MERGE without deduplicating within the batch.\"",
            senior: "\"Within a micro-batch, multiple operations can hit the same key. I deduplicate to the latest operation per key before MERGE to avoid insert-then-update ordering bugs.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you build a CDC pipeline in Databricks?\"",
          "\"How do you use MERGE for upserts in Delta Lake?\"",
          "\"Describe a Databricks pipeline that keeps a Delta silver table in sync with a transactional database.\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a logistics company with CDC from MySQL",
          "Asked in a pipeline design round at a Series B SaaS company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "What is Auto Loader and when would you use it instead of a batch file listing?",
        code: [
          {
            accent: "bug",
            lang: "pyspark",
            label: "re-lists everything each run",
            lines: [
              "df = spark.read.parquet(path)",
              "# O(total files) every run",
            ],
          },
          {
            accent: "fix",
            lang: "pyspark",
            label: "Auto Loader: O(new files)",
            lines: [
              "df = (spark.readStream",
              "  .format('cloudFiles')",
              "  .option('cloudFiles.format','json')",
              "  .option('cloudFiles.schemaLocation', ck)",
              "  .load(path))  # checkpoint skips seen",
            ],
          },
        ],
        answerStructured:
          "- Auto Loader (`cloudFiles` format in Structured Streaming) incrementally detects and processes new files as they land in cloud storage, without re-listing the entire directory on each run.\n- **Two detection modes**: directory listing (polls for new files periodically) and file notification (subscribes to S3 event notifications or Azure Event Grid for near-real-time detection).\n- **Why better than batch listing**: a directory with millions of files takes minutes to list; Auto Loader maintains state about already-processed files in a checkpoint directory, so each run only considers new files. This is O(new files), not O(total files).\n- **Schema inference + rescue**: Auto Loader infers schema from the first batch and stores it; it can evolve the schema incrementally as new columns appear. Unknown fields go to `_rescued_data`.\n- **Use it when**: you have a continuous or frequent file drop into cloud storage (e.g., Kafka’s S3 sink, hourly exports from an upstream system) and need incremental processing without managing your own file-tracking logic.",
        explanationDeep:
          "The core problem Auto Loader solves is the file listing scalability wall. If you land 10,000 files per hour in an S3 prefix and you’ve been running for 6 months, a naive Spark batch job that starts with `spark.read.parquet(‘s3://bucket/prefix/’)` has to list millions of files on every run to find the new ones. That list operation can take longer than the actual data processing.\n\nAuto Loader solves this with a persistent checkpoint. It records which files have been processed, so each run starts from where the previous one ended. In file notification mode, it doesn’t even list — it receives event notifications from the cloud storage service (S3 SNS/SQS or Azure Event Grid) when new files arrive, making detection nearly instantaneous.\n\nIn the medallion pattern, Auto Loader is the standard bronze ingestion mechanism: files land in cloud storage, Auto Loader picks them up incrementally, and appends them to a bronze Delta table. From there, downstream silver jobs (either streaming or batch) read from the bronze Delta table. This decouples ingestion latency from processing complexity.",
        interviewerLens:
          "I want to hear ‘checkpoint for incremental file tracking’ and the scalability argument (O(new files) vs O(total files)). The file notification mode vs directory listing mode is a bonus that shows you’ve actually configured Auto Loader in production. Candidates who just say ‘it’s like a streaming read of files’ have the right idea but haven’t used it.",
        followupChain: [
          {
            question: "How does Auto Loader handle corrupt or malformed files?",
            answer: "Auto Loader has a `badRecordsPath` option to redirect malformed rows to a quarantine location instead of failing the entire batch. For corrupt files (completely unreadable), they can be added to an ignore list or cause the stream to fail depending on configuration. Schema mismatches go to `_rescued_data`."
          },
          {
            question: "Can you use Auto Loader for non-file sources like Kafka?",
            answer: "No — Auto Loader is specifically for cloud file storage (S3, ADLS, GCS). For Kafka or other message queues, use the Kafka source in Spark Structured Streaming (`spark.readStream.format(‘kafka’)`). Auto Loader and Kafka are the two primary Structured Streaming ingestion patterns in a Databricks lakehouse."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d just use spark.read.parquet() on the whole prefix every time.\"",
            senior: "\"That re-lists and re-reads everything on each run. Auto Loader with a checkpoint is O(new files) and handles millions of files in a prefix without performance degradation.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you incrementally ingest files from S3 into Delta Lake?\"",
          "\"What is the `cloudFiles` format in Structured Streaming?\"",
          "\"Compare Auto Loader to a scheduled batch read of cloud storage.\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a company migrating from hourly batch loads to streaming",
          "Asked in a pipeline design discussion at a growth-stage fintech"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How does Delta Lake handle schema evolution, and what’s the difference between `mergeSchema` and `overwriteSchema`?",
        code: [
          {
            lang: "pyspark",
            label: "additive: keeps existing cols",
            lines: [
              "(df.write.format('delta')",
              "  .mode('append')",
              "  .option('mergeSchema','true')",
              "  .saveAsTable('events'))",
            ],
          },
          {
            lang: "pyspark",
            label: "destructive: replaces schema",
            lines: [
              "(df.write.format('delta')",
              "  .mode('overwrite')",
              "  .option('overwriteSchema','true')",
              "  .saveAsTable('events'))",
              "# can drop cols / change types",
            ],
          },
        ],
        answerStructured:
          "- **Schema enforcement** (default): a write that doesn’t match the table schema is rejected with an AnalysisException before any data is written. Protects data integrity.\n- **Schema evolution with `mergeSchema`**: when you write with `.option(‘mergeSchema’, ‘true’)`, new columns in the source are automatically added to the table schema. Existing columns and their data types are preserved. Use when the source schema can grow (e.g., new event properties added upstream).\n- **`overwriteSchema`**: when you write in overwrite mode with `.option(‘overwriteSchema’, ‘true’)`, the entire table schema is replaced by the source schema, even if existing columns are dropped or types changed. Destructive — use only when intentionally replacing the table definition.\n- **Column type changes**: neither mergeSchema nor overwriteSchema allow arbitrary type changes (e.g., int → string). Type widening (int → long) is supported in recent Delta versions with the type widening feature flag.",
        explanationDeep:
          "Schema enforcement is the default because silent schema drift is one of the most common causes of data quality incidents. If an upstream system adds a field, the write to Delta will fail — loudly, immediately, before any data lands. This is the correct behavior for most production pipelines: a schema change should be a deliberate, reviewed action, not something that silently modifies the table.\n\nmergeSchema trades strictness for flexibility: it lets the table grow as the source grows, which is appropriate for event-driven pipelines where new event properties are expected to appear over time. The contract is additive-only: mergeSchema will add columns but will not drop them or change types.\n\noverwriteSchema is dangerous and should be used sparingly — it’s the right tool when you’re deliberately changing the table definition (backfilling a column type, restructuring the layout) but it will destroy schema history and can break downstream consumers that expected the old schema.",
        interviewerLens:
          "I want to hear the distinction between the three states: enforcement (default), additive evolution (mergeSchema), and destructive replacement (overwriteSchema). Candidates who only know ‘mergeSchema = true’ without understanding when to use overwriteSchema vs the destructive implications have only used it for the happy path. Mentioning type widening shows awareness of Delta’s ongoing evolution.",
        followupChain: [
          {
            question: "What happens downstream when you add a column with mergeSchema?",
            answer: "Existing Parquet files don’t have the new column — Delta’s reader fills it with NULL for those older files. Downstream queries work correctly as long as they handle NULLs for the new column in older records. This is safe as long as consumers don’t assume the column is always populated."
          }
        ],
        redFlags: [
          {
            junior: "\"I use overwriteSchema whenever I need to add a column.\"",
            senior: "\"overwriteSchema replaces the whole schema destructively. To add columns, I use mergeSchema. overwriteSchema is only for intentional, breaking schema changes.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you add a new column to a Delta table from an upstream schema change?\"",
          "\"What is the difference between schema enforcement and schema evolution in Delta?\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a company with rapidly evolving event schemas",
          "Asked in a schema management discussion at a SaaS data platform"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "How do you decide between Structured Streaming (micro-batch) and batch jobs for a Databricks pipeline?",
        answerStructured:
          "- **Structured Streaming (micro-batch)**: use when data must be processed continuously or with low latency (seconds to minutes). Handles Auto Loader, Kafka sources, and Delta table sources. Maintains an offset/checkpoint so it knows exactly where it left off.\n- **Batch job**: use when data arrives in discrete chunks (daily export, hourly file drop), latency in minutes-to-hours is acceptable, and the processing logic is complex enough that streaming adds no value.\n- **Decision driver**: what is the required freshness SLA? Sub-5-minute latency → streaming. Hourly or daily → batch with a Databricks Workflow trigger.\n- **Streaming adds complexity**: checkpoint management, watermarking for late data, stateful operation caveats, harder to debug. Don’t stream just because you can.\n- **Hybrid pattern**: many production Databricks pipelines ingest via Auto Loader (streaming) to bronze, then run batch silver and gold jobs on a schedule. This decouples ingestion latency from transformation complexity.",
        explanationDeep:
          "The question interviewers really want answered is ‘do you default to streaming or do you have a principled reason?’ Many engineers either always stream (because it’s technically impressive) or always batch (because it’s simpler). The right answer is to match the architecture to the SLA.\n\nStreaming introduces real operational complexity: checkpoints must be maintained and can become corrupt; watermarks for late data need tuning; stateful operations (joins across streams, sessionization) require understanding trigger modes and state TTL. For a pipeline that runs hourly and doesn’t need sub-5-minute freshness, a triggered batch job on a Databricks Workflow is simpler, cheaper, and easier to debug.\n\nThe hybrid pattern (Auto Loader for bronze, batch for silver/gold) is a practical sweet spot: Auto Loader handles continuous file ingestion efficiently, and the silver/gold transformations run on a schedule. This gives you near-real-time bronze landing with the simplicity of batch transformation.",
        interviewerLens:
          "I’m listening for the SLA-first framing: ‘I ask what latency is required before deciding streaming vs batch.’ Candidates who default to streaming without a latency justification are building unnecessary complexity. The hybrid pattern (Auto Loader for bronze, batch for silver/gold) shows real-world production taste.",
        followupChain: [
          {
            question: "What is a watermark in Structured Streaming and why does it matter?",
            answer: "A watermark tells the streaming engine how late data can arrive before it’s dropped from stateful computations. `.withWatermark(‘event_time’, ‘2 hours’)` means: include events up to 2 hours late in aggregations, then discard later arrivals. Without a watermark, stateful operations accumulate unbounded state. Setting it too tight drops valid late data; too loose causes memory growth."
          },
          {
            question: "How do you trigger a streaming job on a schedule instead of continuously?",
            answer: "`trigger(availableNow=True)` (Databricks Runtime 10.3+): processes all available data since the last checkpoint in one micro-batch, then stops. This gives you incremental batch semantics with streaming’s checkpointing — good for ‘hourly incremental load’ use cases."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use streaming because it’s more modern.\"",
            senior: "\"I match the architecture to the latency SLA. For hourly pipelines, a triggered batch job is simpler. Streaming earns its complexity when freshness is measured in seconds or minutes.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use Structured Streaming vs a scheduled batch job?\"",
          "\"Should this pipeline be streaming or batch?\"",
          "\"What is `trigger(availableNow=True)` and when would you use it?\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a real-time analytics company",
          "Pipeline design discussion at a Series B logistics startup"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 11,
        questionText:
          "How do you choose between Delta Live Tables and hand-written Databricks jobs for a new pipeline?",
        code: [
          {
            lang: "sql",
            label: "DLT declarative CDC",
            lines: [
              "APPLY CHANGES INTO live.silver",
              "FROM stream(live.bronze)",
              "KEYS (id)",
              "APPLY AS DELETE WHEN op = 'D'",
              "SEQUENCE BY ts",
              "COLUMNS * EXCEPT (op, ts);",
              "-- replaces hand-written MERGE",
            ],
          },
        ],
        answerStructured:
          "- **Delta Live Tables (DLT)**: declarative pipeline framework. You define tables with `@dlt.table` or `CREATE LIVE TABLE` and declare expectations (data quality rules). DLT handles orchestration, dependency resolution, lineage, error handling, and quality monitoring automatically.\n- **Hand-written jobs** (notebooks + Databricks Workflows): explicit Python/SQL code you write and wire together in a multi-task Workflow. Full control over execution logic, error handling, and performance tuning.\n- **Choose DLT when**: you want built-in data quality monitoring, automatic lineage, easy CDC with `APPLY CHANGES INTO`, and the team is comfortable with the declarative model.\n- **Choose hand-written jobs when**: you need fine-grained control over execution order, performance tuning (salting, custom Spark config), complex conditional logic, or you’re integrating non-Spark steps.\n- **DLT trade-off**: less flexible but lower operational overhead. DLT is harder to debug locally and abstracts Spark config in ways that can surprise performance engineers.",
        explanationDeep:
          "DLT is Databricks’ opinionated answer to ‘how do you build reliable pipelines without writing a lot of boilerplate.’ It handles the things that hand-rolled pipelines always get wrong: dependency ordering, retries, schema evolution, and data quality tracking. The `APPLY CHANGES INTO` command makes CDC specifically much easier than writing a MERGE manually.\n\nThe downside is the abstraction layer: DLT controls cluster configuration, checkpointing, and execution flow. When something is slow, your tuning options are limited to what DLT exposes. For a performance-critical pipeline with petabytes of data and aggressive latency requirements, hand-written Spark jobs with full control often win.\n\nMy heuristic: greenfield pipelines with standard medallion patterns → DLT. Pipelines with unusual performance constraints or teams that prefer code-over-config → hand-written jobs. The two aren’t mutually exclusive: a team can use DLT for bronze→silver and a hand-written Workflow for a custom gold aggregation that needs specific tuning.",
        interviewerLens:
          "I’m looking for the trade-off: DLT reduces boilerplate and adds built-in quality/lineage but limits low-level control. Candidates who say ‘DLT is always better’ or ‘DLT is overkill’ without qualification haven’t used both. The APPLY CHANGES INTO mention shows DLT-specific knowledge, not just general awareness.",
        followupChain: [
          {
            question: "What is `APPLY CHANGES INTO` in DLT?",
            answer: "`APPLY CHANGES INTO` is DLT’s declarative CDC mechanism. You specify a source (e.g., a streaming CDC feed), a primary key, a sequence column (timestamp or version), and the operation column. DLT automatically handles insert, update, and delete operations, maintaining the target table as the current state of the source. It replaces the manual MERGE pattern for CDC."
          }
        ],
        redFlags: [
          {
            junior: "\"DLT is just notebooks with a different syntax.\"",
            senior: "\"DLT is a declarative framework with built-in dependency resolution, data quality expectations, automatic lineage, and CDC via APPLY CHANGES INTO — it replaces a lot of pipeline boilerplate but trades fine-grained control.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use Delta Live Tables vs writing a Spark job yourself?\"",
          "\"What does DLT give you that a notebook can’t?\""
        ],
        interviewContexts: [
          "Mid-level data engineer screen at a company evaluating DLT for their medallion pipelines",
          "Platform design discussion at a Databricks-native team"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Databricks", "Snowflake"],
        asked: 19,
        questionText:
          "Databricks vs Snowflake for a net-new data platform — how do you choose?",
        answerStructured:
          "- **Workload first**: Snowflake wins for SQL analytics + BI with near-zero ops, predictable concurrency, and simplicity for analyst-heavy teams. Databricks wins for ML/AI, Python-heavy data engineering, streaming, and teams that want open format (Delta) and one platform for engineering + data science.\n- **Format / lock-in**: Databricks uses open Delta/Parquet — readable by other engines without migration. Snowflake uses a proprietary internal format; it now supports Iceberg tables for external openness.\n- **Cost model**: Snowflake = credits per virtual warehouse second (simple to reason about). Databricks = DBUs + your cloud compute (more knobs, more potential savings with spot instances and right-sizing, but more to manage).\n- **ML/AI**: Databricks is the clear winner — notebooks, MLflow, Unity Catalog for model governance. Snowflake’s ML capabilities are improving (Cortex AI) but are not the primary use case.\n- **Streaming**: Databricks (Spark Structured Streaming, Auto Loader) handles complex stream processing natively. Snowflake’s Snowpipe Streaming is ingestion-oriented, not complex stream processing.\n- **2025+ nuance**: lines are blurring. Snowflake added Python, Iceberg, Openflow. Databricks added great SQL warehousing and Serverless. Anchor the choice on team skills and dominant workload.",
        explanationDeep:
          "The wrong answer is a tribal loyalty: ‘Databricks is better’ or ‘Snowflake is better’ without qualification. Both platforms have deeply invested in closing each other’s gaps since 2023.\n\nFor a SQL/BI-centric team (analysts writing dashboards in Tableau/Looker, with mostly SQL-based transforms), Snowflake’s operational simplicity is genuinely valuable. Virtual warehouse sizing is intuitive, auto-suspend is easy, and Snowflake’s concurrency model handles many simultaneous BI users without a lot of tuning.\n\nFor a team where ML engineers, data scientists, and data engineers all need one platform — where pipelines involve Python, streaming data from Kafka, and training models on the processed data — Databricks consolidates this better. The open Delta format also matters to organizations that want to avoid storage lock-in: your data remains readable by Spark, Trino, Flink, or any future engine.\n\nIn practice, many organizations run both: Snowflake for the SQL/BI warehouse, Databricks for ML and heavy engineering. The question is whether you want the operational overhead of two platforms versus the optimization of using the right tool for each workload.",
        interviewerLens:
          "I’m testing whether you pick based on workload + team or by tribal preference. Naming specific differentiators (Databricks for ML/streaming/open format, Snowflake for SQL/BI/ops simplicity) shows you know both. The 2025 nuance — Iceberg on Snowflake, SQL warehousing on Databricks — shows you’re tracking the current landscape, not memorizing a 2022 comparison.",
        followupChain: [
          {
            question: "How does the cost model differ between the two platforms?",
            answer: "Snowflake bills credits per virtual warehouse second — simple, predictable, but you can’t use spot instances. Databricks bills DBUs plus your cloud provider’s compute cost, which you manage directly. This means Databricks can be significantly cheaper with spot instances (60-70% discount) and right-sized autoscaling clusters, but it requires more operational attention to cost governance."
          },
          {
            question: "What is Apache Iceberg and why does it matter for this comparison?",
            answer: "Iceberg is an open table format (like Delta) that gives Parquet files ACID guarantees, time travel, and schema evolution. Both Databricks and Snowflake now support Iceberg tables, reducing format lock-in. This means a team can store data in Iceberg on S3 and access it from either platform, weakening the format advantage Databricks had with Delta."
          }
        ],
        redFlags: [
          {
            junior: "\"Databricks is always better because it has Spark.\"",
            senior: "\"It depends on the dominant workload and team. Snowflake wins on SQL analytics + ops simplicity; Databricks wins on ML, streaming, open format. I’d pick based on where the team spends 80% of its time.\""
          }
        ],
        alternatePhrasings: [
          "\"Lakehouse vs data warehouse — which would you build on?\"",
          "\"We’re greenfield — Databricks or Snowflake?\"",
          "\"What are the key trade-offs between Databricks and Snowflake?\""
        ],
        interviewContexts: [
          "Mid-level senior data engineer interview at a company choosing a new cloud data platform",
          "Platform design round at a growth-stage company evaluating both tools"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is the Change Data Feed (CDF) and how does it differ from reading the full silver table?",
        "Explain optimistic concurrency control in Delta Lake and when you’d hit a ConcurrentModificationException.",
        "How does Structured Streaming checkpointing work and what happens when a checkpoint is corrupted?",
        "Walk me through configuring a Databricks Workflow with task dependencies and conditional retry logic.",
        "What is Delta Sharing and how is it different from reading Delta files directly?",
        "How does Photon differ from Spark’s Tungsten engine and when does it help most?"
      ],
      decisions: [
        "DLT vs hand-written notebooks + Workflows — when does each win?",
        "Structured Streaming vs triggered batch (availableNow=True) — when to use each?",
        "mergeSchema vs overwriteSchema vs strict enforcement — how do you choose?"
      ],
      quickRef: [
        "What are the three MERGE clauses for CDC (insert / update / delete)?",
        "What does `trigger(availableNow=True)` do?",
        "Auto Loader file notification vs directory listing mode?",
        "What is `_rescued_data` in Auto Loader?",
        "mergeSchema vs overwriteSchema?",
        "What is APPLY CHANGES INTO in DLT?",
        "How many commits before Delta writes a checkpoint?",
        "What is a ConcurrentModificationException in Delta?",
        "What is the DLT Expectations feature?",
        "DBU rate: job cluster vs all-purpose cluster?"
      ],
      redFlags: [
        {
          junior: "\"Delta achieves ACID because it’s built on a database engine.\"",
          senior: "\"Delta achieves ACID via the transaction log — a write is only visible after the commit JSON file lands. There’s no traditional lock manager.\""
        },
        {
          junior: "\"I’d overwrite the whole silver table on each CDC batch.\"",
          senior: "\"MERGE applies only the changed rows atomically. Full overwrites are expensive and non-atomic on large tables.\""
        },
        {
          junior: "\"I always use streaming because batch is old-fashioned.\"",
          senior: "\"I match architecture to the latency SLA. If hourly freshness is fine, a triggered batch job is simpler, cheaper, and easier to debug than a continuous stream.\""
        }
      ],
      checklist: [
        "Explain the transaction log: JSON commit files, checkpoint files, optimistic concurrency",
        "Write a MERGE statement with insert/update/delete branches for CDC",
        "Explain Auto Loader: checkpoint mechanism, file notification vs listing, rescued_data",
        "Know when to use DLT vs hand-written jobs (trade-offs)",
        "Know Databricks vs Snowflake workload positioning"
      ],
      behavioral: [
        "Describe a CDC pipeline you built — how did you handle schema drift and late data?",
        "Tell me about a time you chose between DLT and a hand-written pipeline. What drove the decision?",
        "A time you debugged a streaming pipeline checkpoint issue — what was wrong?"
      ],
      reverse: [
        "Are you using DLT or hand-written notebooks for your medallion pipelines?",
        "What’s your streaming vs batch split today?",
        "How do you handle schema drift from upstream sources?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR — Small files + OPTIMIZE/Z-order/liquid clustering,
  //          Unity Catalog governance, DLT vs notebooks deep trade-offs,
  //          cost control, lakehouse migration
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 24,
        questionText:
          "A Delta table that ingests streaming data has degraded read performance over time. Diagnose it and fix it.",
        code: [
          {
            lang: "sql",
            label: "Diagnose and compact",
            lines: [
              "DESCRIBE DETAIL events;",
              "-- numFiles huge, sizeInBytes small",
              "OPTIMIZE events;   -- ~128MB-1GB",
              "VACUUM events;     -- reclaim files",
              "-- prevent: cluster incrementally",
              "ALTER TABLE events",
              "  CLUSTER BY (user_id, event_date);",
            ],
          },
        ],
        answerStructured:
          "- **Diagnosis**: run `DESCRIBE DETAIL my_table` — look at `numFiles` and `sizeInBytes`. If `numFiles` is in the tens of thousands with average file size well below 128MB, you have the **small-files problem**.\n- **Root cause**: streaming and frequent small-batch writes each produce one or a few small Parquet files per micro-batch. After days or weeks, the table has thousands of tiny files. Every query must open and read metadata for each file, multiplying filesystem overhead even when data skipping eliminates most of them.\n- **Fix 1 — OPTIMIZE**: run `OPTIMIZE my_table` to compact small files into right-sized files (target ~128MB–1GB). Idempotent — running it twice produces no additional change.\n- **Fix 2 — Auto Optimize**: set `delta.autoOptimize.optimizeWrite = true` on the table to have Delta auto-compact on write (reduces new small files) and `delta.autoOptimize.autoCompact = true` for background compaction.\n- **Fix 3 — Liquid Clustering** (preferred for new tables): `CLUSTER BY (clustering_col)` at table creation. Databricks then clusters data incrementally on OPTIMIZE without a full rewrite. Replaces Z-ORDER for new tables in Databricks Runtime 13.3+.\n- **After OPTIMIZE**: run `VACUUM` to remove the now-unreferenced old small files and reclaim storage.",
        explanationDeep:
          "The small-files problem is the #1 performance degradation pattern in streaming Delta lakes. A Structured Streaming job running every 30 seconds produces 2 files per minute, 120 files per hour, ~87,000 files per month in a single partition. At that point, even a simple `SELECT COUNT(*)` may take seconds just to open and read the file footers for statistics.\n\nOPTIMIZE is the standard mitigation: it reads the small files and rewrites them into right-sized files using bin-packing, then records the old files as removed and the new files as added in a single atomic transaction log commit. The table is fully readable by other queries throughout OPTIMIZE (it uses snapshot isolation). The downside: OPTIMIZE on a table with millions of small files takes time and compute — you want to run it regularly (daily or more frequently for high-ingestion tables) rather than waiting until performance degrades severely.\n\nLiquid clustering is the modern replacement for static partition + Z-ORDER. It uses a tree-based algorithm that co-locates similar data in the same files based on the clustering columns, and it’s incremental: new data clusters automatically without rewriting existing files. This means a table stays performant even under continuous ingestion without requiring aggressive OPTIMIZE scheduling. For tables created after DBR 13.3, liquid clustering is the recommendation.\n\nZ-ORDER remains valid for existing tables. Z-ORDER BY (column_a, column_b) on OPTIMIZE co-locates values of those columns within files to enable data skipping, but it’s a full file rewrite each time and the ordering decays as new small files accumulate.",
        interviewerLens:
          "The phrase I’m waiting for is ‘small-files problem’ said immediately from the symptom of streaming + performance degradation. Then I want OPTIMIZE as the tactical fix and liquid clustering as the strategic fix for new tables. Candidates who mention DESCRIBE DETAIL to measure file count have clearly diagnosed this in production. If you also know the difference between bin-packing (default OPTIMIZE) and Z-ORDER (co-location for data skipping), you’ve passed the question. Liquid clustering shows you’re tracking the 2024/2025 best practice.",
        followupChain: [
          {
            question: "When would you use Z-ORDER vs liquid clustering?",
            answer: "Z-ORDER for existing tables that can’t be converted to liquid clustering, or teams on older Databricks runtimes. Liquid clustering for any new table — it’s incremental (no full rewrite), column choices can change with ALTER TABLE, and it handles high-cardinality and skewed columns better. You cannot use both simultaneously on the same table."
          },
          {
            question: "How does data skipping work in Delta and how does Z-ORDER / liquid clustering improve it?",
            answer: "Delta stores per-column min/max statistics in the transaction log for each Parquet file. When a query has a filter like `WHERE event_date = '2024-01-15'`, Delta checks each file’s min/max for `event_date` and skips files where the filter condition can’t be true. Z-ORDER and liquid clustering co-locate similar values into the same files, making the min/max ranges tighter and enabling more files to be skipped."
          },
          {
            question: "What is auto-compaction and how does it differ from OPTIMIZE?",
            answer: "Auto-compaction (`delta.autoOptimize.autoCompact = true`) triggers a lightweight compaction immediately after a write operation, merging newly written small files into right-sized ones. It’s synchronous with the write job (small additional latency) and targets a smaller file size (~128MB) than a full OPTIMIZE run. OPTIMIZE is a separate, manually-triggered or scheduled job that does a more thorough compaction across all small files. Both are complementary."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d add more executors to make the queries faster.\"",
            senior: "\"More executors don’t help when the bottleneck is file metadata overhead from tens of thousands of small files. The fix is OPTIMIZE for compaction and liquid clustering for structural prevention.\""
          },
          {
            junior: "\"I’d Z-ORDER every table by all its columns.\"",
            senior: "\"Z-ORDER only benefits columns you filter on. Choose 1-4 high-selectivity filter/join columns. Z-ordering all columns wastes compute and dilutes the co-location benefit. For new tables, liquid clustering is preferred over Z-ORDER.\""
          }
        ],
        alternatePhrasings: [
          "\"Your Delta table query performance is degrading as more data lands. What do you do?\"",
          "\"What is the small-files problem and how do you solve it in Delta Lake?\"",
          "\"When would you use liquid clustering vs Z-ORDER?\""
        ],
        interviewContexts: [
          "Senior data engineer screen at a company with high-volume streaming into Delta",
          "Performance engineering discussion at a Databricks-native data platform team",
          "Asked at a Series D fintech with a multi-TB streaming Delta lake"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 20,
        questionText:
          "Your organization is migrating to Unity Catalog. Walk me through what Unity Catalog provides and how you’d govern a multi-team lakehouse with it.",
        code: [
          {
            lang: "sql",
            label: "Three-tier names + fine-grained grants",
            lines: [
              "GRANT SELECT ON prod.sales.orders",
              "  TO `analysts`;  -- catalog.schema.tbl",
              "ALTER TABLE prod.sales.orders",
              "  SET ROW FILTER region_flt",
              "  ON (region);  -- enforced at query",
            ],
          },
        ],
        answerStructured:
          "- **Unity Catalog (UC)**: centralized governance layer for data and AI assets across all Databricks workspaces in an account. Replaces the legacy per-workspace Hive metastore.\n- **Three-tier namespace**: `catalog.schema.table` (e.g., `prod.finance.transactions`). Catalogs map to business domains or environments; schemas to teams or subject areas.\n- **Fine-grained access control**: ANSI SQL `GRANT`/`REVOKE` on catalogs, schemas, tables, views, rows, and columns. Row-level filters and column masks enforce data access policies dynamically without copying data.\n- **Lineage**: UC automatically tracks column-level lineage across notebooks, jobs, and DLT pipelines without instrumentation. You can see which upstream tables fed a column in a downstream table.\n- **Data discovery**: searchable data catalog across all workspaces. Owners, tags, and descriptions are first-class.\n- **Migration path**: `UPGRADE TABLE` converts legacy Hive tables to UC-managed tables. External tables pointing to S3/ADLS can be registered as UC external tables without data movement.\n- **Multi-team governance**: use separate catalogs per environment (dev/staging/prod) and separate schemas per team. Grant teams ownership of their schemas; grant read access cross-team via views with row filters where needed.",
        explanationDeep:
          "Before Unity Catalog, Databricks governance was per-workspace: each workspace had its own Hive metastore, its own ACLs, and no cross-workspace lineage. This meant a 100-workspace organization had 100 independent silos with no unified discovery or consistent access control. Unity Catalog centralizes all of this at the account level.\n\nThe governance model that matters in practice: UC uses a deny-by-default model. Nothing is accessible without an explicit GRANT. This is different from Hive metastore’s historically permissive defaults. When migrating, teams often discover they had implicit access to sensitive tables they shouldn’t have. The migration is also a governance audit opportunity.\n\nRow-level security and column masking are the features most organizations underuse. Instead of creating one copy of a table per team with different fields redacted, you define one table and attach row filters (`CREATE ROW ACCESS POLICY`) and column masks (`CREATE COLUMN MASK`). The policy is enforced at query time by UC, transparently to the consumer. This eliminates the data proliferation problem where the same PII data exists in 15 different tables with slightly different redaction.\n\nFor multi-team governance, the pattern I recommend: one UC catalog per environment (dev, staging, prod), schemas named after domain teams within each catalog, table ownership granted to the owning team’s service principal, cross-team access via views in a shared schema rather than direct table grants. This keeps the blast radius of a compromised service principal bounded to one team’s schema.",
        interviewerLens:
          "I want to hear the three-tier namespace (catalog.schema.table) and the centralization story — replacing per-workspace Hive metastores. The senior signal is row-level security and column masking: knowing that UC can enforce data access policies at query time without data copying shows you’ve designed for real compliance requirements. The multi-team governance pattern (catalog-per-environment, schema-per-team) shows production architecture thinking.",
        followupChain: [
          {
            question: "How do you enforce GDPR deletion in a UC-governed Delta table?",
            answer: "Execute a `DELETE FROM table WHERE user_id = ?` (Delta MERGE/DELETE is atomic), then run `VACUUM RETAIN 0 HOURS` to remove the underlying Parquet files containing the deleted rows. Because Delta is copy-on-modify, the old files still exist until VACUUM removes them — for GDPR compliance, you must VACUUM after deletion, not just delete from the table. Note: this requires temporarily setting `spark.databricks.delta.retentionDurationCheck.enabled = false`."
          },
          {
            question: "What is a UC External Location and when would you use it?",
            answer: "An External Location registers a cloud storage path (S3 prefix, ADLS container) with UC and grants access to it via storage credentials. It lets UC manage access to data that isn’t stored in UC-managed storage — useful for existing data lakes or when you need to retain data outside Databricks-managed storage but still want UC access control and lineage."
          },
          {
            question: "How does Unity Catalog lineage work and what are its limits?",
            answer: "UC captures lineage automatically from Spark SQL and Delta operations executed on UC-enabled clusters. Column-level lineage tracks which source columns produced which target columns. Limits: lineage is captured for SQL and DataFrame operations but not for Python-native file I/O (e.g., reading raw bytes). External tools outside Databricks are not tracked unless you instrument via UC’s API."
          }
        ],
        redFlags: [
          {
            junior: "\"Unity Catalog is just a metadata catalog like AWS Glue.\"",
            senior: "\"UC is a full governance layer: centralized access control with row/column-level security, automatic lineage, cross-workspace discovery, and a deny-by-default security model — far beyond a metadata catalog.\""
          },
          {
            junior: "\"I’d copy tables with sensitive data redacted for each team.\"",
            senior: "\"Data copying proliferates PII and becomes a governance nightmare. UC row filters and column masks enforce access policies at query time on a single source of truth.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you govern a multi-team Databricks lakehouse?\"",
          "\"What does Unity Catalog replace and why does it matter?\"",
          "\"How would you enforce row-level security across teams in Databricks?\""
        ],
        interviewContexts: [
          "Senior data engineer / platform architect interview at an enterprise migrating to UC",
          "Data governance deep-dive at a Series D fintech with regulatory requirements"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 17,
        questionText:
          "How would you approach migrating a legacy on-prem Hive/HDFS data warehouse to Databricks on the cloud?",
        answerStructured:
          "- **Phase 1 — Assess**: catalog all Hive tables (schema, size, partition structure, access patterns). Identify hot vs cold data, owner teams, and downstream consumers. Prioritize by business value and migration complexity.\n- **Phase 2 — Storage migration**: use tools like `distcp` or cloud vendor migration services to copy HDFS data to S3/ADLS. Convert ORC/Avro/legacy formats to Delta Lake during or after the move. `CONVERT TO DELTA` works for existing Parquet; ORC/Avro tables need a Spark job to rewrite.\n- **Phase 3 — Compute migration**: rewrite Hive QL and Spark 1.x jobs to Databricks notebooks / Spark 3.x / Python. Most Spark SQL is compatible but watch for deprecated functions, `hive.exec.dynamic.partition` settings, and UDAF behavior differences.\n- **Phase 4 — Orchestration**: replace Oozie/Airflow on-prem with Databricks Workflows or managed Airflow. Migrate cron-based jobs to triggered Workflow tasks.\n- **Phase 5 — Governance**: register tables in Unity Catalog; replicate Ranger/Sentry ACLs as UC GRANTs. Enable lineage from day one.\n- **Run parallel**: run old and new pipelines in parallel during cutover; validate row counts, aggregates, and schema before switching consumers.\n- **Cost governance**: set up cost attribution tags per team from day one; configure cluster policies to prevent runaway spend during migration.",
        explanationDeep:
          "The biggest risk in a Hive-to-Databricks migration is assuming Spark SQL compatibility means the jobs will run correctly. Spark 3.x made breaking changes from Spark 2.x (behavior of ANSImode, division semantics, timestamp handling) and Hive 2.x functions don’t map 1:1 to Spark SQL 3.x. A validation framework — running legacy and migrated jobs in parallel on the same input and comparing outputs — is non-negotiable.\n\nThe storage migration is usually the easiest part: distcp is reliable and cloud providers have managed migration services for large HDFS volumes. The format conversion to Delta is worth doing during migration: you get ACID, time travel, and compaction immediately rather than running on legacy ORC in Delta tables.\n\nGovernance is where migrations go wrong long-term. Organizations replicate the old permission structure (no-one owns these tables, everyone has access to everything) rather than using the migration as an opportunity to enforce proper access control via Unity Catalog. The team that migrates the tables should simultaneously define ownership and access policies — not defer it to ‘after we’re live.’\n\nCost is the operational surprise. On-prem clusters had a fixed cost regardless of utilization. Cloud clusters are pay-per-use. Without cluster policies, job cluster configurations, and cost attribution tags from day one, the first cloud bill for a migrated workload often causes sticker shock.",
        interviewerLens:
          "I’m listening for the parallel-run validation step — that’s the non-negotiable for production migrations. Candidates who jump straight to ‘copy the data and repoint the jobs’ have never managed a production migration incident caused by Spark behavior differences. The governance-during-migration point and the cost-governance setup show you’ve learned from real migrations, not just planned them.",
        followupChain: [
          {
            question: "How do you validate that migrated pipelines produce the same results as the legacy system?",
            answer: "Row count comparison at each pipeline layer, aggregate comparison (sum/count/distinct by partition), schema comparison, and statistical validation (distribution of key metrics, null rates). For critical tables, run a reconciliation job that does a full keyed comparison and emits a diff report. Run both systems in parallel for at least one full business cycle before cutting over."
          },
          {
            question: "What are the most common Spark 2.x to 3.x gotchas in a Hive migration?",
            answer: "ANSIMode changes default behavior for integer overflow and string-to-numeric casting (throws errors instead of silently producing NULL/wrong results). Division of integers now returns double by default. `spark.sql.storeAssignmentPolicy` changed, breaking implicit type coercions in INSERT statements. Timestamp handling changed (timezone awareness). UDAFs require rewriting to use the typed interface."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d copy the data and repoint the Spark jobs — it’s just Spark.\"",
            senior: "\"Spark 2.x vs 3.x has breaking behavioral differences. I’d run parallel jobs and validate output before cutting over, with a full schema + aggregate reconciliation framework.\""
          },
          {
            junior: "\"I’d migrate governance after we’re live.\"",
            senior: "\"The migration is the governance opportunity. I’d define UC ownership and access control during migration — retrofitting it after go-live with hundreds of running jobs is far harder.\""
          }
        ],
        alternatePhrasings: [
          "\"How would you migrate from an on-prem Hadoop cluster to Databricks on AWS?\"",
          "\"We’re moving from Hive to Delta Lake — what are the key risks?\"",
          "\"Walk me through a cloud data platform migration project you’d lead.\""
        ],
        interviewContexts: [
          "Senior/staff data engineer interview at a company in the middle of a cloud migration",
          "Platform architect screen at an enterprise moving from Cloudera to Databricks"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you control and reduce Databricks compute costs in a production environment?",
        answerStructured:
          "- **Job clusters for all production jobs**: 40-60% cheaper DBU rate than all-purpose; zero idle cost. Never run scheduled jobs on always-on all-purpose clusters.\n- **Spot instances**: use spot (AWS) or preemptible (GCP) / spot (Azure) for worker nodes. 60-70% cheaper than on-demand. Configure a small on-demand driver node for reliability; spot workers only.\n- **Autoscaling**: configure min/max workers on job clusters. Autoscaling on job clusters scales with workload rather than paying for peak capacity permanently.\n- **SQL Warehouses for BI**: auto-stop after inactivity (2–10 minutes). Serverless SQL Warehouses don’t bill for idle at all. Use these for Databricks SQL dashboards and ad-hoc analyst queries instead of clusters.\n- **Cluster policies**: enforce DBU limits, instance type whitelists, and auto-termination on all-purpose clusters. Without policies, engineers spin up XL clusters and leave them running.\n- **Right-size with Photon**: enable Photon for SQL-heavy workloads on SQL Warehouses. Photon can reduce query time significantly, lowering total DBU consumption for the same work.\n- **Monitor with cost attribution**: tag jobs and clusters with team/project tags, query Databricks billing tables (in Unity Catalog) to attribute cost and identify outliers.",
        explanationDeep:
          "The single biggest Databricks cost lever is job cluster vs all-purpose cluster discipline. All-purpose clusters are the right tool for interactive development but catastrophic for production scheduling — they’re billed at a higher DBU rate and accumulate idle time when no jobs are running. Enforcing job clusters for all scheduled work through cluster policies is the highest-ROI cost change for most teams.\n\nSpot instances are the second lever. Worker nodes on spot can be interrupted, but Databricks handles interruptions gracefully for Spark jobs: the job retries failed tasks on a new node. For streaming jobs, checkpoints ensure no data is lost. The small risk of spot interruption is almost always worth the 60-70% compute cost saving on worker nodes.\n\nCluster policies deserve more attention than they get. Without policies, every engineer in the organization can spin up a 32-node cluster with the most expensive GPU instances. A policy enforcing a maximum instance type, a required auto-termination timeout, and a DBU-per-hour limit prevents the most egregious cost incidents without blocking legitimate work.\n\nLong-term, the telemetry matters: you can’t control what you can’t measure. Unity Catalog’s system tables include billing and usage data. A weekly cost report attributed to team tags, surfaced to team leads, creates accountability and surfaces rogue jobs before they compound.",
        interviewerLens:
          "The job-cluster discipline point should come first and be stated as a policy, not a suggestion. Spot instances and cluster policies are the other two that show production cost ownership. Candidates who just say ‘use smaller clusters’ haven’t managed a real Databricks bill. The Unity Catalog system tables for cost attribution shows platform-level maturity.",
        followupChain: [
          {
            question: "How do you handle spot instance interruptions in a streaming job?",
            answer: "Structured Streaming with checkpoints is designed for this. When a worker is interrupted, in-progress tasks are rescheduled on surviving/new workers. The checkpoint ensures the stream resumes from the last committed offset. For jobs that are particularly interruption-sensitive (very long individual tasks), use spot with fallback to on-demand (`spot_bid_max_price` and fallback config in the cluster spec)."
          },
          {
            question: "What is a Databricks cluster policy and what can it enforce?",
            answer: "A cluster policy is a JSON template that restricts cluster configuration options for users or groups. It can enforce: maximum DBU/hour rates, allowed instance types, required auto-termination timeouts, mandatory tags, runtime version bounds, and max number of workers. Policies are assigned to users/groups via permissions and override their cluster creation options."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d just use smaller clusters to save money.\"",
            senior: "\"Smaller clusters for the wrong workload type doesn’t fix idle billing. The structural fix is job clusters for all production jobs, spot workers, cluster policies to prevent over-provisioning, and cost attribution to create team accountability.\""
          }
        ],
        alternatePhrasings: [
          "\"We’re spending too much on Databricks. Where would you start?\"",
          "\"How do you govern Databricks costs in a large engineering organization?\"",
          "\"What’s the most impactful cost optimization you’d make on a Databricks deployment?\""
        ],
        interviewContexts: [
          "Senior data engineer interview at a company whose Databricks bill tripled after moving to cloud",
          "Platform engineer screen at a data-intensive Series D startup managing $500k/year Databricks spend"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 16,
        questionText:
          "How do you decide between traditional Hive partitioning, Z-ORDER, and liquid clustering for a high-volume Delta table?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "millions of tiny dirs",
            lines: [
              "CREATE TABLE t (...)",
              "PARTITIONED BY (user_id);",
              "-- 1 dir per user -> small files",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            label: "incremental, high-card safe",
            lines: [
              "CREATE TABLE t (...)",
              "CLUSTER BY (user_id);",
              "-- liquid clustering, up to 4 cols",
            ],
          },
        ],
        answerStructured:
          "- **Hive-style partitioning** (e.g., `PARTITIONED BY (date)`): physically divides the table into subdirectories. Effective when queries almost always filter on the partition column and data is evenly distributed. Avoid for high-cardinality columns (user_id, event_id) — creates millions of tiny directories (the small-files problem at the partition level).\n- **Z-ORDER** (legacy approach): co-locates values of specified columns within Parquet files to improve data skipping for multi-column filter queries. Requires running `OPTIMIZE ... ZORDER BY (col_a, col_b)`. Full file rewrite each time; ordering decays as new files accumulate. Use for existing tables on older runtimes or when liquid clustering isn’t available.\n- **Liquid Clustering** (current best practice, DBR 13.3+): incremental, tree-based clustering. Choose up to 4 clustering columns with `CLUSTER BY`. New data clusters automatically without rewriting existing files. Column selection is changeable with `ALTER TABLE`. Handles high cardinality and skewed data gracefully. Replaces both partitioning and Z-ORDER for new tables.\n- **Decision matrix**: new table + Databricks → always liquid clustering. Existing table + DBR 13.3+ → consider migrating to liquid clustering. Existing table + older runtime → Z-ORDER. External system requires Hive partition-pruning → traditional partitioning (and accept the trade-offs).",
        explanationDeep:
          "The evolution from partitioning → Z-ORDER → liquid clustering reflects a maturing understanding of what co-location should look like in a cloud lakehouse. Traditional Hive partitioning was designed for HDFS where directory-level locality was meaningful. In object storage (S3, ADLS), listing directories is expensive and the physical locality benefit is gone. What remains is partition pruning at the metadata level, which is valuable but brittle: partition on date and your date-filtered queries fly, but any other filter column gets no benefit.\n\nZ-ORDER addressed the multi-column case by rearranging data within files rather than between directories. It genuinely improves data skipping for high-selectivity filters on the Z-ordered columns. The problems: it requires a full file rewrite on each OPTIMIZE run, the ordering degrades as new small files land, and you can’t change the Z-ORDER columns without a full rewrite.\n\nLiquid clustering solves all of this with an incremental approach. It uses a tree structure in the transaction log to track the clustering state of each file and only rewrites files that need clustering. New data written today clusters incrementally; old, already-clustered files don’t need to be rewritten. The clustering columns can change without a full rewrite. It handles high-cardinality columns that would create millions of partition directories. For teams on DBR 13.3+, liquid clustering should be the default for any table that needs organized data layout.\n\nThe one case where traditional partitioning still wins: external systems that consume the table via file listing and rely on Hive-style partition directory structure for their own pruning (e.g., Athena, older Presto versions, or data export pipelines). In that case, partitioning is a compatibility requirement, not a performance choice.",
        interviewerLens:
          "The question tests whether you know the evolution and can articulate when each option is appropriate, not just recite definitions. The liquid clustering recommendation for new tables is the 2024/2025 current best practice — candidates who still default to Z-ORDER for new tables are behind the curve. The high-cardinality partitioning anti-pattern (millions of tiny partition directories) is the classic junior mistake that seniors should have burned into their memory.",
        followupChain: [
          {
            question: "Can you convert a Z-ORDERED table to liquid clustering?",
            answer: "Yes: `ALTER TABLE my_table CLUSTER BY (col_a, col_b)`. This changes the table to use liquid clustering going forward. Existing files are not immediately rewritten; they’ll be reclustered as OPTIMIZE runs incrementally. Running `OPTIMIZE FULL` (DBR 16.0+) forces a full reclustering of all files in one pass."
          },
          {
            question: "What happens to data skipping if you have no Z-ORDER and no liquid clustering?",
            answer: "Delta still uses per-file min/max statistics for data skipping, collected during writes. Without clustering, similar values are scattered across many files, so the min/max ranges per file are wide and few files can be skipped. Clustering (Z-ORDER or liquid) tightens the min/max ranges by co-locating similar values, enabling more aggressive file skipping."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d partition by user_id for better performance.\"",
            senior: "\"Partitioning by user_id creates millions of tiny partition directories — the small-files problem at scale. I’d use liquid clustering on user_id instead, which handles high cardinality without directory explosion.\""
          },
          {
            junior: "\"Z-ORDER is the current best practice for organizing Delta tables.\"",
            senior: "\"Z-ORDER is the legacy approach. For new tables on DBR 13.3+, liquid clustering is recommended — it’s incremental, handles cardinality better, and allows column changes without full rewrites.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you partition a Delta table vs use liquid clustering?\"",
          "\"Explain Z-ORDER vs liquid clustering and when you’d choose each.\"",
          "\"How do you optimize a Delta table for query performance without creating the small-files problem?\""
        ],
        interviewContexts: [
          "Senior data engineer screen at a company with multi-TB Delta tables and slow queries",
          "Platform architecture discussion at a high-scale Databricks deployment"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 12,
        questionText:
          "When would you choose Delta Live Tables over hand-written jobs for a production pipeline, and what are the hidden costs of each?",
        answerStructured:
          "- **Choose DLT when**: the pipeline follows a standard medallion pattern, you want built-in data quality monitoring (Expectations), automatic lineage in Unity Catalog, declarative CDC with `APPLY CHANGES INTO`, and lower pipeline boilerplate. Good for teams where the productivity gain from the framework outweighs the loss of low-level control.\n- **Choose hand-written jobs when**: you need fine-grained Spark config tuning (custom shuffle partitions, memory settings, AQE hints), complex conditional branching, non-Spark steps in the same workflow (Python scripts, dbt runs, API calls), or the team has strong Spark expertise and finds the DLT abstraction restrictive.\n- **Hidden DLT costs**: DLT controls cluster configuration; you cannot set all Spark configs directly. DLT pipelines are harder to debug locally (no local mode). DLT adds its own compute for the pipeline driver. Cost is billed at the DLT DBU rate (slightly higher than job cluster rate).\n- **Hidden hand-written job costs**: you write and maintain retry logic, dependency resolution, data quality checks, and lineage instrumentation yourself. For a 10-table medallion pipeline, that’s hundreds of lines of boilerplate that DLT generates for free.\n- **Hybrid**: common pattern is DLT for bronze→silver (standard medallion with quality enforcement) and a hand-written Workflow task for a custom gold aggregation with specific tuning requirements.",
        explanationDeep:
          "DLT is best understood as a framework that trades flexibility for productivity. The key things it gives you for free: dependency DAG resolution (you don’t wire dependencies manually), automatic retries at the table level, built-in data quality metrics surfaced in the DLT UI, lineage tracked automatically in Unity Catalog, and pipeline-level status monitoring. For a standard medallion pattern with 20 tables, DLT eliminates enormous amounts of pipeline orchestration code.\n\nThe loss of control matters most in performance-critical pipelines. DLT’s cluster management doesn’t expose every Spark configuration knob. If you need to set `spark.sql.shuffle.partitions`, specific memory configs, or custom broadcast thresholds, you’re working around DLT rather than with it. Teams with strong Spark performance backgrounds often find this frustrating.\n\nThe debugging experience in DLT is also genuinely worse than hand-written notebooks. You can’t run a DLT pipeline locally; you have to deploy and run it in the Databricks environment, which adds iteration latency. For complex transformation logic, hand-written notebooks with interactive execution let you inspect intermediate results and iterate quickly.\n\nMy recommendation: evaluate DLT for each pipeline based on two criteria — does the pipeline fit a standard medallion shape (yes = DLT advantage), and does the team’s performance requirements exceed what DLT exposes (yes = hand-written advantage). Use both where it makes sense.",
        interviewerLens:
          "The hidden-costs framing is the senior signal. Junior candidates know DLT is ‘declarative and easier.’ Senior candidates can articulate the trade: what DLT gives you (quality, lineage, boilerplate elimination) and what it takes away (Spark config control, local debugging, cost per DBU). Naming the hybrid pattern (DLT for bronze→silver, hand-written for custom gold) shows production architecture judgment.",
        followupChain: [
          {
            question: "How does DLT’s Expectations feature work?",
            answer: "Expectations are data quality rules declared on a DLT table with `@dlt.expect`, `@dlt.expect_or_drop`, or `@dlt.expect_or_fail`. At each pipeline run, DLT checks the rule against every row and records the pass/fail rate in the DLT event log. `expect` tracks quality but doesn’t drop rows. `expect_or_drop` removes failing rows to a quarantine. `expect_or_fail` halts the pipeline if any row fails. Quality metrics are visible in the DLT UI and queryable from the event log Delta table."
          }
        ],
        redFlags: [
          {
            junior: "\"DLT is always better because it’s the new way to build pipelines.\"",
            senior: "\"DLT reduces boilerplate and adds quality + lineage, but it limits Spark config control and has worse local debugging. I choose DLT for standard medallion patterns and hand-written jobs for performance-critical custom pipelines.\""
          }
        ],
        alternatePhrasings: [
          "\"What does DLT give you that a notebook + Workflow can’t?\"",
          "\"Why wouldn’t you always use DLT?\"",
          "\"Compare the operational trade-offs of DLT vs orchestrating your own notebook DAG.\""
        ],
        interviewContexts: [
          "Senior data engineer screen at a company evaluating DLT adoption at scale",
          "Architecture design discussion at a Databricks customer migrating from Airflow-orchestrated notebooks"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Delta Live Tables", "Databricks Workflows + Notebooks"],
        asked: 15,
        questionText:
          "Delta Live Tables vs Databricks Workflows with notebooks — compare them as production pipeline frameworks for a senior data engineer choosing between them.",
        answerStructured:
          "- **Abstraction level**: DLT is declarative — you define the tables and their quality expectations; DLT handles execution, dependency ordering, retries, and lineage. Workflows + notebooks is imperative — you write the Spark code, wire the task dependencies, write the retry logic, and instrument quality checks yourself.\n- **Data quality**: DLT has first-class Expectations with built-in metrics and UI. Workflows require you to implement quality checks in code and surface them manually.\n- **Lineage**: DLT populates Unity Catalog lineage automatically. Workflows do not; you must instrument manually or rely on UC’s inference from SQL operations.\n- **CDC**: DLT’s `APPLY CHANGES INTO` is significantly simpler than writing MERGE logic in a notebook. For CDC-heavy pipelines, DLT is the clear productivity winner.\n- **Performance tuning**: Workflows + notebooks gives full Spark config access. DLT exposes a subset of configs; complex tuning requires workarounds.\n- **Debugging**: Workflows notebooks support local/interactive execution. DLT must be deployed to run.\n- **Cost**: DLT uses a slightly higher DBU rate. Hand-written job clusters give you full control including spot instances.\n- **Verdict**: DLT for standard medallion CDC pipelines where quality and lineage matter. Workflows for performance-critical or non-standard pipelines.",
        explanationDeep:
          "The comparison is really about where you want to take on complexity. DLT absorbs the complexity of orchestration, quality, and lineage but constrains you within its model. Workflows + notebooks absorbs none of that complexity for you — you build it or skip it, which means most teams skip it, resulting in pipelines with no quality monitoring, no lineage, and brittle retry logic.\n\nIn practice, the most common senior mistake with DLT is trying to use it for everything, including pipelines that have unusual performance requirements or multi-system orchestration. DLT pipelines cannot natively trigger a dbt run or call an external API as part of the pipeline; those steps have to go in a surrounding Workflow. Recognizing where DLT’s model fits and where it doesn’t is the architectural judgment that separates senior engineers.\n\nThe reverse mistake is rejecting DLT entirely because ‘we write our own Spark.’ Teams that hand-roll every pipeline often end up with 50 notebooks with no consistent quality pattern, no lineage, and no one sure what feeds what. DLT’s forced structure — declare your tables, declare your quality rules — is genuinely valuable as an organizational standard even for teams that believe they could write it themselves.",
        interviewerLens:
          "I want the structured trade-off, not a preference. The CDC / `APPLY CHANGES INTO` point is the most compelling DLT advantage for data engineers — if you name it, I know you’ve worked with it. The performance-tuning constraint and the debugging experience limitations show you’ve hit DLT’s ceiling, not just read the feature page.",
        followupChain: [
          {
            question: "Can you mix DLT and Workflows in the same pipeline?",
            answer: "Yes — a Databricks Workflow can have a DLT pipeline as one task and notebook tasks as other tasks. The DLT pipeline runs its tables; the surrounding Workflow handles non-DLT steps (API calls, dbt runs, custom Python). This hybrid pattern lets you use DLT where it fits and escape its model for steps it doesn’t support."
          }
        ],
        redFlags: [
          {
            junior: "\"I’d always use DLT — it’s the future of Databricks pipelines.\"",
            senior: "\"DLT is excellent for standard medallion + CDC pipelines with quality requirements, but it constrains Spark tuning and debugging. I use it where it fits and hand-written jobs where it doesn’t — and they compose via Workflows.\""
          }
        ],
        alternatePhrasings: [
          "\"What’s the real difference between DLT and a notebook job in Databricks?\"",
          "\"When would you NOT use Delta Live Tables?\"",
          "\"Compare DLT and hand-written Spark for a CDC pipeline.\""
        ],
        interviewContexts: [
          "Senior data platform architect interview at a company standardizing Databricks pipeline patterns",
          "Asked at a staff data engineer loop evaluating DLT for 100+ table medallion pipelines"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How does Delta Lake’s optimistic concurrency handle concurrent MERGE and INSERT operations on the same table?",
        "Walk me through designing a petabyte-scale Delta table — partitioning, clustering, file size targets, and OPTIMIZE schedule.",
        "How does the Photon engine differ from Tungsten and when does it provide the most speedup?",
        "Explain Unity Catalog’s row-level security and column masking — how are policies enforced at query time?",
        "How do you implement a lakehouse pattern for feature engineering — serving both ML training and online inference?",
        "What is Databricks Asset Bundles and how does it enable CI/CD for notebooks and DLT pipelines?"
      ],
      decisions: [
        "Liquid clustering vs Z-ORDER vs Hive partitioning for a new 10TB Delta table with multi-column filters?",
        "DLT vs hand-written Workflows for a 50-table medallion pipeline with strict quality SLAs?",
        "Serverless SQL Warehouse vs provisioned cluster for an ad-hoc analyst team?"
      ],
      quickRef: [
        "What does `OPTIMIZE FULL` do in DBR 16.0+?",
        "Maximum clustering columns in liquid clustering?",
        "How does Delta enforce row-level security without Unity Catalog?",
        "What is `delta.logRetentionDuration`?",
        "What does `CONVERT TO DELTA` do and what formats does it support?",
        "Z-ORDER maximum effective columns?",
        "What is the DLT event log and where is it stored?",
        "Unity Catalog three-tier namespace?",
        "What is a UC External Location?",
        "What does `VACUUM RETAIN 0 HOURS` do to time-travel capability?"
      ],
      redFlags: [
        {
          junior: "\"I partition by user_id for performance.\"",
          senior: "\"High-cardinality partitioning creates millions of tiny directories. I use liquid clustering on user_id instead.\""
        },
        {
          junior: "\"Z-ORDER is the current best practice for clustering.\"",
          senior: "\"Liquid clustering is the 2024+ recommendation for new tables — incremental, flexible column changes, better cardinality handling.\""
        },
        {
          junior: "\"Unity Catalog is just Glue but for Databricks.\"",
          senior: "\"UC is a full governance layer with deny-by-default RBAC, row/column-level security, automatic lineage, and cross-workspace discovery — far beyond a metadata catalog.\""
        }
      ],
      checklist: [
        "Diagnose small-files problem and prescribe OPTIMIZE, auto-compaction, and liquid clustering",
        "Explain Unity Catalog: three-tier namespace, deny-by-default, row filters, column masks, lineage",
        "Compare DLT vs hand-written Workflows with concrete trade-offs for both",
        "Know liquid clustering vs Z-ORDER vs partitioning decision matrix",
        "Articulate cost control levers: job clusters, spot, cluster policies, Photon, attribution tagging"
      ],
      behavioral: [
        "Tell me about a Delta table performance incident you diagnosed and resolved.",
        "Describe a lakehouse governance problem you solved — how did you approach access control?",
        "A time you had to choose between DLT and a custom pipeline approach — what drove the decision and what was the outcome?"
      ],
      reverse: [
        "Are you on liquid clustering or still using Z-ORDER / traditional partitioning for your core tables?",
        "How mature is your Unity Catalog rollout — row-level security in production?",
        "What’s the split between DLT pipelines and hand-written jobs in your platform today?"
      ]
    }
  }
};
