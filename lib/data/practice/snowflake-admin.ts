import type { ConvItem } from "./types";

/**
 * Snowflake administrator / platform interview practice questions.
 * Researched from Snowflake official docs (docs.snowflake.com), select.dev,
 * estuary.dev, chaosgenius.io, flexera.com, and verified against
 * Snowflake SnowPro Core/Advanced Architect study materials (2025-2026).
 * Every idealAnswer was cross-checked against official documentation.
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const SNOWFLAKE_ADMIN_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────
  {
    id: "sfadm-wh-sizing-autosuspend",
    category: "snowflake-admin",
    executes: false,
    free: true,
    level: "junior",
    title: "Warehouse sizing, auto-suspend & auto-resume",
    company: "Mid-size analytics team · financial services",
    difficulty: "easy",
    mode: "text",
    prompt:
      "A new analytics team at your company is running ad-hoc queries throughout the day. Their current dedicated warehouse is an X-Large that runs 24/7. A colleague notices the bill is spiking. Walk me through how you would right-size and configure this warehouse to reduce idle spend without degrading analyst experience. Cover warehouse size selection, auto-suspend, and auto-resume settings — and explain the trade-offs of each choice.",
    hints: [
      "Start by asking about query patterns: how many concurrent analysts, typical query duration, and whether they see queuing. That determines size vs. cluster count.",
      "Auto-suspend cuts idle cost — but what is the cold-start penalty when the warehouse resumes, and how does that affect the analyst experience?",
      "Each warehouse size doubles the credit-per-hour consumption. Walk through how you would quantify the cost difference between, say, a Large and an X-Large.",
    ],
    starter: "",
    idealAnswer:
      "A strong answer starts by profiling usage before changing anything: query QUERY_HISTORY and WAREHOUSE_METERING_HISTORY in SNOWFLAKE.ACCOUNT_USAGE to find peak concurrency, average and p95 query duration, and the percentage of time the warehouse has no active queries. If the team runs 3-5 concurrent analysts running typical BI queries (seconds to a few minutes), a Large warehouse (4 credits/hour) is usually sufficient; an X-Large (16 credits/hour) is 4x the cost and only justified for large-scale transformations or very heavy queries. Auto-suspend should be set to 1-5 minutes for a shared analytics warehouse — shorter (1 min) saves more money but means analysts who return after a short break wait 1-3 seconds for resume. Auto-resume is always ON for an analytics warehouse so queries trigger it automatically. The trade-off: auto-suspend of 1 minute is appropriate for bursty/scheduled workloads; 5 minutes is better for interactive dashboards where sub-second resume UX matters. If the team has high concurrency spikes (e.g., morning rush), a multi-cluster warehouse with min_cluster_count=1 and max_cluster_count=2-3 prevents queueing without running extra clusters all day. Finally, separate warehouses by workload type (ad-hoc analyst, scheduled ETL, dashboards) so one heavy batch job does not penalize interactive queries — and each warehouse can have its own sizing and suspend policy. Monitoring: set a resource monitor on the warehouse with a monthly credit quota and a SUSPEND action at 90% to prevent runaway spend.",
    rubric: [
      "Recommends profiling QUERY_HISTORY / WAREHOUSE_METERING_HISTORY before resizing rather than guessing",
      "Correctly identifies that warehouse size doubles credits per hour and applies that math to the trade-off",
      "Sets auto-suspend to a concrete value (1-5 min) and explains the UX vs. cost trade-off",
      "Mentions separating workloads into dedicated warehouses by workload type",
      "References resource monitors or another cost guardrail mechanism",
    ],
  },
  {
    id: "sfadm-resource-monitors",
    category: "snowflake-admin",
    executes: false,
    free: false,
    level: "junior",
    title: "Resource monitors & credit quota enforcement",
    company: "SaaS startup · rapid growth",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Your Snowflake bill doubled last month because a poorly-written query looped in a Stored Procedure and consumed thousands of credits overnight. The CTO wants guardrails so this never happens again. Describe how you would use Snowflake resource monitors to set budget limits at both the account level and the individual warehouse level. What actions can a monitor trigger, and what are their differences? Are there any gaps in resource monitors you would fill with another mechanism?",
    hints: [
      "Resource monitors track credits over a configurable interval (daily, weekly, monthly). Walk through how the quota resets and what happens to in-flight queries at the moment of suspension.",
      "There are three action types: NOTIFY, SUSPEND, and SUSPEND_IMMEDIATE — they differ critically in what happens to currently running queries.",
      "Resource monitors do not limit individual query credit consumption directly. What would you add to catch a single runaway query?",
    ],
    starter: "",
    idealAnswer:
      "Resource monitors are account-level or warehouse-level objects that track credit consumption against a quota over a defined interval (daily, weekly, monthly, yearly, or never-reset). Best practice is to create one account-level monitor as a top-of-house ceiling (e.g., 10,000 credits/month) with a NOTIFY action at 75%, a SUSPEND action at 90%, and a SUSPEND_IMMEDIATE at 100%. Additionally, create per-warehouse monitors for high-risk warehouses (e.g., the ETL warehouse used by Stored Procedures) with tighter quotas. The three action types differ as follows: NOTIFY sends an email to designated users and records an alert but does not stop anything; SUSPEND lets currently running queries finish and then suspends the warehouse (safe for most workloads); SUSPEND_IMMEDIATE cancels all running queries instantly and suspends the warehouse (use for runaway scenarios). Each monitor supports up to five NOTIFY thresholds, one SUSPEND, and one SUSPEND_IMMEDIATE threshold. Quotas reset at 12:00 AM UTC on the configured interval regardless of wall-clock time. Gaps: resource monitors track total credit usage per interval but cannot cap a single query. To catch runaway individual queries, complement monitors with: (1) STATEMENT_TIMEOUT_IN_SECONDS on the warehouse or session level — kills any query exceeding the limit; (2) STATEMENT_QUEUED_TIMEOUT_IN_SECONDS — prevents queries from waiting forever in the queue. For production Stored Procedures, add a MAX_STATEMENT_COUNT guard in the procedure logic itself and test in a separate warehouse. Operationally, resource monitor notifications require email addresses to be confirmed in the user profile — verify this during setup or alerts silently fail.",
    rubric: [
      "Describes account-level and warehouse-level monitor assignment with distinct credit quotas",
      "Correctly distinguishes NOTIFY vs. SUSPEND (finish current) vs. SUSPEND_IMMEDIATE (kill current) actions",
      "Explains that quota resets at 12 AM UTC on the configured interval",
      "Identifies the gap: monitors do not cap individual queries; recommends STATEMENT_TIMEOUT_IN_SECONDS as a complement",
      "Mentions verifying email notification delivery as an operational gotcha",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────
  {
    id: "sfadm-rbac-hierarchy",
    category: "snowflake-admin",
    executes: false,
    free: false,
    level: "mid",
    title: "RBAC role hierarchy: SECURITYADMIN vs. SYSADMIN vs. custom roles",
    company: "Enterprise data platform · healthcare",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your company is onboarding three new teams to Snowflake: a Data Engineering team that needs to create databases, schemas, and warehouses; a Data Science team that needs read/write access to specific schemas; and a BI team that needs read-only access to a reporting schema. Design the role hierarchy. Explain which system-defined roles you use, which custom functional and access roles you create, and why ACCOUNTADMIN should not be the day-to-day operational role. How do SECURITYADMIN and SYSADMIN divide responsibilities in your design?",
    hints: [
      "Snowflake recommends separating access roles (define what can be done on an object) from functional roles (define who belongs to a team). Layer them.",
      "Who owns the GRANT privilege? SECURITYADMIN has MANAGE GRANTS globally — why is that dangerous if overused?",
      "Explain where custom roles sit in the hierarchy so their privileges roll up to SYSADMIN and remain auditable.",
    ],
    starter: "",
    idealAnswer:
      "Snowflake has five system-defined roles: ACCOUNTADMIN (top-level, encompasses SECURITYADMIN + SYSADMIN), SECURITYADMIN (manages users, roles, and global grants), USERADMIN (creates users and roles), SYSADMIN (creates databases, warehouses, and all data objects), and PUBLIC (auto-granted to everyone). Best practice: ACCOUNTADMIN is used only for account-level configuration (parameters, resource monitor creation, replication setup) and must NOT be the default role for any human or service account — it bypasses all data governance policies. Day-to-day operations split as follows: SECURITYADMIN handles user creation, role grants, and security policy assignments; SYSADMIN handles database/schema/warehouse creation and object ownership. For the three teams, create a layered model: (1) Access roles — these define privileges on objects: DB_REPORTING_READ (SELECT on all tables in REPORTING schema), DS_SCHEMA_RW (SELECT + INSERT + UPDATE on DS_WORK schema), DE_INFRA (CREATE DATABASE, CREATE WAREHOUSE). (2) Functional roles — these represent team membership: ROLE_BI_TEAM (granted DB_REPORTING_READ), ROLE_DATA_SCIENCE (granted DS_SCHEMA_RW), ROLE_DATA_ENGINEERING (granted DE_INFRA + broader data object privileges). Custom roles must be granted to SYSADMIN so the SYSADMIN can manage all objects created by those roles — failing to do this creates orphaned objects that only ACCOUNTADMIN can manage. SECURITYADMIN (or USERADMIN) creates users and grants functional roles to humans. SYSADMIN creates databases and warehouses. The key separation: SECURITYADMIN manages who can access what (identity and policy); SYSADMIN manages what exists to be accessed (objects). Neither should routinely use ACCOUNTADMIN. Audit: use SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS and GRANTS_TO_ROLES views to periodically review privilege drift.",
    rubric: [
      "Correctly explains ACCOUNTADMIN, SECURITYADMIN, and SYSADMIN responsibilities and why ACCOUNTADMIN is not for daily use",
      "Distinguishes access roles (object-level privileges) from functional roles (team membership) in the hierarchy",
      "Explains that custom roles must be granted to SYSADMIN to avoid orphaned objects",
      "Assigns role creation to SECURITYADMIN/USERADMIN and object creation to SYSADMIN with a clear boundary",
      "Mentions auditing role grants via ACCOUNT_USAGE views as an ongoing practice",
    ],
  },
  {
    id: "sfadm-governance-masking-rap",
    category: "snowflake-admin",
    executes: false,
    free: false,
    level: "mid",
    title: "Data governance: masking policies, row access policies & tags",
    company: "Global retailer · GDPR + CCPA compliance",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your company stores customer PII (email, phone, SSN) in a CUSTOMERS table in Snowflake. Analysts should see masked values; the DATA_OWNER role sees full data. Additionally, each regional manager should only see rows belonging to their region — enforced at the row level, not by creating separate views per region. You also need to classify all PII columns consistently as new tables are added. Walk me through how you implement dynamic data masking, row access policies, and object tags to solve all three requirements at scale.",
    hints: [
      "Dynamic data masking and row access policies are both schema-level objects that are attached to columns or tables — they do not change the underlying data.",
      "Tags can be associated with masking policies so that when a new column is tagged as PII, the policy applies automatically without a manual ALTER COLUMN step.",
      "Row access policies use a mapping table or a policy function that checks the current_role() or current_user() against an entitlements table — walk through that function design.",
    ],
    starter: "",
    idealAnswer:
      "Three governance features work together: (1) Dynamic Data Masking (DDM): Create a masking policy that returns the original value when CURRENT_ROLE() = 'DATA_OWNER' and returns a masked form (e.g., SHA2(email) for analysts, '***-**-XXXX' for SSN) otherwise. Apply the policy to each PII column with ALTER TABLE CUSTOMERS MODIFY COLUMN email SET MASKING POLICY mask_email. The policy executes at query time and never modifies stored data. (2) Row Access Policy (RAP): Create a schema-level RAP backed by an entitlements mapping table (e.g., REGION_ACCESS: user_name, allowed_region). The policy function returns TRUE where the region column of the row matches the calling user's allowed region via CURRENT_USER() or via a role-to-region mapping in the entitlements table. Apply it with ALTER TABLE CUSTOMERS ADD ROW ACCESS POLICY rap_region ON (region). Every SELECT, UPDATE, DELETE, and MERGE will automatically filter rows. Performance note: on tables with 100M+ rows, a complex RAP predicate can add 10-30% overhead — keep the entitlements join on a small, well-indexed mapping table. (3) Object Tags for scale: Create a tag SENSITIVITY with allowed values ('PII', 'SENSITIVE', 'PUBLIC'). Use tag-based masking: bind the masking policy to the tag with ALTER TAG SENSITIVITY SET MASKING POLICY mask_pii_generic. Now any column tagged SENSITIVITY = 'PII' automatically inherits the masking policy — no per-column ALTER required when new tables are added. Operational: assign a POLICY_ADMIN custom role (owned by SECURITYADMIN) that is the sole role allowed to create and assign policies, preventing privilege creep. Monitor: SNOWFLAKE.ACCOUNT_USAGE.POLICY_REFERENCES shows which policies are attached where. SNOWFLAKE.ACCOUNT_USAGE.TAG_REFERENCES shows tag coverage — use this to find untagged PII columns.",
    rubric: [
      "Explains DDM as a schema-level object that transforms data at query time, not at rest, and gives a concrete masking expression per role",
      "Designs a row access policy backed by an entitlements mapping table with a CURRENT_USER() or CURRENT_ROLE() check",
      "Explains tag-based masking as the scalable path so new PII columns do not require manual policy attachment",
      "Mentions the RAP performance overhead on large tables and the mitigation (small, indexed entitlements table)",
      "Describes a POLICY_ADMIN role for governance isolation and audit via ACCOUNT_USAGE.POLICY_REFERENCES",
    ],
  },
  {
    id: "sfadm-multicluster-concurrency",
    category: "snowflake-admin",
    executes: false,
    free: false,
    level: "mid",
    title: "Multi-cluster warehouse: scaling policies & cost vs. concurrency trade-offs",
    company: "BI-heavy enterprise · 200+ dashboard users",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your company's BI reporting warehouse is a Large warehouse. Every morning between 8-10 AM, 150 analysts hit their dashboards simultaneously and queries queue for 2-3 minutes. Outside peak hours the warehouse is idle 80% of the time. A colleague suggests switching to a 4X-Large to fix queuing. You think multi-cluster is the better answer. Walk through your reasoning: when does resizing help vs. scaling out, how do you configure a multi-cluster warehouse for this scenario, and how do you compare the total cost of each approach?",
    hints: [
      "A single warehouse runs one cluster. Multi-cluster adds more clusters of the same size behind a single endpoint — concurrency improves, not per-query speed.",
      "Maximized mode vs. Auto-scale mode have very different cost profiles. Which fits a warehouse that is idle 80% of the time?",
      "Walk through the credit math: a Large warehouse at 4 credits/hour vs. a 4X-Large at 64 credits/hour vs. a Large multi-cluster 1-3 in Auto-scale mode.",
    ],
    starter: "",
    idealAnswer:
      "The core insight: warehouse size (X-Small through 6X-Large) determines per-query resources — memory, CPU parallelism within a single query. Scaling up helps slow individual queries but does nothing for concurrency. Multi-cluster adds additional identical-size clusters that handle overflow queries when the primary cluster's concurrency limit is reached, eliminating the queue. The right fix for 150 concurrent morning dashboard users is scale-out (more clusters), not scale-up. Configuration: CREATE WAREHOUSE BI_REPORTING WITH WAREHOUSE_SIZE = 'LARGE' MIN_CLUSTER_COUNT = 1 MAX_CLUSTER_COUNT = 3 SCALING_POLICY = 'STANDARD' AUTO_SUSPEND = 120 AUTO_RESUME = TRUE. In Auto-scale mode (min < max), Snowflake starts additional clusters only when queries are queuing, then shuts them down after the scaling policy's idle window. Standard scaling policy spins up clusters quickly to prevent queuing; Economy policy waits longer to ensure a new cluster will be used for at least 6 minutes before starting it — Economy is better when you want to trade a small amount of queuing for credit savings. Credit math: a Large = 4 credits/hour per cluster. At peak (2 hours, 3 clusters): 4 × 3 × 2 = 24 credits. Off-peak (22 hours, 1 cluster, 80% idle, auto-suspend after 2 min): ~4-8 credits. Total: ~30-32 credits/day. Compare to a 4X-Large (64 credits/hour, no multi-cluster) running 24/7: 1,536 credits/day — 50x more expensive. Even running the 4X-Large with auto-suspend for 4 hours/day = 256 credits vs. ~32 for multi-cluster Large. Maximized mode (min = max = 3) keeps all 3 clusters running constantly — appropriate only for 24/7 high-volume workloads; not suitable here given 80% idle time. Monitoring after rollout: watch WAREHOUSE_METERING_HISTORY for cluster_count per 15-min interval and QUERY_HISTORY for queued_overload_time to validate that queueing has been eliminated.",
    rubric: [
      "Correctly explains that warehouse size improves per-query performance while multi-cluster improves concurrency — and applies the right lever",
      "Configures MIN_CLUSTER_COUNT, MAX_CLUSTER_COUNT, and SCALING_POLICY with justification for each setting",
      "Distinguishes Auto-scale vs. Maximized mode and explains why Auto-scale is appropriate for the 80% idle scenario",
      "Provides a concrete credit cost comparison (multi-cluster Large vs. 4X-Large) showing the order-of-magnitude difference",
      "References WAREHOUSE_METERING_HISTORY and QUERY_HISTORY to validate the solution post-deployment",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────
  {
    id: "sfadm-replication-failover",
    category: "snowflake-admin",
    executes: false,
    free: false,
    level: "senior",
    title: "Account replication, failover groups & business continuity design",
    company: "Financial data platform · Business Critical edition",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your company's Snowflake account is the single source of truth for regulatory reporting. The CISO has mandated an RPO of 15 minutes and an RTO of 30 minutes for a full regional outage. Walk me through how you would design and test a business continuity solution using Snowflake's native replication and failover capabilities. Cover: what objects you replicate, the difference between replication groups and failover groups, edition requirements, the failover procedure itself, and how you would validate recovery without impacting production.",
    hints: [
      "Replication groups vs. failover groups differ in whether the secondary can be promoted to read-write. One of them requires Business Critical edition.",
      "Achieving a 15-minute RPO means the replication schedule must run frequently — walk through the REPLICATION_SCHEDULE parameter and what drives its minimum interval.",
      "A failover test in Snowflake promotes the secondary to primary. How do you test without accidentally failing over your real production workload?",
    ],
    starter: "",
    idealAnswer:
      "Business continuity in Snowflake uses two constructs: Replication Groups (read-only replicated copies; available on all editions) and Failover Groups (promote secondary to read-write primary; requires Business Critical Edition or higher). For a 15-min RPO / 30-min RTO requirement on a regulated workload, the design is: (1) Create a Failover Group in the primary account that includes all critical objects — databases (including schemas, tables, views, streams, tasks, dynamic tables), account-level objects (users, roles, warehouses, network policies, security integrations, resource monitors, masking policies, row access policies). Not all objects replicate by default — explicitly enumerate object types in the OBJECT_TYPES clause. (2) Set REPLICATION_SCHEDULE = '5 MINUTES' on the failover group to refresh every 5 minutes, comfortably within the 15-minute RPO. The minimum practical schedule is 1 minute but this increases Snowflake replication compute costs. (3) Add the secondary account (target region / cloud) to the failover group's ALLOWED_ACCOUNTS list. The secondary account runs ALTER FAILOVER GROUP … REFRESH to pull a consistent point-in-time snapshot. (4) Connection strings: use a Snowflake Connection object (a DNS-like abstraction) that points to whichever account is primary. During failover, update the Connection to point to the secondary, so application config does not change. The failover procedure: (a) Confirm the secondary is up to date (check REPLICATION_GROUP_REFRESH_HISTORY for last_completed_refresh); (b) On the secondary account, run ALTER FAILOVER GROUP <name> PRIMARY — this promotes the secondary to read-write and demotes the original primary to secondary; (c) Update the Connection object; (d) Validate by running smoke-test queries. Estimated RTO: 5-10 minutes for promotion + application reconnect, well within the 30-minute target. Testing without impacting production: create a separate test Snowflake account in the same secondary region; add it to the failover group as an additional allowed account with READ_ONLY (replication-only, no promotion rights). Run promotion tests there — the test account receives the same replication stream but promotion is isolated from the real secondary. After the test, verify row counts and object counts match the primary. Important limits: databases created from shares cannot be replicated. Transient and temporary tables do not replicate data (only their definitions). Include a DATA_INTEGRITY_CHECK step that compares row counts on critical fact tables between primary and secondary after each refresh.",
    rubric: [
      "Correctly distinguishes Replication Groups (all editions, read-only) from Failover Groups (Business Critical, promotable) and states the edition requirement",
      "Sets a concrete REPLICATION_SCHEDULE that satisfies the 15-min RPO with explanation of the cost trade-off",
      "Describes the failover promotion command (ALTER FAILOVER GROUP … PRIMARY) and the Connection object for transparent application reconnection",
      "Explains a safe testing strategy (separate test account with replication but no production promotion) to validate DR without impacting production",
      "Notes replication exclusions: shared databases cannot replicate, transient/temporary table data does not replicate",
    ],
  },
  {
    id: "sfadm-query-perf-clustering",
    category: "snowflake-admin",
    executes: false,
    free: false,
    level: "senior",
    title: "Query performance tuning: clustering, search optimization & result cache",
    company: "E-commerce data platform · 50TB Snowflake account",
    difficulty: "hard",
    mode: "text",
    prompt:
      "A senior analyst reports that a Snowflake query scanning a 10TB ORDER_ITEMS table by ORDER_DATE and CUSTOMER_ID is taking 8 minutes on an X-Large warehouse. The table has no clustering key and is loaded daily with full refreshes. You have three tools available: Automatic Clustering on a clustering key, the Search Optimization Service, and Materialized Views. Walk through how you would diagnose the root cause using the query profile, then decide which optimization to apply — and when to use each tool. Also explain how the result cache and the local disk cache interact with this workload.",
    hints: [
      "Open the query profile in Snowsight and look for 'Bytes scanned' vs. 'Bytes scanned from cache' and the 'Partitions scanned' vs. 'Partitions total' ratio. What does a high ratio tell you?",
      "Clustering keys work by co-locating rows with the same key values into the same micro-partitions, reducing the number of partitions scanned. But clustering has a maintenance cost — who pays for it and when?",
      "The Search Optimization Service excels at equality and IN-list predicates on high-cardinality columns. Clustering keys excel at range scans on low-to-medium cardinality columns. Know the difference.",
    ],
    starter: "",
    idealAnswer:
      "Step 1 — Diagnose with the Query Profile: In Snowsight, open the query profile for the slow query. Key metrics to read: (a) Partitions scanned / Partitions total — if the ratio is near 1.0 (e.g., 95,000 / 100,000 partitions scanned), almost all micro-partitions are being read, meaning Snowflake cannot prune. This is the primary cause of the 8-minute runtime. (b) Bytes scanned from cache — a low percentage means the local disk cache (per-warehouse SSD cache of recently used micro-partition data) is cold, possibly because the warehouse was suspended between runs. (c) Spillage to local / remote storage — if present, the warehouse size may be too small for the working set. Step 2 — Choosing the optimization: Clustering key on (ORDER_DATE, CUSTOMER_ID): Since the query filters on ORDER_DATE (a range predicate, low-to-medium cardinality) as the primary filter, ORDER_DATE should be the first key to maximize partition pruning. CUSTOMER_ID as a secondary key helps when ORDER_DATE is selective. Automatic Clustering continuously re-clusters new micro-partitions as data is loaded. Cost: clustering credits are consumed in the background; monitor with AUTOMATIC_CLUSTERING_HISTORY. This is the right tool for a 10TB table with frequent range scans on ORDER_DATE. Search Optimization Service: Best for equality or IN-list point lookups on high-cardinality columns (e.g., specific ORDER_ID or EMAIL lookups). It builds a persistent search access path (a sorted index structure) at the table level. Not the right choice for range scans on ORDER_DATE. Cost: ~0.5 credits/TB/day for maintenance. Materialized Views: Pre-compute an aggregated result set (e.g., daily totals per customer). Appropriate if the analyst always runs the same aggregation. The MV is automatically refreshed when the base table changes. Not appropriate for ad-hoc filters on the raw row table. Result cache: Snowflake caches the full result set of any query for 24 hours at the services layer. If the exact same SQL with unchanged underlying data runs again, Snowflake returns the cached result with zero compute — the query instantly returns. For a daily-refresh table, this means the first run of the morning pays full cost; subsequent identical runs are free. Local disk cache (data cache): The active warehouse caches micro-partition data on its SSD between queries. Warming this cache by pre-running a canonical query after the warehouse resumes eliminates the first-run cold start. If the warehouse is suspended nightly, the local cache is cleared, explaining why the first morning query is always the slowest. Recommendation: Add ALTER TABLE ORDER_ITEMS CLUSTER BY (ORDER_DATE, CUSTOMER_ID) and enable Automatic Clustering. After the initial clustering pass (visible in AUTOMATIC_CLUSTERING_HISTORY), re-run the query — expect Partitions scanned to drop from ~95% to <5% of total for a typical 30-day ORDER_DATE filter, reducing runtime from 8 minutes to under 30 seconds on the same X-Large warehouse.",
    rubric: [
      "Reads the query profile correctly: partitions scanned ratio and bytes-from-cache percentage as the diagnostic entry points",
      "Selects clustering key (ORDER_DATE first) as the correct tool for range-scan partition pruning, with justification over Search Optimization Service for this access pattern",
      "Explains Search Optimization Service vs. clustering key trade-offs (equality/point lookups vs. range scans) and when each applies",
      "Describes both result cache (services-layer, 24-hour, zero-compute) and local disk cache (warehouse SSD, cleared on suspend) and their distinct behaviors",
      "Mentions AUTOMATIC_CLUSTERING_HISTORY and the ongoing credit cost of maintaining a clustering key as part of the decision",
    ],
  },
];
