/**
 * Offline JD analyzer (Pro). Mirrors the web app's rule-based matcher: scan a pasted
 * job description for per-track keywords → rank tracks by fit, infer the best role, and
 * flag coverage gaps from the user's progress. Deterministic, no network.
 */
import { bankForTrack, Track, TRACKS, trackBySlug } from './content';
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

/* ── JD → skills (Pro): term-level extraction with per-skill card coverage ─────────────── */

export interface JdSkill {
  /** The keyword as it appears in our taxonomy (e.g. "window functions", "delta lake"). */
  term: string;
  trackSlug: string;
  trackName: string;
  /** Cards in the term's track whose QUESTION mentions the term (capped scan). */
  cards: number;
  /** Of those, how many the user has studied. */
  studied: number;
  /** First unstudied matching card — the "tap to drill this skill" target. */
  firstUnseenId: string | null;
}

/**
 * Pull the individual SKILL TERMS a JD mentions and map each to real cards + the user's
 * coverage ("CDC · 4 cards · 0 studied"). Same keyword taxonomy as the track matcher —
 * fully offline, deterministic.
 */
export function extractSkills(text: string, progress: Record<string, CardState>, max = 20): JdSkill[] {
  const jd = ` ${text.toLowerCase()} `;
  const out: JdSkill[] = [];
  for (const [slug, kws] of Object.entries(TRACK_KEYWORDS)) {
    const t = trackBySlug(slug);
    if (!t) continue;
    for (const term of kws) {
      const esc = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(jd)) continue;
      // The term is in the JD — count matching cards in its home track.
      const re = new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i');
      let cards = 0;
      let studied = 0;
      let firstUnseenId: string | null = null;
      for (const card of bankForTrack(slug)) {
        if (!re.test(card.q)) continue;
        cards++;
        if ((progress[card.id]?.reps ?? 0) > 0) studied++;
        else if (!firstUnseenId) firstUnseenId = card.id;
      }
      out.push({ term, trackSlug: slug, trackName: t.name, cards, studied, firstUnseenId });
    }
  }
  // Most actionable first: skills that HAVE cards and are least covered.
  return out
    .sort((a, b) => (b.cards > 0 ? 1 : 0) - (a.cards > 0 ? 1 : 0) || a.studied - b.studied || b.cards - a.cards)
    .slice(0, max);
}

/** The card pool a JD implies (for the JD cheat sheet + "create a My Track from this JD"):
 *  unstudied-first across the matched skills' cards, deduped, gap tracks leading. */
export function jdCardPool(text: string, progress: Record<string, CardState>, cap = 30): string[] {
  const skills = extractSkills(text, progress, 40);
  const seen = new Set<string>();
  const unstudied: string[] = [];
  const studied: string[] = [];
  for (const sk of skills) {
    const re = new RegExp(`(^|[^a-z0-9])${sk.term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
    for (const card of bankForTrack(sk.trackSlug)) {
      if (seen.has(card.id) || !re.test(card.q)) continue;
      seen.add(card.id);
      if ((progress[card.id]?.reps ?? 0) > 0) studied.push(card.id);
      else unstudied.push(card.id);
    }
  }
  return [...unstudied, ...studied].slice(0, cap);
}
