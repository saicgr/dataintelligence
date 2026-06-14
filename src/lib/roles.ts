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
  // Language-led developer roles (interviews lead with the language + its drills)
  { key: 'java-dev', name: 'Java Developer', emoji: '☕', family: 'Software Engineering', blurb: 'JVM, services, concurrency', tag: 'new' },
  { key: 'python-dev', name: 'Python Developer', emoji: '🐍', family: 'Software Engineering', blurb: 'Python services, APIs, async, testing', tag: 'new' },
  { key: 'ts-dev', name: 'TypeScript / Node.js Developer', emoji: '🟦', family: 'Software Engineering', blurb: 'TS, Node services, APIs, event loop', tag: 'new' },
  { key: 'go-dev', name: 'Go Developer', emoji: '🐹', family: 'Software Engineering', blurb: 'Go services, goroutines, channels', tag: 'new' },
  { key: 'rust-dev', name: 'Rust Developer', emoji: '🦀', family: 'Software Engineering', blurb: 'Ownership, async Rust, systems code', tag: 'new' },
  { key: 'cpp-dev', name: 'C++ Developer', emoji: '🧮', family: 'Software Engineering', blurb: 'Modern C++, memory, performance', tag: 'new' },
  { key: 'scala-dev', name: 'Scala Developer', emoji: '🔺', family: 'Software Engineering', blurb: 'Scala, FP, Spark, JVM', tag: 'new' },
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
  // Business & Management
  { key: 'tpm', name: 'Technical Program Manager', emoji: '🗂️', family: 'Business & Management', blurb: 'Programs, roadmaps, cross-team delivery', tag: 'rising' },
  { key: 'pm', name: 'Project Manager', emoji: '♟️', family: 'Business & Management', blurb: 'Agile, PMP, delivery, stakeholders' },
  { key: 'scrum-master', name: 'Scrum Master', emoji: '🏃', family: 'Business & Management', blurb: 'Scrum, sprint ceremonies, team velocity' },
  { key: 'eng-manager', name: 'Engineering Manager', emoji: '👔', family: 'Business & Management', blurb: 'People, delivery, technical leadership' },
  { key: 'finops-eng', name: 'FinOps Engineer', emoji: '💰', family: 'Business & Management', blurb: 'Cloud cost optimization, FinOps framework', tag: 'rising' },
  { key: 'cost-engineer', name: 'Cost Engineer', emoji: '📊', family: 'Business & Management', blurb: 'Cloud cost governance, budgets, allocation' },
  { key: 'business-analyst', name: 'Business Analyst', emoji: '📋', family: 'Business & Management', blurb: 'Requirements, SQL, stakeholder analysis' },
  { key: 'data-pm', name: 'Data Product Manager', emoji: '🎯', family: 'Business & Management', blurb: 'Data roadmaps, metrics, SQL', tag: 'rising' },
  { key: 'ai-pm', name: 'AI Product Manager', emoji: '🤖', family: 'Business & Management', blurb: 'AI/LLM product strategy & roadmaps', tag: 'rising' },
  { key: 'product-owner', name: 'Product Owner', emoji: '🏷️', family: 'Business & Management', blurb: 'Backlog, user stories, sprint planning' },
  { key: 'data-governance-mgr', name: 'Data Governance Manager', emoji: '🗺️', family: 'Business & Management', blurb: 'Data quality, lineage, catalog, compliance' },
  { key: 'data-steward', name: 'Data Steward', emoji: '📌', family: 'Business & Management', blurb: 'Data quality, ownership, GDPR, metadata' },
  { key: 'solutions-engineer', name: 'Solutions Engineer', emoji: '💼', family: 'Business & Management', blurb: 'Pre-sales, demos, technical discovery', tag: 'new' },
  { key: 'tech-csm', name: 'Technical Customer Success Mgr', emoji: '💚', family: 'Business & Management', blurb: 'Adoption, NRR, technical onboarding' },
  { key: 'mgmt-consultant', name: 'Management Consultant', emoji: '🧩', family: 'Business & Management', blurb: 'Case frameworks, MECE, strategy' },
  { key: 'fpa-analyst', name: 'FP&A Analyst', emoji: '💹', family: 'Business & Management', blurb: 'Financial planning, variance, SQL + Excel' },
  { key: 'bizops-analyst', name: 'Strategy & Ops Analyst', emoji: '🏢', family: 'Business & Management', blurb: 'BizOps, SQL, cross-functional strategy' },
  { key: 'supply-chain-analyst', name: 'Supply Chain Analyst', emoji: '⛓️', family: 'Business & Management', blurb: 'Supply chain, SQL, analytics, logistics' },
  { key: 'revops-analyst', name: 'RevOps / Marketing Analyst', emoji: '📣', family: 'Business & Management', blurb: 'Revenue ops, attribution, SQL, CRM' },
  { key: 'pricing-analyst', name: 'Pricing Analyst', emoji: '💲', family: 'Business & Management', blurb: 'Price modeling, stats, SQL, Excel' },
  // Adobe / Vendor roles
  { key: 'workfront-arch', name: 'Workfront Fusion Architect', emoji: '🏛️', family: 'Vendor', blurb: 'Fusion architecture, security, governance', tag: 'new' },
  { key: 'workfront-lead', name: 'Workfront Fusion Lead', emoji: '🔧', family: 'Vendor', blurb: 'Fusion lead dev, mentoring, best practices', tag: 'new' },
  { key: 'workfront-solution-arch', name: 'Workfront Solution Architect', emoji: '⚙️', family: 'Vendor', blurb: 'End-to-end Workfront solution design', tag: 'new' },
  { key: 'aep-de', name: 'Adobe AEP Data Engineer', emoji: '🔴', family: 'Vendor', blurb: 'AEP ingestion, XDM, CDP, governance', tag: 'new' },
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
  'java-dev': ['java-coding', 'java', 'apis', 'databases', 'sql', 'sysd', 'architecture', ...SHIP, 'observability', ...CRAFT],
  'python-dev': ['python-drills', 'sql-coding', 'python', 'apis', 'databases', 'sql', 'sysd', 'architecture', ...SHIP, 'observability', ...CRAFT],
  'ts-dev': ['typescript-coding', 'nodejs-coding', 'typescript', 'nodejs', 'apis', 'databases', 'sql', 'sysd', 'architecture', ...SHIP, 'observability', ...CRAFT],
  'go-dev': ['go-coding', 'go', 'apis', 'databases', 'sql', 'sysd', 'architecture', ...SHIP, 'kubernetes', 'observability', ...CRAFT],
  'rust-dev': ['rust-coding', 'rust', 'apis', 'databases', 'sysd', 'architecture', ...SHIP, 'observability', ...CRAFT],
  'cpp-dev': ['cpp-coding', 'cpp', 'apis', 'databases', 'sysd', 'architecture', ...SHIP, 'observability', ...CRAFT],
  'scala-dev': ['scala-coding', 'scala', 'spark', 'kafka', 'sql-coding', 'sql', 'sysd', 'architecture', ...SHIP, 'observability', ...CRAFT],
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
  'snowflake-de': ['sql-coding', 'snowflake', 'sql', 'dbt', 'dbt-metricflow', 'dbt-semantic-layer', 'modeling', 'python', 'data-governance', 'aws', 'git', 'cicd', 'data-reliability', ...CRAFT],
  'snowflake-arch': ['snowflake', 'architecture', 'security', 'sql', 'modeling', 'aws', 'git', 'terraform', 'data-reliability', ...CRAFT],
  'snowflake-admin': ['snowflake', 'security', 'sql', 'observability', 'git', 'terraform', 'data-reliability', ...CRAFT],
  'snowflake-ai': ['snowflake', 'cortex', 'llms', 'rag', 'evals', 'python', 'sql', 'git', ...CRAFT],
  'palantir-fde': ['python-drills', 'sql-coding', 'palantir', 'python', 'typescript', 'sql', 'modeling', 'data-integration', ...SHIP, ...CRAFT],
  'integration-dev': ['data-integration', 'snaplogic', 'sql-coding', 'sql', 'python', 'kafka', 'airflow', 'git', 'cicd', 'data-reliability', ...CRAFT],
  'aem-dev': ['java-coding', 'aem', 'java', 'typescript', 'apis', 'architecture', 'databases', 'sql', ...SHIP, ...CRAFT],
  'workfront-dev': ['workfront', 'apis', 'data-integration', 'sql', 'python', ...SHIP, ...CRAFT],
  // Business & Management
  tpm: ['program-management', 'agile-pm', 'stakeholder-mgmt', 'sysd', 'architecture', 'sql', ...CRAFT],
  pm: ['agile-pm', 'program-management', 'stakeholder-mgmt', ...CRAFT],
  'scrum-master': ['agile-pm', 'stakeholder-mgmt', 'program-management', ...CRAFT],
  'eng-manager': ['program-management', 'stakeholder-mgmt', 'agile-pm', 'sysd', 'architecture', ...CRAFT],
  'finops-eng': ['finops', 'aws', 'gcp', 'azure', 'architecture', ...CRAFT],
  'cost-engineer': ['cost-engineer', 'finops', 'aws', 'gcp', 'azure', 'databricks', 'snowflake', 'sql-coding', 'sql', 'modeling', ...CRAFT],
  'business-analyst': ['sql-coding', 'business-analysis', 'sql', 'statistics', 'bi', 'modeling', 'stakeholder-mgmt', ...CRAFT],
  'data-pm': ['sql-coding', 'product-management', 'business-analysis', 'sql', 'bi', 'statistics', 'modeling', 'stakeholder-mgmt', ...CRAFT],
  'ai-pm': ['ai-product-mgmt', 'product-management', 'llms', 'agents', 'evals', 'stakeholder-mgmt', ...CRAFT],
  'product-owner': ['agile-pm', 'product-management', 'business-analysis', 'stakeholder-mgmt', ...CRAFT],
  'data-governance-mgr': ['sql-coding', 'data-governance', 'sql', 'security', 'modeling', 'snowflake', 'databricks', ...CRAFT],
  'data-steward': ['sql-coding', 'data-governance', 'sql', 'modeling', 'security', ...CRAFT],
  'solutions-engineer': ['python-drills', 'sql-coding', 'pre-sales', 'sysd', 'architecture', 'sql', 'python', 'stakeholder-mgmt', ...SHIP, ...CRAFT],
  'tech-csm': ['sql-coding', 'customer-success', 'sql', 'bi', 'stakeholder-mgmt', ...CRAFT],
  'mgmt-consultant': ['consulting-frameworks', 'business-analysis', 'finance-fundamentals', 'bizops', 'stakeholder-mgmt', ...CRAFT],
  'fpa-analyst': ['sql-coding', 'finance-fundamentals', 'sql', 'statistics', 'bi', 'modeling', ...CRAFT],
  'bizops-analyst': ['sql-coding', 'bizops', 'sql', 'statistics', 'business-analysis', 'stakeholder-mgmt', ...CRAFT],
  'supply-chain-analyst': ['sql-coding', 'supply-chain', 'sql', 'statistics', 'modeling', 'bi', ...CRAFT],
  'revops-analyst': ['sql-coding', 'sql', 'bi', 'statistics', 'business-analysis', 'customer-success', ...CRAFT],
  'pricing-analyst': ['sql-coding', 'finance-fundamentals', 'sql', 'statistics', 'modeling', ...CRAFT],
  // Adobe / Vendor roles
  'workfront-arch': ['workfront', 'architecture', 'security', 'apis', 'data-integration', 'stakeholder-mgmt', ...SHIP, ...CRAFT],
  'workfront-lead': ['workfront', 'program-management', 'leadership', 'apis', 'data-integration', 'stakeholder-mgmt', ...SHIP, ...CRAFT],
  'workfront-solution-arch': ['workfront', 'architecture', 'stakeholder-mgmt', 'pre-sales', 'apis', 'data-integration', ...SHIP, ...CRAFT],
  'aep-de': ['aep', 'data-governance', 'data-integration', 'sql-coding', 'sql', 'python', 'apis', 'aws', ...SHIP, ...CRAFT],
  all: [], // resolved dynamically to every track in content.ts
};

