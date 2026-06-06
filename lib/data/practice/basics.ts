import type { ConvItem } from "./types";

/**
 * Basics track — "teach it back" concept explanations ("what is Snowflake / git /
 * a vector DB / a partition?"). Mode "text"; the AI grades the candidate's own
 * explanation (the Feynman technique forces understanding before building).
 * approachGate is off (the explanation IS the answer). Authored via gen_conv.py.
 *
 * Sources used (researched 2025–2026):
 * - https://docs.snowflake.com/en/user-guide/intro-key-concepts
 * - https://kafka.apache.org/documentation/#intro_concepts_and_terms
 * - https://airflow.apache.org/docs/apache-airflow/stable/core-concepts/dags.html
 * - https://platform.openai.com/tokenizer
 */
export const BASICS_ITEMS: ConvItem[] = [
  {
    id: "bx-001",
    category: "basics",
    level: "junior",
    title: "What is Snowflake?",
    company: "Fundamentals",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain, in your own words, what Snowflake is and why a team would use it instead of a traditional database. Pretend you're teaching a new teammate.",
    idealAnswer:
      "Snowflake is a fully managed, cloud-native data warehouse delivered as software-as-a-service — you don't provision or patch any servers. Its defining feature is the multi-cluster, shared-data architecture that separates storage from compute: data lives once in columnar micro-partitions in cloud object storage (S3/GCS/Azure Blob), while independent 'virtual warehouses' (compute clusters) read it. That separation lets you scale storage and compute independently, run many workloads concurrently without contention, and pay per second only for the compute you use. Teams pick it over a traditional database for elastic analytical (OLAP) scale, near-zero administration, and features like time travel and easy data sharing. The common misconception is that it's a transactional (OLTP) database — it isn't; it's optimized for analytics, not high-volume row-level updates.",
    rubric: [
      "Identifies Snowflake as a managed cloud data warehouse / SaaS (no servers to run)",
      "Explains separation of storage and compute as the key architectural idea",
      "Mentions independent virtual warehouses / elastic, pay-for-what-you-use scaling",
      "Frames it as analytical (OLAP), not transactional (OLTP) — the common mistake",
    ],
    hints: [
      "Think about what you no longer have to manage versus a self-hosted database.",
      "Why can two teams run heavy queries at the same time without slowing each other down?",
    ],
  },
  {
    id: "bx-002",
    category: "basics",
    level: "junior",
    title: "What is git, and how is it different from GitHub?",
    company: "Fundamentals",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what git is and how it differs from GitHub, as if onboarding someone who has only ever emailed zip files around.",
    idealAnswer:
      "Git is a distributed version-control system: a command-line tool that tracks changes to files over time as a series of commits, lets many people work in parallel via branches, and lets you merge, revert, or inspect history. 'Distributed' means every clone is a full copy of the repository and its history, so you can commit and view history offline — there is no single required central server. GitHub (like GitLab or Bitbucket) is a hosting platform built around git: it stores a remote copy and adds collaboration features git itself doesn't have — pull requests, code review, issues, CI/CD, and access control. The key distinction people miss: git is the tool/protocol that works without GitHub, while GitHub is one of many websites that host git repositories and layer a workflow on top.",
    rubric: [
      "Defines git as a distributed version-control system that tracks changes via commits",
      "Mentions core git concepts: commits, branches, merging/history",
      "Describes GitHub as a hosting platform/service for git repositories",
      "Makes clear git is the underlying tool and GitHub is optional / one of several hosts",
    ],
    hints: [
      "One is a tool on your machine; the other is a website.",
      "Could you use git with no internet connection at all?",
    ],
  },
  {
    id: "bx-003",
    category: "basics",
    level: "junior",
    title: "Data warehouse vs data lake (vs lakehouse)",
    company: "Fundamentals",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the difference between a data warehouse and a data lake, and what a 'lakehouse' adds. Teach it to a teammate deciding where to put their data.",
    idealAnswer:
      "A data warehouse stores structured, cleaned, modeled data optimized for fast SQL analytics and BI — it's schema-on-write, meaning you define the schema before loading (e.g. Snowflake, BigQuery, Redshift). A data lake stores raw data of any type — structured, semi-structured, or unstructured — cheaply in object storage, applying schema-on-read when you query it (e.g. files on S3); it's flexible and great for data science/ML but can become a disorganized 'data swamp' without governance. A lakehouse combines the two: it keeps data in cheap open-format files in the lake but adds a transactional table layer (Delta Lake, Apache Iceberg, Hudi) that brings ACID transactions, schema enforcement, and warehouse-grade SQL performance directly on the lake — so you get one system for both BI and ML. The common mistake is treating warehouse vs lake as raw-vs-clean only; the deeper differences are schema-on-write vs schema-on-read and structured-only vs any-format.",
    rubric: [
      "Warehouse = structured, modeled, schema-on-write, optimized for SQL/BI",
      "Lake = raw/any-format data, cheap object storage, schema-on-read",
      "Lakehouse = lake storage plus a transactional/ACID table layer (Delta/Iceberg/Hudi) for warehouse-like performance",
      "Names a real trade-off (cost/flexibility vs structure/governance, or the 'data swamp' risk)",
    ],
    hints: [
      "When do you decide the schema — before loading, or when you read?",
      "What does adding ACID transactions to files in a lake give you?",
    ],
  },
  {
    id: "bx-004",
    category: "basics",
    level: "junior",
    title: "ETL vs ELT",
    company: "Fundamentals",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the difference between ETL and ELT and why modern cloud data stacks tend to favor ELT. Teach it back in your own words.",
    idealAnswer:
      "Both move data from sources into a destination; the difference is the order of the Transform step. In ETL (Extract, Transform, Load), you extract from sources, transform/clean/reshape the data on a separate processing engine, and then load the finished result into the warehouse. In ELT (Extract, Load, Transform), you extract and load the raw data into the warehouse first, then transform it in-place using the warehouse's own compute (often with SQL and tools like dbt). Modern cloud stacks favor ELT because cloud warehouses (Snowflake, BigQuery) have cheap, elastic, massively parallel compute, so it's efficient to transform after loading; it also preserves the raw data so you can re-transform later, and shortens the time to get data landed. The common confusion is thinking ELT skips transformation — it doesn't; it just defers it to after the load, inside the warehouse.",
    rubric: [
      "Correctly states ETL transforms before loading, ELT transforms after loading",
      "Explains the transform happens in the warehouse's own compute in ELT",
      "Gives a reason ELT is favored now (cheap elastic cloud compute, raw data preserved, faster landing)",
      "Clarifies ELT still transforms — order changes, not the existence of the step",
    ],
    hints: [
      "The only letters that move are T and L — where does the T happen?",
      "What changed about compute cost that made loading-first attractive?",
    ],
  },
  {
    id: "bx-005",
    category: "basics",
    level: "junior",
    title: "What is a vector database?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what a vector database is and what problem it solves for AI applications. Teach it to a teammate new to AI.",
    idealAnswer:
      "A vector database stores high-dimensional vectors (embeddings) and is built to do fast similarity search — given a query vector, find the stored vectors that are 'closest' by a distance metric like cosine similarity or Euclidean distance. Because exact nearest-neighbor search is too slow at scale, it uses approximate nearest neighbor (ANN) indexes such as HNSW or IVF to trade a little accuracy for huge speed. It solves the problem of searching by meaning/semantic similarity rather than exact keyword matches, which is what powers RAG, semantic search, recommendations, and deduplication. Examples include Pinecone, Weaviate, Milvus, Qdrant, and pgvector. The common misconception is that it 'understands' the data — it only stores numeric vectors and finds nearby ones; the meaning comes from the embedding model that produced the vectors.",
    rubric: [
      "Defines it as a store for embeddings/high-dimensional vectors built for similarity search",
      "Mentions a distance/similarity metric (cosine, Euclidean, dot product)",
      "Notes approximate nearest neighbor (ANN) indexing (e.g. HNSW/IVF) for speed at scale",
      "Connects it to a use case like RAG / semantic search / recommendations",
    ],
    hints: [
      "What kind of 'match' are you looking for — exact text, or similar meaning?",
      "Why can't you just compare the query to every stored item one by one?",
    ],
  },
  {
    id: "bx-006",
    category: "basics",
    level: "junior",
    title: "What is an embedding?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what an embedding is and why embeddings are useful, as if teaching someone who knows basic programming but no ML.",
    idealAnswer:
      "An embedding is a list of numbers (a vector) that represents the meaning of a piece of data — text, an image, audio — in a high-dimensional space, produced by a model trained so that semantically similar things land close together. So the words 'dog' and 'puppy' end up near each other, while 'dog' and 'spreadsheet' are far apart, and you can measure that closeness with a distance metric like cosine similarity. Embeddings are useful because they turn fuzzy human concepts into numbers a computer can compare and compute on, enabling semantic search, clustering, recommendations, classification, and retrieval for RAG. Two things people get wrong: an embedding is not the raw data and not human-readable (it's just coordinates), and the dimensions don't map to tidy human-named features — meaning is distributed across all of them.",
    rubric: [
      "Defines an embedding as a numeric vector representing meaning of data",
      "States that semantically similar items have nearby vectors (and that you measure with a distance/similarity metric)",
      "Explains it's produced by a (trained) model",
      "Gives a use case (semantic search, clustering, recommendations, or RAG retrieval)",
    ],
    hints: [
      "How would you let a computer tell that 'car' and 'automobile' are related?",
      "Think coordinates in space — what does 'close together' mean there?",
    ],
  },
  {
    id: "bx-007",
    category: "basics",
    level: "junior",
    title: "What is RAG?",
    company: "Fundamentals",
    difficulty: "easy",
    free: true,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "In one paragraph, explain what Retrieval-Augmented Generation (RAG) is and what problem it solves. Teach it back simply.",
    idealAnswer:
      "RAG, or Retrieval-Augmented Generation, is a pattern where, instead of relying only on what an LLM memorized during training, you first retrieve relevant documents from an external knowledge source at query time and inject them into the prompt as context, then ask the model to answer using that context. The typical pipeline is: chunk and embed your documents into a vector database, embed the user's question, retrieve the top-k most similar chunks, and pass them alongside the question to the model. It solves the problems of stale knowledge, missing private/domain-specific data, and hallucination, and it lets the model cite its sources — all without the cost of retraining or fine-tuning the model. The key idea people miss is that RAG adds knowledge at inference time through context, whereas fine-tuning changes the model's weights/behavior.",
    rubric: [
      "Defines RAG as retrieve-then-generate: fetch external context and feed it to the LLM at query time",
      "Describes the retrieval step (embed query, vector search for relevant chunks/documents)",
      "Names a problem it solves: stale/private knowledge, hallucination, or citations without retraining",
      "Distinguishes it from fine-tuning (context at inference vs changing model weights)",
    ],
    hints: [
      "What do you add to the prompt before the model answers?",
      "How is this different from training the model on your data?",
    ],
  },
  {
    id: "bx-008",
    category: "basics",
    level: "mid",
    title: "What is a partition (Kafka & Spark)?",
    company: "Fundamentals",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what a 'partition' means in Apache Kafka and what it means in Apache Spark, and why partitions matter in both. Teach the shared idea and the differences.",
    idealAnswer:
      "The shared idea is that a partition is a unit of parallelism — splitting data into pieces that can be processed independently and in parallel. In Kafka, a topic is divided into partitions, each an ordered, append-only log; Kafka guarantees message ordering only within a partition, and messages with the same key hash to the same partition so per-key order is preserved. Partition count caps consumer parallelism, since each partition is consumed by at most one consumer in a consumer group at a time. In Spark, a partition is a chunk of a distributed dataset (RDD/DataFrame); each partition is processed by one task on one core, so the number of partitions controls how much work runs in parallel across the cluster. Too few partitions underuses the cluster; too many (or skewed) partitions add overhead or hot spots. The common confusion is treating them as the same: a Kafka partition is an infrastructure-level ordered log and durability/ordering unit, while a Spark partition is a transient compute-level slice of data — though when Spark reads Kafka, it commonly maps one Spark partition per Kafka partition.",
    rubric: [
      "States the shared concept: partition = unit of parallelism / a split of data processed independently",
      "Kafka: topic split into ordered append-only logs; ordering guaranteed only within a partition (key → partition)",
      "Spark: a slice of a distributed dataset processed by one task; partition count drives parallelism",
      "Notes a real consequence (Kafka partitions cap consumer parallelism; Spark too few/too many/skewed partitions hurt)",
    ],
    hints: [
      "Both are about splitting work so it can run in parallel.",
      "In Kafka, what does a partition guarantee about message order?",
    ],
  },
  {
    id: "bx-009",
    category: "basics",
    level: "mid",
    title: "What is idempotency?",
    company: "Fundamentals",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what idempotency means and why it matters in data pipelines and APIs. Teach it with an example.",
    idealAnswer:
      "An operation is idempotent if running it multiple times produces the same result as running it once — there are no extra side effects from the repeats. It matters because in distributed systems retries, duplicate messages, and re-runs are inevitable (networks fail, jobs restart), so operations need to be safe to repeat. Concrete examples: an HTTP PUT that sets a record to a specific value is idempotent (re-sending it leaves the same state), whereas a naive POST that inserts a new row each time is not. In data pipelines you make a job idempotent by, for example, using upserts/MERGE keyed on a unique id, overwriting a target partition rather than appending, or deduplicating with an idempotency key — so re-running a failed batch doesn't double-count rows. The common mistake is conflating idempotent with 'read-only' or 'runs only once'; an idempotent operation can write and can run many times — the end state just doesn't change after the first successful application.",
    rubric: [
      "Defines idempotency: doing the operation N times has the same effect as doing it once",
      "Explains why it matters: retries/duplicates/re-runs are unavoidable in distributed systems",
      "Gives a concrete contrast (e.g. PUT/upsert/overwrite-partition vs naive POST/append that duplicates)",
      "Corrects a misconception or notes how to achieve it (idempotency key, MERGE/upsert, overwrite)",
    ],
    hints: [
      "If a job crashes halfway and you re-run it, does the data double up?",
      "Think PUT versus a blind INSERT.",
    ],
  },
  {
    id: "bx-010",
    category: "basics",
    level: "junior",
    title: "Primary key vs foreign key",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain the difference between a primary key and a foreign key in a relational database. Teach it with a simple two-table example.",
    idealAnswer:
      "A primary key is a column (or set of columns) that uniquely identifies each row in a table; its values must be unique and non-null, and a table has at most one. A foreign key is a column in one table whose values reference the primary key of another table, creating a link between them and enforcing referential integrity — you can't insert a foreign-key value that doesn't exist in the referenced table, and the database can block or cascade deletes that would orphan rows. For example, an orders table has its own primary key order_id and a customer_id foreign key that points to the customers table's primary key; that's how you know which customer placed each order. The common mistakes are thinking a primary key can be null or duplicated (it can't), and that a foreign key must be unique (it usually isn't — many orders can reference the same customer).",
    rubric: [
      "Primary key: uniquely identifies each row; unique and non-null; one per table",
      "Foreign key: references another table's primary key, linking the two tables",
      "Mentions referential integrity (FK values must exist in the referenced table)",
      "Gives a concrete cross-table example (or corrects a misconception, e.g. FKs need not be unique)",
    ],
    hints: [
      "Which key says 'this row is unique' and which says 'this row points at another table'?",
      "Can two orders belong to the same customer? What does that tell you about the foreign key's uniqueness?",
    ],
  },
  {
    id: "bx-011",
    category: "basics",
    level: "mid",
    title: "Normalization vs denormalization",
    company: "Fundamentals",
    difficulty: "medium",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what normalization and denormalization mean in database design and the trade-off between them. Teach it back.",
    idealAnswer:
      "Normalization is organizing data into multiple related tables to eliminate redundancy — each fact is stored in exactly one place, linked by keys (following normal forms like 1NF/2NF/3NF). Its benefits are no duplicate data, smaller storage, and no update anomalies, since you change a fact in one row; the cost is that answering a question often requires joining many tables, which can be slower. Denormalization deliberately reintroduces redundancy — duplicating or pre-joining data into fewer, wider tables — to make reads faster by avoiding joins; the cost is more storage and the risk of inconsistent copies that you must keep in sync on writes. The trade-off is essentially write-consistency-and-storage-efficiency (normalized, typical of OLTP transactional systems) versus read/query speed (denormalized, common in analytics/warehouses and star schemas). The misconception is that one is simply 'better' — it depends on whether the workload is write-heavy and consistency-critical or read/analytics-heavy.",
    rubric: [
      "Normalization: split data into related tables to remove redundancy (each fact stored once), linked by keys",
      "Denormalization: deliberately add redundancy / pre-join into wider tables to speed up reads",
      "States the trade-off: consistency/storage/update-safety vs read/query performance (fewer joins)",
      "Ties to a context (normalized → OLTP; denormalized → analytics/warehouse/star schema), or notes there's no universal winner",
    ],
    hints: [
      "Where is each fact stored — once, or copied around?",
      "What do you gain by avoiding joins, and what do you risk?",
    ],
  },
  {
    id: "bx-012",
    category: "basics",
    level: "junior",
    title: "What is a JOIN (inner vs left)?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what a SQL JOIN does and the difference between an INNER JOIN and a LEFT JOIN. Teach it with a simple example.",
    idealAnswer:
      "A JOIN combines rows from two tables by matching them on a related column (a join condition), so you can pull fields from both into one result set. An INNER JOIN returns only the rows where the condition matches in both tables — unmatched rows from either side are dropped. A LEFT JOIN (left outer join) returns every row from the left table, and the matching columns from the right table where they exist; where there's no match, the right-side columns come back as NULL. For example, joining customers to orders: an INNER JOIN shows only customers who have placed orders, while a LEFT JOIN shows all customers including those with no orders (their order columns are NULL) — which is exactly how you'd find customers who never ordered. The common mistake is filtering left-joined right-table columns in the WHERE clause, which silently turns a LEFT JOIN back into an inner join because NULLs fail the predicate.",
    rubric: [
      "Defines a JOIN as combining rows from two tables on a matching/join condition",
      "INNER JOIN returns only rows that match in both tables",
      "LEFT JOIN returns all rows from the left table, with NULLs where the right table has no match",
      "Gives a concrete example or notes a real gotcha (e.g. WHERE on the right table collapsing a LEFT JOIN to inner)",
    ],
    hints: [
      "What happens to a left-table row that has no match on the right?",
      "How would you list customers who have never placed an order?",
    ],
  },
  {
    id: "bx-013",
    category: "basics",
    level: "junior",
    title: "What is a database index?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what a database index is, how it speeds up queries, and what it costs. Teach it with an everyday analogy.",
    idealAnswer:
      "An index is an auxiliary data structure (commonly a B-tree) that the database maintains on one or more columns so it can find rows matching a value or range without scanning the whole table — like the index at the back of a book that lets you jump to a page instead of reading every page. It dramatically speeds up lookups, range queries, joins, and sorts on the indexed columns, turning a full table scan into a fast tree traversal. The cost is real: indexes take extra storage, and they slow down writes (INSERT/UPDATE/DELETE) because every index must be updated too, so over-indexing hurts write-heavy tables. The common misconceptions are that more indexes are always better (they aren't) and that an index helps any query — it only helps when the query filters/sorts/joins on the indexed column(s) in a way the optimizer can use, and a primary key is typically backed by an index automatically.",
    rubric: [
      "Defines an index as an extra structure (e.g. B-tree) that avoids full table scans for lookups",
      "Explains it speeds up reads: lookups/range/join/sort on the indexed column(s)",
      "Names the cost: extra storage and slower writes (every write updates the index)",
      "Notes a nuance: indexes only help queries that use the indexed columns / over-indexing is bad",
    ],
    hints: [
      "Think of the index at the back of a textbook.",
      "If reads get faster, what gets slower every time you change data?",
    ],
  },
  {
    id: "bx-014",
    category: "basics",
    level: "junior",
    title: "What is Apache Kafka?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what Apache Kafka is and what problem it solves, as if teaching someone who has only used a normal request/response API.",
    idealAnswer:
      "Apache Kafka is a distributed event-streaming platform — essentially a durable, high-throughput, append-only log that lets systems publish and subscribe to streams of events. Producers write messages (events) to named topics, which are split into partitions for parallelism and ordering; consumers read from topics, and because Kafka retains messages on disk for a configured period, many independent consumers can read the same stream at their own pace, and a consumer can replay history. It solves the problem of decoupling systems: instead of services calling each other directly (tight coupling, hard to scale), they communicate asynchronously through Kafka, which buffers spikes, fans data out to many downstream systems, and provides durability and replay. The common misconception is that it's just a message queue that deletes messages once read — Kafka is a retained log, so reading doesn't remove data and consumers track their own offset.",
    rubric: [
      "Defines Kafka as a distributed event-streaming platform / durable append-only log",
      "Describes the publish/subscribe model: producers → topics (partitions) → consumers",
      "Explains the problem it solves: decoupling producers and consumers, buffering, scaling, durability",
      "Notes a distinguishing trait (messages are retained and replayable; consumers track offsets) — not a delete-on-read queue",
    ],
    hints: [
      "Think publish/subscribe and a log that's kept around, not a phone call.",
      "What happens to a message after one consumer reads it?",
    ],
  },
  {
    id: "bx-015",
    category: "basics",
    level: "junior",
    title: "What is Apache Airflow / a DAG?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what Apache Airflow is and what a DAG is in that context. Teach it to a teammate who currently schedules jobs with cron.",
    idealAnswer:
      "Apache Airflow is an open-source platform to author, schedule, and monitor data workflows as code (in Python). A workflow in Airflow is defined as a DAG — a Directed Acyclic Graph — where each node is a task (a unit of work, like running a query or a Spark job) and the edges define dependencies and order; 'acyclic' means there are no loops, so the tasks have a well-defined execution order. Airflow runs each DAG on a schedule (or trigger), executes tasks in dependency order, retries failures, and gives you a UI to monitor runs, see logs, and re-run failed tasks. It's better than plain cron because cron just fires commands on a clock with no awareness of dependencies, failures, retries, or backfills, whereas Airflow models the whole pipeline, its dependencies, and its history. The common misconception is that a DAG is the running job itself — it's the definition/blueprint; each execution is a separate 'DAG run'.",
    rubric: [
      "Defines Airflow as a platform to author/schedule/monitor workflows as (Python) code",
      "Defines a DAG: Directed Acyclic Graph of tasks with dependencies, no cycles, defining execution order",
      "Explains what Airflow does at runtime: schedules, runs tasks in order, retries, monitors via UI",
      "Contrasts it with cron (dependency/failure/retry/backfill awareness) — or notes DAG is the definition vs a DAG run",
    ],
    hints: [
      "What does 'acyclic' rule out in the graph of tasks?",
      "Why is cron not enough when task B must wait for task A to succeed?",
    ],
  },
  {
    id: "bx-016",
    category: "basics",
    level: "junior",
    title: "What is an LLM token?",
    company: "Fundamentals",
    difficulty: "easy",
    free: false,
    executes: false,
    mode: "text",
    starter: "",
    prompt:
      "Explain what a 'token' is in the context of large language models, and why tokens matter practically. Teach it to a teammate new to LLMs.",
    idealAnswer:
      "A token is the basic unit of text that an LLM reads and generates — not a whole word and not a single character, but a chunk produced by a tokenizer, often a common word, a sub-word piece, or punctuation. A rough rule of thumb for English is that one token is about 4 characters or roughly 3/4 of a word, so 1,000 tokens is around 750 words; whitespace and rare words split into more tokens, and other languages tokenize differently. Tokens matter for three practical reasons: pricing (API costs are billed per input and output token), the context window (a model can only handle a fixed maximum number of tokens at once, which bounds how much prompt + history + response fit), and latency (more tokens generated means more time). The model literally predicts the next token one at a time. The common misconception is that a token equals a word — tokenization is sub-word, so word and token counts differ.",
    rubric: [
      "Defines a token as the unit of text an LLM processes — a sub-word chunk, not exactly a word or character",
      "Gives a rough sense of scale (e.g. ~4 chars / ~0.75 word per token in English)",
      "Explains why tokens matter: cost/pricing, context window limits, and/or latency",
      "Corrects the word-equals-token misconception (tokenization is sub-word; counts differ)",
    ],
    hints: [
      "Is a token the same as a word? Try 'unbelievable' or a rare word.",
      "What two limits in using an LLM API are measured in tokens?",
    ],
  },
];
