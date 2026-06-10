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
};
