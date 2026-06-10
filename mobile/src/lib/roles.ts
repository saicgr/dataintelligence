/**
 * Role catalog + role→tracks registry. This is the data that drives the whole app:
 * the Learn path shows ONLY the selected role's tracks (grouped by section), and the
 * daily session pool is built from the role's concept/coding tracks.
 *
 * Adding a role = one ROLES entry + one ROLE_TRACKS entry. Adding a track = one entry in
 * content.ts RAW_TRACKS (+ its content). No component edits.
 */

/** Which Learn-path section a track renders under. */
export type Group = 'concept' | 'coding' | 'deploy' | 'oncall' | 'craft' | 'behavioral';

/** Section render order + headers for the Learn path. */
export const GROUP_ORDER: Group[] = ['coding', 'deploy', 'oncall', 'behavioral', 'craft', 'concept'];
export const GROUP_LABEL: Record<Group, string> = {
  coding: '⌨️ Coding',
  deploy: '🚀 Deploy & ship',
  oncall: '🚨 On-call & production',
  behavioral: '🗣️ Behavioral & leadership',
  craft: '🎯 Interview craft',
  concept: '📚 Concepts',
};

export type RoleKey = string;

export interface RoleDef {
  key: RoleKey;
  name: string;
  emoji: string;
  family: string;
  blurb: string;
  tag?: 'rising' | 'new';
  tier?: 'assoc' | 'pro' | 'expert';
}

// Near-universal bundles (every engineer ships code, interviews behaviorally).
const SHIP = ['git', 'docker', 'cicd'];
const CRAFT = ['interview-craft', 'behavioral', 'leadership'];

/** Build the four cloud roles (developer / data-eng / ai / architect) for a cloud track. */
function cloudRoles(cloud: 'aws' | 'gcp' | 'azure', label: string): RoleDef[] {
  return [
    { key: `${cloud}-developer`, name: `${label} Developer`, emoji: '☁️', family: label, blurb: `${label} app/dev — services, IaC, SDKs`, tier: 'assoc' },
    { key: `${cloud}-de`, name: `${label} Data Engineer`, emoji: '☁️', family: label, blurb: `${label} pipelines, warehouse, streaming` },
    { key: `${cloud}-ai`, name: `${label} AI / ML Engineer`, emoji: '🤖', family: label, blurb: `${label}-native GenAI & ML serving`, tag: 'rising' },
    { key: `${cloud}-architect`, name: `${label} Solutions Architect`, emoji: '🏛️', family: label, blurb: `${label} architecture, Assoc → Pro`, tier: 'pro' },
  ];
}
// The cloud's flagship GenAI track — wired into that cloud's AI role so it's a findable, deep unit.
const CLOUD_AI: Record<'aws' | 'gcp' | 'azure', string> = { aws: 'bedrock', gcp: 'vertex-ai', azure: 'azure-ai' };
function cloudTracks(cloud: 'aws' | 'gcp' | 'azure') {
  return {
    [`${cloud}-developer`]: ['python-drills', 'sql-coding', cloud, 'python', 'typescript', 'sql', 'architecture', ...SHIP, 'terraform', ...CRAFT],
    [`${cloud}-de`]: ['python-drills', 'sql-coding', cloud, 'spark', 'pyspark', 'sql', 'airflow', 'python', 'modeling', ...SHIP, 'terraform', 'observability', 'data-reliability', ...CRAFT],
    [`${cloud}-ai`]: ['python-drills', cloud, CLOUD_AI[cloud], 'mlsys', 'llms', 'rag', 'agents', 'evals', 'python', ...SHIP, 'prompt-lab', ...CRAFT],
    [`${cloud}-architect`]: [cloud, 'architecture', 'security', 'sysd', 'modeling', ...SHIP, 'kubernetes', 'terraform', 'observability', ...CRAFT],
  } as Record<string, string[]>;
}

