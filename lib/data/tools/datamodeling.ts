import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR  — fact vs dimension, star schema basics, surrogate keys,
  //           normalization 1NF–3NF, primary/foreign keys
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
          "What is the difference between a fact table and a dimension table? Give me a concrete example.",
        code: [
          {
            lang: "sql",
            label: "fact + dimension",
            lines: [
              "CREATE TABLE fct_order_items (",
              "  customer_key BIGINT, -- FK to dim",
              "  date_key     INT,    -- FK to dim",
              "  quantity     INT,     -- additive",
              "  revenue      NUMERIC  -- additive",
              ");",
              "-- dim holds who/what: name, segment",
            ],
          },
        ],
        answerStructured:
          "- **Fact table**: stores measurable events or transactions — rows of numeric measurements. Example: `fct_order_items` with columns like `quantity`, `line_revenue`, `discount_amount` plus foreign keys to dimensions.\n- **Dimension table**: stores descriptive context around those facts — the 'who, what, when, where.' Example: `dim_customer` with `customer_name`, `city`, `segment`; `dim_date` with `date`, `month`, `quarter`.\n- The **grain rule**: each row in a fact table represents exactly one measurable event at the declared grain — 'one row per order line item,' not 'one row per order.'\n- Facts are numeric and additive (you sum them). Dimensions are textual and used for filtering, grouping, and labeling.\n- In a star schema, the fact table sits in the center; dimension tables radiate outward, joined via foreign keys.",
        explanationDeep:
          "The most common junior mistake is blurring the line: putting descriptive columns (customer name, product category) inside the fact table, or putting measures (revenue, quantity) inside a dimension. The rule of thumb: if you're summing it, it belongs in a fact. If you're filtering or grouping by it, it belongs in a dimension.\n\nThe grain is the single most important concept in fact-table design. 'One row per order' and 'one row per order line item' are completely different grains — the first loses the ability to analyze line-level discounts and product-level revenue, the second enables it. You declare the grain before you name a single column, because every column you add must be consistent with that grain.\n\nDimension tables are intentionally denormalized: instead of separate tables for city, state, and country, you put all three in `dim_geography`. That denormalization makes queries simpler — one join instead of three — and is the core design choice that separates a dimensional model from a normalized OLTP schema.",
        interviewerLens:
          "I'm listening for two things: (1) the additive-measure vs descriptive-attribute distinction, and (2) the grain mentioned in the same breath as the fact table. Candidates who say 'fact tables have numbers, dimensions have text' have a textbook definition. Candidates who say 'grain is the single most important decision and you state it first' have designed in production. If they give me a concrete example unprompted — 'like fct_order_items joined to dim_customer' — they've moved from abstract to applied.",
        followupChain: [
          {
            question: "What is a factless fact table?",
            answer: "A fact table with no numeric measures — it records the existence of an event or relationship. Example: a `fact_student_enrollment` table with just student_key, course_key, and date_key but no revenue or count column. You query it to count enrollments, or join it to find students who enrolled but never completed. Bridge tables for many-to-many relationships are a related pattern."
          },
          {
            question: "Can a measure be in a dimension table? Can a descriptor be in a fact?",
            answer: "Rarely and with intent. A degenerate dimension is a descriptor that lives in the fact table without a corresponding dimension table — like an order number or invoice number. There's no separate dim_order because the fact already IS the order event. Putting measures in dimensions is almost always wrong."
          },
          {
            question: "What is a date dimension and why do you need one instead of storing raw timestamps in the fact?",
            answer: "A dim_date pre-populates every calendar date with useful attributes: day of week, week number, fiscal quarter, is_holiday, etc. This lets analysts filter on 'fiscal Q3' or 'weekends' without writing date arithmetic in every query. Raw timestamps in the fact can't be grouped on fiscal calendar without the dimension."
          }
        ],
        redFlags: [
          {
            junior: "\"Facts have numbers and dimensions have text — that's basically it.\"",
            senior: "\"Facts store additive measures at a declared grain; dimensions provide descriptive context for filtering and grouping. The grain determines which columns belong where.\""
          },
          {
            junior: "\"I'd put customer_name in the fact table so I don't have to join.\"",
            senior: "\"That breaks normalization of the star schema — customer attributes go in dim_customer, joined via a surrogate key. Embedding them in the fact makes updates a nightmare.\""
          }
        ],
        alternatePhrasings: [
          "\"What goes in a fact table versus a dimension table?\"",
          "\"Explain star schema to me.\"",
          "\"Why do you join a fact to a dimension?\""
        ],
        interviewContexts: [
          "Asked in virtually every junior data engineering and analytics engineering screen",
          "Entry-level analytics role at a Series A e-commerce company",
          "Junior DE loop at a data-heavy SaaS startup"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 21,
        questionText:
          "Explain normalization: what does 1NF, 2NF, and 3NF mean, and when would you normalize versus denormalize?",
        code: [
          {
            lang: "sql",
            label: "denormalized for OLAP",
            lines: [
              "-- 3NF splits these; star embeds",
              "-- them in one redundant dim",
              "CREATE TABLE dim_geography (",
              "  geo_key  BIGINT,",
              "  city     TEXT,",
              "  state    TEXT,  -- redundant",
              "  country  TEXT   -- on purpose",
              ");",
            ],
          },
        ],
        answerStructured:
          "- **1NF (First Normal Form)**: all values are atomic (no arrays, no comma-lists in a cell), and each column has a single type. No repeating groups.\n- **2NF (Second Normal Form)**: in 1NF PLUS every non-key column is fully dependent on the *entire* primary key — no partial dependencies. Matters when you have a composite primary key.\n- **3NF (Third Normal Form)**: in 2NF PLUS no transitive dependencies — non-key columns depend only on the primary key, not on other non-key columns. Example: if `zip_code` determines `city`, and `city` is a non-key column, that's a transitive dependency — break it into a separate table.\n- **When to normalize (3NF)**: OLTP systems — transactional databases where data integrity and avoiding update anomalies matters most.\n- **When to denormalize**: analytics / OLAP — dimensional models denormalize intentionally (e.g., all of `city`, `state`, `country` in one `dim_geography`) to minimize joins and simplify BI queries.",
        explanationDeep:
          "Normalization is about eliminating redundancy and preventing update anomalies. In a 3NF OLTP database, customer address lives in one place; update it once and it's correct everywhere. In a denormalized star schema, you intentionally embed that address into the dimension table — accepting redundancy to avoid joins at query time.\n\nThe key interview insight is that normalization vs denormalization is a deliberate trade-off driven by workload, not a universal correctness rule. Relational database textbooks treat 3NF as the goal because they assume OLTP. Kimball's dimensional modeling explicitly denormalizes because it assumes OLAP.\n\n2NF is where most people get tripped up: partial dependency only applies when the primary key is composite. A table with a single-column primary key is automatically in 2NF if it's in 1NF. The classic example is an `order_items` table with composite key `(order_id, product_id)` where `product_name` depends only on `product_id` (partial dependency) — fix by moving `product_name` to a separate products table.",
        interviewerLens:
          "I want the normalize-vs-denormalize framing tied to workload (OLTP vs OLAP) rather than 'normalized is always better.' The 2NF partial-dependency example with a composite key is where candidates separate rote memory from real understanding. If they can give me a concrete bad table and fix it, they know it; if they only recite the definition, they memorized it.",
        followupChain: [
          {
            question: "Give me an example of a table that violates 3NF and fix it.",
            answer: "employees(emp_id, emp_name, dept_id, dept_name). dept_name depends on dept_id (a non-key column), not directly on emp_id — that's a transitive dependency. Fix: split into employees(emp_id, emp_name, dept_id) and departments(dept_id, dept_name). Now no transitive dependency."
          },
          {
            question: "What's BCNF and do you need to know it for a data engineering interview?",
            answer: "Boyce-Codd Normal Form is a stricter version of 3NF — every determinant must be a candidate key. Most data engineering interviews stop at 3NF; BCNF comes up in more academic settings or database design roles. Knowing it's stricter than 3NF and handles edge cases with multiple overlapping candidate keys is enough."
          }
        ],
        redFlags: [
          {
            junior: "\"3NF is always best; you should always normalize.\"",
            senior: "\"3NF is best for OLTP integrity; for analytics we intentionally denormalize into star schemas to minimize join complexity.\""
          },
          {
            junior: "\"I don't really know the difference between 2NF and 3NF.\"",
            senior: "\"2NF eliminates partial dependencies on a composite key; 3NF eliminates transitive dependencies — non-key columns depending on other non-key columns.\""
          }
        ],
        alternatePhrasings: [
          "\"What is database normalization?\"",
          "\"When would you not normalize a schema?\"",
          "\"Give me a table that violates 3NF and fix it.\""
        ],
        interviewContexts: [
          "Junior data engineering fundamentals screen",
          "Analytics engineer entry-level loop at a SaaS company",
          "Asked at a data analyst interview focused on data design basics"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 19,
        questionText:
          "What is a surrogate key and why do you use one in a dimensional model instead of the natural business key?",
        code: [
          {
            lang: "sql",
            label: "surrogate + natural key",
            lines: [
              "CREATE TABLE dim_customer (",
              "  customer_key BIGINT, -- surrogate",
              "  customer_id  TEXT,   -- natural",
              "  effective_from DATE,",
              "  effective_to   DATE,",
              "  is_current   BOOLEAN",
              ");",
            ],
          },
        ],
        answerStructured:
          "- A **surrogate key** is a system-generated, meaningless integer (or UUID) assigned by the warehouse — e.g., `customer_key = 1001`. It has no business meaning.\n- A **natural key** (a.k.a. business key) is a real identifier from the source system — e.g., `customer_id = 'CUS-XYZ'`, an email address, or a CRM ID.\n- **Why surrogate keys in dimensional models**:\n  1. **Source independence**: if the source system rekeys customers (e.g., after a merger), the warehouse surrogate is stable.\n  2. **SCD Type 2 versioning**: the same customer can have multiple dimension rows (one per attribute change), each with a different surrogate key — the natural key stays the same across versions, but the fact stores the *versioned* surrogate for point-in-time accuracy.\n  3. **Join performance**: small integer keys join faster than long strings or composite keys.\n  4. **Deduplication**: you can reconcile the same entity from multiple source systems under one surrogate.",
        explanationDeep:
          "The most important reason for surrogate keys in analytics is SCD Type 2. When a customer moves from 'Tier 1' to 'Tier 2', a Type 2 dimension creates a new row — both rows share the same `customer_natural_id` but get different surrogate keys. The fact table stores the surrogate key that was valid at the time of the transaction. If you stored the natural key, you couldn't distinguish which version of the customer to join to — you'd always get today's attributes, not the attributes at event time.\n\nThe source-system-instability argument is equally important: OLTP systems change. A company migrates CRMs, rekeys customers after an acquisition, or changes email formats. If your fact table stored the raw CRM ID and that CRM ID changes, every historical fact row is now broken. With a surrogate key in the middle, you update the dimension lookup table once and the facts remain intact.\n\nPractically: always carry the natural key in the dimension table as `customer_natural_id` or `customer_bk` (business key) so you can still map back to the source. Never discard the natural key — surrogate and natural keys coexist.",
        interviewerLens:
          "I'm looking for the SCD2 versioning reason — that's the specific reason surrogate keys exist in dimensional models (not just 'because it's best practice'). Candidates who say 'performance' only have a partial answer. The source-system-stability argument is the second: natural keys break when source systems change. If they also say 'keep the natural key in the dimension for traceability,' that shows production experience.",
        followupChain: [
          {
            question: "A source system rekeys a customer after an acquisition — how does a surrogate key protect you?",
            answer: "The fact table stores your internal surrogate key, not the source ID. When the source rekeys, you update the dimension's natural_key mapping — the surrogate stays the same, so all historical facts still join correctly to the right customer row. With natural keys in facts, you'd have to update millions of historical rows."
          },
          {
            question: "What is a dbt-style surrogate key and how is it generated?",
            answer: "dbt generates surrogate keys using `dbt_utils.generate_surrogate_key([col1, col2, ...])` — a hash (MD5 or SHA-256) of the business key columns. Hash-based surrogates are deterministic and idempotent (regenerating produces the same key), avoiding an auto-increment sequence. The trade-off vs. integer surrogates: hashes are larger and not sortable by insertion order."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just use the customer_id from the source system as the key.\"",
            senior: "\"Natural keys break SCD Type 2 versioning and are vulnerable to source-system rekeying. Surrogate keys decouple the warehouse from source instability.\""
          },
          {
            junior: "\"Surrogate keys are just for performance.\"",
            senior: "\"Performance is a benefit, but the real reasons are SCD2 versioning (each dimension version needs a unique key) and source-system independence.\""
          }
        ],
        alternatePhrasings: [
          "\"Why not just use the CRM customer ID as your dimension key?\"",
          "\"What's the difference between a surrogate key and a natural key?\"",
          "\"Why do dimension tables have their own generated keys?\""
        ],
        interviewContexts: [
          "Junior analytics engineering loop at a Series B fintech",
          "Data engineering fundamentals screen at a B2B SaaS company",
          "Asked in a dimensional modeling basics interview at a mid-size retailer"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 16,
        questionText:
          "SCD Type 1 vs Type 2 vs Type 3 — how do you choose which to apply for a given attribute?",
        code: [
          {
            lang: "sql",
            label: "Type 1 / 2 / 3 columns",
            lines: [
              "-- T1: just overwrite segment",
              "-- T2: version rows",
              "effective_from DATE,",
              "effective_to   DATE,",
              "is_current     BOOLEAN,",
              "-- T3: one prior value column",
              "previous_segment TEXT",
            ],
          },
        ],
        answerStructured:
          "- **SCD Type 1 (Overwrite)**: update the attribute in place, no history retained. Choose when: history genuinely doesn't matter (e.g., correcting a data entry typo), or the business only cares about the current value.\n- **SCD Type 2 (New row per change)**: insert a new dimension row with `effective_from`, `effective_to`, and `is_current` columns. Choose when: historical reporting must reflect the attribute's value at event time (e.g., customer segment at time of order, sales rep's region at time of close).\n- **SCD Type 3 (Extra column)**: add a `previous_value` column alongside `current_value`. Choose when: you need exactly one prior value and only one — e.g., 'what was the customer's tier before this change?' Rarely used because it only tracks one prior state.\n- **Decision driver**: ask the business — 'Does a report run today, looking at last year's orders, need to show the attribute as it was then or as it is now?' If the answer is 'as it was then,' it's Type 2.",
        explanationDeep:
          "The choice between Type 1 and Type 2 is not a technical preference — it is a business requirement question. You cannot answer it correctly without knowing whether the organization needs historical point-in-time accuracy. 'What region was the sales rep in when they closed the Q3 deal?' requires Type 2. 'What is the sales rep's current phone number?' can be Type 1.\n\nType 2 is the most powerful but most expensive: every dimension change creates a new row, join logic must use effective date ranges, and the dimension table grows over time. Type 1 is free in terms of complexity — just overwrite — but data is permanently lost. Some teams apply Type 1 for most attributes and Type 2 only for audit-sensitive ones (customer tier, pricing group, sales territory).\n\nType 3 is the odd one out: it commits to exactly one prior value, which is rarely what people need in practice. It's useful only when the spec is literally 'show current and previous value side by side in one row.' The moment you need two history versions, Type 3 breaks.",
        interviewerLens:
          "The phrase I'm listening for is 'ask the business whether they need point-in-time history.' Candidates who instantly say 'use Type 2 for everything' are not thinking about implementation cost; candidates who never mention Type 2 haven't dealt with slowly changing dimensions in production. The Type 3 explanation should include its single-history limitation — that's what makes it rarely the right answer.",
        followupChain: [
          {
            question: "How does dbt's snapshot feature implement SCD Type 2?",
            answer: "dbt snapshots check for changes using either a timestamp strategy (row updated_at changed) or a check strategy (specific columns changed). When a change is detected, dbt closes the previous row (sets dbt_valid_to) and inserts a new row (dbt_valid_from = now, dbt_valid_to = null for current). It manages effective date columns automatically without manual ETL logic."
          },
          {
            question: "Can you apply Type 1 and Type 2 to different attributes in the same dimension?",
            answer: "Yes — this is called a hybrid SCD. You might apply Type 1 to a customer's email address (correctable data, history irrelevant) and Type 2 to their tier or region (business-critical historical accuracy). The implementation is the same SCD2 row-insertion mechanism; you just define which columns trigger new rows."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd always use Type 2 to be safe.\"",
            senior: "\"Type 2 has real costs — dimension growth, complex joins. I ask the business whether they need point-in-time accuracy before committing to Type 2 for every attribute.\""
          },
          {
            junior: "\"Type 1 just means deleting old records.\"",
            senior: "\"Type 1 overwrites in place — no deletion. The old value is gone permanently. That's fine when history isn't needed, like fixing a typo.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you track attribute changes in a dimension table?\"",
          "\"When would you overwrite vs. preserve history in a dimension?\"",
          "\"Explain slowly changing dimensions to me.\""
        ],
        interviewContexts: [
          "Junior to mid analytics engineering interview",
          "Data engineering loop at a company using dbt and Snowflake",
          "Dimensional modeling fundamentals screen"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 12,
        questionText:
          "When would you use a snowflake schema instead of a star schema, and what are the trade-offs?",
        answerStructured:
          "- **Star schema**: dimension tables are fully denormalized — all attributes in one table, one join from fact to dimension. Simpler, faster for most BI queries, easier for analysts.\n- **Snowflake schema**: dimension tables are normalized into sub-dimensions (e.g., `dim_product` → `dim_subcategory` → `dim_category`). Reduces storage for very large, high-redundancy dimensions; supports complex hierarchies cleanly.\n- **Trade-offs**:\n  - Star: more storage (redundancy in dimensions), but simpler queries and faster BI tool performance.\n  - Snowflake: less storage, better for deep hierarchies, but more joins — queries are harder to write and slower.\n- **When to use snowflake**: when dimensions are very large (millions of rows with many repeated text values), or when strict storage constraints exist, or when a hierarchy has many levels and you need to navigate it dynamically.\n- **Modern default**: star schema. Columnar warehouses (BigQuery, Snowflake, Redshift) make denormalized reads cheap. The join overhead of snowflake schemas often isn't worth the storage savings.",
        explanationDeep:
          "The snowflake-vs-star debate is largely settled in modern practice: star schema wins for almost every analytics use case. Columnar storage compresses repeated string values efficiently, eliminating the storage argument for snowflaking. And every extra join in a snowflake schema is query complexity that analysts and BI tools have to navigate.\n\nThe legitimate case for snowflaking is a very deep, complex hierarchy where the dimension would have thousands of unique path combinations — think a product taxonomy with 8 levels or an org chart. In those cases, normalizing the hierarchy makes it easier to query at any level without redundant data.\n\nA critical distinction: the Snowflake *database* vendor and the snowflake *schema design pattern* are unrelated. Confusing them in an interview signals a shallow understanding of dimensional modeling terminology.",
        interviewerLens:
          "I want 'star is the default, snowflake only when hierarchies justify it' — not a memorized pro/con list. The senior signal is mentioning that columnar compression reduces the storage argument for snowflaking. If they confuse the Snowflake database product with the snowflake schema pattern, that's a red flag.",
        followupChain: [
          {
            question: "Can you have a hybrid — star schema with some snowflaked dimensions?",
            answer: "Yes, and it's common. A dimension table like dim_product might reference a separate dim_category table for a very deep category hierarchy, while dim_customer is fully denormalized. The point is to snowflake only when the hierarchy genuinely benefits from it, not uniformly."
          }
        ],
        redFlags: [
          {
            junior: "\"Snowflake schema is better because it's more normalized.\"",
            senior: "\"Normalized is better for OLTP integrity, not for analytics performance. Star schema wins on query simplicity, and columnar compression mostly eliminates the storage argument for snowflaking.\""
          }
        ],
        alternatePhrasings: [
          "\"Star schema vs. snowflake schema — which would you use?\"",
          "\"Why do most analytics teams use star schemas?\"",
          "\"When does normalizing dimensions make sense?\""
        ],
        interviewContexts: [
          "Junior analytics engineering screen",
          "Data engineering fundamentals interview at a B2B SaaS company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["Star Schema", "3NF"],
        asked: 14,
        questionText:
          "Compare a normalized (3NF) schema to a dimensional (star) schema. When would you use each?",
        answerStructured:
          "- **3NF / Normalized**: minimizes data redundancy, enforces referential integrity, optimized for writes. Every piece of data in one place — update once, correct everywhere. Many tables, many joins.\n- **Star schema / Dimensional**: intentionally denormalized fact + dimension tables. Fewer joins (one per dimension), fast aggregation reads, easy for BI tools. Redundancy accepted for query performance.\n- **Use 3NF when**: transactional integrity matters (OLTP — banking, order management), write throughput is high, or you need to avoid update anomalies.\n- **Use star schema when**: the system is analytics-facing (reporting, BI dashboards), reads far outnumber writes, and query performance and BI-tool compatibility are primary concerns.\n- **Modern nuance**: most data platforms use both — 3NF in the source/operational layer, star schema in the presentation/mart layer.",
        explanationDeep:
          "The standard data platform architecture uses both: operational databases stay in 3NF (integrity for writes), and the analytics layer transforms that into a star schema (performance for reads). The classic mistake is applying OLTP modeling principles to an analytics warehouse — three-join chains that make sense for a normalized OLTP schema kill BI query performance when analysts are doing ad-hoc exploration.\n\nThe reason star schemas win on read performance: a flat, denormalized dimension table means the analyst writes `JOIN dim_customer ON fk_customer_key` once and gets every customer attribute they need. In a 3NF schema, that same query requires joining customer → address → city → state → region — four joins for context that a star schema delivers in one.\n\nThe redundancy trade-off is real but often tolerable: column-based warehouses compress repeated string values well, so 'customer segment' repeated in a fact table 50 million times compresses far smaller than its raw size suggests. The operational simplicity of fewer joins frequently justifies the storage cost.",
        interviewerLens:
          "I want the workload distinction (OLTP/writes vs OLAP/reads) as the primary decision driver, and the statement that modern platforms use both. Candidates who say 'star schema is always better' haven't thought about OLTP; candidates who say '3NF is correct, star schema is a shortcut' are applying OLTP rules to the wrong context.",
        followupChain: [
          {
            question: "Where does Data Vault fit into this spectrum?",
            answer: "Data Vault is a third modeling approach — a highly normalized hub-and-satellite architecture designed for the raw layer of large enterprise warehouses, optimized for auditability and ingestion speed from many sources. It sits between the 3NF source and the star-schema presentation layer, not replacing either. It's rarely needed for teams under a certain scale, and Kimball-style dimensional modeling usually covers the same ground with less complexity."
          }
        ],
        redFlags: [
          {
            junior: "\"3NF is for good databases; star schema is a shortcut.\"",
            senior: "\"They optimize for different workloads. 3NF is correct for OLTP write integrity; star schema is correct for OLAP read performance. Most platforms use both in different layers.\""
          }
        ],
        alternatePhrasings: [
          "\"Should we normalize our warehouse or use a dimensional model?\"",
          "\"What's the downside of using 3NF in an analytics warehouse?\"",
          "\"Why do analytics teams denormalize?\""
        ],
        interviewContexts: [
          "Junior analytics engineering and data engineering interviews",
          "Warehouse design discussion at a startup building its first data platform"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Design a date dimension table — what columns would you include and why?",
        "What is a degenerate dimension? Give a real example.",
        "What is a conformed dimension and why does it matter across data marts?",
        "Explain additive, semi-additive, and non-additive measures with examples.",
        "What are foreign keys in a star schema and how do they enforce referential integrity?"
      ],
      decisions: [
        "When does a dimension attribute belong in the fact table instead (degenerate dimension)?",
        "Integer surrogate key vs. hash-based surrogate key — when would you choose each?",
        "Type 1 vs Type 2 for a specific attribute — how do you decide?"
      ],
      quickRef: [
        "What is the grain of a fact table?",
        "Fact vs dimension — one-sentence each?",
        "What is a surrogate key?",
        "What is 1NF / 2NF / 3NF?",
        "What is a star schema?",
        "What is a snowflake schema?",
        "SCD Type 1 vs Type 2 in one line each?",
        "What is a degenerate dimension?",
        "What is a natural key (business key)?",
        "What does 'denormalized' mean?"
      ],
      redFlags: [
        {
          junior: "\"Putting descriptive attributes like customer_name in the fact table.\"",
          senior: "\"Descriptive attributes go in dimension tables — the fact table stores foreign keys and additive measures.\""
        },
        {
          junior: "\"Always normalize everything to 3NF.\"",
          senior: "\"3NF is correct for OLTP; analytics warehouses intentionally denormalize into star schemas for query performance.\""
        },
        {
          junior: "\"Surrogate keys are just integers for performance.\"",
          senior: "\"Surrogate keys are essential for SCD Type 2 versioning and source-system independence — performance is a side benefit.\""
        }
      ],
      checklist: [
        "Distinguish fact (measures + grain) from dimension (descriptive context)",
        "Know 1NF/2NF/3NF with a concrete bad-table example and fix",
        "Understand surrogate key purpose: SCD2 versioning and source independence",
        "SCD Type 1 vs 2 — state the decision driver as 'does the business need point-in-time history?'",
        "Know star vs. snowflake vs. 3NF: which workload each targets"
      ],
      behavioral: [
        "Tell me about a data model you built or contributed to — what grain did you choose and why?",
        "Describe a time you had to explain a star schema concept to a non-technical stakeholder.",
        "A time you found a modeling mistake (wrong grain, missing dimension) — how did you catch it?"
      ],
      reverse: [
        "Is the analytics layer using star schema, OBT, or something else?",
        "How is historical attribute change tracked today — SCD Type 1 or 2?",
        "Do you use dbt snapshots for slowly changing dimensions?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID  — grain declaration, SCD Type 1/2/3, additive/semi-additive/
  //        non-additive measures, star vs snowflake schema, fact types
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 30,
        questionText:
          "Walk me through designing the grain for a sales orders fact table. What happens if you get the grain wrong?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "triple-counts the order",
            lines: [
              "-- grain: one row per order line",
              "SELECT SUM(total_order_value)",
              "FROM fct_order_items;",
              "-- repeats on every line of an",
              "-- order -> over-counts",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            lines: [
              "-- keep only line-additive measures",
              "SELECT SUM(line_revenue)",
              "FROM fct_order_items;",
              "-- total_order_value lives in an",
              "-- order-grain fact instead",
            ],
          },
        ],
        answerStructured:
          "- **Declare the grain first, out loud**: 'The grain of this fact table is one row per order line item.' Not per order, not per customer — one atomic measurement event.\n- **Kimball's four-step process**: (1) pick the business process (sales), (2) declare the grain, (3) identify dimensions (date, customer, product, store), (4) identify facts (quantity, unit_price, discount, line_revenue).\n- **Why line-item grain over order grain**: if you model at the order level, you can't analyze product-level revenue, per-item discount, or category breakdown without aggregating from a fact that already lost that detail.\n- **Getting the grain wrong causes**: mixed-grain fact tables (some rows represent different events than others), wrong aggregations (summing a measure that isn't additive at the declared grain), and joins that fan out unexpectedly.\n- **Key rule**: every row in the fact must be consistent with the declared grain — no exceptions. If a measure only makes sense at the order level, it doesn't belong in the line-item grain fact.",
        explanationDeep:
          "The grain is not a technical detail — it is the foundational design decision that determines what questions the model can answer. Choosing 'one row per order' locks you out of any per-item analysis forever without a rebuild. This is why Kimball mandates declaring the grain *before* naming a column.\n\nA mixed-grain fact table is one of the most dangerous anti-patterns: you start with line-item rows but add order-level attributes (total_order_value) to the same table. Now some measures are additive at the line-item grain (line_revenue) and some are not (total_order_value is the same on every line of the same order — summing it gives you 3x the actual order value). Every analyst who touches this table needs to know the hidden rule, and eventually someone forgets and gets wrong numbers in production.\n\nThe practical test: for every column in the fact, ask 'does this value exist once per [grain]?' If total_order_value is the same on every line of order 123, it exists once per order, not once per line item — it violates the grain. Either move it to a separate order-level fact or handle it in the transform layer.",
        interviewerLens:
          "The phrase that separates real modelers from people who've read about modeling: 'declare the grain before naming any columns.' If they say it unprompted, they've designed in production. The mixed-grain anti-pattern is the follow-up test — if they can explain why total_order_value in a line-item fact causes double-counting, they've been burned by it. Most mid-level candidates know what grain means; the senior signal is explaining the consequences of getting it wrong.",
        followupChain: [
          {
            question: "You need both order-level and line-item-level data in the warehouse. How do you model that?",
            answer: "Two separate fact tables: fct_order_items at line-item grain, and fct_orders at order grain. They share dimension keys (dim_customer, dim_date) and are related by order_id (often a degenerate dimension in the line-item fact). Analysts query the appropriate fact for the question they're answering."
          },
          {
            question: "How do you validate that a fact table is at the correct grain?",
            answer: "Run: SELECT [grain_columns], COUNT(*) FROM fct_table GROUP BY [grain_columns] HAVING COUNT(*) > 1. If this returns rows, you have duplicate rows at the declared grain — the ETL is producing multiple rows per event, usually from a join fan-out. Also check that every measure makes sense at the grain by summing each one and comparing to source system totals."
          },
          {
            question: "What is the grain of a periodic snapshot fact table?",
            answer: "One row per entity per time period — e.g., one row per account per month-end. The grain is (account_id, month). Periodic snapshots are used for slowly changing quantities like account balance, inventory level, or headcount — values that don't have a discrete 'event' but that you need a point-in-time snapshot of."
          }
        ],
        redFlags: [
          {
            junior: "Drawing or describing tables before declaring the grain.",
            senior: "\"The grain is one row per order line item — that's the first decision, and every column I choose must be consistent with it.\""
          },
          {
            junior: "\"I'd put total_order_value in the line-item fact table.\"",
            senior: "\"total_order_value repeats on every line item of the same order — summing it at line-item grain triple-counts the order. That's a grain violation; it belongs in an order-level fact.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the grain of a fact table and why does it matter?\"",
          "\"Design a star schema for a retail sales model.\"",
          "\"What happens when you mix grains in a fact table?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineering loop at a Series C retail analytics company",
          "dbt-centric data engineering interview",
          "Dimensional modeling deep-dive at a BI-heavy team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 25,
        questionText:
          "Explain additive, semi-additive, and non-additive measures. Give an example of each and explain how you handle non-additive measures in a fact table.",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "ratio cannot be summed",
            lines: [
              "-- stored conversion_rate per row",
              "SELECT SUM(conversion_rate)",
              "FROM fct_sessions;",
              "-- meaningless: ratios don't add",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            lines: [
              "-- store additive components,",
              "-- derive the rate at query time",
              "SELECT SUM(conversions)::NUMERIC",
              "     / SUM(sessions) AS conv_rate",
              "FROM fct_sessions;",
            ],
          },
        ],
        answerStructured:
          "- **Additive**: can be summed across *all* dimensions — time, products, geography, customer. Example: `revenue`, `quantity_sold`, `cost`. Sum January's revenue + February's revenue + US revenue + EU revenue and you get meaningful totals. The gold standard measure.\n- **Semi-additive**: can be summed across *some* dimensions but not time. Example: `account_balance` or `inventory_level`. Summing balances across accounts makes sense (total portfolio value). Summing balances across months does NOT make sense (you'd be adding today's balance to yesterday's balance — meaningless). Use `MAX()` or `AVG()` across time, not `SUM()`.\n- **Non-additive**: cannot be meaningfully summed across *any* dimension. Example: `conversion_rate`, `profit_margin`, `ratio`. You cannot sum conversion rates across products to get total conversion rate.\n- **How to handle non-additive measures**: store the *components* (numerator and denominator) as additive facts, compute the ratio at query time. Store `revenue` and `orders` additively; compute `avg_order_value = revenue / orders` in the BI layer or mart. Never store only the ratio.",
        explanationDeep:
          "The semi-additive vs. non-additive distinction is where most mid-level candidates reveal gaps. Account balance is the canonical semi-additive: you can sum across accounts to get total portfolio value, but you cannot sum across time periods — adding December balance + January balance gives you a nonsensical number. Periodic snapshot fact tables store semi-additive measures, and the BI tool or query must use LAST() or AVG() over the time dimension instead of SUM().\n\nNon-additive measures are a common data quality trap: someone stores `conversion_rate` as a fact column and then a report accidentally sums it across 12 months to get '12.3' — which means nothing. The professional fix is always to store the components (sessions and conversions) and compute the ratio at query time. This is a form of the 'store the atomic grain' principle applied to measures: store what is additive, derive what is not.\n\nInventory level is a useful edge-case: it's semi-additive across locations (you can sum inventory across all stores) but not across time (total inventory on Monday + total inventory on Tuesday is not meaningful). Headcount behaves the same way.",
        interviewerLens:
          "I want account_balance (semi-additive) and conversion_rate (non-additive) as concrete examples, plus the 'store components, compute ratio at query time' prescription. Candidates who say 'just don't sum it' without explaining the storage solution are giving me a workaround, not a design. The phrase 'semi-additive: use LAST() or AVG() across time, not SUM()' is the specific answer I'm checking for.",
        followupChain: [
          {
            question: "How do you handle avg_order_value in a fact table — store it or derive it?",
            answer: "Derive it. Store revenue (additive) and order_count (additive) as separate fact columns; compute avg_order_value = revenue / order_count in the BI layer or in a downstream mart. If you store the ratio, it becomes non-additive and breaks roll-ups. If revenue is $100 in January and $200 in February, avg_order_value = ($100 + $200) / (count_Jan + count_Feb) — but stored pre-computed ratios can't be re-averaged this way."
          },
          {
            question: "A BI analyst is SUM()-ing inventory_level across months and getting wrong numbers. How do you fix the model?",
            answer: "First explain the root cause: inventory_level is semi-additive — valid to sum across locations, not across time. The fix: ensure the fact is a periodic snapshot (one row per location per day), and document in the mart's README and dbt description that time-dimension aggregation should use LAST() or AVG(), not SUM(). Some BI tools let you define the aggregation type per measure in a semantic layer (Looker LookML, Cube.js) to enforce this automatically."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd store conversion_rate directly in the fact table as a measure.\"",
            senior: "\"Conversion_rate is non-additive — storing only the ratio breaks all roll-ups. Store sessions and conversions as additive facts; derive the rate at query time.\""
          },
          {
            junior: "\"Semi-additive just means you can't sum it.\"",
            senior: "\"Semi-additive means can't sum across time but can across other dimensions. Account balance: sum across accounts = portfolio value (fine); sum across months = nonsense. Use LAST() or AVG() across the time dimension.\""
          }
        ],
        alternatePhrasings: [
          "\"Can you always SUM() a fact column? What are the exceptions?\"",
          "\"How do you handle a metric like profit margin in a fact table?\"",
          "\"Explain why account balance is tricky in a fact table.\""
        ],
        interviewContexts: [
          "Mid-level data modeling interview at a fintech (account balances)",
          "Analytics engineering loop at a B2B SaaS (conversion rates)",
          "Asked at a retail analytics company (inventory modeling)"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "What are the three types of fact tables — transaction, periodic snapshot, and accumulating snapshot? When would you use each?",
        answerStructured:
          "- **Transaction fact**: one row per discrete event. Example: one row per sale, per click, per support ticket opened. Grain = the individual event. Use when: you want to analyze frequency, timing, and individual event attributes. Most common fact type.\n- **Periodic snapshot fact**: one row per entity per time period, capturing state at regular intervals. Example: one row per account per month-end with balance, outstanding_loans, etc. Grain = (entity, time_period). Use when: you need to track slowly changing quantities over time (balance, headcount, inventory level). Measures are semi-additive.\n- **Accumulating snapshot fact**: one row per business process instance, updated as it progresses through stages. Example: one row per order with columns `order_placed_date`, `payment_cleared_date`, `shipped_date`, `delivered_date`. The row is updated in place as each stage completes. Use when: you need to track a process with a defined start, multiple milestones, and an end (order lifecycle, loan origination pipeline, hiring process).\n- **Key signal**: if the grain is an event → transaction. If the grain is (entity, time period) → periodic snapshot. If the grain is a business process instance that changes over time → accumulating snapshot.",
        explanationDeep:
          "The accumulating snapshot is the least understood of the three, and the one most likely to trip up mid-level candidates. Unlike transaction facts (immutable, append-only) and periodic snapshots (a new row per period), accumulating snapshots have rows that are updated in place as the process progresses. An order starts with `order_placed_date` filled and all other milestone dates NULL; as the order ships, `shipped_date` is populated; when delivered, `delivered_date` is populated. This means fact table rows are mutable, which is unusual and requires MERGE/upsert semantics in the ETL rather than append.\n\nThe classic use case for accumulating snapshots is anything with a defined end state — order fulfillment, loan origination, job application pipeline. The power is that you can calculate elapsed time between stages (how long does it take from payment to shipment?), see which stage is the bottleneck, and track conversion rates through the funnel — all in a single row per entity.\n\nThe trade-off: accumulating snapshots require careful SCD handling for the dimension keys they store. When an order's sales_rep changes, which surrogate key does the accumulating snapshot row store? Typically, you use the current surrogate key (Type 1 behavior on the fact row) or you need additional logic to freeze the key at the time of the first event.",
        interviewerLens:
          "Every candidate names transaction facts correctly. The test is the accumulating snapshot: can they explain that rows are updated in place as milestones are hit, and give a real use case (order lifecycle, loan pipeline)? The periodic snapshot test is whether they know the measures are semi-additive (don't SUM() account balance across time). If they can describe all three with examples and explain when each is used, they've clearly worked with a real dimensional model.",
        followupChain: [
          {
            question: "How does an ETL pipeline differ for each fact table type?",
            answer: "Transaction: append-only INSERTS, fully additive. Periodic snapshot: generate one row per (entity, period) on a schedule — INSERT the new period's rows, typically from a source snapshot or calculated state. Accumulating snapshot: MERGE/UPSERT — match on the business process key, update milestone date columns as stages complete. Transaction is the simplest; accumulating is the most complex because rows are updated, not just inserted."
          },
          {
            question: "Can a periodic snapshot fact have NULL measures?",
            answer: "Yes — if an account has no activity in a period, some measures (transactions, new deposits) might be zero or NULL. A zero is often semantically different from NULL: zero means 'active, no activity' while NULL means 'not applicable.' The model should be explicit about which is used and consistent across periods."
          }
        ],
        redFlags: [
          {
            junior: "\"All fact tables are the same — they store events.\"",
            senior: "\"Transaction facts store individual events (append-only). Periodic snapshots store entity state per period (semi-additive, scheduled rows). Accumulating snapshots store process instances updated in place as milestones complete.\""
          },
          {
            junior: "\"I'd use a transaction fact for order fulfilment tracking.\"",
            senior: "\"Order fulfilment is an accumulating snapshot — one row per order updated at each stage (placed, paid, shipped, delivered). A transaction fact gives you disconnected events; an accumulating snapshot lets you calculate stage durations in one query.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you model an order lifecycle in a data warehouse?\"",
          "\"What's the difference between a transaction fact and a snapshot fact?\"",
          "\"Model the data warehouse table for tracking orders through fulfilment stages.\""
        ],
        interviewContexts: [
          "Mid-level DE loop at a logistics or e-commerce company",
          "Dimensional modeling deep-dive at a analytics engineering team",
          "Asked in a warehouse design round at a fintech (loan pipeline)"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 20,
        questionText:
          "How do you choose between a star schema, snowflake schema, and One Big Table for a new analytics mart?",
        answerStructured:
          "- **Star schema** (dimensional, denormalized): fact table joined to denormalized dimension tables. The analytics default — one join per dimension, BI-tool friendly, flexible as questions change. Best for a general-purpose analytics layer.\n- **Snowflake schema** (normalized dimensions): dimension tables normalized into sub-dimensions. Reduce storage for high-cardinality hierarchies; more joins. Choose only when dimensions are very large with deep hierarchies or storage constraints are real.\n- **One Big Table (OBT)**: all dimensions pre-joined into a single wide table alongside measures. Maximum read speed for a known, dominant query pattern. Accepts rigidity — schema changes ripple everywhere. Best for a specific dashboard or embedded analytics product with a known, stable query shape.\n- **Decision tree**:\n  1. Is this a general-purpose analytics layer? → Star schema.\n  2. Is there one dominant, well-defined query with extreme latency requirements? → OBT.\n  3. Are dimensions very large with deep hierarchies? → Snowflake (selectively).\n- **Modern nuance**: columnar warehouses make OBT cheaper than it used to be (compression + columnar pruning). Teams increasingly use star for the general mart and OBT for specific high-traffic API or dashboard marts.",
        explanationDeep:
          "The star vs. OBT choice is increasingly relevant as modern columnar warehouses (BigQuery, Snowflake, DuckDB) make wide tables much cheaper to operate. A star schema's flexibility comes from keeping dimensions separate — you can add a new dimension without rebuilding every row of the fact. An OBT's speed comes from eliminating joins entirely — queries against a pre-joined wide table can be 5-10x faster for a known access pattern.\n\nThe cost of OBT is rigidity: every schema change requires updating the wide table, which may have hundreds of downstream consumers. Adding a column is fine; changing a dimension attribute type or removing a column breaks things. Star schema separates those concerns — a change to dim_customer doesn't require rebuilding fct_order_items.\n\nA practical pattern many teams use: build star schema as the authoritative layer (flexible, maintainable), then materialize OBT 'feature tables' for specific high-traffic dashboards or ML feature stores. The star is the source of truth; the OBT is a derived, read-optimized cache.",
        interviewerLens:
          "I want the decision framing, not a memorized comparison table. 'Star for general analytics, OBT for known high-traffic patterns, snowflake only for deep hierarchies' — if they can articulate that in their own words with trade-offs, they've designed a real analytics layer. The modern-nuance answer about columnar warehouses making OBT cheaper is the senior signal.",
        followupChain: [
          {
            question: "Your CEO's dashboard is slow. Would you switch it from star schema to OBT?",
            answer: "First diagnose — is it slow because of joins, because of data volume, or because of BI tool inefficiency? If joins are genuinely the bottleneck, materializing an OBT for that specific dashboard is a valid fix. But the star schema stays as the authoritative layer; the OBT is a derivative. Don't rebuild the entire analytics layer — that's over-engineering the wrong solution."
          },
          {
            question: "What is the dbt pattern for OBT marts?",
            answer: "Build your staging → intermediate → marts layers with a star schema as intermediate. For a specific OBT mart, write a final mart model that joins all dims and the fact into one wide table. Use materialized='table' or 'incremental' depending on size. The OBT is a leaf node in the DAG, downstream of the star schema models."
          }
        ],
        redFlags: [
          {
            junior: "\"OBT is bad practice — always use a star schema.\"",
            senior: "\"OBT is the right call for a specific high-traffic known query pattern. Star schema is the general-purpose default; OBT is a targeted read optimization.\""
          },
          {
            junior: "\"I'd use a snowflake schema to be more normalized.\"",
            senior: "\"Normalization serves OLTP. For analytics, star schema wins on query simplicity and BI-tool compatibility. I only snowflake when I have very deep hierarchies that genuinely justify extra joins.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use One Big Table instead of a star schema?\"",
          "\"Should we pre-join everything into a wide table or keep a proper dimensional model?\"",
          "\"Normalized vs. denormalized vs. wide table — which for our analytics layer?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineering warehouse design discussion",
          "Asked at a Series B company building their first data mart",
          "dbt-heavy team interview — modeling philosophy discussion"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you decide which attributes of a dimension require SCD Type 2 tracking vs. Type 1 overwrite?",
        answerStructured:
          "- **Ask the business question**: 'If I run a report tomorrow on last year's orders, should this attribute show its value at the time of the order, or today's value?' If 'at the time of the order' → Type 2. If 'today's value is fine' → Type 1.\n- **Type 2 for**: business-critical segment or tier changes (customer tier, pricing group), sales rep territory (affects commission accuracy), product category (affects historical category reports), compliance-sensitive attributes (regulatory status, KYC tier).\n- **Type 1 for**: correctable errors (fixing a misspelled name), contact info that's only useful current (email, phone), internal technical IDs with no analytical meaning.\n- **Hybrid SCD**: most production dimensions are hybrid — Type 1 for some attributes, Type 2 for others, on the same dimension table.\n- **Practical constraint**: Type 2 makes dimensions grow and joins more complex (temporal range joins). Apply it surgically — only where point-in-time accuracy materially changes a reported number.",
        explanationDeep:
          "The decision is always a business question, not a technical default. A junior mistake is either applying Type 2 universally ('to be safe') or applying Type 1 universally ('simpler'). Neither is right without knowing what historical accuracy means for the specific attribute.\n\nThe clearest test is a concrete report: 'Show me sales rep performance for Q3 2023.' If the sales rep was in the West region in Q3 but moved to East in Q4, should the Q3 report show West (point-in-time) or East (current)? For commission reporting and territory analysis, it must show West — that's Type 2. For an org chart directory, East is fine — Type 1.\n\nImplementation cost matters too: each Type 2 attribute on a dimension means every downstream fact join must use a temporal range join (fact_date BETWEEN dim.effective_from AND dim.effective_to), not just a simple key join. If a dimension has 15 attributes and you Type 2 all of them, every fact join is a range join — more complex, slower, harder to explain to analysts. Type 2 surgically applied to the 3-4 attributes that genuinely need it keeps the model tractable.",
        interviewerLens:
          "The first thing I listen for is whether they ask a clarifying question or immediately prescribe Type 2. 'What does the business need to see in a historical report?' is the right first move. Then I want 'hybrid SCD' named — the idea that one dimension can have some Type 1 and some Type 2 attributes. Candidates who say 'just Type 2 everything' have never maintained a production SCD2 dimension with 50M rows.",
        followupChain: [
          {
            question: "How does a hybrid SCD affect the ETL pipeline?",
            answer: "Type 1 attributes are updated in place on the current row (UPDATE dim SET attribute = new_value WHERE is_current = 1 AND natural_key = X). Type 2 attributes close the current row and insert a new one. In dbt snapshots, you define which columns trigger new rows via the `check_cols` config — only changes in those columns create new versions."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd Type 2 every attribute to be safe.\"",
            senior: "\"Type 2 has real costs — dimension growth and range-join complexity. I apply it surgically to attributes where point-in-time accuracy materially changes a reported number, based on a business requirements conversation.\""
          }
        ],
        alternatePhrasings: [
          "\"When do you use SCD Type 2 vs. Type 1 for a dimension attribute?\"",
          "\"How do you decide what history to track in a dimension table?\"",
          "\"Should customer email address be SCD Type 1 or Type 2?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineering interview at a company with complex customer data",
          "Dimensional modeling design discussion — dbt snapshot configuration"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["SCD Type 1", "SCD Type 2"],
        asked: 22,
        questionText:
          "SCD Type 1 vs. SCD Type 2 — compare them on implementation complexity, storage cost, and join pattern. When does each give a wrong answer if misapplied?",
        code: [
          {
            accent: "bug",
            lang: "sql",
            label: "returns today's tier",
            lines: [
              "SELECT f.*, d.tier",
              "FROM fct_orders f",
              "JOIN dim_customer d",
              "  ON d.customer_id = f.customer_id",
              " AND d.is_current = TRUE;",
              "-- ignores tier at order time",
            ],
          },
          {
            accent: "fix",
            lang: "sql",
            lines: [
              "-- join the surrogate key stamped",
              "-- on the fact at event time",
              "SELECT f.*, d.tier",
              "FROM fct_orders f",
              "JOIN dim_customer d",
              "  ON d.customer_key =",
              "     f.customer_key;",
            ],
          },
        ],
        answerStructured:
          "- **SCD Type 1 — overwrite**:\n  - Implementation: simple UPDATE on the existing row.\n  - Storage: no dimension growth — one row per entity always.\n  - Join: simple equality join on surrogate key — no date range needed.\n  - **Wrong answer if misapplied**: using Type 1 when historical accuracy matters. Report on 'customer tier at time of purchase' returns today's tier, not the tier when they bought — if the customer downgraded, all their historical purchases now look like they came from a lower tier.\n- **SCD Type 2 — new row per change**:\n  - Implementation: INSERT new row, UPDATE previous row's `effective_to` and `is_current`. Requires ETL MERGE logic.\n  - Storage: dimension grows with every attribute change — a high-churn attribute can make the dimension 10x larger.\n  - Join: temporal range join — `fact.event_date BETWEEN dim.effective_from AND dim.effective_to` — more complex, slower if not indexed.\n  - **Wrong answer if misapplied**: joining on surrogate key alone without filtering to the correct version. If a fact stores an old surrogate key that has been superseded, the query returns stale attributes unless the join correctly matches the version valid at event time.",
        explanationDeep:
          "The misapplication scenarios are what separate candidates who've shipped SCD implementations from those who've only read about them. Type 1 misapplied: a commission report that recalculates last year's revenue with today's sales territory assignments — the sales rep's region changed mid-year, so every historical deal now gets credited to the wrong region. Completely wrong numbers, and the mistake is invisible because no error is thrown.\n\nType 2 misapplied (the subtler bug): the fact table stores the surrogate key for the dimension version valid at event time, but an analyst joins dim_customer on `customer_natural_key` and `is_current = 1` — they always get today's customer attributes, defeating Type 2 entirely. The correct join uses the stored surrogate key directly (or uses the temporal range join), trusting the ETL to have stamped the right version's key at event time.\n\nThe storage cost of Type 2 is often underestimated. A customer dimension with 10 million customers that churns 5% of its tier attributes annually adds 500,000 rows per year. After 5 years, the dimension has grown 25%. For a high-churn attribute on a large dimension, this matters. The fix: apply Type 2 only to the attributes that need it (hybrid SCD), and consider archiving old closed rows.",
        interviewerLens:
          "I'm testing whether they can articulate the misapplication failure modes, not just the definitions. 'Type 1 wrong when history matters' and 'Type 2 wrong when the join doesn't use the temporal filter or surrogate key' are the two real-world bugs I'm listening for. If they can give me the 'join on natural_key + is_current = 1 defeats Type 2' bug, they've debugged an SCD2 join in production.",
        followupChain: [
          {
            question: "How do you join a fact table to an SCD Type 2 dimension table correctly?",
            answer: "Two valid approaches: (1) at ETL time, stamp the fact row with the surrogate key of the dimension version that was current at event time — then join is a simple equality on surrogate key, no date range needed. (2) At query time, use a temporal range join: JOIN dim_customer ON fact.customer_natural_key = dim.customer_natural_key AND fact.event_date BETWEEN dim.effective_from AND dim.effective_to. Option 1 is preferred for performance; option 2 is a recovery pattern when the fact only stored the natural key."
          }
        ],
        redFlags: [
          {
            junior: "\"For SCD2 I just join on customer_id and filter is_current = 1.\"",
            senior: "\"That always returns today's attributes — it defeats Type 2 entirely. The correct join uses the surrogate key stamped at event time, or a temporal range join on the event date.\""
          }
        ],
        alternatePhrasings: [
          "\"Walk me through implementing SCD Type 2 end to end.\"",
          "\"How do you join historical facts to a slowly changing dimension?\"",
          "\"What is a point-in-time query and why does it matter with SCD2?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineering deep-dive at a company with customer tier tracking",
          "Data engineering interview at a fintech with commission models",
          "SCD implementation review at a B2B SaaS warehouse team"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How do you design a date dimension — columns, grain, and why it must be pre-populated?",
        "What is a junk dimension and when would you create one?",
        "How do you model a product hierarchy (category > subcategory > product) in a dimensional model?",
        "Explain the role of a conformed dimension across multiple data marts.",
        "How do you handle nulls in dimension foreign keys on a fact table?"
      ],
      decisions: [
        "Transaction fact vs. periodic snapshot fact — which for inventory modeling?",
        "When does a semi-additive measure need special BI-layer handling vs. fix in the model?",
        "Hybrid SCD vs. pure Type 2 — when does the added complexity not justify full Type 2?"
      ],
      quickRef: [
        "What is the Kimball four-step dimensional modeling process?",
        "Additive vs semi-additive vs non-additive — one example each?",
        "How do you detect a mixed-grain fact table?",
        "What is the grain of a periodic snapshot fact?",
        "SCD Type 2 — what three columns make it work?",
        "What is a degenerate dimension?",
        "What makes a measure semi-additive?",
        "One Big Table — when is it the right call?",
        "What is the danger of storing a ratio (e.g. conversion_rate) as a fact?",
        "What is the role of effective_from / effective_to in SCD Type 2?"
      ],
      redFlags: [
        {
          junior: "\"I'd design the schema and then figure out the grain.\"",
          senior: "\"Grain first — always. The grain determines which columns belong where and prevents mixed-grain anti-patterns.\""
        },
        {
          junior: "\"I'd store conversion_rate as a fact column.\"",
          senior: "\"Non-additive — store sessions and conversions as additive facts; derive the rate at query time.\""
        },
        {
          junior: "\"For SCD2, I just filter is_current = 1 when joining.\"",
          senior: "\"That returns today's attributes, defeating Type 2. Use the surrogate key stamped at event time, or a temporal range join on the event date.\""
        }
      ],
      checklist: [
        "Declare the grain before naming any column — state it out loud",
        "Know additive/semi-additive/non-additive with concrete examples (revenue/balance/conversion_rate)",
        "Know all three fact types with use cases: transaction, periodic snapshot, accumulating snapshot",
        "SCD Type 2 join pattern: surrogate key stamped at event time OR temporal range join",
        "Star vs. OBT decision: general-purpose vs. known high-traffic pattern"
      ],
      behavioral: [
        "Tell me about a grain decision you made and how it affected downstream analysis.",
        "A time you discovered a mixed-grain or semi-additive measure bug in a production model.",
        "How you decided between star schema and OBT for a specific use case."
      ],
      reverse: [
        "What is the predominant fact table pattern here — transaction, snapshot, or accumulating?",
        "How are slowly changing dimensions tracked — dbt snapshots, custom ETL, or something else?",
        "Are there known semi-additive measure issues in the current warehouse?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR  — SCD2 point-in-time correctness end to end, bridge tables
  //           / many-to-many, late-arriving dimensions, normalized vs
  //           dimensional vs OBT trade-offs at scale
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 26,
        questionText:
          "Walk me through SCD Type 2 end to end — from source system change detection to a correct point-in-time query on the fact table. What are the failure modes at each step?",
        code: [
          {
            lang: "sql",
            label: "atomic close of old row",
            lines: [
              "MERGE INTO dim_customer d",
              "USING staged s",
              "  ON d.customer_id = s.customer_id",
              " AND d.is_current = TRUE",
              "WHEN MATCHED AND d.seg <> s.seg",
              "  THEN UPDATE SET is_current=FALSE,",
              "    effective_to = current_date;",
            ],
          },
        ],
        answerStructured:
          "- **Step 1 — Change detection**: compare incoming source rows to existing dimension rows on the natural key. Detect changes via (a) timestamp strategy: `source.updated_at > dim.effective_from` for the current row, or (b) hash strategy: `MD5(concat(col1, col2, ...))` compared to a stored hash. Failure mode: if `updated_at` is unreliable (source system doesn't update it on all changes), use a column-level hash.\n- **Step 2 — Insert new version**: close the current row (`effective_to = change_timestamp - 1 day`, `is_current = false`), insert a new row (`effective_from = change_timestamp`, `effective_to = 9999-12-31`, `is_current = true`, new surrogate key). Failure mode: race condition if two changes arrive simultaneously — use an atomic MERGE, not separate UPDATE + INSERT.\n- **Step 3 — Stamp the fact at load time**: when loading new facts, look up the dimension surrogate key that was active at the fact's event timestamp: `JOIN dim ON fact.customer_nk = dim.customer_nk AND fact.event_ts BETWEEN dim.effective_from AND dim.effective_to`. Stamp the fact with that surrogate key. Failure mode: missing dimension version for a late-arriving fact (fact arrives before or during a dimension change) — see late-arriving dimension handling.\n- **Step 4 — Point-in-time query**: at query time, join fact to dimension on the stamped surrogate key — simple equality join. No date range needed because the ETL already resolved the correct version. Failure mode: analyst re-joins on natural key + is_current = 1, bypassing the stamped key and getting today's attributes.\n- **Step 5 — Validate**: for any report, verify row counts at each step, and spot-check a known customer tier change to confirm historical facts return the correct historical tier.",
        explanationDeep:
          "SCD Type 2 is deceptively simple in concept but full of correctness traps in implementation. The most insidious is Step 4: an analyst who writes `JOIN dim_customer ON fact.customer_nk = dim.customer_nk AND dim.is_current = 1` is silently bypassing the entire purpose of Type 2 — they always get today's customer attributes on historical facts. This produces wrong numbers that look plausible, with no error and no warning. The fix is correct ETL in Step 3 that stamps the surrogate key, so the query-time join is a simple surrogate equality join.\n\nThe race condition in Step 2 is the ETL failure mode most teams hit first. If you run UPDATE (close current row) and then INSERT (new row) as two separate statements, a concurrent read between them sees either zero current rows or two current rows — both corrupt states. An atomic MERGE statement (or a transactional block) eliminates this. dbt snapshots handle this correctly; many hand-rolled ETL pipelines don't.\n\nChange detection is the upstream failure: if the source system doesn't reliably update `updated_at` on every attribute change (common with soft-delete updates, CDC event loss, or certain OLTP systems), you'll miss changes. The defensive approach is a full column-level hash comparison — compute MD5 over all tracked columns and compare to the stored hash on the current dimension row. More compute, but catches changes that timestamps miss.",
        interviewerLens:
          "I want five distinct steps named, with at least two failure modes. The 'analyst re-joins on natural key + is_current' bug is the one I use to separate people who've implemented SCD2 from those who know the theory. The atomic MERGE vs separate UPDATE+INSERT shows ETL engineering awareness. If they mention dbt snapshots and can explain what dbt does vs doesn't handle (it handles the MERGE, not the fact-stamping), that's the senior tell.",
        followupChain: [
          {
            question: "How does dbt handle SCD Type 2, and what does it not handle?",
            answer: "dbt snapshots handle steps 1 and 2: change detection (timestamp or check strategy) and new-row insertion with dbt_valid_from/dbt_valid_to. What dbt does NOT handle: stamping historical facts with the correct surrogate key at load time — that's your ETL/mart logic. The snapshot gives you the correctly versioned dimension; you're still responsible for the range join when loading the fact or creating a mart that needs point-in-time correctness."
          },
          {
            question: "What is a Point-in-Time (PIT) table and when do you need one?",
            answer: "A PIT table is a pre-computed join helper: for each business key and each event timestamp in the fact, it stores the correct surrogate key for each SCD2 dimension as of that timestamp. Instead of doing N range joins at query time (one per SCD2 dimension), you join the fact to the PIT table once and get all the correct surrogate keys. PIT tables are used when there are many SCD2 dimensions on one fact — the performance advantage is significant at scale, but they add a pre-computation layer to maintain."
          },
          {
            question: "How do you handle a source system that doesn't provide the change timestamp for a dimension attribute?",
            answer: "Use a column-level hash strategy: compute MD5(concat(all tracked columns)) on each source row and compare to the stored hash on the current dimension row. If the hash differs, a change occurred — but you don't know when exactly. Your effective_from for the new version is the pipeline run timestamp, which is the best approximation available. Document the limitation and avoid joins that require sub-day precision."
          }
        ],
        redFlags: [
          {
            junior: "\"For SCD2, just add effective_from and effective_to and insert a new row when things change.\"",
            senior: "\"The concept is right, but the failure modes are in the details: atomic MERGE to prevent race conditions, hash-based change detection when timestamps are unreliable, surrogate-key stamping at fact load time, and guarding against analysts joining on natural key + is_current which silently returns wrong historical attributes.\""
          },
          {
            junior: "\"I'd use dbt snapshots and that handles everything.\"",
            senior: "\"dbt snapshots handle dimension versioning, but not fact stamping. I still need to resolve the correct surrogate key when loading the fact, or build a PIT table for multi-dimension SCD2 joins at scale.\""
          }
        ],
        alternatePhrasings: [
          "\"Walk me through the complete SCD Type 2 implementation.\"",
          "\"How do you ensure point-in-time correctness in a dimensional model?\"",
          "\"Design an ETL pipeline for a slowly changing customer dimension.\""
        ],
        interviewContexts: [
          "Senior analytics engineering loop at a fintech with customer tier history",
          "Staff data engineer interview at a company with Kimball-style warehouse",
          "Dimensional modeling deep-dive at a large B2B SaaS"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 20,
        questionText:
          "How do you model a many-to-many relationship in a star schema? Walk me through a bridge table implementation and the pitfalls.",
        code: [
          {
            lang: "sql",
            label: "bridge with weighting",
            lines: [
              "-- bridge: one row per pairing,",
              "-- weight 0.5/0.5 for two owners",
              "SELECT b.account_key,",
              "  SUM(f.amount * b.weight) AS amt",
              "FROM fct_revenue f",
              "JOIN bridge_owner b",
              "  ON b.deal_key = f.deal_key;",
            ],
          },
        ],
        answerStructured:
          "- **The problem**: a student can enroll in many courses; a course has many students. A fact table with `student_key` and `course_key` represents transactions — not the relationship itself. If you add multiple course_keys to a fact row, you break the grain and fan out.\n- **Bridge table solution**: create a bridge table (a.k.a. multi-valued dimension bridge or intersection table) with columns `bridge_key`, `student_key`, `course_key`, and optionally a `weighting_factor`. The fact joins to the bridge, and the bridge resolves to the dimension.\n- **Pattern**: `fct_enrollment → bridge_student_course → dim_course`. The bridge has one row per (student, course) combination. When querying, join fact to bridge (on student_key) then bridge to dim_course — the join fans out as expected at the bridge, not at the fact.\n- **Weighting factor**: when you need to allocate a fact measure across multiple dimension members (e.g., split a sale's revenue across two sales reps who co-owned the deal), add a `weight` column to the bridge (0.5 / 0.5) and multiply the measure by weight in the query.\n- **Pitfall — double counting**: if you sum revenue across the bridge without weighting, you'll count each sale once per associated dimension member — revenue doubles or triples. Always multiply by weight, or clarify that the query should DISTINCT-count entities and not SUM non-weighted measures.",
        explanationDeep:
          "Many-to-many relationships expose a fundamental tension in dimensional modeling: the star schema's strength is the clean fact → dimension relationship, but real business data is full of M:N relationships (orders and promotions, students and courses, employees and skills, accounts and sales territories). Bridge tables are the Kimball-prescribed solution.\n\nThe weighting factor is the nuanced part that most candidates miss. Without weights, summing a measure across a bridge double-counts: if a $1000 sale is shared between two sales reps, joining to the bridge gives two rows each with $1000, and summing gives $2000. The fix is a 0.5/0.5 weight on the bridge — multiply revenue × weight to get $500 per rep, sum to $1000 total. Not all M:N relationships have natural weights; when they don't, you must be explicit in your query about what constitutes a valid aggregation.\n\nA factless fact table is the alternative pattern when the relationship itself (not a measure) is the information: `bridge_student_enrollment(student_key, course_key, enrollment_date)` with no measures — you query it to COUNT enrollments or find which students are in which courses. The line between a bridge table and a factless fact table blurs; functionally they're similar, but the terminology differs.",
        interviewerLens:
          "I want the bridge table pattern described correctly (including the fact-to-bridge join direction), and the double-counting pitfall named. Candidates who say 'just add a second foreign key column to the fact table' have never dealt with M:N in a real warehouse. The weighting factor explanation is the senior signal — it shows they've solved the 'shared credit' or 'multi-attribute allocation' problem in production. If they can also explain the factless fact table distinction, that's mastery.",
        followupChain: [
          {
            question: "How does a bridge table affect BI tool query generation?",
            answer: "Most BI tools (Tableau, Power BI, Looker) don't natively understand the bridge table join pattern — they'll generate a direct join from fact to dim, bypassing the bridge. You need to either define the join path explicitly in the semantic layer (LookML, Tableau relationships), build a pre-joined wide view that resolves the M:N before BI tools touch it, or train analysts on the join pattern."
          },
          {
            question: "A sales deal can have multiple products and multiple sales reps. How do you model that?",
            answer: "Two bridge tables: bridge_deal_products (deal_key, product_key) and bridge_deal_reps (deal_key, rep_key, weight). The fact (fct_deals) joins to both bridges. Revenue allocation across reps uses the weight column. Product-level deal analysis joins through the product bridge. This is a common scenario in B2B sales data and requires explicit documentation of the join pattern and aggregation rules."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd add a second product_key column to the fact table for multi-product orders.\"",
            senior: "\"Multiple foreign key columns breaks the star schema grain and doesn't scale beyond 2 values. A bridge table with one row per (fact, dimension member) correctly handles M:N relationships.\""
          },
          {
            junior: "\"I'd join fact to bridge and SUM revenue — total revenue is the sum.\"",
            senior: "\"Without weighting, you double-count — each shared deal appears once per associated rep. The bridge needs a weight column (0.5/0.5) and the query multiplies revenue × weight before summing.\""
          }
        ],
        alternatePhrasings: [
          "\"Model a system where a sales deal can be credited to multiple sales reps.\"",
          "\"How do you handle a many-to-many relationship in a star schema?\"",
          "\"A student can have multiple majors — model that in a dimensional model.\""
        ],
        interviewContexts: [
          "Senior DE interview at a B2B SaaS company with complex sales attribution",
          "Dimensional modeling deep-dive at a university analytics platform",
          "Data warehouse design round at a company with multi-product orders"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "How do you handle late-arriving dimensions in a data warehouse? Walk me through the patterns and their trade-offs.",
        code: [
          {
            lang: "sql",
            label: "unknown member + backfill",
            lines: [
              "-- late fact joins to -1 placeholder",
              "INSERT INTO fct_orders",
              "SELECT order_id,",
              "  COALESCE(d.customer_key, -1)",
              "FROM staged s",
              "LEFT JOIN dim_customer d USING(...);",
              "-- backfill re-stamps on arrival",
            ],
          },
        ],
        answerStructured:
          "- **The problem**: a fact arrives (e.g., a transaction) before its corresponding dimension record exists or has been loaded (e.g., a new customer profile hasn't synced from CRM yet). The fact has a natural key for the dimension, but there's no surrogate key to stamp.\n- **Pattern 1 — Null foreign key**: store NULL in the fact's dimension FK. Later, when the dimension loads, run a backfill to replace NULLs with the correct surrogate key. Simple, but the fact is temporarily incomplete; any report that uses the dimension returns NULLs for that row.\n- **Pattern 2 — Unknown member placeholder**: pre-populate the dimension with a special 'Unknown' row (`dim_customer` row with surrogate key = -1, all attributes = 'Unknown'). All late-arriving facts join to this placeholder. When the real dimension row arrives, re-stamp facts from -1 to the real surrogate key. Reports always work (no NULLs), but the unknown row pollutes counts until backfilled.\n- **Pattern 3 — Late-arriving fact resolution**: at ETL time, attempt the dimension lookup with a temporal range join on the event timestamp. If no dimension version exists, create an inferred dimension row (minimal attributes, flagged as inferred). When the real record arrives, update the inferred row (Type 1 overwrite on inferred rows).\n- **Trade-off**: Pattern 1 is simplest but breaks reports temporarily. Pattern 2 is BI-tool friendly but requires a backfill job. Pattern 3 is most complete but most complex.\n- **Backfill job**: regardless of which pattern, always implement a scheduled backfill that matches any -1 or NULL dimension FKs to real dimension rows once they've loaded.",
        explanationDeep:
          "Late-arriving dimensions expose the dependency ordering problem in warehouse loading: you want facts to load continuously but dimensions to be authoritative and complete. In streaming ingestion or high-velocity batch systems, dimension records frequently lag their fact records by minutes, hours, or even days.\n\nThe 'Unknown' placeholder pattern is the Kimball recommendation and the most production-friendly: the report always runs (no NULL FK issues), the unknown row is clearly labeled so analysts know data is pending, and the backfill job cleans it up as dimensions arrive. The key is that the backfill must actually run — a team that implements the placeholder but never ships the backfill ends up with a dimension of millions of 'Unknown' customers permanently.\n\nThe inferred dimension pattern is used when you have enough information in the fact record to construct a partial dimension row. For example, a transaction includes `customer_id` and `customer_email` but the full CRM profile hasn't arrived. You create a dim_customer row with the partial data, flagged `is_inferred = true`. When the full CRM record arrives, you update (Type 1) the inferred row, preserving the surrogate key so all previously loaded facts still join correctly. This is elegant but requires careful handling: the inferred row must not look authoritative in reports, and the resolution logic must correctly identify when the real record has arrived.",
        interviewerLens:
          "The 'unknown placeholder' pattern is the Kimball-canonical answer and the one I'm looking for. The backfill job requirement is the operational detail that separates people who've run this in production from those who described the pattern from a book. The inferred dimension pattern is the senior bonus — naming it, explaining the is_inferred flag, and describing the Type 1 resolution on arrival. If they also mention that the backfill must be idempotent (safe to re-run), that's real production experience.",
        followupChain: [
          {
            question: "How does late-arriving dimension handling change for a streaming pipeline vs. batch?",
            answer: "Streaming pipelines have higher late-arrival frequency and shorter expected lag. The unknown placeholder pattern applies equally, but the backfill interval needs to be much shorter — ideally near real-time, triggered by dimension arrival events (e.g., a Kafka message when a new customer profile arrives triggers a fact backfill for that customer_id). Batch ETL can run the backfill in the next scheduled window; streaming can't wait that long."
          },
          {
            question: "How do you validate that your late-arriving dimension backfill is working?",
            answer: "Monitor the count of facts with NULL FK or FK = -1 (unknown) over time. This should trend toward zero as the backfill runs. Alert if the count grows faster than it shrinks — that indicates dimension loading is lagging and the backfill can't keep up. Also reconcile: count(distinct customer_nk in fct_orders WHERE customer_key = -1) and compare to count(dim_customer where loaded_within_sla). Any gap is a pipeline latency issue."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just wait for the dimension to load before loading facts.\"",
            senior: "\"Blocking fact loading on dimension availability doesn't work at scale — facts arrive continuously. The right pattern is an unknown placeholder with a backfill job, or inferred dimension rows with Type 1 resolution on arrival.\""
          },
          {
            junior: "\"Use NULL in the FK when the dimension isn't ready yet.\"",
            senior: "\"NULL FKs break BI tool filters and counts. The unknown member placeholder (-1 or a designated unknown row) is better — reports always work, and the backfill resolves the placeholder when the real dimension arrives.\""
          }
        ],
        alternatePhrasings: [
          "\"A transaction arrives before the customer has been loaded into the dimension — what do you do?\"",
          "\"How do you handle orphan facts in a dimensional model?\"",
          "\"Design a pipeline that correctly handles fact records arriving before their dimensions.\""
        ],
        interviewContexts: [
          "Senior data engineer interview at a streaming-heavy platform",
          "Analytics engineering deep-dive at a company with CDC-driven dimension loading",
          "Warehouse design round at a fintech with high-frequency transaction ingestion"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "Compare normalized (3NF), dimensional (star), and One Big Table modeling approaches for a senior analytics platform. When does each break down at scale?",
        answerStructured:
          "- **3NF at scale**: excellent for write integrity, terrible for analytical read patterns. Every analytical query requires 5-10+ joins; query plans become complex and slow. BI tools can't auto-generate sensible queries. Breaks when: query complexity exceeds what analysts can sustain, or when join selectivity is poor on large tables.\n- **Star schema at scale**: the analytics standard for a reason — one join per dimension, BI-tool friendly, SCD2 handles history. Breaks when: the number of distinct grain dimensions becomes very large (hundreds of dimensions), when the model is too rigid for evolving questions (adding a new dimension requires backfilling the fact), or when users always need the same pre-joined shape (→ OBT better for that specific case).\n- **One Big Table at scale**: maximum read speed for the specific pre-joined shape. Breaks when: the wide table has hundreds of columns and schemas drift constantly; when the OBT is joined as input to further queries (losing the performance benefit); or when there are many distinct query patterns (each needs a different OBT — you've re-created the problem).\n- **At scale, the real architecture**: 3NF in the source layer (operational systems), star schema in the curated presentation layer (dimensional marts), OBT as derived read-optimized snapshots for specific high-traffic patterns (dashboards, ML feature stores). No single approach at all layers.",
        explanationDeep:
          "The senior answer rejects the premise that one approach dominates. Real data platforms at scale use all three in different layers of the same architecture. The source database is 3NF (OLTP). The warehouse mart layer is a star schema (curated, versioned, tested). The BI layer or ML feature store may consume OBT materialized views that pre-join the mart for specific consumers.\n\nThe star schema's main scaling challenge is schema evolution: once a fact table is loaded with millions of rows, adding a new dimension requires either a backfill (expensive) or accepting NULL for historical rows. This is where the OBT's rigidity and the star's flexibility trade off: a star schema fact table needs a new foreign key column; an OBT needs all its columns rebuilt. Neither is free.\n\nColumnar compression changes the OBT trade-off significantly: a fact table with 200 columns where each query only touches 5 is barely more expensive than a 5-column table in a columnar warehouse, because unread columns aren't scanned. This is why teams like Netflix, Airbnb, and LinkedIn have documented OBT patterns for their feature stores and specific analytics products — the columnar engine makes wide tables tractable in ways that row-oriented databases never could.",
        interviewerLens:
          "The answer I'm checking for is 'use all three at different layers' — not declaring a winner. The 3NF → star → OBT layered architecture is how sophisticated data platforms actually work. The columnar-storage nuance for OBT is the up-to-date insight I'm looking for (shows they're reading 2024-era analytics engineering content, not Kimball 1996 alone). If they can name where each approach breaks down at scale, they've managed a real warehouse at real volume.",
        followupChain: [
          {
            question: "How would you decide whether to refactor a 3NF warehouse into a star schema?",
            answer: "Trigger points: analysts spending more time writing joins than writing business logic; BI tool query performance consistently poor; new engineers taking weeks to understand the query patterns; no clear mart layer that encapsulates dimension history. The refactor is a phased project: build the dimensional mart in parallel (dbt models on top of the existing 3NF source), migrate BI tool connections over mart by mart, eventually deprecate direct 3NF access. Don't big-bang rebuild."
          }
        ],
        redFlags: [
          {
            junior: "\"Star schema is always the right approach for analytics.\"",
            senior: "\"Star schema is the right default for the curated mart layer, but real platforms use 3NF at the source, star in the mart, and OBT for specific high-traffic consumers. The architecture has layers, not one winning pattern.\""
          }
        ],
        alternatePhrasings: [
          "\"Our analytics warehouse is 3NF — should we refactor to a dimensional model?\"",
          "\"When does a star schema break down and what do you do then?\"",
          "\"Compare normalized, dimensional, and wide table approaches for a senior team.\""
        ],
        interviewContexts: [
          "Senior analytics engineering architecture discussion",
          "Staff data engineer warehouse design round",
          "Asked at a company transitioning from a 3NF Redshift warehouse to a dbt-modeled star schema"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 17,
        questionText:
          "You need to model a process that tracks order fulfilment through 5 stages. Compare transaction fact, periodic snapshot, and accumulating snapshot for this use case — which do you choose and why?",
        code: [
          {
            lang: "sql",
            label: "accumulating snapshot",
            lines: [
              "-- one mutable row per order",
              "CREATE TABLE fct_fulfilment (",
              "  order_key BIGINT,",
              "  stage1_date DATE, ... stage5_date",
              ");",
              "SELECT order_key,",
              "  stage5_date - stage1_date AS days;",
            ],
          },
        ],
        answerStructured:
          "- **Transaction fact**: one row per stage transition event. You'd have 5 rows per order (one per stage). Good for event-level analysis ('how many orders hit stage 3 today?'), but answering 'how long did it take to go from stage 1 to stage 5?' requires a self-join or sessionization query. Grain = event.\n- **Periodic snapshot**: one row per order per time period (e.g., daily). Records the current stage of each order daily. Good for 'how many orders were at stage 3 on a given date?' — but doesn't directly answer 'how long between stage 1 and stage 3?' without pivot/lag logic. Grain = (order, period).\n- **Accumulating snapshot**: one row per order, updated in place as stages complete. Has columns `stage_1_date`, `stage_2_date`, ... `stage_5_date`. Directly answers 'time from stage 1 to stage 5' as `DATEDIFF(stage_5_date, stage_1_date)`. Grain = business process instance.\n- **Winner for order fulfilment**: **accumulating snapshot**. The business question is 'how long does each stage take and where are orders stuck?' — the accumulating snapshot answers this in a single row per order, no self-join needed.\n- **Combined approach**: accumulating snapshot as the primary model, plus a transaction fact for event-level monitoring (real-time stage alerts, anomaly detection).",
        explanationDeep:
          "The accumulating snapshot is purpose-built for business processes with a defined lifecycle — order fulfilment, loan origination, job applications, patient care pathways. It wins whenever the primary analytical question is about the process as a whole: stage durations, bottleneck analysis, end-to-end SLA compliance. The transaction fact is better for event-level monitoring and alerting; the periodic snapshot is better for state-over-time questions.\n\nThe ETL implication is the key operational difference: accumulating snapshot rows are mutable. When an order moves from stage 3 to stage 4, you UPDATE the stage_4_date column on the existing row. This requires MERGE/upsert semantics in the ETL — unlike transaction facts which are append-only. This makes accumulating snapshots harder to implement incrementally and harder to maintain in a streaming context.\n\nA common mistake is trying to answer the accumulating-snapshot questions with transaction facts: 'just join event = stage_1 to event = stage_5 per order_id.' This works for a two-stage process but becomes a multi-step pivot/self-join nightmare for 5+ stages. The accumulating snapshot collapses that complexity into one row.",
        interviewerLens:
          "The answer I want is 'accumulating snapshot for order fulfilment, because stage-duration calculations are a single DATEDIFF per row.' The comparison should include the ETL implication: accumulating snapshot rows are mutable (UPDATE in place), transaction facts are immutable (append-only). Candidates who choose transaction fact because it's 'simpler' are optimizing for ETL simplicity at the cost of analytic complexity — the wrong trade-off.",
        followupChain: [
          {
            question: "How do you handle an order that skips a stage (goes from stage 2 directly to stage 4)?",
            answer: "The skipped stage's date column stays NULL in the accumulating snapshot. The ETL should handle this by only updating the date for the stage that actually occurred. Queries that calculate stage duration need COALESCE or CASE logic to handle NULLs in skipped stages. Document this in the model and add a dbt test for 'stage N date must be >= stage N-1 date when both are non-null.'"
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use a transaction fact — simpler ETL.\"",
            senior: "\"Transaction facts make the ETL simpler but make the analysis harder — answering 'time from stage 1 to stage 5' requires a pivot or self-join across 5 rows. Accumulating snapshot puts that into a single DATEDIFF on one row per order.\""
          }
        ],
        alternatePhrasings: [
          "\"What's the right fact table type for a loan origination funnel?\"",
          "\"Model a patient care pathway through 6 treatment stages.\"",
          "\"How would you analyze fulfilment bottlenecks in an order pipeline?\""
        ],
        interviewContexts: [
          "Senior analytics engineering interview at a logistics or e-commerce company",
          "Data warehouse design round at a fintech (loan pipeline modeling)",
          "Healthcare analytics engineering interview"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "How do you decide between surrogate keys (integer / hash) and natural keys in a dimensional model — and when can natural keys be used in fact tables safely?",
        code: [
          {
            lang: "sql",
            label: "degenerate dim + hash key",
            lines: [
              "CREATE TABLE fct_order_items (",
              "  order_number TEXT, -- degenerate",
              "  customer_key TEXT, -- hash surr",
              "  revenue NUMERIC",
              ");",
              "-- key = md5(source_id): idempotent",
            ],
          },
        ],
        answerStructured:
          "- **Always use surrogate keys in dimensions**: decouples the warehouse from source-system key instability, enables SCD Type 2 versioning (one natural key → many surrogate rows), and allows cross-source entity resolution (same customer from two source systems gets one surrogate).\n- **Natural keys in facts as degenerate dimensions**: an order_number or invoice_id that exists in the fact at the same grain as the fact row (it IS the grain) can live in the fact as a degenerate dimension — a descriptor without a corresponding dimension table. No join needed, used for filtering and drill-through.\n- **Integer vs. hash surrogate**: integer sequences (auto-increment) are compact, fast to join, and sort by insertion order. Hash surrogates (MD5/SHA-256 of natural key) are deterministic and idempotent — the same natural key always generates the same surrogate, so you don't need a lookup to resolve it. dbt uses hash surrogates. The trade-off: hashes are larger (32-byte string vs 8-byte integer) and not sequentially sortable.\n- **When natural keys are safe in facts**: when the natural key is stable (never rekeys), unique (no duplicates), not null (all facts have one), and there's no SCD2 on the referenced entity. Rare in practice.\n- **Senior rule**: prefer surrogate keys; use natural keys in facts only as degenerate dimensions or when you can provably guarantee the above four conditions.",
        explanationDeep:
          "The degenerate dimension concept is where most candidates reveal gaps. An order_number in a line-item fact table is at the same grain as the fact — there's no separate dim_order table because the order event IS the fact. The order_number is a descriptor that lets users filter or drill into a specific order without a separate join. It's called degenerate because it's a dimension attribute that 'degenerated' (simplified) into the fact table.\n\nHash vs. integer surrogates is a practical question that's become more relevant with dbt's popularization of hash-based surrogate keys. The dbt-utils `generate_surrogate_key()` generates MD5 hashes — useful because you don't need a surrogate key sequence table, and re-running the pipeline produces the same keys (idempotent). The cost: 32-byte strings are larger than 8-byte integers, and join performance on a 32-byte string is meaningfully slower at very large scale (hundreds of billions of rows). At typical scale (millions to low billions), the difference is negligible and the idempotency benefit often wins.",
        interviewerLens:
          "I'm checking two things: whether they know the degenerate dimension pattern (natural key in a fact as a non-joined descriptor), and whether they can explain the hash vs. integer trade-off with the idempotency argument. Most candidates know 'use surrogate keys in dimensions' — the degenerate dimension and the hash-surrogate idempotency insight separate seniors from mid-levels.",
        followupChain: [
          {
            question: "How do you reconcile the same customer from two different source systems into one dimension row?",
            answer: "Entity resolution: use a matching/deduplication step that identifies that CRM customer_id=12345 and ERP customer_id=ABC are the same person (matching on email, phone, or a golden record match). Assign a single warehouse surrogate key to the resolved entity. The dimension stores both source IDs as natural key columns (crm_customer_id, erp_customer_id) alongside the warehouse surrogate. All facts from both source systems are stamped with the single warehouse surrogate."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use the source customer_id directly as the fact's foreign key.\"",
            senior: "\"That breaks if the source rekeys, and doesn't support SCD Type 2 versioning. I use surrogate keys in dimensions; only natural keys that are at the fact grain and stable live directly in the fact as degenerate dimensions.\""
          }
        ],
        alternatePhrasings: [
          "\"Should I use the CRM customer ID or generate a new key for my dimension?\"",
          "\"What is a degenerate dimension and when do you use it?\"",
          "\"How do you handle customers that exist in both Salesforce and SAP?\""
        ],
        interviewContexts: [
          "Senior analytics engineering interview at a multi-source enterprise data warehouse",
          "dbt architecture discussion on key strategy",
          "Data platform design round at a company post-acquisition with two CRM systems"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["Star Schema", "3NF", "One Big Table"],
        asked: 21,
        questionText:
          "Star schema vs. 3NF vs. One Big Table — compare all three on read performance, write complexity, schema flexibility, and BI-tool compatibility at the senior level.",
        answerStructured:
          "| Dimension | 3NF | Star Schema | One Big Table |\n|---|---|---|---|\n| **Read performance** | Poor (many joins) | Good (one join per dim) | Excellent (no joins) |\n| **Write complexity** | Low (normalized, single update) | Medium (dim + fact separately, SCD logic) | High (rebuild wide table on any change) |\n| **Schema flexibility** | High (add columns to one table) | Medium (adding a dimension = backfill FK in fact) | Low (adding a column ripples everywhere) |\n| **BI-tool compatibility** | Poor (complex join paths) | Excellent (designed for BI) | Good (simple, but fragile on schema change) |\n| **History tracking** | Hard (no built-in SCD) | Native (SCD Type 1/2) | None (point-in-time requires rebuilds) |\n| **Best for** | OLTP, data integrity | General analytics layer | Specific known queries, ML features |\n- **At scale**: use 3NF at the source, star schema for the authoritative mart layer, OBT for read-optimized derivatives. No single winner across all concerns.\n- **Modern shift**: columnar storage + cheap compute makes OBT more viable than it was in the row-store era. But star schema remains the standard because its flexibility outlasts any specific query pattern.",
        explanationDeep:
          "The table comparison forces a structured trade-off analysis rather than a vague 'it depends.' Read performance is the dimension where OBT dominates: no joins means the engine can satisfy a query from a single table scan (in a columnar warehouse, scanning only the needed columns). Star schema's one-join-per-dimension is close — modern query optimizers handle star schema joins very efficiently. 3NF's many-join chains are genuinely slow for analytical queries.\n\nSchema flexibility is where OBT loses hardest: when a new dimension attribute arrives, the OBT must be rebuilt. The rebuild of a 10TB OBT is expensive and blocks downstream consumers. Star schema's fact table only needs a new FK column; the dimension absorbs the new attribute. 3NF absorbs schema changes most cheaply because each attribute lives in the most natural table.\n\nThe history-tracking row tells the story of why star schema dominates analytics: SCD Type 1/2 is a native, well-understood pattern for star schema. For 3NF, you'd need to build SCD logic from scratch (no standard pattern). For OBT, point-in-time accuracy requires rebuilding the wide table for each historical snapshot — prohibitively expensive at scale.",
        interviewerLens:
          "The structured comparison table is what I'm looking for — not prose 'it depends.' I want each approach evaluated on the same dimensions so I can see the candidate thinks systematically. The 'history tracking: native in star, none in OBT' row is the key: it explains why star schema isn't just 'good practice' but structurally superior for any model that needs to track attribute changes over time. The modern-nuance closing (columnar makes OBT viable, star still wins on flexibility) shows they're current.",
        followupChain: [
          {
            question: "A team wants to use OBT exclusively to avoid the complexity of SCDs. What's your advice?",
            answer: "Valid short-term, breaks long-term. OBT can sidestep SCD complexity by materializing daily snapshots of the wide table — but at significant storage cost (N daily snapshots × table size). The 'rebuild it fresh each day' approach works until your OBT grows to tens of TBs. At that point, SCD2 on a star schema dimension is far cheaper than full daily OBT rebuilds. I'd advise starting with OBT if the team is small and data is manageable, with a planned migration path to star schema before OBT rebuilds become prohibitive."
          }
        ],
        redFlags: [
          {
            junior: "\"Star schema is just better — 3NF and OBT are wrong.\"",
            senior: "\"Each serves a different workload and layer. 3NF at the source, star in the mart, OBT for specific read-optimized derivatives. The architecture has layers.\""
          }
        ],
        alternatePhrasings: [
          "\"Which modeling approach would you use for a new enterprise warehouse?\"",
          "\"Pros and cons of One Big Table vs dimensional model at scale.\"",
          "\"We're debating between a normalized warehouse and a star schema — help us decide.\""
        ],
        interviewContexts: [
          "Staff analytics engineer architecture discussion",
          "Senior DE system design round at a Series D analytics platform",
          "Asked at a company choosing between Kimball and a flat OBT approach"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "Design a Point-in-Time (PIT) table and explain when it outperforms direct SCD2 range joins.",
        "How do you implement entity resolution when customers exist in multiple source systems?",
        "Model a multi-currency financial fact table — how do you handle exchange rate conversion?",
        "Design a role-playing dimension (same dimension used twice in one fact table with different semantics).",
        "How do you model a slowly changing hierarchy (org chart that changes) in a dimensional model?"
      ],
      decisions: [
        "When does the operational cost of SCD Type 2 outweigh its analytical benefit?",
        "Accumulating snapshot vs. multiple transaction facts — when does each win?",
        "Should late-arriving dimensions use the unknown placeholder or inferred dimension pattern?"
      ],
      quickRef: [
        "What is a PIT (Point-in-Time) table?",
        "What is a role-playing dimension?",
        "What is an inferred dimension member?",
        "How does the unknown member placeholder (-1) prevent NULL FK issues?",
        "What is the weighting factor in a bridge table?",
        "What is the difference between a bridge table and a factless fact table?",
        "What is entity resolution in the context of surrogate keys?",
        "Hash surrogate key vs. integer surrogate key — trade-offs in one line each?",
        "What is a degenerate dimension?",
        "What does 'point-in-time correctness' mean for a historical report?"
      ],
      redFlags: [
        {
          junior: "\"For SCD2, join on natural_key WHERE is_current = 1.\"",
          senior: "\"That returns today's attributes on historical facts — defeating Type 2. Use the surrogate key stamped at fact load time, or a temporal range join.\""
        },
        {
          junior: "\"For M:N relationships, add a second FK column to the fact table.\"",
          senior: "\"Multiple FK columns break the grain and don't scale. Use a bridge table with one row per (fact, dim member), and a weighting factor if revenue allocation is needed.\""
        },
        {
          junior: "\"Block fact loading until all dimensions are loaded.\"",
          senior: "\"At scale that's not feasible — facts arrive continuously. Use an unknown placeholder (-1) with a backfill job, or inferred dimension rows with Type 1 resolution on arrival.\""
        },
        {
          junior: "\"Star schema is the single right approach for all analytics.\"",
          senior: "\"3NF at the source, star in the mart, OBT for specific high-traffic derived tables. The architecture uses all three at different layers.\""
        }
      ],
      checklist: [
        "SCD2 end-to-end: change detection → atomic MERGE → surrogate stamping at fact load → point-in-time query (not is_current = 1 join)",
        "Bridge table pattern with weighting factor and double-counting pitfall",
        "Late-arriving dimension patterns: unknown placeholder (-1), backfill job, inferred dimension rows",
        "Three-layer architecture: 3NF source → star schema mart → OBT derivatives",
        "Accumulating snapshot: mutable rows, UPDATE semantics, stage-duration DATEDIFF analysis"
      ],
      behavioral: [
        "Tell me about the most complex dimensional model you designed — what were the key grain and SCD decisions?",
        "A time you found a SCD2 implementation bug causing wrong historical reports — how did you diagnose and fix it?",
        "How you navigated a trade-off between modeling correctness and implementation complexity with a stakeholder."
      ],
      reverse: [
        "How mature is SCD2 tracking in the current warehouse — are historical reports point-in-time correct?",
        "Are there M:N relationships in the current model that are handled with multi-column FKs in the fact?",
        "Is there a late-arriving dimension strategy, or do late facts get dropped / NULLed?"
      ]
    }
  }
};
