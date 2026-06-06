/**
 * Stage 0 · Fundamentals — a FREE beginner primer per role. Ultra-basic cards
 * ("what is a list", "what are tokens") authored per concept track in ./generated/basics,
 * surfaced as a pinned "Start here" deck assembled from the role's core tracks.
 */
import { GeneratedCard } from './content.generated';
import type { SessionCard } from './content';
import { trackBySlug, tracksForRole } from './content';

import apis from './generated/basics/apis.json';
import agents from './generated/basics/agents.json';
import airflow from './generated/basics/airflow.json';
import architecture from './generated/basics/architecture.json';
import aws from './generated/basics/aws.json';
import azure from './generated/basics/azure.json';
import bi from './generated/basics/bi.json';
import cicd from './generated/basics/cicd.json';
import databases from './generated/basics/databases.json';
import databricks from './generated/basics/databricks.json';
import dataIntegration from './generated/basics/data-integration.json';
import dbt from './generated/basics/dbt.json';
import deepLearning from './generated/basics/deep-learning.json';
import docker from './generated/basics/docker.json';
import evals from './generated/basics/evals.json';
import gcp from './generated/basics/gcp.json';
import git from './generated/basics/git.json';
import hex from './generated/basics/hex.json';
import kafka from './generated/basics/kafka.json';
import kubernetes from './generated/basics/kubernetes.json';
import llms from './generated/basics/llms.json';
import looker from './generated/basics/looker.json';
import mlsys from './generated/basics/mlsys.json';
import modeling from './generated/basics/modeling.json';
import observability from './generated/basics/observability.json';
import palantir from './generated/basics/palantir.json';
import prompt from './generated/basics/prompt.json';
import pyspark from './generated/basics/pyspark.json';
import python from './generated/basics/python.json';
import rag from './generated/basics/rag.json';
import security from './generated/basics/security.json';
import snowflake from './generated/basics/snowflake.json';
import spark from './generated/basics/spark.json';
import sql from './generated/basics/sql.json';
import statistics from './generated/basics/statistics.json';
import sysd from './generated/basics/sysd.json';
import tableau from './generated/basics/tableau.json';
import terraform from './generated/basics/terraform.json';
import typescript from './generated/basics/typescript.json';
import vectordb from './generated/basics/vectordb.json';

const j = (x: unknown) => x as unknown as GeneratedCard[];

/** slug → beginner cards. */
export const BASICS: Record<string, GeneratedCard[]> = {
  spark: j(spark), pyspark: j(pyspark), kafka: j(kafka), sql: j(sql), dbt: j(dbt), airflow: j(airflow),
  snowflake: j(snowflake), databricks: j(databricks), modeling: j(modeling), python: j(python), sysd: j(sysd),
  typescript: j(typescript), rag: j(rag), llms: j(llms), agents: j(agents), vectordb: j(vectordb), prompt: j(prompt),
  evals: j(evals), mlsys: j(mlsys), aws: j(aws), gcp: j(gcp), azure: j(azure), palantir: j(palantir),
  'data-integration': j(dataIntegration), architecture: j(architecture), security: j(security), statistics: j(statistics),
  bi: j(bi), databases: j(databases), apis: j(apis), 'deep-learning': j(deepLearning), tableau: j(tableau),
  looker: j(looker), hex: j(hex), git: j(git), docker: j(docker), kubernetes: j(kubernetes), terraform: j(terraform),
  cicd: j(cicd), observability: j(observability),
};

function cardFromBasic(slug: string, c: GeneratedCard, i: number): SessionCard {
  const t = trackBySlug(slug);
  return {
    id: `basics-${slug}-${i}`,
    kind: 'flip',
    tk: t?.color ?? 'spark',
    tool: t?.name ?? slug,
    tag: '🌱 Fundamentals · Stage 0',
    q: c.q,
    a: c.a,
    fj: c.fj,
    fs: c.fs,
    code: c.code,
    followups: c.followups,
  };
}

/** Ordered Stage-0 primer for a role: basics from its first ~5 concept/deploy tracks. */
export function basicsForRole(roleKey: string, limit = 15): SessionCard[] {
  const tracks = tracksForRole(roleKey)
    .filter((t) => (t.group === 'concept' || t.group === 'deploy') && (BASICS[t.slug]?.length ?? 0) > 0)
    .slice(0, 6);
  const out: SessionCard[] = [];
  for (const t of tracks) {
    (BASICS[t.slug] ?? []).forEach((c, i) => out.push(cardFromBasic(t.slug, c, i)));
  }
  return out.slice(0, limit);
}

export function basicsCount(roleKey: string): number {
  return basicsForRole(roleKey).length;
}