export const ROLES: RoleDef[] = [
  // Core data / SWE
  { key: 'de', name: 'Data Engineer', emoji: '🛠️', family: 'Data & SWE', blurb: 'Pipelines, Spark, SQL, warehouses' },
  { key: 'analytics', name: 'Analytics Engineer', emoji: '📊', family: 'Data & SWE', blurb: 'dbt, SQL, modeling, BI' },
  { key: 'ds', name: 'Data Scientist', emoji: '🔬', family: 'Data & SWE', blurb: 'Stats, ML, SQL, experimentation' },
  { key: 'da', name: 'Data Analyst', emoji: '📈', family: 'Data & SWE', blurb: 'SQL, statistics, BI, dashboards' },
  { key: 'swe', name: 'Software Engineer', emoji: '💻', family: 'Data & SWE', blurb: 'Services, system design, APIs' },
  { key: 'be', name: 'Backend Engineer', emoji: '🧩', family: 'Data & SWE', blurb: 'APIs, databases, services, scale' },
  { key: 'mobile', name: 'Mobile Engineer', emoji: '📱', family: 'Data & SWE', blurb: 'Flutter/Dart, app architecture, async', tag: 'new' },
  { key: 'applied-data-eng', name: 'Applied Data Engineer', emoji: '🛠️', family: 'Data & SWE', blurb: 'Pipelines + ML-ready data + reliability', tag: 'rising' },
  // AI / ML
  { key: 'ai', name: 'AI Engineer', emoji: '🤖', family: 'AI & ML', blurb: 'LLMs, RAG, agents, prompts' },
  { key: 'ml', name: 'ML Engineer', emoji: '🧠', family: 'AI & ML', blurb: 'Training, serving, ML systems' },
  { key: 'aais', name: 'Applied AI Scientist', emoji: '🔭', family: 'AI & ML', blurb: 'DL, research, evals, modeling', tag: 'rising' },
  { key: 'mlops', name: 'MLOps Engineer', emoji: '⚙️', family: 'AI & ML', blurb: 'Model deploy, monitoring, infra', tag: 'rising' },
  { key: 'llmops', name: 'LLMOps Engineer', emoji: '🧪', family: 'AI & ML', blurb: 'Prompt/version/eval/cost ops', tag: 'rising' },
  { key: 'agenteng', name: 'AI Agent Engineer', emoji: '🕹️', family: 'AI & ML', blurb: 'Agentic systems, tools, memory', tag: 'rising' },
  { key: 'applied-ai-eng', name: 'Applied AI Engineer', emoji: '🤖', family: 'AI & ML', blurb: 'Ship LLM/RAG/agent apps to prod', tag: 'rising' },
  { key: 'fde', name: 'Forward Deployed Engineer', emoji: '🚀', family: 'AI & ML', blurb: 'Embed, build, ship for customers', tag: 'new' },
  { key: 'azure-fde', name: 'Azure Forward Deployed Engineer', emoji: '🔷', family: 'AI & ML', blurb: 'Azure OpenAI/Foundry agentic delivery', tag: 'new' },
  { key: 'aws-fde', name: 'AWS Forward Deployed Engineer', emoji: '🟧', family: 'AI & ML', blurb: 'Bedrock/SageMaker agentic delivery', tag: 'new' },
  // BI & Analytics
  { key: 'bi-analyst', name: 'BI Analyst', emoji: '📊', family: 'BI & Analytics', blurb: 'Tableau, Looker, Hex, SQL, BI' },
  { key: 'tableau-dev', name: 'Tableau Developer', emoji: '📈', family: 'BI & Analytics', blurb: 'Tableau, LOD, dashboards, SQL' },
  { key: 'looker-dev', name: 'Looker Developer (LookML)', emoji: '🔭', family: 'BI & Analytics', blurb: 'LookML, explores, PDTs, dbt' },
  // Platform / infra
  { key: 'platform', name: 'Platform Engineer', emoji: '🏗️', family: 'Platform', blurb: 'Infra, k8s, IaC, internal platforms' },
  { key: 'devops', name: 'DevOps Engineer', emoji: '🔧', family: 'Platform', blurb: 'CI/CD, automation, IaC' },
  { key: 'sre', name: 'Site Reliability Engineer', emoji: '🛡️', family: 'Platform', blurb: 'SLOs, observability, incident response', tag: 'rising' },
  { key: 'security', name: 'Security Engineer', emoji: '🔐', family: 'Platform', blurb: 'IAM, encryption, governance' },
  // Architects
  { key: 'solution-architect', name: 'Solution Architect', emoji: '🏛️', family: 'Architect', blurb: 'Cloud-agnostic system design' },
  ...cloudRoles('aws', 'AWS'),
  ...cloudRoles('gcp', 'GCP'),
  ...cloudRoles('azure', 'Azure'),
  // Vendor / platform
  { key: 'databricks-de', name: 'Databricks Data Engineer', emoji: '🧱', family: 'Vendor', blurb: 'Lakehouse, Delta, Unity Catalog' },
  { key: 'databricks-ml', name: 'Databricks ML / GenAI', emoji: '🧱', family: 'Vendor', blurb: 'Mosaic, ML, GenAI on Databricks', tag: 'rising' },
  { key: 'databricks-arch', name: 'Databricks Architect / Admin', emoji: '🧱', family: 'Vendor', blurb: 'Platform admin & cloud architecture' },
  { key: 'snowflake-de', name: 'Snowflake Data Engineer', emoji: '❄️', family: 'Vendor', blurb: 'SnowPro DE — loading, transforms' },
  { key: 'snowflake-arch', name: 'Snowflake Architect', emoji: '❄️', family: 'Vendor', blurb: 'SnowPro Advanced Architect' },
  { key: 'snowflake-admin', name: 'Snowflake Administrator', emoji: '❄️', family: 'Vendor', blurb: 'Security, cost, RBAC, governance' },
  { key: 'snowflake-ai', name: 'Snowflake AI / Cortex', emoji: '❄️', family: 'Vendor', blurb: 'Cortex, ML, GenAI on Snowflake', tag: 'rising' },
  { key: 'palantir-fde', name: 'Palantir Foundry Engineer', emoji: '🛰️', family: 'Vendor', blurb: 'Ontology, pipelines, AIP', tag: 'new' },
  { key: 'integration-dev', name: 'Integration Developer', emoji: '🔌', family: 'Vendor', blurb: 'SnapLogic / Informatica / Fivetran' },
  { key: 'aem-dev', name: 'Adobe AEM Developer', emoji: '🅰️', family: 'Vendor', blurb: 'Sling, JCR, Dispatcher, AEMaaCS', tag: 'new' },
  { key: 'workfront-dev', name: 'Workfront Fusion Developer', emoji: '⚙️', family: 'Vendor', blurb: 'Scenarios, modules, integrations', tag: 'new' },
  // Everything
  { key: 'all', name: 'Explore all tracks', emoji: '🌐', family: 'All', blurb: 'Every track, unfiltered' },
];

