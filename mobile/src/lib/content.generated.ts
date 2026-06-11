/**
 * AUTO-ASSEMBLED from the web app's lib/data (one agent per track).
 * 302 real interview questions across 16 tracks. Regenerate by re-running the
 * content pipeline; edit the per-track JSON in ./generated, not this file.
 */
import agents from './generated/agents.json';
import airflow from './generated/airflow.json';
import databricks from './generated/databricks.json';
import dbt from './generated/dbt.json';
import kafka from './generated/kafka.json';
import llms from './generated/llms.json';
import modeling from './generated/modeling.json';
import prompt from './generated/prompt.json';
import pyspark from './generated/pyspark.json';
import python from './generated/python.json';
import rag from './generated/rag.json';
import snowflake from './generated/snowflake.json';
import spark from './generated/spark.json';
import sql from './generated/sql.json';
import sysd from './generated/sysd.json';
import vectordb from './generated/vectordb.json';
// New tracks (cloud / vendor / deploy / architecture / behavioral) — content filled by the authoring swarm.
import architecture from './generated/architecture.json';
import aws from './generated/aws.json';
import azure from './generated/azure.json';
import behavioral from './generated/behavioral.json';
import cicd from './generated/cicd.json';
import dataIntegration from './generated/data-integration.json';
import docker from './generated/docker.json';
import evals from './generated/evals.json';
import gcp from './generated/gcp.json';
import git from './generated/git.json';
import kubernetes from './generated/kubernetes.json';
import leadership from './generated/leadership.json';
import mlsys from './generated/mlsys.json';
import observability from './generated/observability.json';
import palantir from './generated/palantir.json';
import security from './generated/security.json';
import terraform from './generated/terraform.json';
import typescript from './generated/typescript.json';
// Integration / Adobe MarTech tracks (authored by the content-gen swarm).
import snaplogic from './generated/snaplogic.json';
import aem from './generated/aem.json';
import workfront from './generated/workfront.json';
// Roles increment: stats / BI / databases / APIs / deep-learning + BI tools
import apis from './generated/apis.json';
import bi from './generated/bi.json';
import databases from './generated/databases.json';
import deepLearning from './generated/deep-learning.json';
import hex from './generated/hex.json';
import looker from './generated/looker.json';
import statistics from './generated/statistics.json';
import tableau from './generated/tableau.json';
// Cloud / vendor GenAI tracks (deep AI services wired into the *-ai roles)
import bedrock from './generated/bedrock.json';
import vertexAi from './generated/vertex-ai.json';
import azureAi from './generated/azure-ai.json';
import cortex from './generated/cortex.json';
import mosaic from './generated/mosaic.json';
// Cross-vendor production track: shared failure scenarios (SLA, catch-up, late data) diagnosed
// platform-neutrally; drill-downs fork into Databricks vs Snowflake native fixes.
import dataReliability from './generated/data-reliability.json';
// Agentic AI: MCP, multi-agent orchestration, LangGraph/AutoGen/CrewAI, memory, guardrails, eval.
import agenticAi from './generated/agentic-ai.json';
// Programming-language coding tracks (Q&A + code panels), authored by the content swarm.
import nodejs from './generated/nodejs.json';
import go from './generated/go.json';
import rust from './generated/rust.json';
import cpp from './generated/cpp.json';
import scala from './generated/scala.json';
import flutter from './generated/flutter.json';
import java from './generated/java.json';
import markdown from './generated/markdown.json';
// Domain tracks added from the JD backlog: capital-markets/trading + conversational/voice AI.
import trading from './generated/trading.json';
import voiceAi from './generated/voice-ai.json';
// Business & Management tracks
import programManagement from './generated/program-management.json';
import agilePm from './generated/agile-pm.json';
import finops from './generated/finops.json';
import productManagement from './generated/product-management.json';
import aiProductMgmt from './generated/ai-product-mgmt.json';
import businessAnalysis from './generated/business-analysis.json';
import stakeholderMgmt from './generated/stakeholder-mgmt.json';
import dataGovernance from './generated/data-governance.json';
import consultingFrameworks from './generated/consulting-frameworks.json';
import financeFundamentals from './generated/finance-fundamentals.json';
import bizops from './generated/bizops.json';
import supplyChain from './generated/supply-chain.json';
import preSales from './generated/pre-sales.json';
import customerSuccess from './generated/customer-success.json';
import riskCompliance from './generated/risk-compliance.json';
import costEngineer from './generated/cost-engineer.json';
import aep from './generated/aep.json';
import dbtMetricflow from './generated/dbt-metricflow.json';
import dbtSemanticLayer from './generated/dbt-semantic-layer.json';
// Databricks certification tracks — gap cards authored from official May 2026 exam guides
import certDbDeAssociate from './generated/cert-databricks-de-associate.json';
import certDbDeProfessional from './generated/cert-databricks-de-professional.json';
import certDbGenaiAssociate from './generated/cert-databricks-genai-associate.json';
import certDbContextEngineer from './generated/cert-databricks-context-engineer.json';
import certDbSparkDeveloper from './generated/cert-databricks-spark-developer.json';
import certDbDataAnalyst from './generated/cert-databricks-data-analyst.json';
import certDbMlAssociate from './generated/cert-databricks-ml-associate.json';
import certDbMlProfessional from './generated/cert-databricks-ml-professional.json';
// Snowflake certification tracks
import certSnowflakeAssociatePlatform from './generated/cert-snowflake-associate-platform.json';
import certSnowflakeCore from './generated/cert-snowflake-core.json';
import certSnowflakeAdvancedDe from './generated/cert-snowflake-advanced-data-engineer.json';
import certSnowflakeAdvancedArchitect from './generated/cert-snowflake-advanced-architect.json';
import certSnowflakeAdvancedAnalyst from './generated/cert-snowflake-advanced-data-analyst.json';
import certSnowflakeAdvancedScientist from './generated/cert-snowflake-advanced-data-scientist.json';
import certSnowflakeAdvancedMlops from './generated/cert-snowflake-advanced-mlops-engineer.json';
import certSnowflakeSpecialtyGenAi from './generated/cert-snowflake-specialty-gen-ai.json';
import certSnowflakeSpecialtySnowpark from './generated/cert-snowflake-specialty-snowpark.json';
// AWS certification tracks
import certAwsAiPractitioner from './generated/cert-aws-ai-practitioner.json';
import certAwsDataEngineer from './generated/cert-aws-data-engineer-associate.json';
import certAwsMlEngineer from './generated/cert-aws-machine-learning-engineer-associate.json';
import certAwsGenAiDeveloper from './generated/cert-aws-generative-ai-developer-professional.json';
// GCP certification tracks
import certGcpGenAiLeader from './generated/cert-gcp-generative-ai-leader.json';
import certGcpDataPractitioner from './generated/cert-gcp-associate-data-practitioner.json';
import certGcpDataEngineer from './generated/cert-gcp-professional-data-engineer.json';
import certGcpMlEngineer from './generated/cert-gcp-professional-ml-engineer.json';
import certGcpDatabaseEngineer from './generated/cert-gcp-professional-cloud-database-engineer.json';
// Azure certification tracks
import certAzureDp900 from './generated/cert-azure-dp-900.json';
import certAzureDp700 from './generated/cert-azure-dp-700.json';
import certAzureDp600 from './generated/cert-azure-dp-600.json';
import certAzureDp750 from './generated/cert-azure-dp-750.json';
import certAzureAi900 from './generated/cert-azure-ai-900.json';
import certAzureAi300 from './generated/cert-azure-ai-300.json';
import certAzureAi103 from './generated/cert-azure-ai-103.json';
import certAzureDp800 from './generated/cert-azure-dp-800.json';
import certAzureDp300 from './generated/cert-azure-dp-300.json';
import certAzurePl300 from './generated/cert-azure-pl-300.json';
import certAzureDp420 from './generated/cert-azure-dp-420.json';

