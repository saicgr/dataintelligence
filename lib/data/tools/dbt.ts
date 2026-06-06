import type { Authored, ToolTopics } from "../content-de";
import type { Level } from "../../types";

export const levels: Partial<Record<Level, { authored: Authored[]; topics: ToolTopics }>> = {
  // ─────────────────────────────────────────────────────────────
  // JUNIOR  — ref/source, materializations (view/table/ephemeral),
  //           generic tests, seeds, dbt_project.yml, DAG basics
  // ─────────────────────────────────────────────────────────────
  junior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 31,
        questionText:
          "What is the difference between ref() and source() in dbt, and why does it matter?",
        code: [
          {
            lang: "dbt",
            label: "stg model",
            lines: [
              "-- raw table -> declared source",
              "select * from",
              "  {{ source('jaffle','orders') }}",
              "-- mart refs the dbt model",
              "select * from",
              "  {{ ref('stg_orders') }}",
            ],
          },
        ],
        answerStructured:
          "- **`ref('model_name')`**: references another dbt model inside your project. dbt uses it to build the DAG — model A's dependency on model B is declared by calling `ref('B')` in A's SQL. The function also resolves to the correct fully-qualified table name per target environment (dev vs prod), so you never hardcode schema names.\n- **`source('schema', 'table')`**: references a raw table that exists outside your dbt project — data loaded by Fivetran, Airbyte, or a custom loader. Defined in a `sources:` YAML block, which lets dbt track source freshness, generate docs, and test the raw layer without you managing those tables.\n- **Why it matters**: if you hardcode a table name (e.g., `FROM raw.orders`) instead of using `source()`, dbt has no idea that model depends on that table — it disappears from the lineage graph and CI state comparison breaks. Same for `ref()` — bypassing it with a literal name severs the DAG edge.\n- **Operational difference**: `ref()` builds are ordered automatically; `source()` is the entry point for freshness checks (`dbt source freshness`).",
        explanationDeep:
          "The ref/source distinction is the first thing that separates someone who has only read about dbt from someone who has used it. Hardcoded table names are one of the most common junior mistakes, and the failure mode is silent: the model still runs, but dbt's lineage graph is wrong, `state:modified+` CI selection misses downstream dependents, and the docs site shows a broken DAG.\n\n`source()` is not just cosmetic — the `sources:` YAML block lets you declare `loaded_at_field` and freshness thresholds, so `dbt source freshness` can alert your team if raw data is stale before you transform it. This is a cheap upstream data quality gate that many teams skip when they're small and regret when they scale.\n\nThe environment-awareness of `ref()` is the other key: in dev, `ref('orders')` resolves to `dev_yourname.orders`; in prod it resolves to `analytics.orders`. That substitution is automatic. Hardcode the prod schema and your dev runs write to prod — a real incident risk.",
        interviewerLens:
          "I want to hear the DAG dependency angle, not just 'ref is for models, source is for raw tables.' Candidates who mention that hardcoded table names break lineage and CI state selection have clearly shipped something to production and learned the lesson. The freshness-check angle on source() is the bonus signal that shows breadth beyond the basics. Red flag: saying 'I use ref() everywhere' without distinguishing it from source() — they serve different layers.",
        followupChain: [
          {
            question: "What happens if you hardcode a schema name instead of using ref()?",
            answer: "The model runs, but dbt can't see the dependency edge. The lineage graph is wrong, `--select state:modified+` CI won't rebuild downstream models when the upstream changes, and the docs site shows a missing node. It's a silent correctness bug, not a loud error."
          },
          {
            question: "How do you test the freshness of a source?",
            answer: "In the sources YAML, declare `loaded_at_field: updated_at` and a `freshness:` block with `warn_after` and `error_after` thresholds. Then run `dbt source freshness`. dbt queries `MAX(loaded_at_field)` and compares it to now, failing or warning if the gap exceeds the threshold."
          },
          {
            question: "Can you use ref() to reference a model in a different dbt project?",
            answer: "Yes — with dbt Mesh / cross-project refs (dbt Cloud + dbt Core v1.6+). The upstream project must mark the model as `access: public` and define a contract. The downstream project adds the upstream project to its `dependencies.yml`. This is a senior feature; most single-project shops never need it."
          }
        ],
        redFlags: [
          {
            junior: "\"I just write the table name directly in my FROM clause.\"",
            senior: "\"I always use ref() for dbt models and source() for raw tables — hardcoding breaks the DAG, lineage docs, and CI state selection.\""
          },
          {
            junior: "\"ref() and source() do the same thing.\"",
            senior: "\"ref() wires model-to-model dependencies in the DAG; source() declares raw external inputs and enables freshness checks — they serve different layers.\""
          }
        ],
        alternatePhrasings: [
          "\"What does ref() actually do in dbt?\"",
          "\"How does dbt know the order to run models?\"",
          "\"What is a source in dbt and why define it in YAML?\""
        ],
        interviewContexts: [
          "Asked in virtually every dbt junior/mid screen",
          "Entry-level analytics engineer loop at a Series B SaaS company",
          "dbt fundamentals question at a data-platform team onsite"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 27,
        questionText:
          "Walk me through the four built-in dbt materializations — view, table, incremental, and ephemeral. When do you choose each?",
        code: [
          {
            lang: "dbt",
            label: "config",
            lines: [
              "{{ config(",
              "  materialized='view'      -- light",
              "  -- 'table'      rebuild+store",
              "  -- 'incremental' new rows",
              "  -- 'ephemeral'  inlined CTE",
              ") }}",
            ],
          },
        ],
        answerStructured:
          "- **View**: a SQL `CREATE VIEW` statement. Zero storage cost; query runs fresh every time it is read. Choose for lightweight transformations with low read frequency where staleness is fine.\n- **Table**: dbt drops and re-creates the physical table on every `dbt run`. Storage cost, but fast reads. Choose when downstream consumers need predictable query times and the full rebuild is affordable.\n- **Incremental**: on first run, creates the table; on subsequent runs, only processes new/changed rows (gated by `is_incremental()`) and merges or inserts. Choose for large fact tables where a full rebuild is too slow or expensive.\n- **Ephemeral**: never materialized in the database. The model's SQL is inlined as a CTE into every model that `ref()`s it. Choose for reusable sub-transformations you want to share without creating a DB object.\n- **Decision rule**: start with `view`; upgrade to `table` when read performance suffers; upgrade to `incremental` when full rebuilds become too slow; use `ephemeral` for shared CTE logic that doesn't need to exist as a standalone object.",
        explanationDeep:
          "The materialization choice is really a cost/complexity trade-off. Views are free but every downstream query recomputes the logic. Tables are fast to read but rebuild cost grows with data volume. Incremental is the power option — it keeps build times sub-linear as data grows — but it adds complexity: you must manage `unique_key`, the `is_incremental()` filter, `on_schema_change` behavior, and occasional full-refresh to fix drift.\n\nEphemeral is the least understood. It sounds like a performance optimization but it's actually a code organization tool: you break shared logic into a reusable named block without polluting the database with a table or view. The trade-off is debuggability — you can't `SELECT * FROM an_ephemeral_model` in your warehouse console because it doesn't exist there.\n\nA common junior mistake is defaulting to `table` everywhere. For a model that serves one dashboard query once per hour, a view is strictly better — zero storage cost, zero rebuild time, and the data is always fresh. Save `table` and `incremental` for models with real read volume or volume that makes full rebuilds costly.",
        interviewerLens:
          "I want the decision logic, not just the definitions. Anyone can memorize 'view = no storage.' I want to hear: 'I'd use incremental for fact tables that are too large to rebuild daily, and I'd stick with views for staging models that are only read by downstream dbt models.' The ephemeral answer often reveals whether someone has actually read the docs deeply — most junior candidates skip it. Red flag: saying 'I always use table because it's faster' without mention of rebuild cost or volume threshold.",
        followupChain: [
          {
            question: "Can you mix materializations in the same project?",
            answer: "Yes — you set defaults in dbt_project.yml per folder and override per model with {{ config(materialized='...') }}. A common pattern: staging/ defaults to view, marts/ defaults to table, and specific large fact tables are overridden to incremental."
          },
          {
            question: "What is a custom materialization and when would you write one?",
            answer: "A Jinja macro in macros/ that defines how dbt should CREATE or REPLACE the model. Use it when the built-ins don't match your warehouse's features — e.g., a Snowflake dynamic table, a Redshift materialized view with auto-refresh, or a Databricks Delta Live Table. It requires understanding the adapter API."
          }
        ],
        redFlags: [
          {
            junior: "\"I use table for everything because it's faster.\"",
            senior: "\"I start with view, upgrade to table when read performance is a problem, and use incremental when full rebuilds become cost-prohibitive — ephemeral for shared CTE logic.\""
          },
          {
            junior: "\"Incremental is always better than table.\"",
            senior: "\"Incremental adds complexity — unique_key, on_schema_change, full-refresh escape hatch. I only reach for it when the rebuild time actually hurts.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you decide what materialization to use for a dbt model?\"",
          "\"What is an incremental model?\"",
          "\"What is an ephemeral model and when would you use it?\""
        ],
        interviewContexts: [
          "Asked at every junior-to-mid dbt screen",
          "Analytics engineer loop at a Series A e-commerce company",
          "dbt Cloud fundamentals interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 22,
        questionText:
          "What are dbt's built-in generic tests, and how do you add them to your models?",
        code: [
          {
            lang: "dbt",
            label: "schema.yml",
            lines: [
              "columns:",
              "  - name: order_id",
              "    tests: [unique, not_null]",
              "  - name: status",
              "    tests:",
              "      - accepted_values:",
              "          values: ['new','paid']",
            ],
          },
        ],
        answerStructured:
          "- dbt ships four **generic tests**: `unique`, `not_null`, `accepted_values`, and `relationships`.\n- `unique`: asserts every value in a column is distinct. Catches duplicate primary keys.\n- `not_null`: asserts no row has a NULL in the column. Catches missing required fields.\n- `accepted_values`: asserts every value appears in a declared list. Catches rogue statuses, typos, or unexpected enum values.\n- `relationships`: asserts every value in a column exists in a referenced column of another model (referential integrity). Catches broken foreign keys.\n- **Declared in YAML** alongside the model:\n  ```yaml\n  models:\n    - name: orders\n      columns:\n        - name: order_id\n          tests:\n            - unique\n            - not_null\n        - name: status\n          tests:\n            - accepted_values:\n                values: [placed, shipped, returned]\n  ```\n- Run with `dbt test` or `dbt build` (which runs models and tests together).\n- **Singular tests** (plain SQL files in `tests/`) handle custom business logic that doesn't fit the generic pattern.",
        explanationDeep:
          "Generic tests are the first line of data quality defense and cost almost nothing to add. The `unique` + `not_null` pair on the primary key column of every model should be the minimum bar — it asserts that the model produces a well-formed primary key and catches fan-out or deduplication bugs immediately in CI.\n\nThe `relationships` test is the most powerful and most underused. It's essentially a foreign key check across dbt models: asserts that every `customer_id` in `fct_orders` exists in `dim_customers`. Without it, an upstream model could drop a customer ID and the downstream model would silently have orphaned rows.\n\nThe distinction between generic and singular tests matters in interviews. Generic = parameterized, reusable, YAML-configured. Singular = a SQL file in `tests/` that returns zero rows when the test passes and failing rows when it fails. Use singular for business logic assertions like 'refund amount should never exceed order amount' — things you can't express with column-level YAML configs.",
        interviewerLens:
          "I want all four named correctly and the YAML syntax outlined correctly. Candidates who add `relationships` to their answer without being prompted understand the referential integrity angle. The generic vs singular distinction is the mid-level separator — juniors know the four generic tests, mid-level candidates understand when a singular test is the right tool. Red flag: 'I run tests after deployment, not in CI' — tests are most valuable when they catch issues before code merges.",
        followupChain: [
          {
            question: "How do you write a custom generic test?",
            answer: "Create a SQL file in tests/generic/ using Jinja: {% test my_test_name(model, column_name) %} SELECT ... FROM {{ model }} WHERE {{ column_name }} violates the condition {% endtest %}. The macro returns rows that fail the assertion. Reference it in YAML the same as built-ins."
          },
          {
            question: "What does setting severity: warn do on a test?",
            answer: "By default, a failing test returns exit code 1 and blocks the pipeline. severity: warn changes it to a warning — dbt logs the failure but returns exit code 0, so CI continues. Useful for known issues you're tracking but not yet fixing, or for non-blocking data quality signals."
          },
          {
            question: "How do you run only tests for a specific model in CI?",
            answer: "dbt test --select my_model, or dbt test --select my_model+ to include downstream models. In CI on a PR, the pattern is dbt build --select state:modified+ to run models and tests for changed models and their dependents only."
          }
        ],
        redFlags: [
          {
            junior: "\"I don't add tests — I validate data manually.\"",
            senior: "\"I add unique + not_null on every primary key, accepted_values on enum columns, and relationships for foreign keys. Tests run in CI on every PR.\""
          },
          {
            junior: "\"I put all my tests in the tests/ folder as SQL files.\"",
            senior: "\"Generic tests in YAML for standard assertions, singular SQL tests for custom business logic — different tools for different purposes.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you ensure data quality in a dbt project?\"",
          "\"What is the difference between schema tests and data tests in dbt?\"",
          "\"How do you test a dbt model?\""
        ],
        interviewContexts: [
          "Asked at a junior analytics engineer screen",
          "dbt data quality round at a fintech startup",
          "Entry-level data engineer interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "low",
        asked: 14,
        questionText:
          "What is a dbt seed, and when should you use one versus pulling data from a source?",
        code: [
          {
            accent: "bug",
            lang: "dbt",
            label: "id 007 -> 7",
            lines: [
              "# country_codes.csv has '007'",
              "seeds:",
              "  my_project:",
              "    # dbt infers int -> drops 0s",
            ],
          },
          {
            accent: "fix",
            lang: "dbt",
            lines: [
              "seeds:",
              "  my_project:",
              "    +column_types:",
              "      code: varchar(3)",
            ],
          },
        ],
        answerStructured:
          "- A **seed** is a CSV file in the `seeds/` directory of your dbt project. `dbt seed` loads it into the database as a table.\n- **Use seeds for**: small, slowly-changing reference data that lives alongside your code — country codes, currency lookups, internal cost mappings, feature flags, or test fixtures. The data is version-controlled in git.\n- **Do not use seeds for**: large datasets (seeds are not designed for performance at scale), frequently-changing data (manual CSV updates are error-prone), or data that comes from an upstream system (use a source instead).\n- **Advantages over a source**: seeds are fully version-controlled, portable across environments, and don't require a loader. If you need 50-row lookup table, a seed is simpler than orchestrating a Fivetran connector.\n- **Typing**: by default dbt infers column types from the CSV. Override with `column_types` in `dbt_project.yml` to prevent type coercion issues (especially with IDs that look like numbers).",
        explanationDeep:
          "Seeds fill a specific niche: small reference tables that belong in your codebase, not in an upstream data system. The classic examples are ISO country codes, internal department-to-cost-center mappings, or manually-curated tier lists. These don't come from an operational system, they're authored by the data team, and they're small enough that a CSV is the right format.\n\nThe failure mode for seeds is mis-using them for anything large or frequently changing. I've seen teams try to use a 100MB CSV as a seed for reference data they should have put in a source — it works once but becomes a pain to maintain and is slow to load. Similarly, if the data changes weekly and lives in a Google Sheet, it should be loaded via a connector (Fivetran, Airbyte) and treated as a source, not manually exported to CSV and committed to git.\n\nType inference is a subtle gotcha: if your CSV has a column `user_id` with values like `007`, dbt may cast it as integer and truncate the leading zeros. Always specify `column_types` for ID columns that must be strings.",
        interviewerLens:
          "This is a calibration question. Juniors know 'seeds are CSV files.' Mid-level candidates know when seeds are appropriate vs overkill. The type-inference gotcha with ID columns is a tell that someone has actually shipped a seed and hit the issue. Red flag: 'I use seeds for large datasets' — seeds are explicitly not for scale.",
        followupChain: [
          {
            question: "How do you prevent a seed from being accidentally dropped when you run dbt seed again?",
            answer: "Seeds are fully replaced on every dbt seed run. There's no incremental mode for seeds. For data you can't afford to lose, use a source + table model instead."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd use a seed for any static data.\"",
            senior: "\"Seeds are for small, code-owned reference tables. Anything large, frequently changing, or sourced from an upstream system belongs in a source with a proper loader.\""
          }
        ],
        alternatePhrasings: [
          "\"What is the seeds/ folder in dbt for?\"",
          "\"How do you load reference data into dbt?\""
        ],
        interviewContexts: [
          "dbt fundamentals screen at a data team",
          "Asked at an entry-level analytics engineer interview"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 18,
        questionText:
          "How do you decide where to put logic in a dbt project — staging, intermediate, or marts?",
        answerStructured:
          "- **Staging (`stg_`)**: one model per source table. Thin transformation layer: rename columns to consistent conventions, cast types, and apply light filtering (e.g., exclude test accounts). Always materialized as `view`. Never join across sources here.\n- **Intermediate (`int_`)**: join, aggregate, and apply business logic across staging models. Fan-out or fan-in of staging data. Rarely expose directly to BI tools. Materialized as `view` or `ephemeral`.\n- **Marts (`fct_`, `dim_`)**: the final, business-facing models. Wide, aggregated, report-ready. `fct_` for additive facts (orders, events); `dim_` for descriptive entities (customers, products). Materialized as `table` or `incremental`.\n- **Decision rule**: if it touches raw source data → staging. If it joins across sources or applies business rules → intermediate. If it's the thing a BI tool queries → mart.\n- Keeping staging thin means schema changes in the source only break one model (the stg_ model), not every mart downstream.",
        explanationDeep:
          "The staging → intermediate → marts pattern is the most widely adopted dbt project structure, codified by the dbt Labs style guide. Its value is isolation of concerns: a schema change in a source system (e.g., `customer_name` renamed to `name`) only requires updating one `stg_customers.sql` file; the 15 downstream models that ref it are insulated because they use the standardized column name from staging.\n\nThe intermediate layer is the most team-specific. Some projects skip it and go straight from staging to marts; others have deep intermediate trees for complex business logic. The signal that you need an intermediate layer is: 'multiple mart models contain the same JOIN or business rule.' Extract it into an intermediate model and ref it from the marts — DRY principle applied to SQL.\n\nMart naming matters semantically. `fct_` tables are typically tall and narrow — one row per event or transaction, with additive numeric measures. `dim_` tables are wide and reference-like — one row per entity (customer, product) with descriptive attributes. Keeping them separate makes downstream SQL cleaner and makes the data model legible to business stakeholders.",
        interviewerLens:
          "I want the three-layer model described correctly with a rationale, not just the names. The staging-isolation-of-schema-changes argument is the signal I look for — it shows you understand why the layering exists, not just that it exists. Red flag: 'I put all logic in one model' — this creates brittle, un-testable monoliths. Also a red flag: putting joins in staging models, which breaks the contract that staging is 1:1 with source tables.",
        followupChain: [
          {
            question: "What naming conventions do you use for dbt models?",
            answer: "Standard: stg_ prefix for staging, int_ for intermediate, fct_ and dim_ for marts. File and model names match (stg_orders.sql produces a relation called stg_orders). Source filenames follow source_schema__table pattern (stg_salesforce__accounts.sql) to make origin obvious."
          },
          {
            question: "When would you NOT use the staging layer?",
            answer: "For a tiny project with one source and three models, the staging layer can be overkill. The pattern pays off as the project scales — more sources, more downstream consumers, more team members. Below ~10 models, a flat structure is fine."
          }
        ],
        redFlags: [
          {
            junior: "\"I put all the logic in the final model.\"",
            senior: "\"Staging isolates schema changes to one place; intermediates share business logic; marts are what BI tools query — each layer has a distinct contract.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you structure a large dbt project?\"",
          "\"What is the difference between a staging model and a mart?\"",
          "\"How do you prevent a source rename from breaking 20 downstream models?\""
        ],
        interviewContexts: [
          "Junior-to-mid dbt architecture question",
          "Analytics engineering loop at a Series B company",
          "dbt project structure discussion at a data platform team"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "low",
        asked: 11,
        questionText:
          "How do you choose between running dbt run and dbt build in CI?",
        code: [
          {
            lang: "dbt",
            label: "CI",
            lines: [
              "# run only: skips tests",
              "dbt run",
              "# build: models+tests, DAG order",
              "# fail-fast on changed + downstream",
              "dbt build --select state:modified+",
            ],
          },
        ],
        answerStructured:
          "- **`dbt run`**: executes only the SQL models. Tests, snapshots, and seeds are not run unless called separately.\n- **`dbt build`**: runs models + tests + snapshots + seeds in DAG order, stopping a downstream model if an upstream test fails. The safer, more complete CI command.\n- **In CI**: prefer `dbt build --select state:modified+` — build only changed models and downstream dependents, and run their tests. Fails fast if any test fails before continuing downstream.\n- **In production**: `dbt build` for the full DAG, or `dbt build --select tag:daily` for scheduled subsets.\n- **dbt run alone** is useful during development when you're iterating quickly and don't want tests to slow feedback — but never ship a PR where CI only ran `dbt run`.",
        explanationDeep:
          "The shift from `dbt run` to `dbt build` is a maturity signal. `dbt run` + `dbt test` called separately means a test failure doesn't stop downstream models — they build on bad data and you find out later. `dbt build` interleaves tests with model runs in DAG order, so if `stg_orders` has a failing uniqueness test, `fct_orders` never builds. This is the correct behavior: don't cascade bad data downstream.\n\nThe `state:modified+` selector in CI is what makes dbt CI fast. Instead of rebuilding the entire project on every PR, dbt compares the current `manifest.json` to the production manifest and selects only changed models and their downstream dependents. A 500-model project might only rebuild 10 models on a single-file PR. The `+` suffix means 'and everything downstream of changed models.'",
        interviewerLens:
          "The `dbt build` vs `dbt run` distinction signals whether you've set up real CI. The `state:modified+` selector signals that you've dealt with long-running CI and optimized it. Red flag: 'I just run dbt run --full-refresh in CI' — that rebuilds everything on every PR, which at scale is 30+ minutes.",
        followupChain: [
          {
            question: "What is the manifest.json and how does state:modified use it?",
            answer: "manifest.json is a complete representation of the dbt project — models, tests, sources, DAG edges — generated on every dbt run/build. state:modified compares the current project's manifest to a prior one (usually the production manifest) and selects only nodes that differ. This makes CI incremental."
          }
        ],
        redFlags: [
          {
            junior: "\"I run dbt run then dbt test separately in CI.\"",
            senior: "\"I use dbt build --select state:modified+ — it runs models and tests in DAG order so a failing test stops downstream builds, and only touches changed models and dependents.\""
          }
        ],
        alternatePhrasings: [
          "\"What dbt commands do you run in CI?\"",
          "\"How do you speed up dbt CI on a large project?\""
        ],
        interviewContexts: [
          "Junior dbt CI/CD question",
          "Analytics engineer platform discussion"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "medium",
        isComparison: true,
        comparisonTools: ["dbt", "Stored Procedures"],
        asked: 12,
        questionText:
          "Why would you choose dbt over stored procedures for data transformations?",
        answerStructured:
          "- **Version control**: dbt models are `.sql` files in git. Every change has a PR, code review, and history. Stored procs rot inside the database with no audit trail.\n- **Testing**: dbt has a first-class test framework (generic + singular tests). Procs have nothing unless you build it yourself.\n- **Lineage + docs**: `ref()` and `source()` build an automatic lineage graph and power a generated docs site. Procs you document manually — or not at all.\n- **Environment management**: dbt targets + `{{ target.schema }}` give you dev/CI/prod isolation for free. With procs, you manually manage schema names per environment.\n- **Declarative, not procedural**: dbt models are SELECT statements — you define what the data should look like, not the steps to build it (no DDL, no MERGE boilerplate). This makes code simpler and more auditable.\n- **Trade-off**: dbt is transform-only (in-warehouse ELT). Stored procs can do procedural logic, loops, and temp tables that don't fit the SELECT model. For a tiny team with three transformations, procs can be fine.",
        explanationDeep:
          "The core argument for dbt over stored procedures is software-engineering discipline applied to SQL: version control, testing, modularity, and lineage. A stored procedure is just SQL in a database object — there's no test, no PR, no history, and no automated way to see what depends on it. When a column name changes upstream, you find out when the proc fails at runtime, if at all.\n\nThe DML comparison is also important. A stored proc typically chains INSERT, UPDATE, DELETE, MERGE statements procedurally. dbt replaces all of this with a SELECT statement and lets the materialization strategy (incremental with merge strategy, for example) handle the DML. The model is shorter, testable, and environment-portable.\n\nI'm honest about the trade: dbt assumes ELT (transform in the warehouse, not in application code), and it adds a tool to learn and run. For a two-person startup with five transforms, stored procs might be the pragmatic choice. At any real scale — more than one engineer, more than a dozen transforms, or any regulatory requirement for auditability — dbt wins clearly.",
        interviewerLens:
          "I want the engineering-maturity framing (git, tests, lineage), not just 'dbt is modern and procs are old.' Candidates who can also articulate when stored procs are still reasonable show judgment rather than cargo-culting. The DML replacement angle (SELECT instead of MERGE boilerplate) is a signal that you understand dbt's design philosophy, not just its marketing.",
        followupChain: [
          {
            question: "Can dbt do row-level deletes?",
            answer: "Not natively in the declarative model. dbt handles DELETEs through soft deletes (add an is_deleted flag, filter it out downstream) or through incremental strategies (delete+insert, which deletes matching keys and reinserts). Hard DELETEs require a pre-hook or post-hook calling raw DML. This is a real limitation for GDPR right-to-erasure workflows."
          },
          {
            question: "What does ref() give you over a hardcoded table name?",
            answer: "ref() declares the dependency (DAG edge), resolves to the correct schema per environment (dev vs prod automatically), enables state-based CI selection, and shows up in the lineage graph. A hardcoded name does none of these."
          }
        ],
        redFlags: [
          {
            junior: "\"dbt is just easier SQL writing.\"",
            senior: "\"dbt brings version control, testing, lineage, and environment isolation to transforms — the engineering-maturity advantages, not just syntax convenience.\""
          }
        ],
        alternatePhrasings: [
          "\"What does dbt give you over plain SQL scripts or stored procedures?\"",
          "\"Why did your team move from stored procedures to dbt?\""
        ],
        interviewContexts: [
          "Junior analytics engineer interview at a data-migration project",
          "Asked at a company moving from a SQL Server stored-proc pipeline to dbt + Snowflake"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How does the dbt DAG work and what happens if you introduce a circular reference?",
        "What is dbt_project.yml and what can you configure there?",
        "How do you document a dbt model and generate the docs site?",
        "What is the target keyword in dbt and how does it enable environment switching?",
        "Walk me through a full dbt run from command line to warehouse table."
      ],
      decisions: [
        "View vs table materialization — when does the trade-off tip?",
        "When would you use an ephemeral model instead of a CTE in the consuming model?",
        "Seeds vs sources for reference data — what makes you choose one?"
      ],
      quickRef: [
        "What does ref() return at runtime?",
        "source() vs ref() in one sentence each",
        "Name the four built-in generic tests",
        "What does dbt seed do?",
        "What is an ephemeral model?",
        "What does dbt build do differently from dbt run?",
        "What is dbt_project.yml for?",
        "What does the models/ directory structure control?",
        "What is {{ this }} in dbt?",
        "What command generates the docs site?"
      ],
      redFlags: [
        {
          junior: "\"I hardcode the schema name in my FROM clause.\"",
          senior: "\"I always use ref() or source() — hardcoding breaks lineage and environment portability.\""
        },
        {
          junior: "\"I use table for all my models.\"",
          senior: "\"I start with view, use table for read-heavy marts, and incremental only when rebuilds become costly.\""
        },
        {
          junior: "\"Tests slow down development so I skip them.\"",
          senior: "\"Unique + not_null on every primary key is the minimum bar — tests catch bugs in CI before they reach prod.\""
        },
        {
          junior: "\"I put all my business logic directly in the final mart.\"",
          senior: "\"I layer it: staging isolates source schema changes, intermediates share logic, marts are what BI queries.\""
        },
        {
          junior: "\"I run dbt run in CI.\"",
          senior: "\"I run dbt build --select state:modified+ — runs tests in DAG order and only touches changed models.\""
        },
        {
          junior: "\"Seeds are good for any static data.\"",
          senior: "\"Seeds are for small, code-owned lookup tables — anything large or loader-fed should be a source.\""
        }
      ],
      checklist: [
        "Explain ref() vs source() with the DAG dependency angle",
        "Walk through all four materializations with a concrete when-to-use for each",
        "Know all four generic tests and the YAML syntax to declare them",
        "Explain staging → intermediate → marts layering and why it isolates schema changes",
        "Know dbt build vs dbt run and the state:modified+ CI pattern"
      ],
      behavioral: [
        "Tell me about the first dbt project you set up — what would you do differently now?",
        "Describe a time a missing dbt test let a data quality issue reach production.",
        "How do you onboard a new engineer to a dbt project with 100+ models?"
      ],
      reverse: [
        "What is the dbt project structure like — how many models and sources?",
        "Do you run dbt in CI on every PR, and what does the pipeline look like?",
        "What materializations are most common in the project today?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // MID  — Incremental models + unique_key + incremental strategies,
  //        snapshots / SCD2, on_schema_change, staging→marts layering,
  //        macros and Jinja, debugging
  // ─────────────────────────────────────────────────────────────
  mid: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 29,
        questionText:
          "Walk me through how dbt incremental models work, including unique_key, is_incremental(), and what goes wrong without them.",
        code: [
          {
            lang: "dbt",
            label: "incremental",
            lines: [
              "{{ config(",
              "  materialized='incremental',",
              "  unique_key='id') }}  -- upsert",
              "select * from {{ ref('events') }}",
              "{% if is_incremental() %}",
              "where updated_at >",
              "  (select max(updated_at) from {{ this }})",
            ],
          },
        ],
        answerStructured:
          "- On the **first run**, dbt issues `CREATE TABLE AS SELECT` — a full build.\n- On **subsequent runs**, dbt wraps the SELECT in a MERGE, delete+insert, or insert depending on the incremental strategy. Only rows passing the `{% if is_incremental() %}` filter are processed.\n- **`is_incremental()`** is a Jinja function that returns `true` only on incremental runs, letting you write a filter like `WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})` to restrict the input to new rows.\n- **`unique_key`** tells dbt which column(s) to use as the deduplication key in the MERGE. Without it, dbt uses the `append` strategy and inserts every row from the incremental SELECT — meaning re-sent or corrected rows duplicate instead of update.\n- **Without `is_incremental()` filter**: every run reprocesses the entire source table, defeating the purpose of incremental.\n- **Without `unique_key`**: duplicates compound on every run silently.\n- **`{{ this }}`**: refers to the current target relation — used inside `is_incremental()` blocks to reference the table being built.",
        explanationDeep:
          "The naive incremental model — just `materialized='incremental'` with no filter — is a common junior mistake. It runs as incremental but processes all rows on every run, giving you zero performance benefit while adding complexity. The `is_incremental()` filter is what limits the SELECT to new rows only.\n\nThe `unique_key` mistake is more dangerous: without it, every incremental run appends all rows from the filtered SELECT. If your upstream system resends yesterday's events (very common in ELT pipelines with at-least-once delivery), you end up with duplicates that compound silently. Adding a `unique_key` switches the DML from INSERT to MERGE/delete+insert, which upserts matched rows and inserts new ones — idempotent behavior.\n\nThe `{{ this }}` reference is subtle but important: `FROM {{ this }}` in the watermark subquery references the table dbt is building, not a hardcoded name. This means the watermark moves correctly as the table grows, and it works across environments (dev/prod) without hardcoding schema names.",
        interviewerLens:
          "I'm listening for both pieces: the `is_incremental()` filter AND the `unique_key`. Candidates who only mention one of the two have an incomplete mental model. The most important follow-up signal is late-arriving data handling — if someone adds a lookback window to the filter without prompting, they've shipped incremental models in anger. The silent-duplicate failure mode (no unique_key → append → compounding duplication) is the thing that causes the worst production incidents with incremental models.",
        followupChain: [
          {
            question: "What happens when you run dbt run --full-refresh on an incremental model?",
            answer: "dbt drops and recreates the table with a full SELECT — same as the first run. This is the escape hatch when the incremental state has drifted (e.g., bad data merged in, schema changed). You should run full-refresh periodically or after a data quality incident to reconcile."
          },
          {
            question: "How do you handle late-arriving data in an incremental model?",
            answer: "Instead of filtering WHERE updated_at > MAX(updated_at), subtract a lookback buffer: WHERE updated_at >= MAX(updated_at) - INTERVAL '3 days'. This re-processes a window of recent data, catching records that arrived late. Pair with unique_key to prevent the re-processed rows from duplicating."
          },
          {
            question: "What is on_schema_change and what are the options?",
            answer: "Controls behavior when the model's SELECT adds or removes columns relative to the existing table. Options: ignore (default — new columns are silently dropped), fail (raises an error, forcing you to act), append_new_columns (adds new columns with NULLs for existing rows), sync_all_columns (adds new and removes deleted columns). In production, fail or append_new_columns are safest — ignore causes silent data loss."
          }
        ],
        redFlags: [
          {
            junior: "\"I set materialized='incremental' and that makes it faster.\"",
            senior: "\"Incremental needs an is_incremental() filter to restrict input rows AND a unique_key for upsert semantics — without both, you're either reprocessing everything or silently accumulating duplicates.\""
          },
          {
            junior: "\"I filter WHERE updated_at > MAX(updated_at) and that's it.\"",
            senior: "\"I add a lookback window to catch late-arriving data, and I pair it with unique_key so re-processed rows merge correctly instead of duplicating.\""
          }
        ],
        alternatePhrasings: [
          "\"How does an incremental dbt model work under the hood?\"",
          "\"What is is_incremental() and when does it return true?\"",
          "\"Why might your incremental model be silently accumulating duplicates?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineer screen at a Series B SaaS company",
          "Asked at 4 separate dbt-heavy interviews",
          "Data engineer interview at a startup with Snowflake + dbt stack"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 23,
        questionText:
          "Explain dbt snapshots and how they implement SCD Type 2. When would you use a snapshot vs a custom incremental model for history tracking?",
        code: [
          {
            lang: "dbt",
            label: "snapshot",
            lines: [
              "snapshots:",
              "  - name: orders_snapshot",
              "    config:",
              "      unique_key: id",
              "      strategy: timestamp",
              "      updated_at: updated_at",
              "  # check: check_cols [status,...]",
            ],
          },
        ],
        answerStructured:
          "- **dbt Snapshots** implement **SCD Type 2** — they add `dbt_valid_from`, `dbt_valid_to`, `dbt_scd_id`, and `dbt_updated_at` columns to track every version of a row over time.\n- **How it works**: on each `dbt snapshot` run, dbt compares the current source rows to the snapshot table. Changed rows get a new record (with `dbt_valid_to = NULL` for the current version) and the old record gets `dbt_valid_to` set to the run timestamp.\n- **Two strategies**:\n  - `timestamp`: detects changes by comparing an `updated_at` column. Fast, but only reliable if the source system updates timestamps reliably for all real changes.\n  - `check`: compares specified columns for any change. More thorough but must enumerate columns (or use `check_cols: all`) and doesn't auto-handle schema evolution as gracefully.\n- **When to use snapshots**: built-in SCD2 is the right default. Simple to add, no custom SQL, version-controlled config.\n- **When to use a custom incremental model for history**: complex multi-column change logic, non-standard validity windows, regulatory retention rules, datasets where the snapshot frequency (snapshot = run frequency) isn't fine-grained enough, or tables too large for snapshot comparison overhead.",
        explanationDeep:
          "Snapshots are the dbt answer to the question 'how do I know what a customer's status was last Tuesday?' Without snapshots (or a custom SCD2), your source table gets updated in place and the history is lost. Snapshots capture point-in-time state by inserting a new row every time anything changes, with validity timestamps marking the window each version was active.\n\nThe timestamp vs check strategy trade-off is often tested. Timestamp is the recommended default — it's efficient because dbt only needs to check one column (`updated_at`). But it breaks if the source system updates `updated_at` without changing any real data (spurious updates) or, worse, changes data without updating `updated_at` (silent changes). In that case, `check` strategy with explicit column enumeration is more accurate.\n\nThe snapshot-vs-incremental-SCD2 debate is a real architectural decision. Snapshots are simpler and cover 80% of cases. Custom incremental SCD2 (using ROW_NUMBER window functions and manual validity column management) gives you control over retention windows, handles late-arriving historical records, and can be more cost-efficient for very large slowly-changing tables where full snapshot comparison is expensive. For most teams, start with snapshots and only migrate to custom incremental SCD2 when you hit a concrete limitation.",
        interviewerLens:
          "I want to hear the four snapshot columns named correctly (dbt_valid_from, dbt_valid_to, dbt_scd_id, dbt_updated_at), the two strategies with their trade-offs, and a clear answer to when you'd deviate from the built-in snapshot to a custom approach. Candidates who know that timestamp strategy fails when source systems don't update timestamps reliably have clearly debugged snapshots in production. Red flag: 'I use snapshots for all historical tracking' without awareness of the timestamp-reliability limitation.",
        followupChain: [
          {
            question: "How do you query a snapshot for the state of a record at a specific point in time?",
            answer: "WHERE dbt_valid_from <= '2024-06-01' AND (dbt_valid_to > '2024-06-01' OR dbt_valid_to IS NULL). This returns the row that was active at the given timestamp. In dbt v1.9+, you can set dbt_valid_to_current to a far-future date (9999-12-31) instead of NULL, which simplifies the BETWEEN syntax."
          },
          {
            question: "What happens to snapshot rows when a record is hard-deleted from the source?",
            answer: "By default, nothing — dbt doesn't track deletions and the snapshot row stays with dbt_valid_to = NULL forever. Opt in to hard-delete tracking with hard_deletes: new_record (dbt v1.9+), which inserts a new row with dbt_is_deleted = true when a source record disappears."
          }
        ],
        redFlags: [
          {
            junior: "\"Snapshots keep a full history of all my tables automatically.\"",
            senior: "\"Snapshots capture changes on each run — not sub-run changes. The strategy choice (timestamp vs check) determines how reliably changes are detected, and deletions require explicit opt-in.\""
          },
          {
            junior: "\"I'd use timestamp strategy for everything.\"",
            senior: "\"Timestamp strategy fails if the source doesn't update updated_at reliably. I check source system behavior before committing to the strategy.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you implement SCD Type 2 in dbt?\"",
          "\"What are dbt snapshots and what columns do they add?\"",
          "\"When would you use a snapshot instead of an incremental model for history?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineering interview at an e-commerce company",
          "Data engineering loop at a company with dimension history requirements",
          "Asked at a fintech with regulatory data retention requirements"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 17,
        questionText:
          "How do you use macros in dbt, and what is the difference between a macro and a dbt model? Give a real example of when a macro is the right choice.",
        code: [
          {
            lang: "dbt",
            label: "macros/dedup.sql",
            lines: [
              "{% macro dedup(rel, key, ts) %}",
              "qualify row_number() over (",
              "  partition by {{ key }}",
              "  order by {{ ts }} desc) = 1",
              "{% endmacro %}",
              "-- call: {{ dedup('o','id','ts') }}",
            ],
          },
        ],
        answerStructured:
          "- **Macro**: a Jinja function defined in a `.sql` file in `macros/`. Called from models, other macros, or run-operations. Used for: reusable SQL logic (e.g., a `cents_to_dollars(column)` expression), dynamic SQL generation, and operational tasks (run via `dbt run-operation`).\n- **Model**: a SELECT statement that produces a relation (view/table). Contains business logic for a specific dataset.\n- **Real example — dedup macro**: instead of copy-pasting `ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) = 1` in 10 staging models, write a macro `deduplicate(relation, partition_by, order_by)` that generates the CTE. Call it as `{{ deduplicate(source('raw', 'orders'), 'order_id', 'updated_at desc') }}`.\n- **Another example — grant permissions**: a post-hook macro that grants SELECT to a BI role after every model build.\n- **When NOT to use macros**: when the logic is specific to one model (just put it in the model); when over-abstraction makes the compiled SQL hard to debug; or when a dbt-utils package already has the macro you need.",
        explanationDeep:
          "Macros are the DRY (Don't Repeat Yourself) lever in dbt. They shine when the same SQL pattern appears in multiple models — a conditional type cast, a surrogate key generation, a standard dedup CTE. Without a macro, that pattern gets copy-pasted and then inconsistently updated across models when the logic changes.\n\nThe line between 'use a macro' and 'use a model' is: macros produce SQL expressions or statements, models produce relations. A macro is called at compile time and inlined into the model's SQL. A model is executed and produces a table or view you can query. If you need the output to be a queryable object, use a model. If you need reusable SQL text, use a macro.\n\nThe dbt-utils package is worth knowing: it ships macros like `surrogate_key()` (deterministic hash across multiple columns), `date_spine()` (generate a continuous date range), and `union_relations()` (UNION ALL tables with the same schema). These cover the most common macro patterns and save you from writing them yourself.",
        interviewerLens:
          "I want a concrete example — the abstract 'macros are reusable' answer is insufficient. Candidates who can produce a dedup macro, a grant post-hook, or a surrogate key example have actually written macros. The 'when not to use a macro' answer is the senior signal — over-abstraction is a real team-maintenance problem. Red flag: 'I write macros for everything' without naming the debuggability trade-off.",
        followupChain: [
          {
            question: "What is run_query() and when would you use it inside a macro?",
            answer: "run_query() executes SQL at compile time and returns an Agate table you can iterate over with Jinja. Use it for dynamic SQL generation — e.g., query information_schema for all tables matching a pattern and generate a UNION ALL automatically. Adds compile latency; use sparingly."
          },
          {
            question: "What are pre-hooks and post-hooks?",
            answer: "SQL statements dbt runs immediately before or after a model's main SQL. Pre-hook: lock a table, set a session variable. Post-hook: grant permissions to a BI role, log model run metadata to an audit table, run ANALYZE/VACUUM. Defined in {{ config(post_hook='...') }} or in dbt_project.yml."
          }
        ],
        redFlags: [
          {
            junior: "\"I put all reusable logic in macros.\"",
            senior: "\"Macros are for reusable SQL expressions and operational tasks. Over-abstracting makes compiled SQL hard to read and debug — I use macros when the same pattern appears in 3+ models.\""
          }
        ],
        alternatePhrasings: [
          "\"What are dbt macros and how do you write one?\"",
          "\"Give an example of a macro you've written in production.\"",
          "\"When would you extract logic into a macro instead of keeping it in the model?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineer screen",
          "dbt advanced features discussion at a Series C company",
          "Asked in a dbt platform ownership interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 15,
        questionText:
          "A dbt model that was passing suddenly fails. Walk me through how you debug it.",
        code: [
          {
            lang: "dbt",
            label: "debug",
            lines: [
              "# run compiled SQL in warehouse:",
              "target/compiled/proj/models/x.sql",
              "# write failing rows to a table:",
              "dbt test --store-failures -s x",
              "# exact SQL sent + conn check:",
              "dbt --debug run -s x",
            ],
          },
        ],
        answerStructured:
          "- **Step 1**: Check `dbt run --select failing_model` output for the error message. If the error is in SQL, dbt shows the compiled SQL path (`target/compiled/...`).\n- **Step 2**: Open the compiled SQL in `target/compiled/` and run it manually in your warehouse console. This separates 'dbt plumbing' errors from actual SQL errors.\n- **Step 3**: If it's a SQL error, trace it to the source — check if an upstream model changed schema, if a source table changed columns, or if a new column value broke an `accepted_values` test.\n- **Step 4**: If it's a dbt error (not SQL), check `dbt debug` for connection issues, profile misconfiguration, or Python package conflicts.\n- **Step 5**: Use `dbt --debug run --select failing_model` for verbose output including the exact SQL sent to the warehouse.\n- **Step 6**: For test failures, run `dbt test --select failing_model --store-failures` to write failing rows to a table and inspect them.\n- **Common culprits**: upstream schema change, source freshness gap, ref() pointing to a renamed model, Jinja error in a macro, or warehouse permission change.",
        explanationDeep:
          "The compiled SQL in `target/compiled/` is the single most useful debugging artifact in dbt. Jinja is evaluated at compile time, and the compiled file shows you what SQL dbt actually sent to the warehouse — no more guessing what a macro expanded to. Running the compiled SQL manually isolates the failure: if it runs in the console, the problem is in how dbt is invoking it, not in the SQL itself.\n\nThe `--store-failures` flag is underused. When a uniqueness test fails, you don't just want to know it failed — you want to see which rows are duplicated. `--store-failures` writes the failing rows to a schema in the warehouse, so you can query them directly. This is essential for debugging data issues, not just syntax errors.\n\nChanges in upstream models are the most common cause of surprising failures. If `stg_orders` gets a column renamed, every model that selects `stg_orders.order_status` will fail. The fix is always to update the consuming model, but the diagnosis step is tracing which upstream model changed via the lineage graph.",
        interviewerLens:
          "The compiled SQL shortcut is the signal I look for. Candidates who go straight to the warehouse console with the compiled SQL have done this before; candidates who say 'I'd look at the error message' without knowing about the compiled file are working harder than they need to. The --store-failures tip shows depth in the testing workflow.",
        followupChain: [
          {
            question: "How do you find where the compiled SQL lives?",
            answer: "target/compiled/<project_name>/<path_matching_models_directory>/model_name.sql — dbt writes the compiled SQL for every model and test to this directory on every run, whether or not the run succeeds."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd re-run it and see if the error goes away.\"",
            senior: "\"I'd open target/compiled/ and run the compiled SQL manually in the warehouse to isolate whether it's a SQL error or a dbt error — then trace upstream.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you debug a failing dbt test?\"",
          "\"Where does dbt write the compiled SQL?\"",
          "\"A dbt model failed in CI — walk me through your investigation.\""
        ],
        interviewContexts: [
          "Mid-level dbt debugging question",
          "Analytics engineer technical screen at a Series B company",
          "On-call debugging interview scenario"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 20,
        questionText:
          "How do you choose between the dbt incremental strategies: merge, delete+insert, and insert_overwrite?",
        code: [
          {
            lang: "dbt",
            label: "strategy",
            lines: [
              "{{ config(",
              "  materialized='incremental',",
              "  unique_key='id',",
              "  incremental_strategy='delete+insert',",
              "  incremental_predicates=[",
              "   \"DBT_INTERNAL_DEST.dt >= '2026-01-01'\"",
              "  ]) }}",
            ],
          },
        ],
        answerStructured:
          "- **merge**: compares incoming rows to the target using `unique_key`, updates matches and inserts new rows (upsert). Atomic. Best default for tables under ~100M rows with clear unique keys. Mirrors SCD1.\n- **delete+insert**: deletes rows matching `unique_key` from the target, then inserts all new rows. Two-step (non-atomic window), but avoids MERGE scan cost. Best for large tables (100M+) on Snowflake where MERGE gets expensive.\n- **insert_overwrite**: replaces entire partitions atomically. No row-level comparison. Best for date-partitioned tables on BigQuery or Spark/Databricks — dramatically cheaper than MERGE which scans the full table (BigQuery charges per byte scanned).\n- **append**: insert-only, no deduplication. Only use for truly immutable event logs where duplicates are impossible.\n- **Decision tree**: Do you need row-level upsert? Yes → merge (small/medium tables) or delete+insert (large tables). Is the table partitioned and on BigQuery/Spark? Yes → insert_overwrite. Is the data immutable? Yes → append.",
        explanationDeep:
          "Strategy choice is warehouse-dependent. On BigQuery, MERGE scans the entire target table (you're billed per bytes scanned), while `insert_overwrite` with static partitions only touches the partitions being updated — teams report 100-200x cost reductions. On Snowflake, MERGE is expensive at scale because Snowflake's micro-partition system must scan many partitions to find matches; `delete+insert` benchmarks 3-4x faster at 500M+ rows but introduces a brief intermediate state where rows are deleted before insertion completes.\n\nThe `merge_update_columns` and `merge_exclude_columns` configs are powerful — they let you merge on the full unique key but only update specific columns, which is useful for audit columns (`created_at` should never be overwritten by a merge).\n\n`incremental_predicates` is the advanced optimization: instead of scanning the full target during MERGE, limit the scan to recent partitions. Example: `DBT_INTERNAL_DEST.event_date > DATEADD(day, -7, CURRENT_DATE)`. This can reduce a full-table scan to a 7-day window scan — a 50x cost reduction on billion-row tables.",
        interviewerLens:
          "I want the warehouse-specific nuances, not just the strategy definitions. Candidates who know that MERGE on BigQuery scans the full table (byte-billing implication) and that insert_overwrite avoids that have clearly worked with large-scale BigQuery or Snowflake incremental tables. The incremental_predicates tip is a senior signal — most candidates haven't needed it yet at mid-level, but knowing it exists shows you've read the advanced docs.",
        followupChain: [
          {
            question: "What are incremental_predicates and when do you use them?",
            answer: "An additional WHERE clause applied to the target table during the MERGE scan, limiting how much of the target is scanned. DBT_INTERNAL_DEST.event_date > DATEADD(day, -7, CURRENT_DATE) limits the target scan to 7 days. Critical for large tables where a full-table MERGE scan costs too much. Available for merge and delete+insert strategies."
          },
          {
            question: "What is the microbatch incremental strategy?",
            answer: "Available since dbt 1.9. Processes the model in time-bounded batches automatically (hourly, daily) without manual is_incremental() logic. Supports batch-level retry and backfill via CLI flags. Best for high-volume time-series tables where processing the full window in one query is too slow or risky."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use merge — it handles duplicates.\"",
            senior: "\"Merge is the right default, but on BigQuery it scans the full target (byte billing) and on Snowflake it slows past 100M rows — I switch to insert_overwrite for partitioned BigQuery tables and delete+insert for large Snowflake tables.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you use delete+insert instead of merge in dbt?\"",
          "\"Why is merge expensive on BigQuery?\"",
          "\"What is insert_overwrite and when does it win?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineer interview at a company with large BigQuery tables",
          "Snowflake + dbt incremental strategy discussion at a Series C",
          "Asked in an advanced dbt features round"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 13,
        questionText:
          "Snapshot vs incremental model — how do you decide which to use for slowly changing data?",
        answerStructured:
          "- **Use a snapshot when**: you need SCD Type 2 with minimal setup, the source table is small-to-medium, your run cadence (hourly to daily) matches the change frequency, and the built-in validity columns (dbt_valid_from, dbt_valid_to) meet downstream query patterns.\n- **Use a custom incremental model when**: retention policies require custom logic (e.g., keep only 2 years of history), the source has complex multi-column change logic, performance at scale is a concern (snapshots do a full-table comparison on each run), or you need sub-hourly SCD tracking.\n- **Key trade-off**: snapshots are simple, declarative, and version-controlled — minimal SQL to write. Custom incremental SCD2 is more flexible but requires writing and maintaining the change-detection SQL yourself.\n- **Both options**: both require a reliable change detection signal — either a trustworthy `updated_at` timestamp (for snapshot timestamp strategy or incremental watermark) or explicit column enumeration (for snapshot check strategy).",
        explanationDeep:
          "This is an architectural judgment question. Snapshots are dbt's built-in SCD2 mechanism and are the right default for most teams. They require almost no SQL — just YAML configuration. The downside is they run a full comparison on every snapshot run, which scales poorly for very large tables (tens of millions of rows) with frequent change detection.\n\nCustom incremental SCD2 gives you control: you can implement any SCD type (1, 2, 3, or hybrid), set explicit retention windows, handle soft deletes, and process only changed rows using your own watermark logic. The cost is complexity — you're writing change-detection SQL, managing validity columns manually, and taking on the maintenance burden.\n\nFor most teams (tables under 10M rows, daily cadence), snapshots are the clear winner. For regulated industries with explicit retention policies, or tables with hundreds of millions of slowly-changing rows, the custom approach earns its complexity.",
        interviewerLens:
          "I want a clear criteria-based answer, not just 'snapshots are easier.' The retention policy angle and the full-table-comparison-at-scale limitation show production experience. Candidates who say 'always use snapshots' haven't hit a case where the approach breaks down.",
        followupChain: [
          {
            question: "How do you implement SCD Type 1 in dbt?",
            answer: "Use an incremental model with merge strategy and a unique_key — MERGE updates the matching row in place (SCD1 = overwrite with no history). This is the default behavior of incremental + merge and is correct when you only need the current state, not history."
          }
        ],
        redFlags: [
          {
            junior: "\"Always use snapshots for any historical tracking.\"",
            senior: "\"Snapshots are the right default, but they do a full comparison on every run. For very large tables or custom retention policies, a custom incremental SCD2 is more controllable.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you implement SCD Type 2 in dbt without snapshots?\"",
          "\"When is a custom incremental model better than a snapshot for history?\""
        ],
        interviewContexts: [
          "Mid-level analytics engineer interview",
          "Data modeling deep-dive at an e-commerce company"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["merge", "delete+insert", "insert_overwrite"],
        asked: 16,
        questionText:
          "Compare merge, delete+insert, and insert_overwrite as dbt incremental strategies — when does each win and why?",
        answerStructured:
          "- **merge**: single atomic SQL MERGE statement. Updates matched rows (by `unique_key`), inserts new rows. Correct default for most cases. Limitation: scans the full target table to find matches — expensive at 100M+ rows and on byte-billed warehouses (BigQuery).\n- **delete+insert**: first DELETE rows matching `unique_key` from target, then INSERT all rows from the incremental SELECT. Two steps (brief non-atomic window). Avoids full-target-scan comparison. On Snowflake benchmarks 3-4x faster than merge at 500M+ rows. Risk: if the job fails between DELETE and INSERT, rows are lost until the next run.\n- **insert_overwrite**: atomically replaces entire partitions. No row-level key comparison. Requires a partitioned table design. On BigQuery: dramatically cheaper (only touches affected partitions vs full-table scan). On Snowflake: replaces the whole table (not just partitions) — a footgun, use delete+insert instead.\n- **Warehouse recommendation matrix**:\n  - BigQuery: insert_overwrite for time-partitioned fact tables, merge for dimension-like models\n  - Snowflake: merge under 100M rows, delete+insert at scale\n  - Databricks: merge (Delta MERGE is ACID and efficient), insert_overwrite for partition-aware jobs",
        explanationDeep:
          "The strategy choice is partly a data-volume problem and partly a warehouse-billing problem. MERGE's full-table-scan cost is irrelevant at 1M rows but becomes the dominant CI bill item at 1B rows. The architectural insight is that insert_overwrite sidesteps row-level comparison entirely — it replaces the partition wholesale, which is idempotent and cheap if your partition granularity matches your incremental window.\n\nThe Snowflake insert_overwrite footgun is a well-documented community issue: unlike BigQuery (which replaces only discovered partitions), Snowflake's insert_overwrite replaces the entire table, not just the rows matching your query. This is almost never what you want and causes data loss. Snowflake teams should use delete+insert instead.\n\nDelete+insert's two-step atomicity issue is manageable in practice: dbt wraps the DELETE and INSERT in a transaction (where the warehouse supports it), and the lookback window in your is_incremental() filter means the next successful run repairs any rows lost in a failed run. The key is that your unique_key and lookback window make the operation idempotent — running it twice produces the same result as running it once.",
        interviewerLens:
          "The BigQuery byte-billing implication of MERGE and the Snowflake insert_overwrite footgun are the two pieces of knowledge that tell me someone has worked with large-scale incremental tables in production. Candidates who give the generic 'merge is safe, insert_overwrite is fast' answer without the warehouse-specific nuances are working from the docs, not from experience. I follow up with 'what does insert_overwrite do on Snowflake?' — the trap question.",
        followupChain: [
          {
            question: "What does insert_overwrite do on Snowflake vs BigQuery?",
            answer: "On BigQuery: replaces only the partitions that contain rows from your SELECT query — atomic and safe. On Snowflake: replaces the ENTIRE table regardless of your query scope — almost never what you want, causes data loss. Use delete+insert on Snowflake instead."
          },
          {
            question: "How do incremental_predicates improve merge performance?",
            answer: "They add a WHERE clause to the target table scan during MERGE: e.g., DBT_INTERNAL_DEST.event_date > DATEADD(day, -7, CURRENT_DATE). Instead of scanning the full 1B-row table for matching keys, the engine scans only 7 days of data. Teams report 50x scan reduction on large Snowflake tables."
          }
        ],
        redFlags: [
          {
            junior: "\"I use insert_overwrite on Snowflake for partitioned tables.\"",
            senior: "\"insert_overwrite on Snowflake replaces the entire table — that's a data-loss footgun. I use delete+insert on Snowflake and reserve insert_overwrite for BigQuery and Databricks.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you switch from merge to delete+insert in dbt?\"",
          "\"Why is merge expensive on BigQuery?\"",
          "\"What incremental strategy do you use on a 500M row Snowflake table?\""
        ],
        interviewContexts: [
          "Mid-level dbt + BigQuery interview at a Series B analytics team",
          "Advanced dbt incremental strategies discussion at a large-scale data platform",
          "Snowflake + dbt architecture review"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How do you test an incremental model to catch drift between full-refresh and incremental paths?",
        "Walk me through the on_schema_change options and when each is appropriate.",
        "How do you use dbt exposures to document dashboard dependencies?",
        "What is the dbt meta-field system and how do you use tags operationally?",
        "How do you manage dbt across multiple environments (dev, CI, prod) with minimal config duplication?"
      ],
      decisions: [
        "When do you use a Jinja macro vs putting logic directly in the model SQL?",
        "Snapshot check strategy vs timestamp strategy — which do you default to?",
        "When is dbt Cloud worth the cost over dbt Core + self-managed CI?"
      ],
      quickRef: [
        "What does is_incremental() return on the first run?",
        "What columns does a dbt snapshot add?",
        "What does on_schema_change: ignore do?",
        "What is {{ this }} in dbt?",
        "What command runs macros without building a model?",
        "What does --store-failures do on dbt test?",
        "What is unique_key in an incremental model?",
        "Where is the compiled SQL written by dbt?",
        "What does dbt source freshness check?",
        "What is the state:modified+ selector?"
      ],
      redFlags: [
        {
          junior: "\"I set materialized='incremental' and it handles everything.\"",
          senior: "\"Incremental needs an is_incremental() filter AND a unique_key — without both, you're reprocessing everything or silently duplicating.\""
        },
        {
          junior: "\"I use on_schema_change: ignore.\"",
          senior: "\"ignore silently drops new columns — I use fail or append_new_columns so schema drift is explicit, not silent.\""
        },
        {
          junior: "\"Snapshots automatically capture all historical data.\"",
          senior: "\"Snapshots capture changes at run frequency — sub-run changes are missed, and deletions require hard_deletes opt-in.\""
        },
        {
          junior: "\"I use insert_overwrite on Snowflake because it's fast.\"",
          senior: "\"insert_overwrite on Snowflake replaces the whole table — I use delete+insert for Snowflake and reserve insert_overwrite for BigQuery.\""
        },
        {
          junior: "\"I write all macros from scratch.\"",
          senior: "\"I check dbt-utils first — surrogate_key, date_spine, union_relations cover the most common patterns without reinventing them.\""
        },
        {
          junior: "\"I debug by re-running with --debug and staring at logs.\"",
          senior: "\"I open target/compiled/ and run the compiled SQL in the warehouse directly — that isolates SQL errors from dbt plumbing issues immediately.\""
        }
      ],
      checklist: [
        "Explain is_incremental() + unique_key together — what each prevents",
        "Know all four on_schema_change options and their risk profiles",
        "Explain snapshot strategies (timestamp vs check) with trade-offs",
        "Be able to select the right incremental strategy by warehouse (BigQuery, Snowflake, Databricks)",
        "Know where compiled SQL lives and how to use it for debugging",
        "Name at least 3 dbt-utils macros and their use cases"
      ],
      behavioral: [
        "Describe a time an incremental model caused a data quality incident — how did you detect and fix it?",
        "Tell me about a dbt project you restructured — what changed and why?",
        "How do you introduce snapshot-based history tracking to a team that has been overwriting source data?"
      ],
      reverse: [
        "What incremental strategies are most common in your dbt project today?",
        "How do you handle schema changes from source systems — is there a process?",
        "How big is your dbt DAG and how long does a full CI run take?"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // SENIOR  — Late-arriving data at scale, full-refresh vs incremental
  //           reconciliation in CI, large-DAG ownership, exposures/contracts,
  //           macros for platform-level abstractions, failure/cost trade-offs
  // ─────────────────────────────────────────────────────────────
  senior: {
    authored: [
      // ── deep-dives ────────────────────────────────────────────
      {
        category: "deep-dives",
        riskLevel: "high",
        freePreview: true,
        asked: 22,
        questionText:
          "How do you architect an incremental dbt model to be both correct with late-arriving data and cost-efficient at scale?",
        code: [
          {
            accent: "bug",
            lang: "dbt",
            lines: [
              "-- skips late-arriving rows",
              "where updated_at >",
              "  (select max(updated_at)",
              "     from {{ this }})",
            ],
          },
          {
            accent: "fix",
            lang: "dbt",
            lines: [
              "-- lookback covers late data",
              "where updated_at >=",
              "  (select max(updated_at)",
              "     from {{ this }})",
              "  - interval '3 days'",
            ],
          },
        ],
        answerStructured:
          "- **Late-arriving data problem**: the naive filter `WHERE updated_at > (SELECT MAX(updated_at) FROM {{ this }})` misses records that arrive after their event timestamp (e.g., mobile events buffered for hours, late CDC events). They're silently skipped and never merged in.\n- **Fix — lookback window**: filter `WHERE updated_at >= (SELECT MAX(updated_at) FROM {{ this }}) - INTERVAL 'N hours/days'`. Re-processes a buffer window every run. N is sized to the observed late-arrival distribution plus a safety margin.\n- **Cost trade-off**: a wider lookback window catches more late data but processes more rows — cost scales with window size. Instrument late-arrival percentiles in the source to right-size N.\n- **unique_key + merge**: ensures re-processed rows update rather than duplicate. This makes the lookback idempotent — running the same window twice produces the same table state.\n- **Full-refresh as safety net**: incremental state can drift over months. Schedule periodic full-refresh (monthly or after any data quality incident) to reconcile. Make full-refresh a first-class CI gate on large PRs.\n- **incremental_predicates**: limit the target-table scan to the same window, not just the source filter. Without this, MERGE scans the full target even if you only process 3 days of source data.",
        explanationDeep:
          "The late-arriving data problem is the difference between a junior incremental model and a production-grade one. Upstream systems — mobile apps, third-party SaaS, change-data-capture pipelines — rarely deliver events in strict timestamp order. A mobile app might buffer events for 6 hours before a network reconnect. A CDC system might have a few hours of replication lag. Without a lookback window, these records are permanently missing from your incremental model.\n\nSizing the lookback is an empirical exercise. I query the source to measure the distribution of `ingestion_time - event_time` — the 99th percentile of this distribution plus a 25% buffer becomes my window. A fact table with 99th-percentile late arrival of 4 hours gets a 6-hour window. Compute the cost: if a 6-hour window means re-processing 10% of daily volume, that's a 10% cost premium for correctness — almost always worth it.\n\nThe reconciliation problem is different. Over time, even a correct incremental model can drift from the full-refresh version due to: schema changes applied with `on_schema_change: append_new_columns` (new columns have NULLs for historical rows), bug fixes applied mid-run, or corrupted rows merged from a source incident. I run a full-refresh-vs-incremental reconciliation test in CI: materialize a sample of the model with `--full-refresh` into a test schema and compare row counts and checksums. Any systematic divergence signals drift.",
        interviewerLens:
          "This question reveals whether someone has shipped incremental models at real scale. The lookback-window pattern with empirically sized N is the senior answer — not just 'subtract 3 days.' The incremental_predicates angle shows cost awareness beyond correctness. The reconciliation-in-CI test is the rarest signal — I've only heard it from engineers who've actually hit unexplained incremental drift and had to debug it systematically. Red flag: 'I use the MAX watermark and it works fine' — that answer tells me they haven't had a late-arriving data incident yet.",
        followupChain: [
          {
            question: "How do you measure the right lookback window size for a given source?",
            answer: "Query the source: SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ingestion_time - event_time) as p99_lag FROM raw.events. The p99 lag plus a 25% safety margin is the window. Monitor this metric monthly — upstream latency can increase as source systems grow."
          },
          {
            question: "How do you prevent a full-refresh during CI from accidentally overwriting production data?",
            answer: "CI runs target a separate schema (e.g., ci_pr_123) via a different target profile. full-refresh in CI only affects the CI schema. The manifest comparison (state:modified+) ensures CI only builds changed models. Never run CI against the prod target."
          },
          {
            question: "What is the dbt microbatch strategy and how does it improve on manual lookback windows?",
            answer: "Microbatch (dbt v1.9+) automates the batch window — dbt processes the model in hourly or daily increments automatically, with built-in batch-level retry (a failed batch reruns just that batch, not the whole model) and CLI backfill support. Eliminates manual lookback window sizing and makes late-arrival handling declarative."
          }
        ],
        redFlags: [
          {
            junior: "\"I filter WHERE updated_at > MAX(updated_at) and it's always correct.\"",
            senior: "\"That misses late-arriving data. I use a lookback window sized to the observed late-arrival p99, paired with unique_key for idempotent re-processing and incremental_predicates to limit target scan cost.\""
          },
          {
            junior: "\"Incremental models are always correct once set up.\"",
            senior: "\"Incremental state drifts over time. I run a full-refresh reconciliation test in CI quarterly and after any upstream data quality incident.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you handle late-arriving events in a dbt incremental fact table?\"",
          "\"A source system delivers events with multi-hour delays — how does your incremental model handle that?\"",
          "\"How do you know your incremental model matches the full-refresh version?\""
        ],
        interviewContexts: [
          "Senior analytics engineer loop at a Series C SaaS company",
          "Staff data engineer interview at a high-scale event-driven platform",
          "Advanced dbt architecture discussion at a data platform team"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 18,
        questionText:
          "How do you manage a large dbt DAG (500+ models) across multiple teams without it becoming a maintenance nightmare?",
        answerStructured:
          "- **Project structure**: split into sub-projects (dbt Mesh / cross-project refs) where each domain team owns their models. Upstream projects expose public models via contracts; downstream projects consume them without touching upstream internals.\n- **CODEOWNERS**: use GitHub CODEOWNERS to require review from the owning team on any change to their model directory. Prevents accidental changes and creates clear accountability.\n- **Contracts + access modifiers**: mark cross-team interface models as `access: public` with `contract: enforced: true`. This makes schema changes a versioned, breaking-change process rather than a silent breakage.\n- **Tags for operational selection**: tag models by domain (`tag:finance`) and run frequency (`tag:hourly`, `tag:daily`). Enables `dbt build --select tag:daily` in production jobs.\n- **DAG health metrics**: monitor model run times, test pass rates, and source freshness. Alert when a model's p95 runtime increases 2x (signals upstream volume change or filter regression).\n- **State-based CI**: `dbt build --select state:modified+` ensures only changed models and downstream dependents are built in CI — PR builds finish in minutes instead of hours on a 500-model project.",
        explanationDeep:
          "At 50 models, a monolithic dbt project is manageable. At 500, it becomes a governance problem: any engineer can accidentally change a model that 20 downstream models depend on, with no review gate. The two structural answers to this are CODEOWNERS (process) and dbt Mesh (architecture).\n\nContracts are the API boundary for dbt models. When `fct_revenue` is marked `access: public` with an enforced contract, downstream teams know exactly what schema they're getting — column names and types are guaranteed. A breaking change (removing a column, changing a type) requires a new model version (`v2`), which gives downstream consumers time to migrate. Without contracts, schema drift breaks downstream models silently.\n\nThe DAG health monitoring angle is often overlooked in interviews but is a real senior concern: a 500-model project where 50 models are failing tests is unusable. I track test pass rate as a metric, alert on regressions, and do quarterly 'test coverage audits' to ensure new models aren't shipped without tests. Similarly, model run times that suddenly increase 2x are often the first signal of a missing filter in an incremental model or an upstream volume spike — catching them in the runtime metric is faster than waiting for an SLA alert.",
        interviewerLens:
          "The dbt Mesh / cross-project ref angle shows awareness of enterprise-scale dbt architecture (released in dbt 1.6+ and widely adopted by 2024). Candidates who name CODEOWNERS + contracts together understand the process and tooling combination for multi-team governance. The run-time monitoring angle shows you think about the operational health of the project, not just the correctness. Red flag: 'we put everything in one project and communicate via Slack' — this doesn't scale past 3 teams.",
        followupChain: [
          {
            question: "What is dbt Mesh and when do you need it?",
            answer: "dbt Mesh is the dbt Labs architecture pattern for multi-project dbt setups. Each domain team runs a separate dbt project; teams expose public models (with enforced contracts) that downstream projects consume via cross-project ref(). Introduced in dbt Core v1.6. You need it when a single monolithic project has more than ~2-3 teams modifying it — governance and CI speed both degrade at scale."
          },
          {
            question: "How do you version a dbt model when you need to make a breaking schema change?",
            answer: "Define a new version in the model's YAML: versions: [v1, v2]. dbt creates both relations (fct_orders_v1 and fct_orders). Downstream models ref('fct_orders', v=1) until they migrate. The old version can be deprecated and removed after all consumers have upgraded. Contracts must be enforced on versioned models."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just document which models not to change.\"",
            senior: "\"Documentation doesn't scale — I use CODEOWNERS for review gates, contracts for schema guarantees, and dbt Mesh for team ownership boundaries.\""
          },
          {
            junior: "\"I run dbt build --full-refresh in CI for the whole DAG.\"",
            senior: "\"On a 500-model project that would take hours. I use state:modified+ to build only changed models and dependents — a single-file PR builds 5-10 models, not 500.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you scale dbt governance across multiple data teams?\"",
          "\"What breaks when a dbt project gets too big and how do you fix it?\"",
          "\"How do you implement dbt model contracts and why?\""
        ],
        interviewContexts: [
          "Senior analytics engineer at a large tech company with 10+ data teams",
          "Staff data engineer interview about dbt at scale",
          "Data platform architecture discussion at a Series D startup"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "high",
        asked: 16,
        questionText:
          "What are dbt model contracts and exposures, and how do you use them together for enterprise data governance?",
        code: [
          {
            lang: "dbt",
            label: "schema.yml",
            lines: [
              "models:",
              "  - name: fct_orders",
              "    config:",
              "      contract:",
              "        enforced: true",
              "    columns:",
              "      - name: order_id",
            ],
          },
        ],
        answerStructured:
          "- **Contracts**: a YAML declaration that enforces column names and data types at build time. When `contract: enforced: true`, dbt runs a preflight check before materializing the model — if the SELECT returns the wrong schema, the build fails (not silently corrupts).\n  - Supported on `table` and `incremental` materializations. Views support column name/type checks but not constraints.\n  - Constraints (`not_null`, `primary_key`, `foreign_key`) are declared in YAML and included in DDL — platform-enforced on Postgres, metadata-only on Snowflake/BigQuery.\n  - Breaking changes (removing a column, changing a type) require a model version bump (`v2`), giving downstream consumers a migration path.\n- **Exposures**: YAML declarations of downstream consumers — dashboards, ML models, reverse-ETL jobs — that `depends_on` your dbt models. Show up in the lineage graph as orange nodes, enabling impact analysis.\n  - Types: `dashboard`, `notebook`, `analysis`, `ml`, `application`.\n  - Enables `dbt build --select +exposure:ceo_dashboard` to test everything feeding that dashboard.\n- **Together**: contracts guarantee the schema of the model a dashboard depends on; exposures document which dashboard depends on it. When a schema change is proposed, you see the exposure in the lineage graph and know exactly which stakeholders are affected before deploying.",
        explanationDeep:
          "Contracts are dbt's answer to the 'silent schema drift' problem. Without a contract, a developer renames a column in a mart model and the downstream BI tool breaks in production — the ETL passed, the tests passed, but the dashboard broke because it referenced the old column name. With a contract, the model's schema is explicitly declared, and any deviation fails the build before reaching the warehouse. The model becomes an API with a stable interface.\n\nExposures complete the lineage picture. Without them, the dbt docs site shows lineage to the last mart model — you don't know that `fct_orders` feeds the CFO's revenue dashboard and three ML models. With exposures, a developer can run `dbt ls --select +exposure:revenue_dashboard` and see every model, source, and test that feeds it. They can run `dbt build --select +exposure:revenue_dashboard` to test the full upstream graph before a release.\n\nThe combination is a governance toolkit for high-stakes models. In practice, I apply contracts to models consumed by other teams or by production dashboards. I add exposures for every dashboard and ML model that data scientists or analysts have told me depends on dbt models. Together, they make 'what does this model affect?' a query-time question, not a detective exercise.",
        interviewerLens:
          "Contracts and exposures are features added in dbt 1.5-1.6 that most junior and mid-level candidates haven't used — just reading about them without shipping a project that uses both is detectable. I listen for the 'breaking change = model version bump' requirement on contracts (not just 'it fails the build') and the `+exposure:name` selector trick for building/testing the full dashboard dependency chain. The column-reorder behavior of contracts (dbt reorders columns per the contract, not per your SQL) is a subtle operational nuance. Red flag: confusing contracts with generic tests — tests validate data content, contracts validate model structure at build time.",
        followupChain: [
          {
            question: "How does dbt handle a contract violation — does it fail before or after writing to the warehouse?",
            answer: "Before. dbt runs a preflight validation comparing the model's SELECT output schema to the declared contract before issuing any CREATE TABLE DDL. If the schema doesn't match, the build fails with a clear error — no partial table is written. This is the key advantage over post-build tests."
          },
          {
            question: "Which platforms enforce constraints physically vs as metadata only?",
            answer: "Postgres enforces not_null, primary_key, foreign_key, check constraints physically (violating rows cause INSERT errors). Snowflake and BigQuery support these as metadata constraints — they're declared and documented but not enforced at write time. Only not_null is enforced on BigQuery. Most cloud warehouses are metadata-only for primary/foreign keys."
          },
          {
            question: "How do you test all models feeding a specific exposure?",
            answer: "dbt build --select +exposure:exposure_name runs all models and tests in the upstream DAG of that exposure. The + prefix means 'all ancestors.' This is the pre-release regression test for a dashboard: if it all passes, you know the dashboard's data pipeline is healthy."
          }
        ],
        redFlags: [
          {
            junior: "\"Contracts are like schema tests.\"",
            senior: "\"Contracts validate model structure at build time (preflight, before DDL is issued). Tests validate data content post-build. Contracts fail the build if the schema is wrong; tests fail if the data has quality issues — different layers of the same quality story.\""
          },
          {
            junior: "\"I document exposures in Confluence.\"",
            senior: "\"Exposures in YAML show up in the lineage graph, enable impact analysis on schema changes, and allow +exposure: selectors for targeted CI testing — they're operational infrastructure, not just documentation.\""
          }
        ],
        alternatePhrasings: [
          "\"What is a dbt contract and how does it differ from a schema test?\"",
          "\"How do you use dbt exposures in a real project?\"",
          "\"How do you make schema changes safe in a large dbt project with many consumers?\""
        ],
        interviewContexts: [
          "Senior analytics engineer at an enterprise data platform",
          "Staff data engineer interview about dbt governance",
          "Asked at a regulated-industry data team (fintech, healthtech) interview"
        ]
      },
      {
        category: "deep-dives",
        riskLevel: "medium",
        asked: 14,
        questionText:
          "How do you use advanced macros to build platform-level abstractions in dbt — and where does macro complexity become a liability?",
        code: [
          {
            lang: "dbt",
            label: "env-aware schema",
            lines: [
              "{% macro generate_schema_name(",
              "    custom, node) %}",
              "{% if target.name == 'prod' %}",
              "  {{ custom or target.schema }}",
              "{% else %}{{ target.schema }}",
              "{% endif %}{% endmacro %}",
            ],
          },
        ],
        answerStructured:
          "- **Platform macros worth building**: a `generate_schema_name` override (environment-aware schema routing), a `get_column_values` macro (query distinct values at compile time for dynamic pivots), a `safe_divide` expression macro, and a project-standard `dedup_cte` that encodes the team's deduplication pattern.\n- **generate_schema_name**: the default behavior concatenates the target schema with any custom schema suffix (e.g., `dev_finance`). Override it to give full control — e.g., in prod use the declared custom schema exactly, in dev prefix with the user name.\n- **Dynamic SQL with run_query()**: query `information_schema` at compile time to discover tables or columns, generate a UNION ALL or pivot without hardcoding names. Adds compile latency and makes the compiled SQL non-deterministic (output depends on warehouse state at compile time) — test carefully.\n- **Liability signals**: a macro more than 50 lines of Jinja, macros that call other macros 3+ levels deep, or macros that require reading the compiled SQL to understand what they do. At this point, the team spends more time debugging Jinja than SQL.\n- **Rule of thumb**: if you can't explain what a macro generates in one sentence, it's too abstract. Prefer explicit SQL with some repetition over a macro that saves 10 lines but requires a macro-debugging session.",
        explanationDeep:
          "The dbt macro system is powerful enough to write an entire project's scaffold — I've seen teams with a `create_model` macro that generates staging models automatically from source metadata. The danger is that macros compile into SQL at runtime, and the compiled SQL is what actually runs. When a macro is buggy, debugging requires reading Jinja, understanding what compiled SQL it generates, and then debugging the SQL — two debugging contexts instead of one.\n\nThe `generate_schema_name` macro is the most impactful override in any team project. dbt's default behavior (concatenating target schema + custom schema) produces names like `dev_finance_transactions`, which are fine for small teams but break down when you want consistent naming across environments or when you want to share a prod schema with another project. Overriding it is a 10-line macro that eliminates a class of 'why is my model writing to the wrong schema?' bugs.\n\nThe Jinja-over-SQL trap is real. I've reviewed dbt projects where the macros were so abstract that no engineer on the team could read a model's compiled SQL without running `dbt compile` first. The cognitive overhead was higher than the DRY savings. My standard: a macro should save repetition of a pattern that appears in 5+ models and that is genuinely stable (won't change frequently). Below that threshold, inline the SQL.",
        interviewerLens:
          "The generate_schema_name override signals real project ownership — not just writing models, but managing the project's operational behavior. The 'macro as liability' answer tells me the candidate has experienced macro over-abstraction and has a principled opinion about it, not just enthusiasm for Jinja. The run_query() non-determinism caveat is an advanced signal. Red flag: 'I love writing macros, they're so powerful' without naming the complexity trade-off.",
        followupChain: [
          {
            question: "How do you override generate_schema_name safely across environments?",
            answer: "Override in macros/generate_schema_name.sql. The pattern: if target.name == 'prod', return the declared custom_schema (exact name). Otherwise, return target.schema ~ '_' ~ custom_schema (dev-prefixed). This prevents dev models from writing to prod schemas and gives prod models exact schema control."
          },
          {
            question: "How do you test a macro?",
            answer: "dbt compile to see the generated SQL, dbt run-operation macro_name to execute it, and unit tests on the compiled output. For macros that generate model SQL, compare the compiled output in CI against a known-good version (snapshot testing). The hardest part is testing dynamic SQL macros — use run_query() mocks or test against a small fixture table."
          }
        ],
        redFlags: [
          {
            junior: "\"I write macros for any repeated SQL pattern.\"",
            senior: "\"I use macros for patterns appearing in 5+ models that are stable. Below that threshold, the Jinja debugging overhead exceeds the DRY benefit.\""
          }
        ],
        alternatePhrasings: [
          "\"What macros have you written in production beyond the standard patterns?\"",
          "\"When does a dbt macro become too complex?\"",
          "\"How do you control which schema a model writes to across environments?\""
        ],
        interviewContexts: [
          "Senior analytics engineer technical deep-dive",
          "dbt platform ownership discussion at a data infrastructure team",
          "Staff data engineer macro review session"
        ]
      },
      // ── decision-frameworks ───────────────────────────────────
      {
        category: "decision-frameworks",
        riskLevel: "high",
        asked: 15,
        questionText:
          "A critical dbt fact table has drifted between its incremental and full-refresh versions. How do you diagnose, fix, and prevent it?",
        answerStructured:
          "- **Diagnose**: materialize the model with `--full-refresh` into a parallel schema. Compare row counts, NULL counts per column, and aggregate checksums (SUM of key measures) between the incremental and full-refresh versions. Use a reconciliation model that JOINs both on the primary key and flags differences.\n- **Root causes to check**: schema change applied with `on_schema_change: append_new_columns` (historical rows have NULLs for the new column; full-refresh would populate them from the source). Source data corrected upstream (re-delivered rows that the incremental watermark didn't catch because they were outside the lookback window). A bug in the `is_incremental()` filter that was fixed mid-run (the incremental table has rows built by the old logic; full-refresh uses the fixed logic everywhere).\n- **Fix**: for most cases, run `dbt run --full-refresh --select the_model` on the production target during a low-traffic window. Coordinate with BI/API consumers if the table will be briefly absent during recreation. Use a CTAS+swap pattern (materialize into a temp name, swap atomically) to minimize downtime.\n- **Prevent**: CI gate that runs a lightweight reconciliation check (row count delta < 0.1%, aggregate checksum match) on every PR that touches the model or its upstream. Add a scheduled full-refresh job (weekly or monthly) as a drift-correction mechanism. Set `on_schema_change: fail` so schema drift is loud, not silent.",
        explanationDeep:
          "Incremental drift is one of the most insidious production data quality problems because it accumulates silently over weeks or months. A model may have drifted 0.5% from its full-refresh counterpart — enough to cause a $50k discrepancy in a revenue report that triggers a finance audit, but not enough to fail any test you've written.\n\nThe reconciliation model pattern is the right preventative: a dbt model that compares the incremental production table to a sampled full-refresh run, flagging any systematic differences. Running this in CI after every PR that touches the upstream DAG catches regressions before they reach prod.\n\nThe on_schema_change: fail vs append_new_columns trade-off is key. `fail` is safer — it forces a full-refresh whenever the schema changes, ensuring historical rows always match the full-refresh schema. `append_new_columns` is more convenient (no full-refresh required for additive schema changes) but introduces drift: new columns have NULLs for historical rows in the incremental table, while a full-refresh would backfill them from the source. Which is acceptable depends on whether the new column's historical NULLs are a business logic problem.",
        interviewerLens:
          "This question is a senior signal because it presupposes that incremental drift happens and asks how you handle it — not whether it can happen. Candidates who've dealt with this have a specific reconciliation approach. I want to hear the checksum comparison (not just row count — aggregate checksums catch off-by-one reprocessing and duplication). The on_schema_change: fail recommendation is the architectural call that prevents a class of drift. Red flag: 'I'd just run a full-refresh to fix it' without a prevent-recurrence step.",
        followupChain: [
          {
            question: "How do you run a full-refresh without downtime for dashboard consumers?",
            answer: "CTAS into a temp relation name (fct_orders_refresh), validate it (row count, checksum), then atomically rename: ALTER TABLE fct_orders_refresh RENAME TO fct_orders (drop old first, or use a swap transaction). In Snowflake, SWAP WITH is atomic. In BigQuery, TABLE COPY is atomic. This keeps fct_orders available for reads until the very last moment."
          }
        ],
        redFlags: [
          {
            junior: "\"I'd just run --full-refresh.\"",
            senior: "\"I'd first diagnose the drift root cause (schema change, missing late data, filter bug), fix it, run full-refresh with a CTAS+swap pattern for minimal downtime, and add a CI reconciliation check to prevent recurrence.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you detect that an incremental model has drifted from its full-refresh version?\"",
          "\"A business metric is 0.5% off from what finance calculates. You suspect incremental drift — walk me through your investigation.\"",
          "\"How do you safely run a full-refresh on a production fact table with active consumers?\""
        ],
        interviewContexts: [
          "Senior data engineer interview at a fintech with strict revenue reporting SLAs",
          "Staff analytics engineer loop at a Series D company",
          "Production incident review follow-up interview"
        ]
      },
      {
        category: "decision-frameworks",
        riskLevel: "medium",
        asked: 12,
        questionText:
          "How do you evaluate whether to build a new dbt model or add logic to an existing one?",
        answerStructured:
          "- **Add to existing**: when the new logic serves the same grain, the same consumers, and the same refresh cadence as the existing model. Avoids DAG complexity without meaningful trade-off.\n- **Create a new model** when: the new logic requires a different grain (e.g., daily vs hourly aggregation), the new model has different consumers with different SLA requirements, the logic is complex enough to deserve independent testing, or adding it would make the existing model unmaintainable.\n- **Warning sign for splitting**: if a model's SQL exceeds ~200 lines, or if it has more than 2-3 CTEs doing fundamentally different things, it's usually better as two models with a ref() between them.\n- **Cost consideration**: each additional model is one more warehouse object, one more DAG node, one more thing to test and monitor. At 500 models, model proliferation is its own maintenance burden.\n- **The layering contract**: never add mart-level business logic to a staging model. Never add staging-level source-specific casting to a mart. The layering discipline is a constraint on where logic can live — not just a suggestion.",
        explanationDeep:
          "This is a judgment question about software design applied to dbt. The 'always split into smaller models' tendency is common among engineers who've read the dbt style guide but haven't dealt with the maintenance overhead of a 500-model project. Every model split adds a DAG node, a relation in the warehouse, and a unit of CI build time. The question is whether the split earns its keep.\n\nThe clearest cases for splitting: a model that serves two different consumer groups with different freshness requirements (they should be separate materialized objects with different schedules), or a model where a single CTE is doing both a complex join and a complex aggregation (split for independent testability). The clearest case against splitting: two models that always run together, serve the same consumers, and whose logic is conceptually one transformation — the split adds complexity without benefit.\n\nThe layering contract is non-negotiable. If a staging model starts doing mart-level aggregation, it breaks the contract that staging is 1:1 with source tables. Every consumer of that staging model now depends on business logic they may not have intended. This is the source of the worst category of dbt maintenance problems: business rules embedded in layers that were supposed to be neutral.",
        interviewerLens:
          "I want the cost-of-model-proliferation angle alongside the design-clarity angle. Engineers who've only worked on small projects advocate for splitting everything into tiny models. Engineers who've maintained large projects know that DAG complexity has a real cost. The layering-contract point shows that you have principled opinions about project structure, not just rules you follow.",
        followupChain: [
          {
            question: "How do you enforce layering conventions across a team?",
            answer: "CODEOWNERS for directory-level review, dbt-project.yml path configurations that restrict which models can ref which, and pre-commit hooks or CI checks that validate naming conventions. dbt-checkpoint is a popular open-source CI tool that enforces these kinds of structural rules."
          }
        ],
        redFlags: [
          {
            junior: "\"I always split models to keep them small.\"",
            senior: "\"Splitting has a cost — every model is a DAG node, a relation, and a CI build step. I split when the logic is independently testable, serves different consumers, or would make the parent model unmaintainable.\""
          }
        ],
        alternatePhrasings: [
          "\"How do you keep a dbt project from turning into 1000 models?\"",
          "\"What signals tell you a model needs to be split?\""
        ],
        interviewContexts: [
          "Senior analytics engineer design discussion",
          "dbt project architecture review at a growing data team"
        ]
      },
      // ── tool-comparison ───────────────────────────────────────
      {
        category: "tool-comparison",
        riskLevel: "high",
        isComparison: true,
        comparisonTools: ["dbt snapshots", "custom incremental SCD2"],
        asked: 11,
        questionText:
          "dbt snapshots vs custom incremental SCD2 model — when does the complexity of a custom approach pay off?",
        answerStructured:
          "- **dbt snapshots**: built-in SCD2 with minimal SQL. Auto-managed validity columns, two detection strategies (timestamp / check), hard-delete opt-in. Right for most use cases: tables under tens of millions of rows, daily-or-slower change frequency, no custom retention requirements.\n- **Custom incremental SCD2**: hand-written change detection (LAG or JOIN to prior snapshot, conditional flags), manual `valid_from` / `valid_to` column management, full control over retention windows, partial updates, and custom SCD types (1, 3, hybrid).\n- **When custom wins**:\n  1. Regulatory data retention: e.g., 'keep only 2 years of history' — snapshot comparison runs grow with table size; a custom model with explicit retention pruning is cheaper.\n  2. Very large slowly-changing tables (100M+ rows): snapshot comparison scans the full table on every run; a custom incremental model only processes changed rows.\n  3. Non-standard change semantics: e.g., SCD Type 6 (hybrid 1+2+3), or tracking changes only for specific column combinations with complex logic.\n  4. Sub-daily CDC tracking: snapshots capture state at run time; for CDC streams with finer granularity, custom incremental logic can replay event-level changes.\n- **Cost of custom**: you write and maintain the change-detection SQL, validity columns, and any edge-case handling for late-arriving changes and deletes.",
        explanationDeep:
          "The snapshot-vs-custom question is fundamentally about where the complexity goes. Snapshots hide the complexity (dbt manages it), at the cost of flexibility and scale ceiling. Custom SCD2 exposes the complexity (you own the SQL), at the gain of full control.\n\nThe scale ceiling is the most concrete argument for custom at senior level: a snapshot on a 100M-row slowly-changing dimension runs a full-table comparison on every execution. At daily frequency that's 100M * 12 months = ~36B row-comparisons per year just for one table. A custom incremental model with a CDC source or timestamp watermark processes only changed rows — potentially 1000x fewer row comparisons.\n\nThe regulatory retention argument is equally concrete: snapshot tables grow indefinitely (there's no built-in pruning). A custom model with a `WHERE valid_from >= CURRENT_DATE - INTERVAL '2 years'` partition or a retention delete job keeps the table bounded. For GDPR or financial audit retention requirements, this is often a compliance requirement, not just a cost preference.",
        interviewerLens:
          "This is a trade-off discussion question, not a 'which is better' question. I want to hear both the valid use cases for snapshots (simplicity wins for most teams) and the specific failure modes that justify custom (scale, retention, non-standard SCD types). Candidates who say 'I always use snapshots because they're easier' haven't hit a scale problem. Candidates who say 'I always write custom SCD2 because it's more powerful' are over-engineering 90% of use cases. The middle path — start with snapshots, migrate to custom when you hit a concrete limitation — is the senior answer.",
        followupChain: [
          {
            question: "How do you implement a retention pruning job on a dbt snapshot table?",
            answer: "A post-hook on a separate dbt model that runs DELETE FROM snapshot_table WHERE dbt_valid_to < CURRENT_DATE - INTERVAL '2 years'. Or a dedicated maintenance dbt model (materialized as table) that selects only the retention window. The latter keeps the operation in the dbt DAG and tests it like any model."
          }
        ],
        redFlags: [
          {
            junior: "\"I always use snapshots — they're built in so why write custom code?\"",
            senior: "\"Snapshots are right for most cases. I switch to custom SCD2 when the table is too large for full comparison, when retention policy requires pruning, or when the SCD type is non-standard.\""
          }
        ],
        alternatePhrasings: [
          "\"When would you write your own SCD2 logic instead of using dbt snapshots?\"",
          "\"What are the limitations of dbt snapshots at scale?\"",
          "\"How do you implement GDPR data retention on a dbt snapshot table?\""
        ],
        interviewContexts: [
          "Senior analytics engineer interview at a regulated data platform",
          "Staff data engineer SCD design discussion",
          "Large-scale dbt architecture review at a Series E company"
        ]
      }
    ],
    topics: {
      moreDeepDives: [
        "How do you implement a blue-green deployment pattern for a critical dbt mart?",
        "How do you use dbt-checkpoint and pre-commit hooks to enforce project conventions?",
        "Walk me through setting up dbt Cloud CI with deferred state against a prod manifest.",
        "How do you build a custom dbt materialization for a warehouse feature not supported out of the box?",
        "How do you handle GDPR right-to-erasure in a dbt project with snapshots and fact tables?"
      ],
      decisions: [
        "When do you add a new dbt project (dbt Mesh) vs extending the existing one?",
        "Contract enforced vs tests-only for a public cross-team model — when is each sufficient?",
        "Full-refresh weekly job vs periodic reconciliation test — how do you decide the right correction mechanism?"
      ],
      quickRef: [
        "What does contract: enforced: true prevent?",
        "Name the valid exposure types in dbt",
        "What does access: public enable in dbt Mesh?",
        "What is the state:modified+ selector used for in CI?",
        "What is the generate_schema_name macro for?",
        "What does hard_deletes: new_record do in a snapshot?",
        "What is the dbt_valid_to_current config option?",
        "What does dbt build --select +exposure:name do?",
        "What is microbatch incremental strategy?",
        "What does incremental_predicates do?"
      ],
      redFlags: [
        {
          junior: "\"I just use a wider lookback window to be safe.\"",
          senior: "\"The window is sized to the observed late-arrival p99 plus a margin — I measure it from source metadata, not guess. Wider = higher cost; I right-size it empirically.\""
        },
        {
          junior: "\"I'd run --full-refresh in production without a plan.\"",
          senior: "\"I use CTAS+swap to minimize downtime, coordinate with dashboard consumers, and add a CI reconciliation check so this is the last time the drift happens.\""
        },
        {
          junior: "\"Contracts are just stricter tests.\"",
          senior: "\"Contracts validate model structure at build time before DDL is issued. Tests validate data content post-build. Different enforcement point, different failure mode.\""
        },
        {
          junior: "\"Exposures are just documentation.\"",
          senior: "\"Exposures enable +exposure: selectors in CI, impact analysis on schema changes, and show up in the lineage graph — they're operational infrastructure.\""
        },
        {
          junior: "\"I keep everything in one dbt project.\"",
          senior: "\"At 3+ teams, a monolithic project needs CODEOWNERS + contracts at minimum, dbt Mesh at scale — without ownership boundaries, any engineer can silently break any other team's models.\""
        }
      ],
      checklist: [
        "Explain the late-arriving data pattern with lookback window sizing",
        "Describe incremental drift: what causes it, how you detect it, how you prevent it",
        "Know dbt contracts — what they enforce, what they don't, breaking changes require versioning",
        "Know dbt exposures — types, depends_on, +exposure: selector pattern",
        "Explain dbt Mesh / cross-project refs and when you'd adopt them",
        "Discuss macro complexity liability — the 5+ models / 50+ lines / 3-level-deep rules"
      ],
      behavioral: [
        "Tell me about a time an incremental model caused a production data quality incident — what was the root cause and how did you prevent recurrence?",
        "Describe a dbt project governance problem you solved — ownership, schema drift, or CI reliability.",
        "Walk me through the most complex dbt macro you've written and the trade-offs you made."
      ],
      reverse: [
        "How is dbt ownership structured across teams — is there a dbt guild or platform team?",
        "What is the current strategy for handling breaking schema changes from source systems?",
        "Are you using dbt contracts and exposures today, and if not, what has prevented adoption?"
      ]
    }
  }
};