export const ROLE_FAMILIES = ['All', 'Data & SWE', 'Software Engineering', 'AI & ML', 'BI & Analytics', 'Platform', 'Architect', 'AWS', 'GCP', 'Azure', 'Vendor', 'Business & Management'];

export function roleByKey(key: RoleKey): RoleDef | undefined {
  return ROLES.find((r) => r.key === key);
}

/* ── Role-aware Learn-path ordering ──────────────────────────────────────────
 * The section order and the pinned "Your path" cores are how the selected role
 * actually changes what you see first (the onboarding "built from this" promise). */

// Universal bundles + generic drill tracks: every role has them, so they never
// define a role's identity and don't belong in its pinned cores.
const NON_CORE = new Set([
  ...SHIP, ...CRAFT, 'python-drills', 'sql-coding', 'java-coding',
  'typescript-coding', 'nodejs-coding', 'go-coding', 'rust-coding',
  'cpp-coding', 'scala-coding', 'pyspark-coding',
]);

/** Roles whose interviews lead with hands-on coding — they keep the coding-first default. */
const CODING_FIRST = new Set<RoleKey>([
  'swe', 'be', 'mobile', 'fde', 'aem-dev', 'palantir-fde',
  'java-dev', 'python-dev', 'ts-dev', 'go-dev', 'rust-dev', 'cpp-dev', 'scala-dev',
]);
/** Infra-centric roles — their day job is Deploy & ship + On-call, so those lead. */
const OPS_FIRST = new Set<RoleKey>(['platform', 'devops', 'sre', 'security', 'mlops']);

const leadWith = (heads: Group[]): Group[] => [...heads, ...GROUP_ORDER.filter((g) => !heads.includes(g))];

/** Section order for a role's Learn path. Unknown roles and 'all' fall back to the default. */
export function groupOrderForRole(role: RoleKey): Group[] {
  if (role === 'all' || !ROLE_TRACKS[role] || CODING_FIRST.has(role)) return GROUP_ORDER;
  if (OPS_FIRST.has(role)) return leadWith(['deploy', 'oncall']);
  // Everything else (data / AI / BI / vendor / cloud / architect) is concept-led —
  // the tracks that define the role live in Concepts.
  return leadWith(['concept', 'coding']);
}

/**
 * The role's headline tracks — the first picks of its registry order minus
 * universals/drills. Drives the pinned "Your path" section. Empty for 'all'
 * (its track list resolves dynamically) and for unknown roles.
 */
export function coreTracksForRole(role: RoleKey): string[] {
  const list = ROLE_TRACKS[role];
  if (!list || list.length === 0) return [];
  return list.filter((slug) => !NON_CORE.has(slug)).slice(0, 4);
}