export interface GeneratedCard {
  q: string;
  a: string;
  fj: string;
  fs: string;
  level: 'Jr' | 'Mid' | 'Sr' | 'Staff' | 'Principal';
  asked?: number;
  /** Optional real code examples shown under the answer (bug/fix or single snippet). */
  code?: {
    label?: string;
    lang?: 'sql' | 'python' | 'pyspark' | 'airflow' | 'dbt' | 'ts' | 'js' | 'go' | 'rust' | 'scala' | 'cpp' | 'dart' | 'java' | 'md';
    lines: string[];
    accent?: 'bug' | 'fix';
  }[];
  /** Optional drill-down follow-up Q&As, revealed one tap deeper under the answer. */
  followups?: { q: string; a: string }[];
  /** Optional MCQ format: when `opts` is present the card renders as a choice card. */
  opts?: { t: string; ok: boolean; why?: string }[];
  why?: string;
  strict?: boolean;
  /** Guided-tradeoff variant (#8): several ok:true positions, each `why` argues its side. */
  tradeoff?: boolean;
  /** Optional code shown above the options (choice cards). */
  lines?: string[];
}

export const GENERATED: Record<string, GeneratedCard[]> = {
  spark: spark as unknown as GeneratedCard[],
  pyspark: pyspark as unknown as GeneratedCard[],
  kafka: kafka as unknown as GeneratedCard[],
  sql: sql as unknown as GeneratedCard[],
  dbt: dbt as unknown as GeneratedCard[],
  airflow: airflow as unknown as GeneratedCard[],
  snowflake: snowflake as unknown as GeneratedCard[],
  databricks: databricks as unknown as GeneratedCard[],
  modeling: modeling as unknown as GeneratedCard[],
  python: python as unknown as GeneratedCard[],
  sysd: sysd as unknown as GeneratedCard[],
  rag: rag as unknown as GeneratedCard[],
  llms: llms as unknown as GeneratedCard[],
  agents: agents as unknown as GeneratedCard[],
  vectordb: vectordb as unknown as GeneratedCard[],
  prompt: prompt as unknown as GeneratedCard[],
  // New tracks
  typescript: typescript as unknown as GeneratedCard[],
  evals: evals as unknown as GeneratedCard[],
  mlsys: mlsys as unknown as GeneratedCard[],
  aws: aws as unknown as GeneratedCard[],
  gcp: gcp as unknown as GeneratedCard[],
  azure: azure as unknown as GeneratedCard[],
  palantir: palantir as unknown as GeneratedCard[],
  'data-integration': dataIntegration as unknown as GeneratedCard[],
  architecture: architecture as unknown as GeneratedCard[],
  security: security as unknown as GeneratedCard[],
  git: git as unknown as GeneratedCard[],
  docker: docker as unknown as GeneratedCard[],
  kubernetes: kubernetes as unknown as GeneratedCard[],
  terraform: terraform as unknown as GeneratedCard[],
  cicd: cicd as unknown as GeneratedCard[],
  observability: observability as unknown as GeneratedCard[],
  behavioral: behavioral as unknown as GeneratedCard[],
  leadership: leadership as unknown as GeneratedCard[],
  // Roles increment
  statistics: statistics as unknown as GeneratedCard[],
  bi: bi as unknown as GeneratedCard[],
  databases: databases as unknown as GeneratedCard[],
  apis: apis as unknown as GeneratedCard[],
  'deep-learning': deepLearning as unknown as GeneratedCard[],
  tableau: tableau as unknown as GeneratedCard[],
  looker: looker as unknown as GeneratedCard[],
  hex: hex as unknown as GeneratedCard[],
  // Cloud / vendor GenAI
  bedrock: bedrock as unknown as GeneratedCard[],
  'vertex-ai': vertexAi as unknown as GeneratedCard[],
  'azure-ai': azureAi as unknown as GeneratedCard[],
  cortex: cortex as unknown as GeneratedCard[],
  mosaic: mosaic as unknown as GeneratedCard[],
  snaplogic: snaplogic as unknown as GeneratedCard[],
  aem: aem as unknown as GeneratedCard[],
  workfront: workfront as unknown as GeneratedCard[],
  'data-reliability': dataReliability as unknown as GeneratedCard[],
  'agentic-ai': agenticAi as unknown as GeneratedCard[],
  // Programming-language coding tracks
  nodejs: nodejs as unknown as GeneratedCard[],
  go: go as unknown as GeneratedCard[],
  rust: rust as unknown as GeneratedCard[],
  cpp: cpp as unknown as GeneratedCard[],
  scala: scala as unknown as GeneratedCard[],
  flutter: flutter as unknown as GeneratedCard[],
  java: java as unknown as GeneratedCard[],
  markdown: markdown as unknown as GeneratedCard[],
  // Domain tracks (JD backlog)
  trading: trading as unknown as GeneratedCard[],
  'voice-ai': voiceAi as unknown as GeneratedCard[],
  // Business & Management
  'program-management': programManagement as unknown as GeneratedCard[],
  'agile-pm': agilePm as unknown as GeneratedCard[],
  finops: finops as unknown as GeneratedCard[],
  'product-management': productManagement as unknown as GeneratedCard[],
  'ai-product-mgmt': aiProductMgmt as unknown as GeneratedCard[],
  'business-analysis': businessAnalysis as unknown as GeneratedCard[],
  'stakeholder-mgmt': stakeholderMgmt as unknown as GeneratedCard[],
  'data-governance': dataGovernance as unknown as GeneratedCard[],
  'consulting-frameworks': consultingFrameworks as unknown as GeneratedCard[],
  'finance-fundamentals': financeFundamentals as unknown as GeneratedCard[],
  bizops: bizops as unknown as GeneratedCard[],
  'supply-chain': supplyChain as unknown as GeneratedCard[],
  'pre-sales': preSales as unknown as GeneratedCard[],
  'customer-success': customerSuccess as unknown as GeneratedCard[],
  'risk-compliance': riskCompliance as unknown as GeneratedCard[],
  'cost-engineer': costEngineer as unknown as GeneratedCard[],
  aep: aep as unknown as GeneratedCard[],
  'dbt-metricflow': dbtMetricflow as unknown as GeneratedCard[],
  'dbt-semantic-layer': dbtSemanticLayer as unknown as GeneratedCard[],
  // Databricks cert tracks (not shown in Skills tab — accessed only via cert detail screens)
  'cert-databricks-de-associate': certDbDeAssociate as unknown as GeneratedCard[],
  'cert-databricks-de-professional': certDbDeProfessional as unknown as GeneratedCard[],
  'cert-databricks-genai-associate': certDbGenaiAssociate as unknown as GeneratedCard[],
  'cert-databricks-context-engineer': certDbContextEngineer as unknown as GeneratedCard[],
  'cert-databricks-spark-developer': certDbSparkDeveloper as unknown as GeneratedCard[],
  'cert-databricks-data-analyst': certDbDataAnalyst as unknown as GeneratedCard[],
  'cert-databricks-ml-associate': certDbMlAssociate as unknown as GeneratedCard[],
  'cert-databricks-ml-professional': certDbMlProfessional as unknown as GeneratedCard[],
  // Snowflake cert tracks
  'cert-snowflake-associate-platform': certSnowflakeAssociatePlatform as unknown as GeneratedCard[],
  'cert-snowflake-core': certSnowflakeCore as unknown as GeneratedCard[],
  'cert-snowflake-advanced-data-engineer': certSnowflakeAdvancedDe as unknown as GeneratedCard[],
  'cert-snowflake-advanced-architect': certSnowflakeAdvancedArchitect as unknown as GeneratedCard[],
  'cert-snowflake-advanced-data-analyst': certSnowflakeAdvancedAnalyst as unknown as GeneratedCard[],
  'cert-snowflake-advanced-data-scientist': certSnowflakeAdvancedScientist as unknown as GeneratedCard[],
  'cert-snowflake-advanced-mlops-engineer': certSnowflakeAdvancedMlops as unknown as GeneratedCard[],
  'cert-snowflake-specialty-gen-ai': certSnowflakeSpecialtyGenAi as unknown as GeneratedCard[],
  'cert-snowflake-specialty-snowpark': certSnowflakeSpecialtySnowpark as unknown as GeneratedCard[],
  // AWS cert tracks
  'cert-aws-ai-practitioner': certAwsAiPractitioner as unknown as GeneratedCard[],
  'cert-aws-data-engineer-associate': certAwsDataEngineer as unknown as GeneratedCard[],
  'cert-aws-machine-learning-engineer-associate': certAwsMlEngineer as unknown as GeneratedCard[],
  'cert-aws-generative-ai-developer-professional': certAwsGenAiDeveloper as unknown as GeneratedCard[],
  // GCP cert tracks
  'cert-gcp-generative-ai-leader': certGcpGenAiLeader as unknown as GeneratedCard[],
  'cert-gcp-associate-data-practitioner': certGcpDataPractitioner as unknown as GeneratedCard[],
  'cert-gcp-professional-data-engineer': certGcpDataEngineer as unknown as GeneratedCard[],
  'cert-gcp-professional-ml-engineer': certGcpMlEngineer as unknown as GeneratedCard[],
  'cert-gcp-professional-cloud-database-engineer': certGcpDatabaseEngineer as unknown as GeneratedCard[],
  // Azure cert tracks
  'cert-azure-ai-900': certAzureAi900 as unknown as GeneratedCard[],
  'cert-azure-dp-900': certAzureDp900 as unknown as GeneratedCard[],
  'cert-azure-dp-700': certAzureDp700 as unknown as GeneratedCard[],
  'cert-azure-dp-600': certAzureDp600 as unknown as GeneratedCard[],
  'cert-azure-dp-750': certAzureDp750 as unknown as GeneratedCard[],
  'cert-azure-ai-300': certAzureAi300 as unknown as GeneratedCard[],
  'cert-azure-ai-103': certAzureAi103 as unknown as GeneratedCard[],
  'cert-azure-dp-800': certAzureDp800 as unknown as GeneratedCard[],
  'cert-azure-dp-300': certAzureDp300 as unknown as GeneratedCard[],
  'cert-azure-pl-300': certAzurePl300 as unknown as GeneratedCard[],
  'cert-azure-dp-420': certAzureDp420 as unknown as GeneratedCard[],
};
