import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR — RDD/DataFrame, transformations vs actions, lazy eval, driver vs executor
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
          "What is lazy evaluation in Spark and why does it matter for performance?",
        code: [
          {
            lang: "pyspark",
            label: "Lazy chain — one scan",
            lines: [
              "df = spark.read.parquet('s/')",
              "out = (df",
              "  .filter('amt > 0')   # lazy",
              "  .filter('cur = \"USD\"') # fuses",
              "  .select('id', 'amt'))  # lazy",
              "out.count()   # action: runs DAG",
            ],
          },
          {
            accent: "bug",
            lang: "pyspark",
            label: "Action in loop — N full DAGs",
            lines: [
              "for c in ('US', 'EU', 'IN'):",
              "  # count() reruns whole scan",
              "  n = df.filter(df.reg == c).count()",
              "# 3 actions -> source read 3x",
            ],
          },
        ],
        answerStructured:
          "- Spark does **not execute transformations immediately**. Instead, it builds a **DAG (Directed Acyclic Graph)** recording every transformation applied.\n- Execution is triggered only when an **action** is called (e.g., `count()`, `collect()`, `write()`). At that point, the driver compiles the full DAG and ships tasks to executors.\n- Why it matters: Spark's **Catalyst optimizer** sees the whole chain of transformations before generating a physical plan — it can reorder filters, merge operations, and eliminate redundant steps. With eager execution this optimization window vanishes.\n- Practical consequence: calling `.filter()` many times does not cost extra passes over the data — they all get fused into a single scan at execution time.\n- **Pitfall**: calling an action (e.g., `df.count()`) inside a loop re-triggers the full DAG each iteration. Cache the result or rethink the loop.",
        explanationDeep:
          "The mental model is a recipe vs cooking. Each transformation appends a step to the recipe; the action says 'cook.' Because Spark has the full recipe before starting, it can optimize: if a filter drops 99% of rows, Spark pushes that filter as early as possible so subsequent transformations process far less data.\n\nThis is the core reason Spark's DataFrame API outperforms hand-rolled RDD pipelines: Catalyst sees the DataFrame plan and rewrites it; RDDs are opaque to the optimizer.\n\nA common junior mistake is thinking that a large chain of `.filter().select().withColumn()` calls is expensive because it looks like many steps. It is not — they are all deferred and fused. The expensive operations are the actions (especially ones that return data to the driver like `collect()`) and the wide transformations that require shuffles.",
        interviewerLens:
          "I want to hear the word 'DAG' and 'action triggers execution' within the first two sentences. If you explain that Catalyst uses the deferred plan to optimize — filter pushdown, operation fusion — you're clearly past surface-level. The trap I set is: 'so calling .filter() five times runs five passes?' A junior says yes. A hired candidate says no and explains fusion.",
        followupChain: [
          {
            question: "What is the difference between a transformation and an action? Give two examples of each.",
            answer: "Transformations return a new DataFrame/RDD and are lazy: `filter()`, `select()`, `map()`, `join()`. Actions trigger execution and return a result or write data: `count()`, `collect()`, `show()`, `write.parquet()`. The rule: if it returns a DataFrame, it's a transformation; if it returns a non-DataFrame value or writes to storage, it's an action."
          },
          {
            question: "Why is collect() dangerous in production?",
            answer: "collect() pulls every row from all executors back to the driver. On a multi-TB dataset that will OOM the driver or take minutes. Use collect() only on small result sets (after a heavy aggregation or limit). For writing results, always use df.write — it keeps data distributed on executors."
          },
          {
            question: "What is a DAG and what problem does it solve for fault tolerance?",
            answer: "A DAG is the full transformation lineage Spark records. If an executor fails mid-job, Spark doesn't re-run the whole job — it replays only the lost partition's lineage from the last reliable data. This is Spark's primary fault-tolerance mechanism without replication."
          }
        ],
        redFlags: [
          {
            junior: "\"Each transformation runs immediately when I call it.\"",
            senior: "\"Transformations build the DAG; only an action triggers execution, which lets Catalyst optimize the full plan.\""
          },
          {
            junior: "\"Five filter() calls mean five passes over the data.\"",
            senior: "\"No — they're all fused into one scan at execution time because transformations are lazy.\""
          }
        ],
        alternatePhrasings: [
          "\"How does Spark's execution model differ from Pandas?\"",
          "\"What triggers Spark to actually run?\"",
          "\"Explain transformations vs actions.\""
        ],
        interviewContexts: [
          "Asked in nearly every junior Spark/PySpark screen",
          "Entry-level data engineering role at a Series B logistics company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 23,
        questionText:
          "What is the difference between an RDD, a DataFrame, and a Dataset? When would you choose each?",
        answerStructured:
          "- **RDD (Resilient Distributed Dataset)**: the lowest-level API. Immutable, distributed collection of arbitrary JVM objects. You control partitioning and transformations manually. No schema, no Catalyst optimization. Use only when you need byte-level control or the DataFrame API can't express your logic.\n- **DataFrame**: distributed table with named, typed columns and an inferred or declared schema. Built on RDDs internally, but opaque to you — Catalyst optimizes it. Equivalent to a Pandas DataFrame but distributed. Best for structured/semi-structured data (Parquet, JSON, JDBC).\n- **Dataset** (Scala/Java only): like a DataFrame but **type-safe** at compile time — errors surface in the IDE, not at runtime. PySpark has no Dataset; Python's dynamic typing makes it unnecessary.\n- **Rule of thumb**: default to **DataFrame** for PySpark pipelines; use **Dataset** in Scala when compile-time safety matters; drop to **RDD** only for custom partitioning, binary/custom serialization, or algorithms Catalyst can't express.",
        explanationDeep:
          "The progression is optimization vs control. RDDs give you maximum control: you decide what each partition contains and how each transformation operates. The cost is that Catalyst is completely blind to your logic — it can't push filters, prune columns, or reorder joins. You do all optimization manually.\n\nDataFrames hand the logical plan to Catalyst, which generates a physical plan, applies predicate pushdown, column pruning, and whole-stage code generation via Tungsten. For the vast majority of structured ETL work, this produces better performance than hand-tuned RDD code.\n\nDatasets add JVM type safety: `Dataset[Person]` catches type mismatches at compile time. In Python there is no Dataset because Python itself is dynamically typed — the type-safety benefit simply doesn't apply.\n\nIn practice for PySpark: you will write DataFrames 95% of the time. The interviewer mostly wants to know you understand why DataFrames beat RDDs (Catalyst/Tungsten) and that you know Datasets are Scala/Java only.",
        interviewerLens:
          "I want 'Catalyst optimization' named as the reason to prefer DataFrame over RDD — not 'DataFrames are easier.' The Dataset type-safety answer and the 'Python has no Dataset' clarification shows you've thought about API design, not just memorized definitions. If you say 'use RDD for better performance,' I'm skeptical — that was true in Spark 1.x, not 2.x+.",
        followupChain: [
          {
            question: "Can you convert between RDD and DataFrame? Show me.",
            answer: "DataFrame to RDD: `df.rdd` (returns RDD of Row objects). RDD to DataFrame: `spark.createDataFrame(rdd, schema)` or `rdd.toDF(column_names)`. The conversion is cheap at the API level but you lose Catalyst optimization the moment you operate on the RDD side."
          },
          {
            question: "What is a Row object in Spark?",
            answer: "A Row is an ordered, schema-aware tuple — essentially a record from a DataFrame exposed as a Python/Scala object. Fields are accessible by name (row['name']) or position (row[0]). It's what you get when you call collect() on a DataFrame."
          }
        ],
        redFlags: [
          {
            junior: "\"RDDs are faster because they're lower-level.\"",
            senior: "\"DataFrames are usually faster because Catalyst optimizes the plan — RDDs are opaque to the optimizer.\""
          },
          {
            junior: "\"Dataset is just a typed DataFrame — I can use it in PySpark.\"",
            senior: "\"Dataset is a Scala/Java API only — PySpark doesn't have it because Python is dynamically typed.\""
          }
        ],
        alternatePhrasings: [
          "\"What's the difference between RDD and DataFrame?\"",
          "\"Why would you ever use an RDD over a DataFrame?\"",
          "\"What is a Spark Dataset and how is it different?\""
        ],
        interviewContexts: [
          "Asked at 4 separate junior data engineering loops",
          "PySpark fundamentals screen at a Series A healthcare startup"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "What is the role of the Spark Driver and Executors, and what happens when each fails?",
        answerStructured:
          "- **Driver**: the process running the `main()` function / your PySpark script. Converts transformations to a DAG, calls the Catalyst optimizer, negotiates resources from the cluster manager, and distributes tasks to executors. There is **exactly one driver per application**.\n- **Executors**: JVM processes launched on worker nodes. They execute the tasks the driver sends, store shuffle data, and optionally cache partitions. Many executors run in parallel.\n- **Driver failure**: the entire application dies. The driver is a single point of failure. Recovery requires restarting the application from scratch (or from a checkpoint).\n- **Executor failure**: Spark recovers automatically. The driver detects the lost executor, marks the affected tasks as failed, and reschedules them on surviving executors using lineage recomputation. The job continues.\n- **Implication**: the driver should never hold large data structures (don't `collect()` large datasets to the driver — it's a single machine).",
        explanationDeep:
          "The driver/executor split mirrors a general distributed-systems pattern: a coordinator (driver) and workers (executors). The driver is stateful and irreplaceable during a job; executors are stateless at the application level and replaceable by design.\n\nPractically: executor OOM is survivable (Spark restarts the task). Driver OOM is fatal. This means: never call `collect()` on a large dataset, never broadcast a multi-GB table through the driver, and never accumulate large lists in driver-side Python code. The driver's memory is a scarce, unrecoverable resource.\n\nIn cluster mode (production), the driver runs on a worker node inside the cluster. In client mode (development), the driver runs on your laptop — your laptop crashing kills the job. This is why you should always deploy production jobs in cluster mode.",
        interviewerLens:
          "I want to hear the asymmetry: executor failure is recoverable, driver failure is not. If you mention that collect() is dangerous because it brings data to the single driver node, I know you've internalized the architecture. The cluster-mode vs client-mode distinction is a nice senior signal from a junior candidate.",
        followupChain: [
          {
            question: "What is speculative execution and when does it help?",
            answer: "Spark can launch a duplicate copy of a slow ('straggler') task on a healthy executor. Whichever finishes first wins; the other is killed. It helps with hardware issues (one slow disk, one throttled VM) but not with data skew — a skewed task is slow because of data volume, and a duplicate still processes the same volume."
          },
          {
            question: "What is the cluster manager's role?",
            answer: "The cluster manager (YARN, Kubernetes, Standalone, Mesos) allocates physical resources — it launches executors on worker nodes per the driver's resource request (cores, memory). Spark itself doesn't manage cluster resources; it delegates to the cluster manager."
          }
        ],
        redFlags: [
          {
            junior: "\"If an executor crashes, the whole job fails.\"",
            senior: "\"Executor failure is recoverable via lineage recomputation — only driver failure kills the whole application.\""
          },
          {
            junior: "\"The driver stores the processed data.\"",
            senior: "\"The driver only schedules tasks and tracks metadata — executors hold data partitions. Collecting large data to the driver is an anti-pattern.\""
          }
        ],
        alternatePhrasings: [
          "\"What does the Spark Driver do?\"",
          "\"What happens when an executor fails in Spark?\"",
          "\"Explain Spark's distributed architecture.\""
        ],
        interviewContexts: [
          "Junior data engineering interview at a cloud-native SaaS company",
          "Spark fundamentals screen at a consultancy"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "When do you cache or persist a DataFrame, and what storage levels are there?",
        code: [
          {
            lang: "pyspark",
            label: "persist with explicit level",
            lines: [
              "from pyspark import StorageLevel",
              "df = base.join(dim, 'id')",
              "df.persist(",
              "  StorageLevel.MEMORY_AND_DISK)",
              "df.count()    # materializes cache",
              "df.groupBy('k').count().show()",
              "df.unpersist()  # free when done",
            ],
          },
        ],
        answerStructured:
          "- **Rule**: cache a DataFrame only when it is **reused in multiple actions**. A single-use DataFrame gains nothing from caching — it just wastes memory.\n- `cache()` is shorthand for `persist(MEMORY_AND_DISK)` — stores in executor JVM heap first; spills to local disk if it doesn't fit.\n- **Storage levels** (key ones to know):\n  - `MEMORY_ONLY`: fastest access, but evicts partitions on memory pressure (must recompute from lineage).\n  - `MEMORY_AND_DISK`: falls back to disk rather than evicting — safer for large DataFrames.\n  - `MEMORY_ONLY_SER` / `MEMORY_AND_DISK_SER`: serialized storage, smaller footprint but CPU cost on each read.\n  - `DISK_ONLY`: fully on local disk, minimal memory footprint.\n- Cache materializes on the **first action** after the `cache()` call, not at the call itself (lazy!).\n- Always call `df.unpersist()` when done — Spark's LRU eviction can displace hot data if you forget.",
        explanationDeep:
          "The most common mistake is caching everything 'just in case.' Memory is a finite, shared resource on executors. Caching a DataFrame you only use once wastes memory that shuffle operations need, potentially causing spill. The decision rule is: will this DataFrame be computed more than once? If yes (it feeds two downstream branches or is referenced in a loop), cache it. If no, don't.\n\nThe storage level choice is a memory/CPU/reliability trade-off. MEMORY_ONLY is fastest at read time but fragile — under memory pressure Spark evicts cached partitions and recomputes them from lineage on next access, which defeats the purpose. MEMORY_AND_DISK is the safe default: if it doesn't fit in memory, pages to disk instead of evicting. For very large datasets where disk I/O is acceptable, DISK_ONLY avoids executor heap pressure entirely.\n\nSerialized levels (SER) reduce memory footprint by ~2-5x but add deserialization cost on every read. Worth it when memory is tight and the DataFrame is read infrequently.",
        interviewerLens:
          "The phrase I'm waiting for is 'only when the DataFrame is reused in multiple actions.' Candidates who say 'cache everything for speed' have never owned a production Spark job. The MEMORY_AND_DISK vs MEMORY_ONLY distinction shows you've hit the eviction problem in production. Mentioning unpersist() is a cleanliness signal.",
        followupChain: [
          {
            question: "How do you know if your cache actually got used?",
            answer: "In the Spark UI, under the 'Storage' tab, cached DataFrames appear with their memory footprint. In the SQL tab, stages that read from cache show 'InMemoryRelation' in the query plan. If the stage rescanned from scratch, the cache was evicted."
          },
          {
            question: "What is checkpointing and how is it different from caching?",
            answer: "Checkpointing writes an RDD/DataFrame to a reliable distributed store (HDFS/S3) and breaks the lineage. Cache stores in executor memory/disk and keeps lineage for recomputation. Checkpoint is slower to write but makes fault recovery cheaper for iterative algorithms (MLlib) or very long lineage chains."
          }
        ],
        redFlags: [
          {
            junior: "\"I cache everything to make Spark faster.\"",
            senior: "\"Cache only DataFrames used in multiple actions — caching everything wastes executor memory that shuffles need.\""
          },
          {
            junior: "\"cache() and persist() are the same thing.\"",
            senior: "\"cache() is persist(MEMORY_AND_DISK). persist() lets you choose the storage level — MEMORY_ONLY, DISK_ONLY, serialized variants — based on your memory/CPU trade-off.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use persist() vs cache()?\"",
          "\"What are Spark storage levels?\"",
          "\"How does caching help Spark performance?\""
        ],
        interviewContexts: [
          "Asked at a junior/mid Spark optimization interview",
          "PySpark performance screen at a data engineering startup"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 12,
        questionText:
          "How do you read data into Spark efficiently? What options matter for Parquet vs CSV?",
        code: [
          {
            accent: "bug",
            lang: "pyspark",
            label: "Before",
            lines: [
              "# extra full scan + mistyped cols",
              "df = (spark.read",
              "  .option('inferSchema', True)",
              "  .csv('data.csv', header=True))",
            ],
          },
          {
            accent: "fix",
            lang: "pyspark",
            label: "After",
            lines: [
              "from pyspark.sql.types import *",
              "s = StructType([",
              "  StructField('id', LongType()),",
              "  StructField('amt', DoubleType())])",
              "df = (spark.read.schema(s)",
              "  .csv('data.csv', header=True))",
            ],
          },
        ],
        answerStructured:
          "- **Parquet** (preferred): columnar format, stores column-level min/max statistics. Spark uses these for **predicate pushdown** (skipping row groups that can't match the filter) and **column pruning** (reading only referenced columns). A filter on an indexed Parquet column can skip 90%+ of I/O.\n- **CSV**: row-oriented, no statistics, must read every byte. No partition elimination. Schema inference requires a full first-pass scan. Always specify the schema explicitly with `schema=` to avoid the inference scan.\n- **Key read options**:\n  - `inferSchema=True` on CSV: scans the file twice — once to infer types, once to read. Always pass an explicit schema.\n  - `spark.sql.files.maxPartitionBytes`: controls how Spark splits large files into tasks (~128 MB default).\n  - For JDBC: use `partitionColumn`, `lowerBound`, `upperBound`, `numPartitions` to enable parallel reads — without these, one executor reads everything serially.\n- **Partition discovery**: store Parquet with Hive-style partitioning (`/date=2024-01-01/`) and Spark auto-filters by partition directory without touching the files.",
        explanationDeep:
          "The most impactful read optimization is choosing the right file format. Parquet's column statistics enable Spark to skip entire row groups without reading them. On a 1 TB table filtered to a single day's data, predicate pushdown can reduce I/O to a few GB. CSV has none of this — every byte gets read regardless of the filter.\n\nFor JDBC reads, the default is a single-partition serial read through one executor. On a 100M-row database table, this is painfully slow and bypasses all Spark parallelism. The partition column option splits the table into N numeric ranges, each read by a separate task in parallel.\n\nSchema inference on CSV is a hidden cost: Spark reads the file twice (or samples it). In production, always declare the schema explicitly using `StructType`. It's faster, deterministic, and catches upstream schema drift immediately rather than silently inferring a wrong type.",
        interviewerLens:
          "I want 'predicate pushdown' and 'column pruning' mentioned for Parquet — those are the reasons you choose it. For CSV, 'always pass explicit schema' shows production experience. JDBC partition column shows you've actually parallelized a database read. If you say 'Parquet is faster and that's it,' you've memorized the advice without understanding the mechanism.",
        followupChain: [
          {
            question: "What is partition pruning in Spark?",
            answer: "When data is stored with Hive-style partitioned directories (e.g., /year=2024/month=01/), Spark's metastore skips entire directories that don't match the filter predicate — without opening a single file. This is directory-level pruning (not row-group level like Parquet statistics). The two combine: directory pruning reduces files to open; Parquet statistics then prune row groups within those files."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use inferSchema=True, it's convenient.\"",
            senior: "\"inferSchema doubles the CSV scan time and can mistype columns — I always declare the schema explicitly in production.\""
          }
        ],
        alternatePhrasings: [
          "\"Why is Parquet preferred over CSV in Spark?\"",
          "\"How do you read a large database table in parallel in Spark?\"",
          "\"What is predicate pushdown?\""
        ],
        interviewContexts: [
          "Junior data engineering screen at a data platform team",
          "PySpark ETL interview at an e-commerce company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["RDD", "DataFrame", "Dataset"],
        asked: 20,
        questionText:
          "RDD vs DataFrame vs Dataset — which do you choose for a new PySpark pipeline and why?",
        code: [
          {
            accent: "bug",
            lang: "pyspark",
            label: "Before",
            lines: [
              "# .rdd: opaque to Catalyst,",
              "# Python ser/deser per row",
              "rdd = df.rdd.map(",
              "  lambda r: (r.id, r.amt * 1.1))",
            ],
          },
          {
            accent: "fix",
            lang: "pyspark",
            label: "After",
            lines: [
              "from pyspark.sql import functions as F",
              "# stays in Tungsten / Catalyst",
              "out = df.select(",
              "  'id', (F.col('amt')*1.1).alias('amt'))",
            ],
          },
        ],
        answerStructured:
          "- **Choose DataFrame for PySpark pipelines** — always. The DataFrame API gives you Catalyst query optimization, Tungsten code generation, and a schema that makes errors visible at plan time, not at runtime.\n- **RDD** is the escape hatch when: (1) you need to manipulate arbitrary binary data or custom objects, (2) a specific algorithm requires partition-level control, or (3) you're wrapping a third-party library that doesn't speak DataFrames. Accept the Catalyst blind spot only when you have no DataFrame equivalent.\n- **Dataset** is Scala/Java only. In PySpark, it does not exist — Python's dynamic typing makes compile-time type safety impossible at the API level.\n- **Performance order**: DataFrame ≈ Dataset >> RDD (for structured data). Catalyst rewrites DataFrame plans; RDDs are black boxes.\n- If you find yourself converting a DataFrame `.rdd` to do something, ask first whether there is a DataFrame equivalent (`explode`, `flatMap`, custom UDFs, pandas UDFs for vectorized ops).",
        explanationDeep:
          "The key insight is that DataFrames are not just 'easier RDDs' — they expose the logical plan to the optimizer. When you call `.filter(col('date') == '2024-01-01')`, Catalyst can push that predicate into the Parquet reader so the file is barely touched. The equivalent `.filter(lambda row: row.date == '2024-01-01')` on an RDD is opaque Python — Catalyst sees nothing, the predicate runs row-by-row in Python, and the file is fully read first.\n\nThe RDD-via-Python-lambda pattern is particularly bad because it requires serializing data out of Tungsten's binary format, passing it through the Python process (via Py4J or Arrow), running the Python function, and serializing back. This is the 10-100x slower path.\n\nThe correct pattern: if the SQL function library (`pyspark.sql.functions`) has what you need, use it. If you need custom logic beyond SQL functions, write a pandas UDF (vectorized, Arrow-based) rather than a Python row-by-row UDF. Drop to RDD only as a last resort.",
        interviewerLens:
          "I want 'Catalyst optimization' as the concrete reason to prefer DataFrame, not 'it's higher level.' The anti-pattern of converting to RDD for a Python lambda is a common junior mistake I'm screening for. The pandas UDF recommendation shows you know the right middle ground. Saying 'Dataset doesn't exist in PySpark' shows API awareness.",
        followupChain: [
          {
            question: "What is a Python UDF and why should you avoid it in PySpark?",
            answer: "A Python UDF runs row-by-row, requires serializing each row from JVM to Python via Py4J, running the Python function, and serializing back. This is ~10x slower than equivalent SQL functions that run natively on the JVM. Use pyspark.sql.functions equivalents first, pandas UDFs (vectorized Arrow transfer) second, and Python UDFs only as a last resort."
          }
        ],
        redFlags: [
          {
            junior: "\"I convert to RDD so I can use Python lambdas — it's more Pythonic.\"",
            senior: "\"Python lambdas on RDDs bypass Catalyst and add Python serialization overhead — I use SQL functions or pandas UDFs instead.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I use RDD or DataFrame?\"",
          "\"What's wrong with using Python UDFs in Spark?\"",
          "\"Why are DataFrames faster than RDDs?\""
        ],
        interviewContexts: [
          "PySpark screen at a mid-size analytics engineering team",
          "Junior DE loop at a data consulting firm"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "What is a stage in Spark and what creates a stage boundary?",
        "What is spark.sql.shuffle.partitions and what should you set it to?",
        "Explain Spark's shared variables: broadcast variables and accumulators.",
        "How do you write a DataFrame to Parquet with partition columns?",
        "What is the difference between groupBy().agg() and groupBy().apply() in PySpark?",
        "What is flatMap and when does it produce more rows than map?",
        "How does Spark handle schema evolution in Parquet reads?",
        "What is the difference between reduceByKey and groupByKey on RDDs?",
        "What does spark-submit do and what are the key flags?",
        "How does Spark's structured streaming differ from batch processing?"
      ],
      decisions: [
        "When do you cache vs persist vs checkpoint a DataFrame?",
        "CSV vs Parquet vs JSON — which format and why?",
        "Client mode vs cluster mode for spark-submit — when do you use each?"
      ],
      quickRef: [
        "What triggers execution in Spark?",
        "What is a transformation vs an action?",
        "What is the Spark DAG?",
        "What does collect() do and when is it dangerous?",
        "What is the driver's role?",
        "What does an executor do?",
        "What is RDD lineage?",
        "What does cache() default to?",
        "What is predicate pushdown?",
        "What is schema inference and why avoid it for CSV?"
      ],
      redFlags: [
        {
          junior: "\"I cache everything for performance.\"",
          senior: "\"Cache only DataFrames used in multiple actions — caching wastes the executor memory that shuffles need.\""
        },
        {
          junior: "\"I use Python lambdas on RDDs because it feels more natural.\"",
          senior: "\"Python lambdas on RDDs bypass Catalyst and incur Python serialization overhead — I use SQL functions or pandas UDFs.\""
        },
        {
          junior: "\"collect() is how I get my results.\"",
          senior: "\"collect() brings everything to the driver — I write results to storage and use collect() only on tiny aggregated outputs.\""
        }
      ],
      checklist: [
        "Know transformations vs actions and be able to list 4 of each",
        "Explain lazy evaluation and the DAG in plain English",
        "Know the RDD vs DataFrame Catalyst optimization story",
        "Understand driver failure (fatal) vs executor failure (recoverable)",
        "Know when to cache and the key storage levels"
      ],
      behavioral: [
        "Tell me about a Spark job you built — what was the data size?",
        "Describe a time your Spark job was slow and how you fixed it.",
        "How do you test a PySpark pipeline before running on the full dataset?"
      ],
      reverse: [
        "What cluster manager are you running Spark on — YARN, Kubernetes, or Databricks?",
        "What's the typical data volume for Spark jobs on this team?",
        "Do you use Spark Structured Streaming or batch-only?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID — Narrow vs wide transformations, shuffles, join strategies,
  //        partitioning, spark.sql.shuffle.partitions, cache/persist
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
          "What is the difference between narrow and wide transformations, and why do wide transformations hurt performance?",
        answerStructured:
          "- **Narrow transformation**: each input partition produces exactly one output partition, with no data movement across executors. Examples: `filter()`, `select()`, `map()`, `withColumn()`, `union()`. These are cheap and pipelined together in the same stage.\n- **Wide transformation**: each input partition may contribute to *multiple* output partitions — requires a **shuffle**: data is written to local disk, transferred over the network, and re-partitioned by key. Examples: `groupBy()`, `join()` (non-broadcast), `distinct()`, `repartition()`, `reduceByKey()`.\n- **Why shuffles hurt**: shuffle involves: (1) map tasks write shuffle files to local disk, (2) network I/O to transfer data between nodes, (3) reduce tasks read and merge the shuffle data. Each wide transformation forces a stage boundary and incurs this full cost.\n- **Practical consequence**: every wide transformation = one or more stage boundaries in the Spark UI. A chain of five narrow transforms is one stage; each wide transform adds another stage. Minimize wide transformations; when unavoidable, reduce the data volume before them (filter/project first).",
        explanationDeep:
          "Stage boundaries exist because Spark cannot pipeline across a shuffle — all map tasks must complete and write their shuffle data before any reduce task can start. This creates a synchronization barrier. The stage count in the Spark UI is a direct measure of how many shuffles your job has.\n\nThe shuffle mechanism: the map side writes rows to local shuffle files partitioned by the target partition (determined by a hash of the groupBy or join key). The reduce side reads its assigned partition from every map task across all executors. This is full network fan-out — every reducer talks to every mapper. On a 1000-node cluster with 1000 partitions, a shuffle produces 1 million small network connections.\n\nThe classic mistake is placing a heavy aggregation before a filter that could have massively reduced the data first. The optimizer can push some filters, but complex pipelines can defeat it. Always think: can I reduce cardinality before the wide transform?\n\nA related nuance: `repartition()` is always wide (shuffles). `coalesce()` can be narrow when reducing partitions (merges locally, no full shuffle), but wide when used to increase partition count.",
        interviewerLens:
          "I want 'shuffle' named as the mechanism within 30 seconds, not just 'wide transformations are slow.' The stage-boundary consequence (multiple stages in the UI) shows you've read actual execution plans. The filter-first optimization is the practical follow-through I look for. A junior says 'groupBy is slow'; a hired candidate says 'groupBy triggers a shuffle — write less data before it gets there.'",
        followupChain: [
          {
            question: "What creates a stage boundary in Spark?",
            answer: "Any wide transformation that requires a shuffle creates a stage boundary. All narrow transformations in a sequence are pipelined into one stage. The Spark UI shows each stage as a block, and the number of stages roughly equals the number of shuffles plus one."
          },
          {
            question: "Why is reduceByKey more efficient than groupByKey on RDDs?",
            answer: "reduceByKey performs a map-side combine (partial aggregation) before the shuffle, so only the partial result per key per partition crosses the network. groupByKey shuffles all values for every key across the network, then aggregates — network I/O is 10-100x larger for high-cardinality keys. This is why the DataFrame API's groupBy().agg() is preferred over groupByKey on RDDs."
          },
          {
            question: "What is spark.sql.shuffle.partitions and what should it be set to?",
            answer: "It controls how many output partitions are created after a shuffle (default: 200). On small datasets 200 is too high — 200 tiny tasks with coordination overhead. On large datasets it may be too low — each partition becomes too large. Rule of thumb: target 100-200 MB per partition after the shuffle. With AQE enabled, Spark auto-coalesces small shuffle partitions at runtime, making this less critical."
          }
        ],
        redFlags: [
          {
            junior: "\"Wide transformations require more code, that's why they're slow.\"",
            senior: "\"Wide transformations require a shuffle — data written to disk, transferred over the network, re-read — that's the performance cost, not the code complexity.\""
          },
          {
            junior: "\"I put all my filters after the join.\"",
            senior: "\"I push filters before wide transforms to reduce shuffle data volume — less data crossing the network means faster stages.\""
          }
        ],
        alternatePhrasings: [
          "\"What causes a shuffle in Spark?\"",
          "\"Why is groupBy expensive?\"",
          "\"What is a stage boundary?\""
        ],
        interviewContexts: [
          "Asked at mid-level data engineering interviews at 3 separate companies",
          "Spark optimization round at a Series C e-commerce company"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 22,
        questionText:
          "How does a sort-merge join work in Spark and when does it fire vs a broadcast hash join?",
        code: [
          {
            lang: "pyspark",
            label: "Force / control broadcast",
            lines: [
              "from pyspark.sql import functions as F",
              "# default threshold = 10MB",
              "spark.conf.get(",
              "  'spark.sql.autoBroadcastJoinThreshold')",
              "# force for a dim table",
              "big.join(F.broadcast(dim), 'id')",
            ],
          },
        ],
        answerStructured:
          "- **Sort-Merge Join (SMJ)**: both sides are shuffled by the join key (all rows with key=X land on the same partition), then each co-partitioned pair is sorted and merged. Works at any scale; neither side needs to fit in memory. This is the default join strategy for large-large joins.\n- **Broadcast Hash Join (BHJ)**: the *smaller* side is serialized on the driver and broadcast (replicated) to every executor. Each executor builds a local hash table of the small side and probes it locally. **No shuffle on the large side** — the join becomes a narrow transformation. Dramatically faster when it applies.\n- **When Spark picks BHJ**: when one side is below `spark.sql.autoBroadcastJoinThreshold` (default **10 MB**). With AQE enabled, Spark can switch to BHJ at runtime even if the estimate was above the threshold, if actual shuffle sizes reveal the smaller side is small enough.\n- **When to force BHJ**: `df.join(broadcast(dim_table), key)` — explicit hint. Use when the dimension table is < ~100–200 MB but above the auto threshold.\n- **Shuffle Hash Join**: a third strategy — shuffle both sides, build a hash table on the smaller side. Faster than SMJ (no sort) but requires the smaller partition to fit in executor memory. Disabled by default since Spark 3.x; SMJ is safer.",
        explanationDeep:
          "The sort-merge join is the safe universal default: it handles any table size because it only keeps one partition's data in memory at a time during the merge phase. The cost is two full shuffles (one per side) and a sort per partition — expensive but bounded.\n\nThe broadcast join eliminates the large side's shuffle entirely by replicate the small side to every executor. A 10 GB fact table joined to a 5 MB dimension table: without broadcast, the 10 GB table shuffles too. With broadcast, only the 5 MB dimension is sent to all executors; the 10 GB is read locally. The speedup can be 10-50x.\n\nThe 10 MB auto-broadcast threshold is conservative because at broadcast time the table sits in driver memory AND is deserialized in every executor's heap. Broadcasting a 2 GB table to 100 executors consumes 200 GB of executor heap collectively. Practical safe limit is 100-200 MB for a typical cluster.\n\nWith AQE (Spark 3.0+), Spark can dynamically re-plan and switch to BHJ at runtime if it discovers the actual shuffle size of one side is small. This makes the static threshold less critical but still worth knowing.",
        interviewerLens:
          "I want to hear the shuffle elimination framing for broadcast — 'no shuffle on the large side' — not just 'the small table is copied everywhere.' If you mention the autoBroadcastJoinThreshold and its default, I know you've tuned this. If you explain why you can't broadcast a 5 GB table (executor heap exhaustion), you've clearly operated Spark at scale. The AQE dynamic re-planning mention is a strong senior signal from a mid-level candidate.",
        followupChain: [
          {
            question: "What happens if you broadcast a table that's too large?",
            answer: "The driver OOMs serializing the broadcast value, or executors OOM storing it. Symptoms: driver OOM on collect of the broadcast, or executor OutOfMemoryError shortly after the broadcast stage. Threshold: keep manually broadcasted tables under 100-200 MB for typical cluster configs. AQE won't protect you from a manual broadcast() hint — it only auto-limits automatic broadcast decisions."
          },
          {
            question: "How do you hint Spark to use a specific join strategy?",
            answer: "DataFrame API: wrap the smaller side in `broadcast(df)`. SQL: `/*+ BROADCAST(table_alias) */` hint in the query. For sort-merge, the `/*+ MERGE(alias) */` hint. Hints override the cost-based planner but not safety checks — if the table is too large, Spark may ignore the broadcast hint."
          },
          {
            question: "What is a shuffle hash join and why is it off by default?",
            answer: "Both sides shuffle by key; a hash table is built on the smaller side's partition. No sort required, so it's faster than SMJ — but if the smaller partition doesn't fit in executor memory, it OOMs. SMJ is safer because it streams the merge without materializing the full partition. Spark disables shuffle hash join by default; it's enabled via spark.sql.join.preferSortMergeJoin=false."
          }
        ],
        redFlags: [
          {
            junior: "\"Broadcast join is always better, use it everywhere.\"",
            senior: "\"Broadcast is only better when one side fits safely in driver and executor memory — broadcasting a large table will OOM the cluster.\""
          },
          {
            junior: "\"Spark always picks the right join strategy automatically.\"",
            senior: "\"Spark's cost estimates can be wrong — I check the query plan and force a broadcast hint when I know the dimension table is small.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use a broadcast join?\"",
          "\"How does Spark decide which join algorithm to use?\"",
          "\"What is a sort-merge join?\""
        ],
        interviewContexts: [
          "Mid-level Spark interview at a data warehousing company",
          "Asked in Spark optimization round at a FAANG-adjacent data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "How do you choose the right number of Spark partitions and what is spark.sql.shuffle.partitions?",
        code: [
          {
            lang: "pyspark",
            label: "Shuffle partition tuning",
            lines: [
              "# default 200 output partitions",
              "spark.conf.set(",
              "  'spark.sql.shuffle.partitions', 400)",
              "# full shuffle -> balanced",
              "df = df.repartition(400, 'key')",
              "# cheap reduce, no shuffle",
              "df.coalesce(50).write.parquet('o/')",
            ],
          },
        ],
        answerStructured:
          "- **Rule of thumb**: aim for **100–200 MB per partition** after a shuffle. Too few partitions → fewer, larger tasks that may OOM. Too many → task scheduling overhead dominates.\n- **spark.sql.shuffle.partitions** (default: **200**): controls the number of output partitions after every shuffle (groupBy, join, etc.). This single number is the most common tuning knob. For a 10 GB shuffle, 200 partitions → 50 MB each (OK). For a 100 MB shuffle, 200 partitions → 0.5 MB each (too many tiny tasks).\n- **repartition(N)**: full shuffle to create exactly N partitions of equal size. Use to increase partition count or to redistribute skewed data.\n- **coalesce(N)**: narrows partitions locally without a full shuffle — used to reduce partition count cheaply before writing output files. Partitions may be unequal.\n- **AQE (Adaptive Query Execution)**: with `spark.sql.adaptive.enabled=true` (default in Spark 3.2+), Spark auto-coalesces small shuffle partitions at runtime. This largely handles the 'too many tiny partitions' problem automatically.\n- **Input partitioning**: controlled by `spark.sql.files.maxPartitionBytes` (128 MB default for Parquet reads) and the actual file sizes. One Parquet file that is 1 GB → ~8 tasks.",
        explanationDeep:
          "The 200 default for spark.sql.shuffle.partitions is a rough heuristic tuned for medium-sized clusters and datasets. It is wrong in both directions on real workloads. For small datasets (a few GB), 200 means thousands of tiny tasks — the task scheduling overhead exceeds the compute cost. For very large datasets (10+ TB), 200 means multi-GB partitions that risk OOM during aggregation.\n\nThe target is 100–200 MB per partition. Calculate: expected shuffle output size / target partition size = shuffle partitions. For a 1 TB shuffle output, that's 5,000–10,000 partitions. Setting shuffle.partitions=5000 for this job and resetting for others is tedious — which is why AQE's auto-coalescing is valuable. AQE observes actual shuffle write sizes and merges consecutive small partitions dynamically.\n\nFor initial read partitioning: Spark splits files into partition-sized chunks based on maxPartitionBytes. A 100-partition Parquet dataset at 128 MB/partition = 12.8 GB total. If you have 200 cores and only 100 partitions, half your cores sit idle during the read phase. Use repartition() after the read to fully utilize the cluster if files are few and large.",
        interviewerLens:
          "The number I want to hear is 100-200 MB per partition as the target — not a fixed number like '200' or '1000.' The calculation (shuffle output / target partition size) shows you actually tune this, not just set it and forget. Mentioning AQE auto-coalescing shows you're current on Spark 3.x. The coalesce-before-write pattern (to reduce output file count) is a practical production signal.",
        followupChain: [
          {
            question: "How do you know how many partitions your DataFrame has?",
            answer: "df.rdd.getNumPartitions() returns the current partition count. For shuffle output, look at the Spark UI's stage detail — it shows the number of tasks (= number of output partitions). After repartition/coalesce, getNumPartitions() reflects the new count immediately (but the actual shuffle hasn't happened yet — it's lazy)."
          },
          {
            question: "What is the small files problem and how do coalesce/repartition help?",
            answer: "Writing a DataFrame with 1000 partitions creates 1000 output files. Reading 1000 tiny files later creates 1000 tasks — high overhead. Before writing, coalesce(n) reduces partition count to produce n files. Coalesce is preferred over repartition here because it avoids a full shuffle; it just merges adjacent partitions locally."
          }
        ],
        redFlags: [
          {
            junior: "\"I leave spark.sql.shuffle.partitions at the default 200.\"",
            senior: "\"200 is wrong for most real workloads. I target 100-200 MB per partition and calculate the right count from estimated shuffle size — or let AQE handle it at runtime.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you tune Spark partitions?\"",
          "\"What is spark.sql.shuffle.partitions?\"",
          "\"repartition vs coalesce — which do you use and when?\""
        ],
        interviewContexts: [
          "Mid-level Spark tuning interview at a streaming platform",
          "Asked at a data engineering loop at a Series D fintech"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "Explain repartition vs coalesce. When do you use each and what are the trade-offs?",
        code: [
          {
            accent: "bug",
            lang: "pyspark",
            label: "Before",
            lines: [
              "# all data through ONE executor",
              "df.coalesce(1).write.parquet('o/')",
            ],
          },
          {
            accent: "fix",
            lang: "pyspark",
            label: "After",
            lines: [
              "# keep parallelism; fewer files",
              "df.coalesce(16).write.parquet('o/')",
              "# need balance? full shuffle:",
              "# df.repartition(16).write...",
            ],
          },
        ],
        answerStructured:
          "- **repartition(N)**: triggers a **full shuffle** — all data is redistributed across N new partitions, resulting in roughly equal-sized partitions. Can increase or decrease partition count. Use when: you need more partitions (to increase parallelism), you need balanced partitions after a skew, or you need to repartition by a specific column (`repartition(N, col)`) to pre-sort for downstream operations.\n- **coalesce(N)**: **no full shuffle** — merges nearby partitions on the same executor. Can only *decrease* partition count. Partitions will be unequal (some executors handle more merged partitions). Use when: reducing output file count before writing, or reducing partition count after a filter that dropped most data.\n- **Key trade-off**: coalesce is faster (no shuffle) but produces unbalanced partitions. repartition is slower (full shuffle) but produces balanced partitions.\n- **Watch out**: `coalesce(1)` forces all data through a single executor — a single-threaded bottleneck that eliminates all parallelism. Prefer `coalesce(n)` where n is a reasonable file count, or `repartition(n)` if balance matters.",
        explanationDeep:
          "The decision is fundamentally about shuffle cost vs data balance. If you're reducing partitions after a write-heavy filter (e.g., 1000 input partitions, 90% data dropped, now you have 1000 tiny partitions), coalesce is the right call — it merges locally and avoids the overhead of re-shuffling already-small data. The resulting unbalanced partitions don't matter much when the total data volume is small.\n\nIf you're preparing data for a heavy downstream operation (a join or aggregation that benefits from balanced input), repartition() is worth the shuffle cost because the balanced partitions lead to better parallelism in subsequent stages.\n\nrepartition(N, col) is a powerful underused pattern: it shuffles data by the specified column, so rows with the same column value land in the same partition. If the next operation is a join on that column, the join becomes a co-partitioned join and avoids a second shuffle. This is the manual precursor to what AQE does automatically via dynamic join reordering.\n\ncoalesce(1) is the performance anti-pattern: the single output file is convenient but routes everything through one task on one executor. On a 100 GB dataset, this single task runs for hours. Write with repartition(small_N) instead.",
        interviewerLens:
          "I want the shuffle/no-shuffle distinction immediately, followed by the unbalanced-partitions trade-off. The coalesce(1) anti-pattern warning shows you've seen production pipelines where someone wanted 'one output file' and accidentally serialized a parallel job. The repartition(N, col) pattern shows you understand partition affinity for downstream join optimization.",
        followupChain: [
          {
            question: "How do you reduce output file count without coalesce(1)?",
            answer: "Use coalesce(N) with a reasonable N (e.g., coalesce(10) to write 10 balanced files) rather than coalesce(1). Or use repartition(N) if you need balanced file sizes. AQE's auto-coalesce handles shuffle output; for final writes, explicit coalesce before df.write is still the clearest approach."
          }
        ],
        redFlags: [
          {
            junior: "\"I use coalesce(1) to get a single output file.\"",
            senior: "\"coalesce(1) routes everything through one executor — it eliminates parallelism. I use coalesce(N) with a small N instead.\""
          },
          {
            junior: "\"repartition and coalesce are basically the same.\"",
            senior: "\"repartition always shuffles for balanced partitions; coalesce merges locally without a shuffle but produces unbalanced partitions — different cost, different use case.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you repartition vs coalesce?\"",
          "\"How do you control output file count in Spark?\"",
          "\"What is the difference between repartition and coalesce?\""
        ],
        interviewContexts: [
          "Mid-level Spark interview at 3 separate data platform teams",
          "PySpark optimization screen at a logistics data engineering team"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 19,
        questionText:
          "How do you decide between broadcast join and sort-merge join for a specific workload?",
        answerStructured:
          "- **Use broadcast join when**: one side is small enough to fit in executor memory (rough guideline: < 100 MB, conservatively < 200 MB). The payoff: eliminates the shuffle on the large side — the biggest performance win in Spark join optimization.\n- **Use sort-merge join when**: both sides are large, or the smaller side exceeds safe broadcast size. SMJ handles any scale safely.\n- **Decision tree**:\n  1. Is one table < 10 MB? → auto-broadcast fires, no action needed.\n  2. Is one table 10–200 MB and fits comfortably in executor heap? → force `broadcast(df)` hint.\n  3. Both sides large (GB+)? → sort-merge join. Consider bucketing to pre-sort and skip one shuffle.\n  4. Uncertain due to upstream filtering? → enable AQE; it will broadcast dynamically if runtime size is small.\n- **Trap**: never broadcast based on the pre-filter size. If the 'large' side has a filter that reduces it to 50 MB, and you apply that filter before the join, broadcast becomes viable — check the actual filtered size.",
        explanationDeep:
          "The core insight is that broadcast join converts a wide transformation into a narrow one. A sort-merge join requires two shuffles (one per side) plus sorting. A broadcast join requires sending the small side's data to all executors (O(small_table × num_executors) network cost), but the large side is never shuffled. For a 10 GB fact table and a 5 MB dimension: SMJ shuffles 10 GB + 5 MB; BHJ ships 5 MB × N executors. On 100 executors that's 500 MB vs 10+ GB in shuffle traffic — a 20x improvement in network I/O.\n\nThe broadcast threshold exists because the broadcast value must fit in driver memory during serialization AND be stored deserialized in every executor's heap simultaneously. With 500 executors and 200 MB to broadcast, you're consuming 100 GB of total executor heap. This crowd out execution memory and causes OOM or excessive GC.\n\nBucketing is the advanced alternative: pre-partition and sort both tables by the join key on disk. Subsequent joins on bucketed tables skip both the shuffle and the sort steps — the SMJ simply reads and merges. This pays off when the same join runs repeatedly (e.g., a daily ETL joining the same dimension).",
        interviewerLens:
          "The decision-tree format is what I want — not a binary 'broadcast is better.' Naming 100-200 MB as the practical threshold, not the theoretical autoBroadcastJoinThreshold, shows production experience. The AQE dynamic planning mention shows you know the modern Spark 3.x approach. Bucketing as the alternative for repeated large-large joins is a senior signal from a mid-level candidate.",
        followupChain: [
          {
            question: "What is bucketing in Spark and how does it help joins?",
            answer: "Bucketing pre-partitions and sorts data on disk by a specified column into a fixed number of buckets. When two tables are bucketed on the same key with the same number of buckets, a join on that key skips both the shuffle and sort steps — the physical partitioning already aligns. Best for dimension tables joined repeatedly in batch pipelines. Setup cost: the initial bucketed write. Benefit: every subsequent join on that key is shuffle-free."
          }
        ],
        redFlags: [
          {
            junior: "\"Always use broadcast join for performance.\"",
            senior: "\"Broadcast is only viable when the smaller side safely fits in executor heap — otherwise it OOMs the cluster. For large-large joins, sort-merge is the right default.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you pick broadcast over sort-merge join?\"",
          "\"How do you optimize a slow join in Spark?\"",
          "\"What is autoBroadcastJoinThreshold?\""
        ],
        interviewContexts: [
          "Mid-level Spark interview at a data warehousing SaaS",
          "Spark performance optimization round at a Series B company"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "A Spark job writes 1000 tiny output files. How do you fix it and why does it matter?",
        code: [
          {
            accent: "bug",
            lang: "pyspark",
            label: "Before",
            lines: [
              "# 200 shuffle parts -> 200 files",
              "df.write.parquet('out/')",
            ],
          },
          {
            accent: "fix",
            lang: "pyspark",
            label: "After",
            lines: [
              "# N sized for 128-512MB files",
              "# e.g. 40GB / 256MB ~= 160",
              "df.coalesce(160).write.parquet('out/')",
            ],
          },
        ],
        answerStructured:
          "- **Root cause**: the number of output files equals the number of partitions at write time. If the job has 1000 shuffle partitions, it writes 1000 files — often tiny if the data is modest.\n- **Why it matters**: the 'small files problem.' Downstream jobs that read thousands of tiny files launch thousands of tasks, pay per-file metadata overhead (especially on S3/ADLS), and underutilize I/O bandwidth.\n- **Fix options**:\n  1. `df.coalesce(N).write.parquet(path)` — merges partitions locally before writing; no full shuffle. Best when just reducing file count.\n  2. `df.repartition(N).write.parquet(path)` — full shuffle for balanced files. Use when you also want uniform file sizes.\n  3. Reduce `spark.sql.shuffle.partitions` if the root cause is a default-200 shuffle on a small dataset.\n  4. Enable AQE auto-coalescing: `spark.sql.adaptive.coalescePartitions.enabled=true` — Spark merges small shuffle partitions automatically at runtime.\n- **Target file size**: 128–512 MB per Parquet file for efficient downstream reads.",
        explanationDeep:
          "The small files problem is one of the most common production issues in Spark pipelines. It's a compounding problem: a job that writes 10,000 files today becomes the input for tomorrow's job, which opens 10,000 files in its read phase — each file costs metadata operations against S3/ADLS, and the input is split into 10,000 tiny tasks with high scheduling overhead.\n\nThe coalesce-before-write pattern is the standard fix. The key is understanding where in the pipeline to coalesce: apply it as the last step before df.write. If you coalesce early and then do a join, the join will repartition anyway and undo the coalesce.\n\nFor Delta Lake / Iceberg tables, the platform often handles compaction separately (OPTIMIZE in Delta Lake). This decouples write performance (write many small files for ingestion throughput) from read performance (compact them asynchronously). For plain Parquet on S3, you must manage compaction yourself.\n\nA common mistake is setting coalesce(1) to get a single file — this forces all data through one executor in a single-threaded bottleneck. For a 100 GB table, that single task runs for hours. Use a reasonable N (e.g., coalesce(20) for a 10 GB output = 500 MB files).",
        interviewerLens:
          "I want the coalesce-before-write solution named, with the explanation that file count = partition count at write time. The coalesce(1) anti-pattern warning shows you've seen this mistake in production. Mentioning Delta OPTIMIZE or AQE shows you're current on platform-level solutions beyond manual coalescing.",
        followupChain: [
          {
            question: "How does the small files problem manifest in the Spark UI?",
            answer: "A job reading many small files shows many tiny tasks in the read stage with very short duration (milliseconds). The total job time is dominated by task scheduling overhead rather than actual compute. The input data size per task column shows values like 1 KB or 100 KB — far below the target ~128 MB."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd set coalesce(1) to get one output file.\"",
            senior: "\"coalesce(1) serializes everything through one task — I'd use coalesce(N) with N sized for 128-512 MB files.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you control the number of output files in Spark?\"",
          "\"What is the small files problem?\"",
          "\"How do you fix a job that writes too many partitions?\""
        ],
        interviewContexts: [
          "Asked at a mid-level data engineering screen at a cloud data company",
          "Spark production interview at an analytics platform startup"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Broadcast Join", "Sort-Merge Join"],
        asked: 21,
        questionText:
          "Broadcast join vs sort-merge join — compare them on shuffle cost, memory requirements, and when each one fails.",
        answerStructured:
          "- **Sort-Merge Join**:\n  - Shuffle: both sides fully shuffled by key — expensive network I/O for large tables\n  - Memory: streams merge partition-by-partition — safe for any table size\n  - Fails when: shuffle volume is so large that disk spill becomes the bottleneck; or sort is slow on very high-cardinality keys\n- **Broadcast Hash Join**:\n  - Shuffle: **only the small side** is sent (broadcast); large side is never shuffled — major network savings\n  - Memory: small side must fit in executor heap, replicated across all executors; driver must fit it during serialization\n  - Fails when: 'small' side is actually large (multi-GB) — driver OOM, executor OOM, or GC pressure\n- **AQE dynamic fallback**: with AQE enabled, Spark can switch from planned SMJ to BHJ at runtime if actual shuffle statistics reveal the smaller side is below threshold — best of both worlds\n- **Summary table**:\n  - Large × Large: Sort-Merge (safe, no choice)\n  - Large × Small (<100MB): Broadcast (fast, eliminates large-side shuffle)\n  - Medium × Medium with AQE: AQE decides at runtime",
        explanationDeep:
          "The fundamental trade-off is: broadcast join pays a one-time cost (ship the small table to all executors) to eliminate the recurring cost (shuffle the large table). When the large table is 10 GB and the small table is 5 MB, the broadcast cost is negligible; the shuffle savings are enormous.\n\nThe broadcast join failure mode is memory exhaustion. The broadcast variable is serialized on the driver (driver heap), then deserialized and stored in every executor's heap. On a 500-executor cluster broadcasting a 500 MB table, that's 250 GB of executor heap consumed by the broadcast alone — before any processing. This evicts cached data, increases GC pressure, and often causes executor OOM.\n\nSort-merge join's failure mode is disk spill. When partitions are too large to sort in executor memory, Spark spills sorted runs to disk and merges them — like external sort. This is recoverable but slow (disk I/O instead of memory operations). Tuning: increase executor memory, increase spark.sql.shuffle.partitions (smaller partitions = less spill risk).\n\nAQE makes this decision less manual: it observes actual shuffle write sizes at runtime and can switch the join strategy. A planned SMJ might become a BHJ if the filter on one side reduces it dramatically. But knowing the underlying mechanics is essential for debugging when AQE makes unexpected choices.",
        interviewerLens:
          "The answer I want is structured around the three axes: shuffle cost, memory requirements, and failure modes — not a single winner. The AQE dynamic switching shows you know the modern execution model. The executor-heap calculation for broadcast cost (small_table_size × num_executors) demonstrates you've thought about the cluster-level impact, not just the per-task view.",
        followupChain: [
          {
            question: "How does AQE change the join strategy decision in Spark 3.x?",
            answer: "AQE collects runtime statistics at shuffle boundaries (actual partition sizes, row counts) and can re-optimize the remaining plan. Specifically: if one side of a planned SMJ turns out to be small enough after filtering, AQE switches to BHJ. It can also coalesce tiny partitions and split skewed ones. This makes many manual hints unnecessary — but you still need to understand the underlying strategies to debug unexpected plans."
          }
        ],
        redFlags: [
          {
            junior: "\"Broadcast join is always faster so always use it.\"",
            senior: "\"Broadcast eliminates the large-side shuffle but requires the small side to fit safely in all executor heaps — it fails with OOM if the 'small' side is multi-GB.\""
          }
        ],
        alternatePhrasings: [
          "\"Compare broadcast and sort-merge join.\"",
          "\"When does broadcast join fail?\"",
          "\"How does AQE affect join selection?\""
        ],
        interviewContexts: [
          "Mid-level Spark round at a FAANG-adjacent data platform",
          "Spark design question at a streaming data engineering interview"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Explain Spark's pipeline execution model: how are narrow transforms pipelined within a stage?",
        "What are accumulators and what are their limitations inside transformations?",
        "How does Structured Streaming handle late data and watermarking?",
        "What is dynamic partition pruning in Spark 3.x?",
        "How do you profile a Spark job using the Spark UI SQL tab?",
        "What is Kryo serialization and when should you enable it over Java serialization?",
        "How does Spark handle skewed joins with salting — walk through the implementation?",
        "What is speculative execution and when does it help vs hurt?",
        "How does spark.executor.memoryOverhead differ from spark.executor.memory?",
        "What is the shuffle service and why is it needed for dynamic allocation?"
      ],
      decisions: [
        "repartition vs coalesce — when do you pay the shuffle cost for balance?",
        "When do you broadcast a join vs rely on AQE to decide?",
        "cache() vs persist(DISK_ONLY) vs checkpoint — when does each win?"
      ],
      quickRef: [
        "How many shuffles does groupBy().agg() trigger?",
        "What is the default for spark.sql.shuffle.partitions?",
        "What is autoBroadcastJoinThreshold default?",
        "What is a stage boundary?",
        "Does coalesce() always avoid a shuffle?",
        "What is a narrow transformation?",
        "What is a wide transformation?",
        "What does repartition(N, col) do?",
        "What does AQE stand for?",
        "What is the difference between storage and execution memory in Spark?"
      ],
      redFlags: [
        {
          junior: "\"I leave shuffle.partitions at 200 — that's the default.\"",
          senior: "\"200 is wrong for most workloads. I target 100-200 MB per partition and tune accordingly, or let AQE coalesce at runtime.\""
        },
        {
          junior: "\"Broadcast join is always better.\"",
          senior: "\"Broadcast eliminates the large-side shuffle but requires the small side to fit in all executor heaps — multi-GB broadcasts OOM the cluster.\""
        },
        {
          junior: "\"I cache everything before joins.\"",
          senior: "\"I cache only DataFrames reused in multiple actions — caching before a join that runs once wastes memory the shuffle operation needs.\""
        },
        {
          junior: "\"coalesce(1) gives me one clean output file.\"",
          senior: "\"coalesce(1) serializes all writes through one task. I use coalesce(N) with N sized for 128-512 MB output files.\""
        },
        {
          junior: "\"groupBy and join are both just 'transformations' — same cost.\"",
          senior: "\"groupBy and join are wide transformations that trigger shuffles and stage boundaries — qualitatively different cost from narrow transforms like filter or select.\""
        },
        {
          junior: "\"I put all my filters at the end for clarity.\"",
          senior: "\"I push filters before wide transforms — smaller shuffle volume means faster stages.\""
        }
      ],
      checklist: [
        "Explain narrow vs wide transformations and what triggers a shuffle",
        "Know the sort-merge vs broadcast join decision tree by memory size",
        "Be ready to explain spark.sql.shuffle.partitions and how to tune it",
        "Understand repartition vs coalesce trade-offs",
        "Know the cache/persist storage levels and the reuse rule",
        "Be able to explain what AQE does at a high level"
      ],
      behavioral: [
        "Describe a Spark job you tuned — what was the bottleneck and how did you find it?",
        "Tell me about a join optimization you made in Spark.",
        "How do you validate that a Spark pipeline produces correct output at scale?"
      ],
      reverse: [
        "What Spark version are you running — is AQE enabled by default?",
        "Do you manage shuffle partition count manually or rely on AQE?",
        "How large are the typical fact tables joined in your Spark jobs?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR — Data skew + AQE, memory tuning/OOM, Spark UI, Catalyst/Tungsten,
  //           repartition vs coalesce deep, production debugging
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
          "Your Spark job has one task that takes 10x longer than all others. Walk me through diagnosing and fixing it.",
        code: [
          {
            lang: "pyspark",
            label: "Find the hot key",
            lines: [
              "from pyspark.sql import functions as F",
              "(big.groupBy('key').count()",
              "  .orderBy(F.desc('count'))",
              "  .show(5))   # null/mega-tenant?",
            ],
          },
          {
            lang: "pyspark",
            label: "Salt the join (or let AQE)",
            lines: [
              "spark.conf.set(",
              " 'spark.sql.adaptive.skewJoin.enabled',",
              " True)   # AQE auto-splits",
              "# or salt manually:",
              "b = big.withColumn('s',",
              "  (F.rand()*10).cast('int'))",
            ],
          },
        ],
        answerStructured:
          "- **Diagnosis — Spark UI first**: in the Stage Detail, look at the task timeline. If one or a few tasks have dramatically longer duration and/or much higher shuffle read/records than the median, that is **data skew**. Check 'Shuffle Read Size' distribution — a skewed task shows GB while others show MB.\n- **Identify the hot key**: `df.groupBy('join_key').count().orderBy(desc('count')).show(20)` — a single value dominating (e.g., null, a mega-tenant ID) is the culprit.\n- **Fix option 1 — Broadcast**: if the smaller side of the join is small enough (<100-200 MB), broadcast it. The large side never shuffles; skew becomes irrelevant.\n- **Fix option 2 — Salting**: append a random integer suffix (0 to N-1) to the join key on the large side; replicate the small side N times with each suffix. Now the hot key is spread across N tasks.\n- **Fix option 3 — AQE Skew Join**: with `spark.sql.adaptive.skewJoin.enabled=true` (default in Spark 3.2+), AQE automatically splits oversized shuffle partitions at runtime. Zero code changes.\n- **Fix option 4 — Isolate the hot key**: filter the hot key out, process it separately with a broadcast or special logic, then UNION back. Maximum control, more code.",
        explanationDeep:
          "Skew is the single most common cause of Spark job SLA failures. The mechanism: Spark assigns work by partition. A skewed join key (e.g., user_id='null' representing all anonymous sessions) routes millions of rows into one partition and therefore one task on one executor. The stage cannot complete until that task finishes — it gates the entire job.\n\nSalting implementation in code:\n```python\nN = 10\n# Large side: append random salt\nlarge = large_df.withColumn('salt', (rand() * N).cast('int'))\nlarge = large.withColumn('salted_key', concat('join_key', lit('_'), 'salt'))\n# Small side: replicate with all salt values\nsmall = small_df.withColumn('salt', explode(array([lit(i) for i in range(N)])))\nsmall = small.withColumn('salted_key', concat('join_key', lit('_'), 'salt'))\n# Join on salted key\nresult = large.join(small, 'salted_key')\n```\nThe hot key is now spread across N tasks. Each task processes 1/N of the large side matched against 1 copy of the small side.\n\nAQE skew join detection: Spark marks a partition as skewed if it is larger than `spark.sql.adaptive.skewJoin.skewedPartitionFactor` (default: 5x) times the median partition size AND larger than `spark.sql.adaptive.skewJoin.skewedPartitionThresholdInBytes` (default: 256 MB). It then splits the skewed partition and duplicates the corresponding small-side partition to complete the join without code changes.\n\nThe null key trap: nulls on a join key all hash to the same partition. A table with 10% nulls in the join column routes 10% of rows to one task. Fix: filter nulls out before the join, or coalesce them separately.",
        interviewerLens:
          "The word 'skew' should come out immediately when you see 'one long task.' I'm then watching your debugging path: Spark UI → shuffle read distribution → key distribution query. Candidates who jump to 'add more executors' have never owned a skewed job — cores don't help if one task is the bottleneck. Salting implementation details (replicate small side, salt large side) show you've actually written the fix. Mentioning null keys as a common culprit is production experience.",
        followupChain: [
          {
            question: "How does AQE skew join handling work under the hood?",
            answer: "AQE monitors shuffle write sizes per partition after the map phase. If a partition exceeds the skew threshold (5x median and >256 MB by default), it splits that partition into multiple tasks and duplicates the corresponding opposite-side partition to serve each split. The result is the same as manual salting but applied dynamically without code changes. Limitation: AQE only detects skew in sort-merge joins, not broadcast joins (which have no shuffle to measure)."
          },
          {
            question: "When does salting fail or make things worse?",
            answer: "Salting fails when you also need global aggregation on the original key. For example, if you salt user_id to spread the join, and then need a COUNT DISTINCT of user_id globally, you must aggregate across all salt values for each original key — an extra step. It also increases shuffle volume by N times on the small side (you replicated it N times). For very large small sides, this trade-off may not pay."
          },
          {
            question: "What if the skew is in a groupBy, not a join?",
            answer: "For groupBy skew, salting + partial aggregation is the pattern: add salt, groupBy(key + salt) to aggregate locally, then groupBy(original_key) again to merge. This is essentially a two-phase aggregation that pre-reduces within each salt group. AQE handles this automatically for shuffle-based aggregations in Spark 3.0+."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd add more executors or increase executor memory.\"",
            senior: "\"One long task is skew — more executors don't help because the bottleneck is one partition. I'd confirm in the Spark UI, identify the hot key, and use broadcast/salting/AQE to spread the work.\""
          },
          {
            junior: "\"I'd increase spark.sql.shuffle.partitions to fix it.\"",
            senior: "\"More partitions don't help skew — the hot key always routes all its rows to one partition regardless of partition count. The fix is salting or AQE skew join.\""
          }
        ],
        alternatePhrasings: [
          "\"What is data skew and how do you fix it in Spark?\"",
          "\"Your join has a long tail — diagnose it.\"",
          "\"How does AQE handle data skew?\""
        ],
        interviewContexts: [
          "Asked at senior data engineering loops at 4 separate companies",
          "Databricks senior DE interview",
          "FAANG-adjacent data platform senior loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 27,
        questionText:
          "Walk me through diagnosing and fixing an executor OOM in a Spark job.",
        answerStructured:
          "- **Distinguish driver OOM from executor OOM**: executor OOM appears in task error logs as `java.lang.OutOfMemoryError: Java heap space` or `GC overhead limit exceeded` in the Stage/Task UI. Driver OOM usually appears in the driver log and kills the whole application immediately.\n- **Common executor OOM causes**:\n  1. **Data skew**: one partition is enormous — that task's memory pressure far exceeds others\n  2. **Too few partitions**: each partition is too large (e.g., spark.sql.shuffle.partitions=10 on a 1 TB shuffle → 100 GB/partition)\n  3. **Caching too much**: cached DataFrames crowd out execution memory\n  4. **Python UDF overhead**: each row deserialized from JVM to Python and back — memory pressure from two runtimes\n  5. **Broadcast too large**: broadcasting a multi-GB table overloads executor heap\n- **Fixes**:\n  - Increase partitions (more tasks, less data per task)\n  - Increase `spark.executor.memory` (add heap) or `spark.executor.memoryOverhead` (for off-heap/Python overhead)\n  - Fix skew (salting/AQE) — biggest skewed partition is the OOM culprit\n  - Switch `spark.memory.fraction` (default 0.6) and `spark.memory.storageFraction` (default 0.5 of that) if storage is crowding execution\n  - Replace Python UDFs with SQL functions or pandas UDFs\n  - Enable G1GC for large heaps (`-XX:+UseG1GC`)",
        explanationDeep:
          "Spark's unified memory model (since Spark 1.6) allocates a single heap pool shared between execution (shuffles, sorts, joins) and storage (cached DataFrames). The execution and storage regions borrow from each other dynamically, bounded by spark.memory.fraction (default 0.6 of the executor heap) — leaving 0.4 as reserved + user memory.\n\nOOM root causes map to memory regions:\n- Execution OOM: a shuffle partition is too large to sort or hash in memory. Fix: increase partitions, increase execution memory by reducing storage usage.\n- Storage OOM: too many cached DataFrames. Fix: unpersist unused DataFrames, switch to DISK_ONLY storage level.\n- Off-heap OOM (memoryOverhead): used for Python processes, shuffle service metadata, JVM overhead. Fix: increase spark.executor.memoryOverhead (default: max(384 MB, 10% of executor.memory)).\n\nDebugging sequence: (1) Find the failing task in the Spark UI. (2) Check its shuffle read size vs the median — confirms skew. (3) Check GC time % — high GC means heap pressure from large objects. (4) Look at spill metrics — spill to local/remote disk means execution memory is exhausted. (5) Check storage tab — cached DataFrames consuming most of heap.\n\nFor Python-heavy pipelines: each Python executor process has its own memory outside the JVM. A pandas UDF that loads a large dataframe fragment can OOM the Python process, not the JVM. This appears as a worker process death, not a JVM OOM — check `stderr` logs, not the Spark UI task detail.",
        interviewerLens:
          "I want the driver-vs-executor OOM distinction first — they have different causes and remedies. Then I want at least two specific root causes, not a generic 'add more memory.' The unified memory model (execution vs storage fraction) shows deep architectural knowledge. If you mention memoryOverhead for Python processes specifically, I know you've debugged PySpark OOM in production. The spill → execution memory exhaustion connection is the signal that you read Spark UI metrics rather than just tuning blindly.",
        followupChain: [
          {
            question: "What does GC time % in the Spark UI tell you?",
            answer: "GC time % > 5-10% of task duration signals that the JVM is spending excessive time on garbage collection — meaning the heap is under pressure. Causes: objects are being created and discarded faster than GC can collect them (e.g., many small Row objects), or the heap is nearly full and GC runs frequently. Fix: reduce object creation (use binary formats via Tungsten instead of Java objects), or increase heap size."
          },
          {
            question: "What is spark.executor.memoryOverhead and when do you tune it?",
            answer: "memoryOverhead is additional memory allocated to the executor process outside the JVM heap — used for Python processes, JVM off-heap buffers, OS overhead, and the shuffle service. Default: max(384 MB, 10% of spark.executor.memory). Increase it when: using PySpark with heavy pandas operations (Python process grows), running on Kubernetes where the container limit must include overhead, or seeing container killed / OOM killer events rather than JVM OOM errors."
          },
          {
            question: "What is the difference between spill to local disk and spill to remote storage?",
            answer: "Local disk spill: execution memory is exhausted; Spark writes intermediate data (shuffle buffers, sort runs) to the executor's local disk. Slow but manageable. Remote storage spill (in older Spark versions): local disk is also exhausted; data spills to HDFS/S3. Catastrophically slow — network I/O on every read. Modern Spark on cloud clusters rarely hits remote spill; fix local spill by increasing partitions or executor memory."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just increase spark.executor.memory.\"",
            senior: "\"Before increasing memory, I'd identify whether it's skew (one huge partition), too-large partitions globally, caching pressure, or Python overhead — each has a different fix.\""
          },
          {
            junior: "\"OOM means I need a bigger cluster.\"",
            senior: "\"OOM is usually a data distribution or configuration problem — more machines don't fix skew or misconfigured shuffle partitions. I diagnose the root cause in the Spark UI first.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you fix an OOM error in Spark?\"",
          "\"Walk me through Spark's memory model.\"",
          "\"What is spark.executor.memoryOverhead?\""
        ],
        interviewContexts: [
          "Senior Spark optimization interview at a big-data platform company",
          "Databricks senior data engineering loop",
          "Asked at a streaming infrastructure senior role at a fintech"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 24,
        questionText:
          "How do you use the Spark UI to diagnose a slow or failing job? Walk me through what you look at.",
        answerStructured:
          "- **Jobs tab**: see all jobs, their stages, and success/failure status. Find the slow job by duration. Click in to see its stages.\n- **Stages tab**: the critical view. For each stage, look at:\n  - **Duration distribution** across tasks — a long tail signals skew\n  - **Shuffle Read/Write size** — large values mean expensive shuffles; high variance signals skew\n  - **GC time** — high GC % means memory pressure\n  - **Spill (Memory/Disk)** — any spill means execution memory is exhausted; disk spill is survivable, remote spill is catastrophic\n  - **Task failure count** — repeated task failures indicate OOM or disk-full issues\n- **SQL tab**: query plan as a DAG with operator-level metrics. Look for:\n  - Operators with unexpectedly high row counts (join fanout, exploded data)\n  - `SortMergeJoin` vs `BroadcastHashJoin` — confirm the join strategy matches expectations\n  - `InMemoryRelation` — confirms a cache hit\n  - Exchange nodes — each is a shuffle stage\n- **Storage tab**: cached DataFrames and their memory footprint. High storage usage crowding execution memory.\n- **Executors tab**: per-executor GC time, task count, input/output size. Uneven task distribution = skew or bad partitioning.",
        explanationDeep:
          "The Spark UI is the primary debugging tool — not log files, not guessing. A disciplined debugging sequence prevents wasted time on wrong hypotheses.\n\nFor a slow job: start at the Jobs tab, find the slowest stage. In Stage Detail, the task duration histogram reveals everything. A bimodal distribution (most tasks finish in 2s, one task takes 2 minutes) is a textbook skew signature. Look at that outlier task's shuffle read size — if it's 100x the median, the skew is in the shuffle key.\n\nFor an OOM: the failing task appears in red in the Stage Detail. Check its shuffle read size (too large → partition too big) and GC time (high → memory pressure). The Executor tab shows if one executor is doing disproportionate work (skew routes to one executor). The Storage tab shows if cached DataFrames are consuming execution memory.\n\nThe SQL tab's physical plan shows the join algorithm selected. If you expected a BroadcastHashJoin and see a SortMergeJoin, Spark estimated the table above the broadcast threshold — either the estimate was wrong (use AQE or a broadcast hint), or the table really is large (reconsider the strategy). Exchange nodes in the plan correspond exactly to shuffle stages — counting them tells you how many shuffles the query executes.\n\nThe GC timeline (available per-executor in the Executors tab) shows GC events over time. A sawtooth pattern with major GC spikes during large joins indicates the heap is nearly full and GC is thrashing — time to increase executor memory or reduce partition size.",
        interviewerLens:
          "I want a structured walkthrough: Jobs → Stages → task distribution → shuffle metrics → GC → spill → SQL plan. Candidates who say 'I check the logs' are not fluent with the UI. The join algorithm verification (looking for BroadcastHashJoin vs SortMergeJoin in the SQL tab) shows you validate Spark's decisions rather than assuming they're correct. Spill metrics and GC time named specifically — not just 'memory' generically — is the senior differentiator.",
        followupChain: [
          {
            question: "What does 'Input Size / Records' in a stage tell you about partitioning quality?",
            answer: "High variance in input size across tasks means unbalanced partitions — some tasks process far more data than others. Ideally, input size per task should be within 2-3x of the median. If one task shows 10 GB and others show 100 MB, that's a skew signal. The fix depends on whether it's input partition skew (repartition before the stage) or join key skew (salting/AQE)."
          },
          {
            question: "What is the 'Exchange' operator in the SQL tab?",
            answer: "Exchange represents a shuffle — data is re-partitioned across executors. Each Exchange in the physical plan corresponds to a stage boundary. You can see the exact partitioning strategy (HashPartitioning for groupBy/join, RangePartitioning for orderBy, RoundRobinPartitioning for repartition) and the number of output partitions. Counting Exchanges tells you the shuffle count; their position tells you where in the plan the shuffles occur."
          }
        ],
        redFlags: [
          {
            junior: "\"I check the logs for ERROR messages.\"",
            senior: "\"I start at the Spark UI: Jobs tab for the slow stage, Stage Detail for task distribution and shuffle metrics, SQL tab for the physical plan and join strategies.\""
          },
          {
            junior: "\"I re-run the job with more memory and see if it works.\"",
            senior: "\"Blind resource increases waste money and time. I diagnose with the Spark UI — spill metrics tell me if memory is the issue; task duration distribution tells me if it's skew.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you debug a slow Spark job?\"",
          "\"What do you look at in the Spark UI?\"",
          "\"How do you tell if a Spark job has data skew?\""
        ],
        interviewContexts: [
          "Senior DE interview at a data platform company",
          "Spark operations round at a cloud analytics company",
          "Asked during a debugging exercise at a FAANG-adjacent data engineering loop"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 19,
        questionText:
          "Explain the Catalyst optimizer and Tungsten engine — what do they each optimize?",
        answerStructured:
          "- **Catalyst** is Spark's **query optimizer** — it works on the *logical plan* of a DataFrame/SQL query:\n  1. **Analysis**: resolves column names and types against the catalog\n  2. **Logical Optimization**: applies rule-based rewrites — predicate pushdown (move filters before joins), column pruning (drop unreferenced columns), constant folding (compute 1+1=2 at plan time), join reordering\n  3. **Physical Planning**: selects join algorithms (SMJ vs BHJ), partition strategies, and generates one or more physical plans; cost-based optimizer picks the best\n  4. **Code Generation**: Catalyst generates Java bytecode for the physical plan using Whole-Stage Code Generation\n- **Tungsten** is Spark's **execution engine** — it optimizes *how code runs*:\n  - **Off-heap memory management**: stores data in compact binary format (UnsafeRow) outside the JVM heap, reducing GC pressure\n  - **Whole-Stage Code Generation (WSCG)**: compiles a chain of operators into a single optimized Java function — eliminates virtual function dispatch and interpreted expression evaluation\n  - **Cache-aware computation**: column-oriented data layout improves CPU cache utilization\n- Together: Catalyst rewrites *what* to execute; Tungsten optimizes *how* to execute it.",
        explanationDeep:
          "Before Catalyst, Spark users had to manually chain operations to avoid redundant scans, manually prune columns, and manually choose join algorithms. Catalyst automates these through a rule engine operating on tree-structured query plans. Each optimization rule is a pattern-match-and-transform: 'if I see a Filter node followed by a Scan, push the Filter into the Scan.' Hundreds of such rules compose into a powerful optimizer.\n\nThe most impactful Catalyst rules in practice: predicate pushdown (filters applied at data source, before bytes cross the network), column pruning (Parquet reads only referenced columns), and join elimination (trivial joins on unique keys removed entirely). These can reduce I/O by orders of magnitude without user intervention.\n\nTungsten addresses the CPU and memory efficiency problem that Catalyst doesn't touch. Traditional Spark stored data as JVM objects (Java HashMap, ArrayList of Row objects) — creating massive GC pressure and poor cache performance. Tungsten's UnsafeRow format stores data in compact binary off-heap memory. WSCG compiles operator chains into tight loops — instead of calling `filter.eval(row)`, `project.eval(row)`, etc., as separate virtual function calls, the entire pipeline is one native function that a modern JIT compiler can optimize to near-C performance.\n\nFor interviewers: the practical impact of understanding Catalyst is knowing what Spark can optimize for you (column pruning, filter pushdown) vs what it cannot (opaque Python UDFs, non-equi joins defeating hash strategies). Knowing Tungsten explains why Python UDFs bypass the performance model — they exit the UnsafeRow binary world and pay serialization cost.",
        interviewerLens:
          "I want Catalyst separated from Tungsten conceptually: Catalyst = logical plan rewriting; Tungsten = execution efficiency. If you can name Whole-Stage Code Generation and explain why Python UDFs bypass Tungsten's performance model, I know you've internalized the architecture. The four Catalyst phases (analysis, logical opt, physical planning, codegen) named in order is a senior signal. Predicate pushdown and column pruning as concrete examples show you know the practical impact, not just the theory.",
        followupChain: [
          {
            question: "Why do Python UDFs hurt performance so much in Spark?",
            answer: "Python UDFs exit Tungsten's binary UnsafeRow world. Each row must be serialized from JVM binary format into Python objects (via Py4J or Arrow), the Python function runs, and the result is serialized back to JVM binary format. This serialization overhead is 10-100x the cost of an equivalent native SQL function. The fix: use pyspark.sql.functions equivalents first; use pandas UDFs (Arrow-based batch transfer) second — pandas UDFs transfer batches as Arrow columns, amortizing the serialization cost."
          },
          {
            question: "What is predicate pushdown and when does it fail?",
            answer: "Predicate pushdown moves filter conditions as close to the data source as possible — ideally into the Parquet/JDBC reader before any bytes cross the network. It fails when: (1) the filter is on a computed column not in the source, (2) the data source doesn't support filter pushdown (some JDBC drivers have limited pushdown support), (3) the filter condition is in a Python UDF (opaque to Catalyst). Check the SQL tab physical plan for 'PushedFilters' annotation on Scan nodes."
          }
        ],
        redFlags: [
          {
            junior: "\"Catalyst just optimizes queries automatically, I don't need to know how.\"",
            senior: "\"Catalyst's optimization rules are powerful but have limits — Python UDFs bypass them, and non-equi joins can prevent hash strategies. Knowing what Catalyst can and can't do determines how you write your code.\""
          },
          {
            junior: "\"Tungsten is just a performance improvement in the background.\"",
            senior: "\"Tungsten's off-heap binary format and whole-stage code generation are why DataFrames with SQL functions massively outperform equivalent Python UDF pipelines — the Python UDF exits Tungsten's execution model.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the Catalyst optimizer?\"",
          "\"What does Project Tungsten do?\"",
          "\"Why is using Python UDFs slow in Spark?\""
        ],
        interviewContexts: [
          "Senior Spark architecture question at a Databricks-heavy data platform",
          "Asked in a Spark internals deep-dive at a senior DE loop",
          "Databricks architect interview question"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 23,
        questionText:
          "How do you approach memory tuning for a Spark job that is spilling or OOMing?",
        code: [
          {
            lang: "pyspark",
            label: "Partition-first, then memory",
            lines: [
              "# global spill: more partitions",
              "spark.conf.set(",
              "  'spark.sql.shuffle.partitions', 800)",
              "# Kryo shrinks shuffle 2-5x",
              "spark.conf.set('spark.serializer',",
              "  'org.apache.spark.serializer'",
              "  '.KryoSerializer')",
            ],
          },
        ],
        answerStructured:
          "- **Step 1 — Diagnose in the Spark UI**: spill metrics in Stage Detail indicate execution memory exhaustion. GC time % > 10% signals heap pressure. Executor OOM error in task logs confirms it.\n- **Step 2 — Rule out skew first**: if one task spills and others don't, it's data skew — fix with salting or AQE, not with memory increases.\n- **Step 3 — If global spill (all tasks), tune partition count**: increase `spark.sql.shuffle.partitions` to create smaller partitions. Target 100-200 MB per partition. Smaller partitions = less data per task = less execution memory needed.\n- **Step 4 — Increase executor memory if needed**:\n  - `spark.executor.memory`: JVM heap. Default varies by deployment. Target: enough that 60% (spark.memory.fraction) × allocated = fits your largest partition.\n  - `spark.executor.memoryOverhead`: off-heap (Python, JVM overhead, shuffle service). Increase for PySpark-heavy jobs.\n- **Step 5 — Tune memory fractions** (rarely needed, last resort):\n  - `spark.memory.fraction` (default 0.6): the fraction of executor heap available for Spark (execution + storage). Reserve 0.4 for user data and overhead.\n  - `spark.memory.storageFraction` (default 0.5 of spark.memory.fraction): the minimum fraction reserved for caching; execution can borrow above this. Reduce if you're using minimal caching and need more execution memory.\n- **Step 6 — Serialize efficiently**: enable Kryo serialization (`spark.serializer=org.apache.spark.serializer.KryoSerializer`) — 2-5x smaller than Java serialization for shuffle data.",
        explanationDeep:
          "The unified memory model means execution (joins, sorts, aggregations) and storage (caching) share a single pool and borrow from each other. The pool is spark.memory.fraction × executor.memory. Outside that pool is 'user memory' (your Python objects, UDF overhead) and reserved memory (300 MB Spark internal minimum).\n\nThe most common tuning mistake is increasing executor.memory as a first move. 90% of the time, the right fix is increasing partitions — not adding memory. A 1 TB shuffle with 200 partitions means 5 GB per partition. Each 5 GB partition must be sorted in memory for a sort-merge join. Increase to 5000 partitions → 200 MB per partition → trivially fits. The cluster doesn't get bigger; each task just processes less.\n\nThe memory fraction levers (spark.memory.fraction, spark.memory.storageFraction) are genuinely a last resort. Modifying them is fragile — too little user memory causes Python OOM that doesn't show as a JVM OOM; too little storage fraction causes cache eviction and recomputation. Only touch these after partition tuning has been maxed out.\n\nFor PySpark: the Python process runs alongside the JVM executor, in its own memory space controlled by `spark.executor.memoryOverhead`. When a pandas UDF allocates a large DataFrame fragment, that memory is in the Python process, not the JVM heap. An OOM here appears as a worker process killed message, not a Java heap OOM — a diagnostic trap for engineers who only check Spark task logs.",
        interviewerLens:
          "The sequence matters: diagnose → rule out skew → increase partitions → then consider memory increase. Engineers who jump to memory increase first don't understand that partition tuning is almost always the right fix and is free (no extra machines). The spark.memory.fraction and storageFraction parameters should be mentioned but with the caveat that they're last-resort levers. Kryo serialization mention is a practical detail I appreciate in a senior candidate.",
        followupChain: [
          {
            question: "What is the reserved memory in Spark's memory model?",
            answer: "Spark reserves 300 MB of executor heap as a baseline minimum for Spark internal objects. This comes out before spark.memory.fraction is applied. So on an executor with 1 GB heap: (1000-300) × 0.6 = 420 MB for Spark execution+storage; the remaining 280 MB is user memory. On small executors, this 300 MB floor is significant — one reason very small executors (< 2 GB) are inefficient."
          },
          {
            question: "What is dynamic resource allocation and when is it useful?",
            answer: "Dynamic allocation (spark.dynamicAllocation.enabled) allows Spark to request additional executors from the cluster manager when tasks are queued and release idle executors when workload drops. Useful for shared clusters where you don't want to hold executors idle between stages. Requires an external shuffle service (so shuffle data persists after executors are released). Not appropriate when shuffle service is unavailable or when latency of acquiring new executors is unacceptable."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd double the executor memory to fix the OOM.\"",
            senior: "\"First I'd check if it's skew (one task spills) or global (all tasks spill). Global spill usually means partitions are too large — increase shuffle partitions. Only after partition tuning would I consider increasing executor.memory.\""
          },
          {
            junior: "\"I'd tune spark.memory.fraction to fix memory issues.\"",
            senior: "\"spark.memory.fraction is a last resort — touching it is fragile. The right first moves are partition tuning, skew fixes, and increasing executor.memory when genuinely needed.\""
          }
        ],
        alternatePhrasings: [
          "\"How does Spark's memory model work?\"",
          "\"What is spark.memory.fraction?\"",
          "\"How do you tune executor memory for a Spark job?\""
        ],
        interviewContexts: [
          "Senior Spark performance interview at a data infrastructure company",
          "Databricks senior engineer loop — memory and resource optimization round"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Catalyst Optimizer", "Tungsten Execution Engine"],
        asked: 16,
        questionText:
          "Catalyst vs Tungsten — what does each one optimize, and what can each not fix?",
        answerStructured:
          "- **Catalyst** (query planner): optimizes *what* Spark executes\n  - What it fixes: redundant scans (predicate pushdown), unnecessary column reads (column pruning), bad join ordering, inefficient aggregation plans\n  - What it cannot fix: opaque Python UDFs (black box to Catalyst), non-equi join conditions (prevents hash strategies), user-introduced data skew, bad physical I/O (small files, unpartitioned reads)\n- **Tungsten** (execution engine): optimizes *how* Spark executes\n  - What it fixes: JVM GC pressure (off-heap UnsafeRow binary storage), interpreter overhead (WSCG compiles operator chains to native functions), CPU cache misses (columnar memory layout)\n  - What it cannot fix: network I/O (shuffle traffic is fundamentally a distributed communication problem), disk spill (once execution memory is exhausted, spill is inevitable regardless of format), bad query plans (that's Catalyst's domain)\n- **Together**: Catalyst selects an efficient plan → Tungsten executes it efficiently. A bad plan executed efficiently (Tungsten) is still slow. An efficient plan executed inefficiently (no Tungsten) is still slow. Both layers matter.\n- **User impact**: Python UDFs break both. They're opaque to Catalyst (no optimization) and exit UnsafeRow (pay serialization cost). Use SQL functions and pandas UDFs to stay in both optimization layers.",
        explanationDeep:
          "The Catalyst/Tungsten division is planning vs execution. Catalyst is a rule-and-cost-based compiler for query plans. Tungsten is a runtime that executes those plans as efficiently as the hardware allows.\n\nCatalyst's most impactful rules from a user perspective: predicate pushdown (applied at data source, not post-scan), column pruning (Parquet skips unneeded columns at byte level), and join reordering (smaller table first). These reduce bytes processed — the most impactful optimization level. Tungsten then makes whatever bytes are processed fly through the CPU as fast as possible.\n\nThe WSCG optimization in Tungsten is conceptually important: traditional query engines process one operator at a time, calling virtual methods (filter.eval, project.eval, aggregate.eval) on each row. This incurs virtual function dispatch overhead and poor CPU branch prediction. WSCG compiles the entire operator chain into a single tight loop that a JIT compiler can further optimize — eliminating the per-operator overhead entirely. Benchmark results show 2-10x improvement on CPU-bound queries.\n\nWhat neither can fix: network I/O from shuffles, disk I/O from spill, and I/O from reading poorly structured data (many small files, unpartitioned scans). These are architectural choices in how data is stored and how jobs are designed — no query optimizer or execution engine overcomes fundamental I/O constraints.",
        interviewerLens:
          "The distinction I want is clean: Catalyst = what, Tungsten = how. Naming what each one cannot fix is the senior differentiator — most candidates know vaguely what they do, few know their limits. The Python UDF breaking both layers is the concrete example that shows you've thought about API design. 'Network I/O is not Tungsten's domain' shows systems-level thinking.",
        followupChain: [
          {
            question: "What is Whole-Stage Code Generation and how does it improve performance?",
            answer: "WSCG compiles a chain of Spark operators (filter, project, aggregate) into a single Java function at runtime. This eliminates virtual function dispatch between operators, allows the JIT compiler to inline and optimize the full chain, and enables CPU-register-based computation rather than object heap allocation. Benchmark: a simple filter+aggregate on 1B rows runs 3-5x faster with WSCG than without. You can see which operators have WSCG applied in the SQL tab — operators in a 'WholeStageCodegen' block are fused."
          }
        ],
        redFlags: [
          {
            junior: "\"Catalyst and Tungsten both make Spark faster — they're basically the same thing.\"",
            senior: "\"Catalyst optimizes the query plan (what to execute); Tungsten optimizes the runtime execution (how to execute it). A bad plan executed fast is still slow; a good plan executed inefficiently is still slow. They're complementary, not redundant.\""
          }
        ],
        alternatePhrasings: [
          "\"How does Spark's query optimization work?\"",
          "\"What is Project Tungsten?\"",
          "\"Why is Spark faster than MapReduce?\""
        ],
        interviewContexts: [
          "Senior Spark architecture deep-dive at a Databricks-heavy shop",
          "Asked at a principal data engineer interview at a tech company"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How does AQE dynamically adjust the number of shuffle partitions at runtime?",
        "Walk through implementing salting for a severely skewed join key — show the PySpark code.",
        "How do you implement two-phase aggregation for a skewed groupBy?",
        "What is the role of the external shuffle service and when is it required?",
        "How do you diagnose and fix a driver OOM — what are the common causes?",
        "Explain bucketing in Spark: setup, use cases, and when it fails to help.",
        "How does Spark's structured streaming guarantee exactly-once processing?",
        "What is dynamic partition pruning in Spark 3.x and how does it improve join performance?",
        "How do you profile and optimize a Spark pipeline running on Databricks?",
        "What are the failure modes of Adaptive Query Execution — when does AQE make wrong decisions?"
      ],
      decisions: [
        "Salting vs AQE skew join vs broadcast — which skew fix do you choose and why?",
        "When do you use repartition(N, col) vs bucketing for join optimization?",
        "When is manually setting spark.sql.shuffle.partitions better than relying on AQE auto-coalescing?"
      ],
      quickRef: [
        "What is spark.memory.fraction?",
        "What is spark.executor.memoryOverhead for?",
        "What is AQE's skew join threshold (default)?",
        "What is Whole-Stage Code Generation?",
        "What does predicate pushdown do in Catalyst?",
        "What is an Exchange node in the SQL plan?",
        "What does spark.sql.adaptive.enabled turn on?",
        "What is UnsafeRow in Tungsten?",
        "What is the external shuffle service?",
        "What does 'GC time %' in the Spark UI indicate?"
      ],
      redFlags: [
        {
          junior: "\"I'd add more executors when a job is slow.\"",
          senior: "\"More executors don't help skew — one task is still the bottleneck. I diagnose in the Spark UI first: task duration distribution, shuffle metrics, GC time.\""
        },
        {
          junior: "\"I set shuffle.partitions to 2000 to be safe.\"",
          senior: "\"2000 arbitrary partitions is often wrong — I calculate: target shuffle output / 150 MB = partition count. Or enable AQE and let it auto-coalesce.\""
        },
        {
          junior: "\"OOM means I need to increase memory.\"",
          senior: "\"OOM is usually over-large partitions or skew — partition tuning is free and fixes 80% of cases before I reach for memory increases.\""
        }
      ],
      checklist: [
        "Walk through skew diagnosis: Spark UI → shuffle distribution → hot key query",
        "Explain the full salting implementation in PySpark",
        "Know the Spark unified memory model: fractions, execution vs storage, overhead",
        "Be able to walk through the Catalyst 4-phase optimization pipeline",
        "Explain Tungsten: off-heap binary, WSCG, and what Python UDFs break",
        "Read the SQL tab physical plan: identify joins, exchanges, and pushed filters"
      ],
      behavioral: [
        "Tell me about the most severe Spark OOM you debugged — root cause and fix.",
        "Describe a data skew problem you solved — how did you detect it and what did you do?",
        "Walk me through a time you significantly improved the performance of a Spark pipeline."
      ],
      reverse: [
        "Is AQE enabled by default in your Spark environment? Are you on Spark 3.2+?",
        "What's the most severe skew problem your team has hit and how did you resolve it?",
        "Do you use Databricks Photon, or classic Spark execution?"
      ]
    }
  }
};
