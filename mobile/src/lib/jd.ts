/**
 * Offline JD analyzer (Pro). Mirrors the web app's rule-based matcher: scan a pasted
 * job description for per-track keywords → rank tracks by fit, infer the best role, and
 * flag coverage gaps from the user's progress. Deterministic, no network.
 */
import { Track, TRACKS, trackBySlug } from './content';
import { ROLE_TRACKS, ROLES, RoleKey, roleByKey } from './roles';
import type { CardState } from './srs';

/** JD terms per track. Unlisted tracks fall back to [name, slug]. Keep terms multi-char to avoid false hits. */
export const TRACK_KEYWORDS: Record<string, string[]> = {
  spark: ['spark', 'rdd', 'catalyst', 'spark sql'],
  pyspark: ['pyspark', 'spark dataframe'],
  kafka: ['kafka', 'event streaming', 'pub/sub', 'kinesis'],
  sql: ['sql', 'postgres', 'mysql', 'queries', 'window functions'],
  dbt: ['dbt', 'data build tool'],
  airflow: ['airflow', 'orchestration', 'dags', 'dagster', 'prefect'],
  snowflake: ['snowflake', 'snowpro'],
  databricks: ['databricks', 'delta lake', 'unity catalog', 'lakehouse'],
  modeling: ['data modeling', 'dimensional', 'star schema', 'data warehouse', 'scd'],
  python: ['python', 'pandas', 'numpy'],
  sysd: ['system design', 'distributed systems', 'scalability', 'microservices'],
  typescript: ['typescript', 'javascript', 'react'],
  nodejs: ['node.js', 'nodejs', 'node js', 'express', 'nestjs', 'event loop'],
  go: ['golang', 'go developer', 'goroutine', 'gin framework'],
  rust: ['rust', 'cargo', 'tokio', 'borrow checker'],
  cpp: ['c++', 'cpp', 'modern c++', 'stl'],
  scala: ['scala', 'akka', 'play framework', 'sbt'],
  flutter: ['flutter', 'dart', 'cross-platform mobile'],
  rag: ['rag', 'retrieval augmented', 'retrieval-augmented'],
  llms: ['llm', 'large language model', 'gpt', 'transformer', 'fine-tuning', 'fine tuning'],
  agents: ['ai agent', 'agentic', 'tool calling', 'langchain', 'langgraph'],
  vectordb: ['vector database', 'vector db', 'embeddings', 'pinecone', 'weaviate', 'faiss'],
  prompt: ['prompt engineering', 'prompting', 'few-shot'],
  evals: ['evaluation', 'evals', 'llm eval', 'faithfulness', 'hallucination'],
  mlsys: ['ml systems', 'model serving', 'feature store', 'mlops', 'model deployment'],
  aws: ['aws', 'amazon web services', 's3', 'redshift', 'ec2', 'lambda', 'sagemaker', 'bedrock'],
  gcp: ['gcp', 'google cloud', 'bigquery', 'dataflow', 'vertex ai', 'pub/sub'],
  azure: ['azure', 'synapse', 'adf', 'data factory', 'azure openai'],
  palantir: ['palantir', 'foundry', 'ontology'],
  'data-integration': ['snaplogic', 'informatica', 'fivetran', 'etl tool', 'data integration', 'talend'],
  architecture: ['architecture', 'solution architect', 'system architecture', 'well-architected'],
  security: ['security', 'iam', 'encryption', 'compliance', 'governance', 'oauth'],
  statistics: ['statistics', 'statistical', 'a/b test', 'ab testing', 'hypothesis', 'regression', 'experimentation'],
  bi: ['business intelligence', 'dashboards', 'data visualization', 'kpis', 'reporting', 'power bi', 'powerbi'],
  databases: ['database', 'rdbms', 'acid', 'indexing', 'nosql', 'mongodb', 'transactions'],
  apis: ['api', 'rest', 'grpc', 'graphql', 'endpoints', 'microservice'],
  'deep-learning': ['deep learning', 'neural network', 'pytorch', 'tensorflow', 'cnn', 'rnn', 'computer vision'],
  tableau: ['tableau'],
  looker: ['looker', 'lookml'],
  hex: ['hex', 'notebook', 'jupyter'],
  git: ['git', 'github', 'version control', 'gitlab'],
  docker: ['docker', 'container', 'containerization'],
  kubernetes: ['kubernetes', 'k8s', 'helm', 'eks', 'gke'],
  terraform: ['terraform', 'infrastructure as code', 'iac', 'pulumi'],
  cicd: ['ci/cd', 'cicd', 'continuous integration', 'continuous deployment', 'github actions', 'jenkins'],
  observability: ['observability', 'monitoring', 'prometheus', 'grafana', 'datadog', 'slo', 'opentelemetry'],
};

export interface JdResult {
  bestRole: RoleKey;
  bestRoleName: string;
  matched: { slug: string; name: string; hits: number }[];
  recommended: Track[];
  gaps: Track[];
}

function countHits(jd: string, kws: string[]): number {
  let n = 0;
  for (const k of kws) {
    const esc = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(jd)) n++;
  }
  return n;
}

export function analyzeJd(text: string, progress: Record<string, CardState>): JdResult {
  const jd = ` ${text.toLowerCase()} `;
  const matched: { slug: string; name: string; hits: number }[] = [];
  for (const t of TRACKS) {
    const kws = TRACK_KEYWORDS[t.slug] ?? [t.name.toLowerCase(), t.slug];
    const hits = countHits(jd, kws);
    if (hits > 0) matched.push({ slug: t.slug, name: t.name, hits });
  }
  matched.sort((a, b) => b.hits - a.hits);

  // Best-fit role = the role whose tracks accumulate the most JD hits.
  let bestRole: RoleKey = 'de';
  let best = -1;
  for (const r of ROLES) {
    if (r.key === 'all') continue;
    const slugs = new Set(ROLE_TRACKS[r.key] ?? []);
    const score = matched.reduce((s, m) => s + (slugs.has(m.slug) ? m.hits : 0), 0);
    if (score > best) {
      best = score;
      bestRole = r.key;
    }
  }

  const recommended = matched.map((m) => trackBySlug(m.slug)).filter((t): t is Track => !!t);
  const seen = (slug: string) => Object.keys(progress).some((k) => k.startsWith(`${slug}-`));
  const gaps = recommended.filter((t) => !seen(t.slug));

  return { bestRole, bestRoleName: roleByKey(bestRole)?.name ?? bestRole, matched, recommended, gaps };
}
