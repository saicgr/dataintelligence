import type { ConvItem } from "./types";

/**
 * Databricks administrator / platform interview questions.
 * Researched from official Databricks docs (docs.databricks.com, learn.microsoft.com/azure/databricks),
 * Databricks engineering blog, and community resources (2024-2026).
 * Topics: Unity Catalog, cluster policies, cost governance, SCIM/access control,
 * secrets management, DLT orchestration, Photon, and HMS→UC migration.
 * `free: true` items are playable without a Practice Pro subscription.
 */
export const DATABRICKS_ADMIN_ITEMS: ConvItem[] = [
  // ─── JUNIOR ────────────────────────────────────────────────────────────────
  {
    id: "dbxadm-uc-hierarchy",
    category: "databricks-admin",
    executes: false,
    free: true,
    level: "junior",
    title: "Unity Catalog three-level namespace and metastore design",
    company: "Mid-size fintech · migrating to lakehouse",
    difficulty: "easy",
    mode: "text",
    prompt:
      "Your company is setting up Databricks Unity Catalog for the first time across three teams: engineering, analytics, and data science. Each team should be able to discover tables in other teams’ catalogs but not read the underlying data unless explicitly granted. Walk me through how you would structure the metastore, catalogs, schemas, and initial grants. Explain the one-metastore-per-region constraint and how you would handle a team in a different cloud region that needs to query a shared dimension table.",
    hints: [
      "Start by explaining the three-level namespace (catalog.schema.table) and what the metastore boundary means for lineage and governance.",
      "Think about who owns each catalog — should ownership be a user or a group? What happens when that person leaves?",
      "For cross-region access, Unity Catalog lineage does not cross metastore boundaries — name the Databricks feature designed for cross-region/cross-cloud sharing.",
    ],
    starter: "",
    idealAnswer:
      "Unity Catalog exposes a three-level namespace: metastore → catalog → schema → table/view/volume. There is exactly one metastore per region per Databricks account; all workspaces attached to that region share a single metastore. For the three-team setup, the recommended pattern is one catalog per team (e.g., eng_prod, analytics_prod, ds_prod) rather than one schema, because catalog-level bindings to workspaces and catalog-level grants provide cleaner isolation. Each catalog should be owned by a group (e.g., grp_engineering), never an individual user, so that admin rights survive personnel changes. For broad discoverability, grant BROWSE on each catalog to the ‘all account users’ group — this lets users see catalog and schema names without exposing data. Actual data access requires explicit USE CATALOG + USE SCHEMA + SELECT grants on the specific schemas or tables. Admins should grant USE CATALOG and USE SCHEMA only to users who need to query data inside them, not as default. For the cross-region dimension table, Unity Catalog lineage does not cross metastore or region boundaries. The correct solution is Delta Sharing: the owning workspace creates a Share containing the dimension table and publishes it to a recipient in the other region’s metastore. Recipients can query it via a foreign catalog without data replication, and access is governed by the sharing organization. Attempting to register the same external table location in two metastores simultaneously risks metadata inconsistency and should be avoided per official best practices.",
    rubric: [
      "Correctly describes the three-level namespace (metastore/catalog/schema/table) and one-metastore-per-region constraint",
      "Recommends group-owned catalogs rather than individually owned catalogs for durability",
      "Distinguishes BROWSE (discoverability) from USE CATALOG + SELECT (data access) and applies the principle of least privilege",
      "Identifies Delta Sharing as the correct solution for cross-region/cross-metastore data access, not multi-metastore registration",
    ],
  },
  {
    id: "dbxadm-cluster-policies",
    category: "databricks-admin",
    executes: false,
    free: true,
    level: "junior",
    title: "Cluster policies, instance pools, and job vs. all-purpose compute",
    company: "Data platform team at a retail company",
    difficulty: "easy",
    mode: "text",
    prompt:
      "A new data engineering team of 12 people has just been onboarded to your Databricks workspace. Finance is worried about runaway cloud spend from long-running interactive clusters. You need to (a) explain the difference between all-purpose and job clusters, (b) design a cluster policy that caps DBU consumption and mandates a cost-center tag, and (c) describe how instance pools reduce startup latency for short-lived job clusters. What attributes would you configure in the policy, and what happens if a user tries to create a cluster that violates it?",
    hints: [
      "Use the `dbus_per_hour` synthetic attribute in the policy to cap hourly spend rather than trying to limit individual node types.",
      "Mandatory tags can be enforced via a `fixed` attribute on the custom tag key in the policy definition.",
      "Instance pools keep pre-warmed VMs idle so job clusters can attach within seconds rather than minutes — but pool-level tags are what propagate to cloud billing, not cluster tags.",
    ],
    starter: "",
    idealAnswer:
      "All-purpose clusters are persistent, multi-user clusters used for interactive notebook development and ad-hoc exploration; they are billed continuously while running and should auto-terminate after idle time. Job clusters are ephemeral: Databricks spins them up for a specific job run, terminates them on completion, and bills only for run duration. Databricks recommends using job clusters for production workloads to minimize cost; all-purpose clusters are appropriate for development. A cluster policy for the team should include: (1) a `fixed` attribute on `autotermination_minutes` set to 60 to prevent indefinitely running interactive clusters; (2) a `range` attribute on `dbus_per_hour` with a max of, say, 50 to cap hourly DBU burn; (3) a `fixed` attribute on a custom tag key like `cost_center` set to the team’s value — this propagates to billing records enabling chargeback; (4) a `allowlist` or `fixed` attribute on `spark_version` to prevent use of deprecated runtimes; (5) `cluster_type` set to `all-purpose` for the interactive policy (create a separate policy for job clusters). If a user attempts to create a cluster violating the policy — for example, requesting more nodes than the `num_workers` range allows — the Databricks UI shows an error and prevents creation; the cluster cannot be started. For instance pools: admins create a pool of pre-warmed instances of specific VM types. Job clusters attached to the pool skip VM provisioning and start in ~30 seconds instead of 5-7 minutes. Crucially, only pool-level tags propagate to the underlying cloud VM instances for cloud-provider billing attribution; cluster tags on job clusters attached to a pool do NOT propagate to VMs. Admins must set cost tags at the pool level.",
    rubric: [
      "Correctly distinguishes all-purpose (interactive, persistent) from job (ephemeral, per-run) clusters and recommends job clusters for production",
      "Names at least three specific policy attributes: `dbus_per_hour`, auto-termination, and a mandatory cost-center tag using `fixed`",
      "Explains that a policy violation prevents cluster creation (not just warns), and that the policy is enforced at the UI and API level",
      "Explains instance pools reduce startup latency and that pool-level tags (not cluster tags) propagate to cloud VM billing",
    ],
  },

  // ─── MID ────────────────────────────────────────────────────────────────────
  {
    id: "dbxadm-uc-grants-scim",
    category: "databricks-admin",
    executes: false,
    free: false,
    level: "mid",
    title: "SCIM provisioning, service principals, and Unity Catalog grants at scale",
    company: "Enterprise SaaS platform · 1,200 Databricks users",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your organization has 1,200 users synced from Okta (SAML + SCIM) into the Databricks account console. The security team wants: (a) no standing human write access to production Delta tables — only CI/CD service principals may write; (b) offboarded employees’ access revoked within one hour of HR deactivation; (c) auditable records of who accessed what data. Walk me through how SCIM provisioning, service principal grants, Unity Catalog privilege model, and system tables work together to satisfy all three requirements.",
    hints: [
      "SCIM provisions users and groups to the Databricks account layer, not individual workspaces — workspace assignment is a separate step.",
      "Service principals in Databricks represent non-human identities; to prevent accidental production writes, MODIFY on production tables should be granted only to service principals, not to human groups.",
      "Unity Catalog’s `system.access.audit` table (system schema) records all data access events — describe its key columns and how you would query it for a specific user.",
    ],
    starter: "",
    idealAnswer:
      "SCIM (System for Cross-domain Identity Management) is configured between Okta and the Databricks account console using the SCIM API endpoint and a Databricks-issued token. Okta pushes user lifecycle events (create, update, deactivate) automatically; deactivation propagates to Databricks within minutes, satisfying the one-hour revocation SLA. Note that SCIM does NOT sync service principals — those are managed separately in Databricks. Once users and groups exist in the account, workspace admins assign them to specific workspaces; this is a separate action from SCIM provisioning. For requirement (a), the privilege model should be: human analyst groups receive USE CATALOG + USE SCHEMA + SELECT on production catalogs. The MODIFY and WRITE VOLUME privileges on production tables are granted only to service principal identities used by CI/CD pipelines (e.g., an Azure AD application registration or an AWS IAM service account mapped to a Databricks service principal). This is enforced via `GRANT MODIFY ON TABLE prod.sales.orders TO \`sp-cicd@company.com\`` and explicitly `REVOKE MODIFY` from human groups. Service principals should use OAuth M2M (machine-to-machine) tokens, not PATs, for programmatic access. For requirement (b), when HR deactivates a user in Okta, SCIM marks them deactivated in Databricks within the sync cycle (typically 10-40 minutes). Deactivated users lose all active sessions and cannot authenticate. Workspace admins should monitor the SCIM sync lag and set Okta push to near-real-time. For requirement (c), Unity Catalog writes all data access events to `system.access.audit` (a system table available in the `system` catalog). Key columns include `event_time`, `user_identity`, `request_params` (contains table name), `response.status_code`, and `service_name`. A sample audit query: `SELECT event_time, user_identity.email, request_params.table_name FROM system.access.audit WHERE service_name = ’unityCatalog’ AND action_name IN (’getTable’, ’executeStatement’) AND event_time > current_timestamp() - INTERVAL 24 HOURS`. System tables are retained for 365 days and are queryable from any workspace attached to the metastore.",
    rubric: [
      "Correctly explains the account-level SCIM provisioning flow from Okta and the separate workspace assignment step",
      "Identifies that service principals require separate management (not via SCIM) and recommends OAuth M2M over PATs",
      "Describes the grant structure that restricts MODIFY to service principals and SELECT to human groups on production tables",
      "Names `system.access.audit` for audit trail and describes at least two key columns used to trace user data access",
      "Addresses the SCIM deactivation propagation path that satisfies the one-hour revocation SLA",
    ],
  },
  {
    id: "dbxadm-cost-governance",
    category: "databricks-admin",
    executes: false,
    free: false,
    level: "mid",
    title: "Cost governance: tagging, budget policies, and system table chargeback",
    company: "Multi-team data platform · Series C startup",
    difficulty: "medium",
    mode: "text",
    prompt:
      "The CFO wants monthly chargeback reports showing DBU and cloud spend broken down by team and environment (dev/staging/prod). Today, clusters have no consistent tagging and the finance team gets a single Databricks bill. You have five teams, three environments, and a mix of all-purpose clusters, job clusters, SQL warehouses, and serverless compute. Design a complete cost governance strategy: tagging schema, enforcement mechanism, budget alerting, and the reporting pipeline. Specifically address how serverless compute differs from classic compute for cost attribution.",
    hints: [
      "Cluster policies are the enforcement point for custom tags on classic compute — but serverless notebooks and jobs do not support cluster-level tags. Budget policies fill this gap.",
      "System table `system.billing.usage` contains per-workspace, per-SKU DBU consumption with custom tag columns — name the key columns you would use for chargeback.",
      "Set budget alerts at multiple thresholds (50%, 75%, 90%) so teams get progressive warning before hitting their cap.",
    ],
    starter: "",
    idealAnswer:
      "A complete cost governance strategy has four layers: tagging schema, enforcement, monitoring, and reporting. Tagging schema: at minimum, mandate two custom tag keys on all compute: `team` (e.g., engineering, analytics, ds, marketing, ops) and `env` (dev, staging, prod). Optionally add `project` and `cost_center` for finer granularity. Since tags only affect future usage (not retroactively), rolling out tags before provisioning any compute is critical. Enforcement on classic compute: create a cluster policy per team that sets `custom_tags.team` as a `fixed` attribute with the team’s value and `custom_tags.env` with an `allowlist` of the three environments. Users cannot create a cluster without these tags; invalid attempts are blocked. For SQL warehouses, tags are set at creation and enforced by workspace admins reviewing warehouse configs. For instance pools, pool-level tags must be set because only pool tags propagate to cloud VM billing. Serverless compute (serverless notebooks, serverless jobs): classic cluster tags do not apply. Use budget policies — a workspace-level feature that automatically attaches tags to all serverless compute charges in that workspace. Create one budget policy per team workspace or use workspace-level tags that propagate through billing records. Budget alerting: use the Databricks Budgets API (or account console UI) to set budgets per workspace or per tag filter. Configure alerts at 50%, 75%, and 90% of monthly threshold so teams receive staged warnings via email or Slack webhook. Reporting pipeline: `system.billing.usage` (in the `system` catalog) is the source of truth. Key columns: `workspace_id`, `sku_name`, `usage_date`, `usage_quantity` (DBUs), `custom_tags` (map column containing the team/env tags), and `list_cost`. A nightly dbt or Delta Live Tables job reads from `system.billing.usage`, explodes the `custom_tags` map, and joins to a team metadata table to produce a monthly_chargeback summary table. The finance team queries this via a SQL warehouse. Cloud VM costs (EC2/Azure VMs) are attributed separately through the cloud provider’s cost explorer using the same tag keys propagated by Databricks to the underlying VMs.",
    rubric: [
      "Defines a concrete tagging schema (at least team + env keys) and explains why retroactive tagging has no effect",
      "Describes cluster policy enforcement for classic compute and budget policies for serverless as the two distinct enforcement mechanisms",
      "Explains that pool-level tags (not cluster tags) propagate to cloud VM billing for instance pool clusters",
      "Names `system.billing.usage` with specific relevant columns (`custom_tags`, `usage_quantity`, `sku_name`) for the chargeback reporting pipeline",
      "Describes a multi-threshold budget alert strategy (50/75/90%) and the notification mechanism",
    ],
  },
  {
    id: "dbxadm-secrets-passthrough",
    category: "databricks-admin",
    executes: false,
    free: false,
    level: "mid",
    title: "Secrets management: scopes, ACLs, and the Unity Catalog migration from credential passthrough",
    company: "Healthcare analytics platform · HIPAA workloads",
    difficulty: "medium",
    mode: "text",
    prompt:
      "Your data platform runs HIPAA-regulated workloads on Databricks. Currently, some teams use IAM credential passthrough to access S3 buckets, and others hard-code AWS access keys in notebooks. The security team wants to eliminate both practices. Design a secrets management architecture using Databricks secret scopes and Unity Catalog external locations that (a) prevents credentials from appearing in notebook output, (b) enforces least-privilege access per team, and (c) provides an upgrade path away from IAM credential passthrough, which is deprecated in Databricks Runtime 15.0+.",
    hints: [
      "Secret scope ACLs have three levels: READ, WRITE, MANAGE — most users should only have READ on scopes relevant to their role.",
      "Unity Catalog external locations are the recommended replacement for credential passthrough: a storage credential (backed by an IAM role or service principal) is attached to an external location, and Unity Catalog enforces access via grants — no credentials in code.",
      "Databricks automatically redacts secret values in notebook output if accessed via `dbutils.secrets.get()` — but only for literal values, not if the value is manipulated and re-printed.",
    ],
    starter: "",
    idealAnswer:
      "Eliminating hard-coded credentials: all AWS keys and connection strings must move to Databricks-backed secret scopes. A secret scope is a named collection of secrets stored in Databricks’ encrypted database. Admins create one scope per application or team (e.g., `team-analytics-prod`), add secrets with `databricks secrets put`, and set ACLs: the team’s Databricks group gets READ permission; the DevOps group managing credentials gets WRITE; workspace admins get MANAGE. Most developers only need READ. Credentials are accessed in notebooks via `dbutils.secrets.get(scope=\"team-analytics-prod\", key=\"s3-access-key\")` — Databricks automatically redacts the return value in notebook cell output, replacing it with `[REDACTED]`. Important caveat: redaction only applies to the literal returned string; if code does `secret = dbutils.secrets.get(...); print(secret[:5])` the first 5 characters ARE printed. Admins should audit notebooks for such patterns. For HIPAA compliance, scope names are readable by all workspace users (non-sensitive), but secret values are not. Eliminating credential passthrough: IAM credential passthrough is deprecated from Databricks Runtime 15.0 and will be removed in future versions. The Unity Catalog replacement is external locations. Steps: (1) Create a storage credential in Unity Catalog backed by an AWS IAM role (using the Databricks account IAM role trust policy); (2) Create an external location pointing to the S3 bucket prefix using the storage credential; (3) Grant READ VOLUME or SELECT on the external location’s path to the appropriate groups; (4) Remove the `spark.databricks.passthrough.enabled` cluster config. With external locations, queries like `SELECT * FROM delta.’s3://bucket/path/’` authenticate automatically via the Unity Catalog credential, with no secrets in code and full lineage tracking. Access is governed by Unity Catalog grants, enabling per-team least-privilege without IAM role proliferation.",
    rubric: [
      "Describes Databricks-backed secret scopes with per-scope ACLs (READ/WRITE/MANAGE) mapped to least-privilege group assignments",
      "Explains `dbutils.secrets.get()` automatic redaction and the important caveat that string manipulation can expose partial values",
      "Identifies IAM credential passthrough as deprecated in DBR 15.0+ and recommends Unity Catalog external locations as the replacement",
      "Explains the external location creation flow: storage credential (IAM role) → external location → Unity Catalog grants — no credentials in code",
    ],
  },

  // ─── SENIOR ─────────────────────────────────────────────────────────────────
  {
    id: "dbxadm-dlt-orchestration",
    category: "databricks-admin",
    executes: false,
    free: false,
    level: "senior",
    title: "Delta Live Tables pipeline design, expectations, and operational monitoring",
    company: "Global retailer · medallion lakehouse",
    difficulty: "hard",
    mode: "text",
    prompt:
      "Your team is migrating a 40-table Spark batch pipeline into Delta Live Tables (DLT). The pipeline must: process 500 GB of raw clickstream data daily in the Bronze layer, apply data quality checks in Silver (drop records with null `session_id`, quarantine records where `event_timestamp` is more than 48 hours old), and produce Gold aggregations consumed by BI. You also need to integrate DLT with Databricks Jobs for downstream dependencies (a model retraining job that runs after DLT completes). Walk me through pipeline architecture decisions, expectation strategies, compute sizing, and how you would monitor the pipeline operationally in production, including alerting on expectation failures.",
    hints: [
      "DLT expectations have three enforcement modes: `expect` (log violations, keep row), `expect_or_drop` (remove violating rows, continue pipeline), `expect_or_fail` (halt pipeline on first violation). Match the mode to the business impact of bad data.",
      "DLT pipelines can run in triggered or continuous mode — for a daily batch, triggered mode is correct. Continuous mode keeps a cluster running indefinitely.",
      "DLT event logs are stored as a Delta table in the pipeline storage location; query `event_log(‘pipeline_id’)` to build custom monitoring dashboards on expectation metrics.",
    ],
    starter: "",
    idealAnswer:
      "Pipeline architecture: use a three-layer medallion structure within one DLT pipeline. Bronze: declare streaming tables reading from Databricks Auto Loader (`cloudFiles` source) pointed at the raw S3 landing zone — Auto Loader handles incremental file discovery and schema inference, avoiding full scans. Silver: define materialized views or streaming tables that apply expectations and transformations. Gold: materialized views with aggregations. Expectation strategy: for the null `session_id` rule, use `expect_or_drop` — rows without a session_id are analytically useless but should not halt the pipeline; they are silently dropped and the drop count is recorded in the event log. For the stale timestamp rule (events > 48 hours old), use `expect` with a metric annotation rather than dropping, quarantine these rows to a separate `silver_quarantine` table via a `CASE WHEN` routing pattern — this preserves the data for late-arriving event investigation. Reserve `expect_or_fail` for hard data contracts: e.g., a mandatory schema column from an upstream CDC topic being entirely absent (indicating a feed failure). Compute sizing: for 500 GB daily, use a DLT pipeline with Enhanced Autoscaling enabled. Enhanced Autoscaling (the DLT-specific autoscaling, distinct from standard cluster autoscaling) observes pipeline backlog and scales workers faster than standard autoscaling. Set `min_workers` to 4 and `max_workers` to 20 for the Silver layer; Gold aggregations can run on 2-4 workers. Use Photon-enabled instance types (e.g., Delta tier) for the Silver and Gold layers — Photon accelerates Delta merge operations and SQL workloads by 2-10x. Job integration: in Databricks Jobs, create a pipeline task (type: `pipeline`) for the DLT pipeline, then add a downstream notebook or Python task for model retraining as a dependent task. The Job orchestrates sequencing; the DLT pipeline task succeeds only when all tables are materialized without `expect_or_fail` violations. Operational monitoring: DLT writes structured events to the event log Delta table at the pipeline storage location. Query it with `SELECT * FROM event_log(‘<pipeline-id>’) WHERE event_type = ’flow_progress’` to get per-table metrics including `data_quality.expectations` — a nested column containing pass/fail/drop counts per expectation per update. Build a Databricks SQL dashboard querying the event log for: (a) daily expectation violation rate per table; (b) pipeline duration trend; (c) rows dropped vs. rows processed ratio. For alerting: create a Databricks SQL alert on a query that checks if any expectation’s drop rate exceeds 5% in the last 24 hours, and route to a Slack webhook or PagerDuty. Also monitor pipeline lag via the `pipeline_progress` event for `latest_update_id` completion timestamps.",
    rubric: [
      "Correctly maps expectation enforcement modes (expect/expect_or_drop/expect_or_fail) to business rules and explains the quarantine pattern for stale records",
      "Recommends Auto Loader for incremental Bronze ingestion and explains why it avoids full directory scans",
      "Describes DLT Enhanced Autoscaling as distinct from standard cluster autoscaling and recommends Photon for Silver/Gold compute",
      "Explains Job task dependency (pipeline task type) for downstream model retraining integration",
      "Describes the event log Delta table as the monitoring source and names specific columns/event types used for expectation metrics and alerting",
    ],
  },
  {
    id: "dbxadm-uc-migration",
    category: "databricks-admin",
    executes: false,
    free: false,
    level: "senior",
    title: "End-to-end migration from Hive metastore to Unity Catalog",
    company: "Enterprise retailer · legacy Databricks workspace",
    difficulty: "hard",
    mode: "text",
    prompt:
      "You are the platform architect leading a migration of 800 tables from the legacy Hive metastore (HMS) to Unity Catalog. The tables include a mix of managed Delta tables, external Parquet tables (pointing to S3), and a few Hive views. Some tables are in active use by 30+ notebooks and scheduled jobs. You must minimize downtime and data risk. Design the migration plan covering: pre-migration assessment, HMS federation vs. full upgrade, table-by-table migration sequencing, permission migration, validation, and rollback strategy. Mention the UCX tool.",
    hints: [
      "UCX (Unity Catalog Migration Accelerator) is the open-source Databricks tool that automates discovery, assessment, and migration of HMS objects — run the assessment workflow first before touching any table.",
      "Hive managed tables store data in the workspace’s default DBFS location; when upgraded to UC managed tables, data is moved to the UC metastore’s managed storage. External tables point to external storage and do not move data.",
      "HMS federation creates a foreign catalog that mirrors the HMS metadata in Unity Catalog, allowing existing code using `hive_metastore.schema.table` syntax to work during the transition without a flag day cutover.",
    ],
    starter: "",
    idealAnswer:
      "Phase 1 — Pre-migration assessment with UCX: install the UCX (Unity Catalog Migration Accelerator) open-source tool on the workspace. Run `databricks labs ucx install` and then the `assessment` workflow. UCX scans all HMS tables, notebooks, jobs, and cluster configs and produces a report classifying: (a) tables ready for direct upgrade; (b) tables requiring data migration (HMS managed tables in DBFS — data will move to UC managed storage); (c) incompatible objects (e.g., Hive SerDe tables, Parquet files in unsupported locations); (d) notebooks/jobs referencing `hive_metastore.*` paths that need code updates. Prioritize fixing incompatibilities before migrating. Phase 2 — HMS federation (zero-downtime bridge): before any table upgrade, enable Hive Metastore Federation. This creates a `hive_metastore` foreign catalog in Unity Catalog that mirrors HMS metadata. Existing notebooks using `hive_metastore.schema.table` continue to work unchanged; queries are governed by HMS ACLs. This buys time for incremental migration without a flag-day cutover. Phase 3 — Migration sequencing: migrate in reverse-dependency order: dimension tables and reference data first (low risk, low usage), then fact tables, then views. For external Parquet tables (S3): create an external location and storage credential in UC first, then use the UCX `migrate-tables` workflow or `CREATE TABLE ... CLONE` to upgrade the table definition in UC — no data movement, since the S3 path remains. Convert format to Delta during migration: `CREATE TABLE uc_catalog.schema.table USING DELTA AS SELECT * FROM hive_metastore.schema.parquet_table` is safer than in-place upgrade. For HMS managed Delta tables: UCX runs a DEEP CLONE to the UC managed storage location and creates the UC table entry. The original HMS table remains until validation passes. NEVER drop the HMS schema with CASCADE while the UC table is still using the same underlying storage path. Phase 4 — Permission migration: HMS used table ACLs (GRANT SELECT ON TABLE); UC uses a different privilege model. UCX’s `migrate-acls` workflow translates HMS grants to UC GRANT statements, mapping HMS principals to Unity Catalog groups. Review the output: HMS roles mapped to UC groups must exist in the account console (created via SCIM or manually). Phase 5 — Validation: for each migrated table, run: (1) row count comparison between HMS and UC tables; (2) schema comparison using `DESCRIBE TABLE`; (3) a sample query comparing 1,000 rows. Automated validation can use a Databricks Job with a notebook that asserts equality. Phase 6 — Cutover and code updates: update notebooks and job parameters to use `uc_catalog.schema.table` syntax. Use UCX’s `migrate-code` workflow to batch-update notebook references. After validation, drop the HMS table (not schema with CASCADE) to release DBFS storage. Rollback strategy: HMS tables are not dropped until validation passes, so rollback is re-pointing code to `hive_metastore.*` references. For UCX DEEP CLONE migrations, the original HMS managed table data in DBFS is intact until explicitly deleted. Federation ensures the HMS foreign catalog continues serving queries during rollback.",
    rubric: [
      "Names UCX (Unity Catalog Migration Accelerator) as the assessment and automation tool and describes the assessment workflow output",
      "Explains HMS federation as the zero-downtime bridge that allows incremental migration without a flag-day cutover",
      "Distinguishes external table migration (no data movement, just metadata re-registration) from managed table migration (DEEP CLONE to UC managed storage) and warns against DROP SCHEMA CASCADE",
      "Describes the UCX permission migration workflow and the requirement that HMS principals must map to existing UC groups",
      "Defines a concrete validation approach (row count, schema comparison, sample query) and rollback path (HMS tables intact until explicit deletion)",
    ],
  },
];