export const ROLE_TRACKS: Record<RoleKey, string[]> = {
  de: ['python-drills', 'sql-coding', 'spark', 'pyspark', 'sql', 'kafka', 'airflow', 'dbt', 'snowflake', 'databricks', 'modeling', 'python', 'scala', 'sysd', ...SHIP, 'terraform', 'observability', 'spark-oncall', 'airflow-oncall', 'data-reliability', 'cr-sql', ...CRAFT],
  analytics: ['sql-coding', 'sql', 'dbt', 'modeling', 'snowflake', 'python', 'bi', 'looker', 'statistics', 'aws', 'gcp', ...SHIP, 'data-reliability', 'cr-sql', ...CRAFT],
  ds: ['python-drills', 'sql-coding', 'python', 'sql', 'statistics', 'mlsys', 'modeling', 'evals', 'llms', 'tableau', 'hex', 'git', 'docker', ...CRAFT],
  da: ['sql-coding', 'sql', 'statistics', 'bi', 'tableau', 'hex', 'modeling', 'python', 'git', ...CRAFT],
  be: ['python-drills', 'sql-coding', 'apis', 'databases', 'python', 'typescript', 'nodejs', 'go', 'sysd', 'sql', 'architecture', 'kafka', ...SHIP, 'kubernetes', 'observability', ...CRAFT],
  aais: ['python-drills', 'python', 'deep-learning', 'statistics', 'mlsys', 'llms', 'evals', 'rag', 'agents', 'vectordb', 'git', 'docker', ...CRAFT],
  sre: ['sysd', 'observability', 'kubernetes', 'terraform', 'security', 'architecture', 'python', 'go', 'git', 'docker', 'cicd', 'spark-oncall', 'airflow-oncall', 'data-reliability', ...CRAFT],
  'bi-analyst': ['sql-coding', 'bi', 'tableau', 'looker', 'hex', 'sql', 'statistics', 'modeling', ...CRAFT],
  'tableau-dev': ['sql-coding', 'tableau', 'bi', 'sql', 'statistics', 'modeling', ...CRAFT],
  'looker-dev': ['sql-coding', 'looker', 'bi', 'sql', 'dbt', 'modeling', 'gcp', 'git', ...CRAFT],
  swe: ['python-drills', 'sql-coding', 'python', 'typescript', 'nodejs', 'go', 'rust', 'cpp', 'sysd', 'sql', 'architecture', ...SHIP, 'kubernetes', 'observability', ...CRAFT],
  mobile: ['flutter', 'typescript', 'nodejs', 'apis', 'sysd', 'sql', 'architecture', ...SHIP, 'observability', ...CRAFT],
  ai: ['python-drills', 'llms', 'rag', 'agents', 'agentic-ai', 'vectordb', 'prompt', 'evals', 'python', 'mlsys', ...SHIP, 'prompt-lab', ...CRAFT],
  'applied-ai-eng': ['python-drills', 'llms', 'rag', 'agents', 'agentic-ai', 'prompt', 'evals', 'vectordb', 'python', 'mlsys', 'sql', ...SHIP, 'prompt-lab', ...CRAFT],
  'applied-data-eng': ['python-drills', 'sql-coding', 'python', 'scala', 'sql', 'spark', 'pyspark', 'snowflake', 'databricks', 'airflow', 'dbt', 'modeling', 'mlsys', 'data-reliability', ...SHIP, 'observability', ...CRAFT],
  'azure-fde': ['python-drills', 'azure', 'azure-ai', 'agents', 'agentic-ai', 'rag', 'llms', 'prompt', 'evals', 'python', 'sql', 'architecture', ...SHIP, 'prompt-lab', ...CRAFT],
  'aws-fde': ['python-drills', 'aws', 'bedrock', 'agents', 'agentic-ai', 'rag', 'llms', 'prompt', 'evals', 'python', 'sql', 'architecture', ...SHIP, 'prompt-lab', ...CRAFT],
  ml: ['python-drills', 'python', 'mlsys', 'llms', 'vectordb', 'agents', 'sysd', 'evals', ...SHIP, 'kubernetes', 'terraform', 'observability', ...CRAFT],
  mlops: ['python-drills', 'mlsys', 'python', 'sysd', 'evals', 'observability', 'docker', 'kubernetes', 'terraform', 'cicd', 'git', ...CRAFT],
  llmops: ['python-drills', 'llms', 'prompt', 'evals', 'rag', 'agents', 'python', 'observability', ...SHIP, 'prompt-lab', ...CRAFT],
  agenteng: ['python-drills', 'agents', 'agentic-ai', 'llms', 'rag', 'prompt', 'evals', 'vectordb', 'python', ...SHIP, 'prompt-lab', ...CRAFT],
  fde: ['python-drills', 'sql-coding', 'python', 'typescript', 'rag', 'agents', 'prompt', 'llms', 'sysd', 'sql', 'architecture', ...SHIP, 'terraform', 'prompt-lab', ...CRAFT],
  platform: ['sysd', 'python', 'go', 'rust', 'kafka', 'sql', 'architecture', 'security', 'git', 'docker', 'kubernetes', 'terraform', 'cicd', 'observability', 'airflow-oncall', 'spark-oncall', 'data-reliability', ...CRAFT],
  devops: ['sysd', 'python', 'go', 'architecture', 'security', 'git', 'docker', 'kubernetes', 'terraform', 'cicd', 'observability', ...CRAFT],
  security: ['security', 'architecture', 'sysd', 'python', 'git', 'docker', 'kubernetes', 'terraform', 'cicd', 'observability', ...CRAFT],
  'solution-architect': ['architecture', 'security', 'sysd', 'modeling', 'kafka', 'aws', 'gcp', 'azure', 'git', 'docker', 'kubernetes', 'terraform', 'cicd', 'observability', ...CRAFT],
  ...cloudTracks('aws'),
  ...cloudTracks('gcp'),
  ...cloudTracks('azure'),
  'databricks-de': ['python-drills', 'sql-coding', 'databricks', 'spark', 'pyspark', 'sql', 'dbt', 'modeling', 'python', 'scala', 'aws', 'data-reliability', ...SHIP, ...CRAFT],
  'databricks-ml': ['python-drills', 'databricks', 'mosaic', 'mlsys', 'python', 'scala', 'llms', 'evals', 'spark', ...SHIP, ...CRAFT],
  'databricks-arch': ['databricks', 'architecture', 'security', 'spark', 'sql', 'aws', 'git', 'terraform', 'cicd', 'observability', 'data-reliability', ...CRAFT],
  'snowflake-de': ['sql-coding', 'snowflake', 'sql', 'dbt', 'modeling', 'python', 'aws', 'git', 'cicd', 'data-reliability', ...CRAFT],
  'snowflake-arch': ['snowflake', 'architecture', 'security', 'sql', 'modeling', 'aws', 'git', 'terraform', 'data-reliability', ...CRAFT],
  'snowflake-admin': ['snowflake', 'security', 'sql', 'observability', 'git', 'terraform', 'data-reliability', ...CRAFT],
  'snowflake-ai': ['snowflake', 'cortex', 'llms', 'rag', 'evals', 'python', 'sql', 'git', ...CRAFT],
  'palantir-fde': ['python-drills', 'sql-coding', 'palantir', 'python', 'typescript', 'sql', 'modeling', 'data-integration', ...SHIP, ...CRAFT],
  'integration-dev': ['data-integration', 'snaplogic', 'sql-coding', 'sql', 'python', 'kafka', 'airflow', 'git', 'cicd', 'data-reliability', ...CRAFT],
  'aem-dev': ['java-coding', 'aem', 'java', 'typescript', 'apis', 'architecture', 'databases', 'sql', ...SHIP, ...CRAFT],
  'workfront-dev': ['workfront', 'apis', 'data-integration', 'snaplogic', 'sql', 'python', ...SHIP, ...CRAFT],
  all: [], // resolved dynamically to every track in content.ts
};

export const ROLE_FAMILIES = ['All', 'Data & SWE', 'AI & ML', 'BI & Analytics', 'Platform', 'Architect', 'AWS', 'GCP', 'Azure', 'Vendor'];

export function roleByKey(key: RoleKey): RoleDef | undefined {
  return ROLES.find((r) => r.key === key);
}
