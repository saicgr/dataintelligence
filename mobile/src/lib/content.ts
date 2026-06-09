import { GENERATED, GeneratedCard } from './content.generated';
import lessonTitlesData from './lesson-titles.json';
import { freshCount, freshForTrack, freshPackCards, freshPackCount, freshSessionCards } from './fresh';
import { lessonsForTrack, seedLessonCount } from './lessons';
import { Group, ROLE_TRACKS } from './roles';
import { SCENARIOS } from './scenarios';
import { weakness } from './srs';
import type { CardState } from './srs';
import type { TrackColorKey } from './theme';

// Re-export the Pillar 2 helpers so callers import everything content-related from here.
export { freshCount, freshForTrack, freshPackCards, freshPackCount, freshSessionCards };
// Lesson helpers re-exported so the track detail screen can render lesson-unit tracks.
export { lessonsForTrack };

/**
 * Bundled, read-only CORE content. Per-track question banks live in ./generated
 * (converted from the web app's lib/data). Two extra content streams sit on top:
 *  - scenarios.ts  → Pillar 1 "explain it fully" articulation cards
 *  - fresh.ts      → Pillar 2 "stay current" cards (bundled seed + OTA/remote, see contentSync.ts)
 * Everything is offline-first; fresh content is version-checked on launch.
 */

export type Level = 'Jr' | 'Mid' | 'Sr' | 'Staff' | 'Principal';
/** The full seniority ladder, junior→principal, in display order. */
export const LEVELS: Level[] = ['Jr', 'Mid', 'Sr', 'Staff', 'Principal'];
/** Canonical seniority label for a level — the single source of truth used everywhere (home header,
 * onboarding + settings selectors, track breakdown). Jr→Junior, Mid→Mid, Sr→Senior, Staff→Staff, Principal→Principal. */
export const levelLabel = (l: Level): string =>
  l === 'Sr' ? 'Senior' : l === 'Mid' ? 'Mid' : l === 'Staff' ? 'Staff' : l === 'Principal' ? 'Principal' : 'Junior';
/** Options for the level selector controls (onboarding + settings + track screen). Labels match `levelLabel`.
 * `null` value = "All levels" (no filter). */
export const LEVEL_OPTIONS: { label: string; value: Level | null }[] = [
  { label: 'All levels', value: null },
  ...LEVELS.map((value) => ({ label: levelLabel(value), value })),
];
export type Domain = 'de' | 'ai';
export type DomainFilter = Domain | 'all';

export interface Track {
  slug: string;
  name: string;
  color: TrackColorKey;
  icon: string;
  q: number;
  domain: Domain;
  group: Group;
}

export interface ChoiceOption {
  t: string;
  ok: boolean;
  why?: string; // per-distractor "why this is wrong", shown on reveal
}

/** One step of a senior "arc" model answer (Pillar 1). */
export interface ArcStep {
  label: string;
  body: string;
}

/** Languages a code panel can be tagged with (display only — no execution). */
export type Lang =
  | 'sql'
  | 'python'
  | 'pyspark'
  | 'airflow'
  | 'dbt'
  | 'ts'
  | 'js'
  | 'go'
  | 'rust'
  | 'scala'
  | 'cpp'
  | 'dart';

/**
 * A labelled, read-only code example attached to a flip card's answer.
 * `accent: 'bug' | 'fix'` colours the label (and is the canonical "show me the
 * bug and the fix" pair); plain panels (no accent) are single illustrative
 * snippets. Lines are pre-split and authored ≤~42 cols so RN never reflows.
 */
export interface CodePanel {
  label?: string;
  lang?: Lang;
  lines: string[];
  accent?: 'bug' | 'fix';
}

/** Sub-skill stage tag (shared across the diagnostic formats). */
export type Stage =
  | 'inspect'
  | 'infer'
  | 'sequence'
  | 'match'
  | 'fix'
  | 'verify'
  | 'prevent'
  | 'articulate';

/** A read-only evidence surface the learner taps a "tell" on. */
export type EvidencePanel =
  | { kind: 'code'; lines: string[]; lang?: Lang }
  | { kind: 'table'; cells: string[][] };

/** `order` — reorder rows into a correct sequence; accepts ≥1 valid permutation. */
export interface OrderSpec {
  rows: string[];
  /** each accepted answer = the sequence of SOURCE indices in correct order */
  accepted: number[][];
  mono?: boolean; // render rows monospace (code) vs sans (prose steps)
}

/** `evidence` — tap the tell(s) on a panel, then name the cause. */
export interface EvidenceSpec {
  panel: EvidencePanel;
  /** code panel → line indices; table panel → [row, col] pairs */
  tells: number[] | Array<[number, number]>;
  cause: ChoiceOption[];
  why: string;
}

/** A token in the assemble bank. `pos` = index in the canonical sequence; pos < 0 = distractor. */
export interface AsmToken {
  t: string;
  pos: number;
}

/** `match` — fill-the-blank (template + blank chips) OR assemble (token bank, multi-solution). */
export interface MatchSpec {
  // fill-the-blank
  template?: string[]; // text segments; a single hole sits between segment[0] and segment[1]
  blank?: ChoiceOption[]; // chip bank for the hole (one correct)
  // assemble
  bank?: AsmToken[];
  acceptedSeqs?: number[][]; // accepted position sequences (multi-solution)
  why?: string;
}

/** One gated beat of a diagnostic loop. */
export interface DiagStep {
  kind: 'inspect' | 'evidence' | 'infer' | 'fix' | 'verify';
  prompt: string;
  opts?: ChoiceOption[]; // inspect / infer / fix / verify
  consequence?: string; // shown when a wrong INSPECT is committed
  panel?: EvidencePanel; // evidence step
  tells?: number[] | Array<[number, number]>; // evidence step
  why: string; // revealed after the beat commits
}

/** Deep-link payload to the matching web workbench problem (the cross-sell). */
export interface WebX {
  blurb: string;
  problemId: string;
}

/** `querybuild` — one full build decomposed into a faded-scaffold lesson + capstone. */
export interface QueryBuild {
  setup: { schema: string; rows: string[]; expected: string };
  hints: string[];
  beats: DiagStep[]; // beats 1..n (insight / trace / load-bearing-token MCQs)
  assemble: MatchSpec; // capstone token bank
  acceptedSeqs: number[][]; // capstone accepted position sequences
  webx: WebX;
}

/** `classify` — label a presented artifact (model output / prompt) with one of N labels. */
export interface ClassifySpec {
  labels: string[];
  answer: number; // index of the correct label
  context?: string; // optional artifact text shown above the labels
  panel?: EvidencePanel; // optional code/table artifact
  why: string;
}

export type CardKind =
  | 'choice'
  | 'flip'
  | 'scenario'
  | 'order'
  | 'evidence'
  | 'diag'
  | 'match'
  | 'querybuild'
  | 'classify';

export interface SessionCard {
  id: string;
  kind: CardKind;
  tk: TrackColorKey;
  tool: string;
  tag: string;
  level?: Level; // difficulty tier (Jr/Mid/Sr) for level-filtered track sessions
  q: string;
  // MCQ
  opts?: ChoiceOption[];
  why?: string;
  strict?: boolean; // code-choice cards: a wrong first pick rates 'again' (not 'good')
  // code panel (choice extension / shared display)
  lines?: string[];
  lang?: Lang;
  // flip-card code examples — real CodeBlock panels under the answer (bug/fix etc.)
  code?: CodePanel[];
  // flip / shared
  a?: string;
  fj: string; // junior tell
  fs: string; // senior tell
  followups?: { q: string; a: string }[]; // drill-down Q&As under the answer
  // Pillar 1 — articulation scenario
  framing?: string;
  arc?: ArcStep[];
  rubric?: string[];
  // new diagnostic / coding formats (all optional, build-time authored)
  order?: OrderSpec;
  evidence?: EvidenceSpec;
  diag?: { steps: DiagStep[]; webx?: WebX };
  match?: MatchSpec;
  querybuild?: QueryBuild;
  classify?: ClassifySpec;
  // shared sub-skill tags
  incidentId?: string;
  stage?: Stage;
  clusterId?: string;
  // Pillar 2 — fresh / stay-current
  fresh?: boolean;
  sourceUrl?: string;
  sourceLabel?: string;
  publishedAt?: string; // ISO
  verifyBy?: string; // ISO — retired/re-verified after this
  packId?: string; // belongs to a paid one-off pack (free when unset)
}

export type QRow = [string, Level];

const RAW_TRACKS: Track[] = [
  // ── Concept tracks: Data Engineering ──
  { slug: 'spark', name: 'Spark', color: 'spark', icon: '⚡', q: 0, domain: 'de', group: 'concept' },
  { slug: 'pyspark', name: 'PySpark', color: 'dbt', icon: '🔥', q: 0, domain: 'de', group: 'concept' },
  { slug: 'kafka', name: 'Kafka', color: 'kafka', icon: '📨', q: 0, domain: 'de', group: 'concept' },
  { slug: 'sql', name: 'SQL', color: 'sql', icon: '🗃️', q: 0, domain: 'de', group: 'concept' },
  { slug: 'dbt', name: 'dbt', color: 'dbt', icon: '🔧', q: 0, domain: 'de', group: 'concept' },
  { slug: 'airflow', name: 'Airflow', color: 'sysd', icon: '🌀', q: 0, domain: 'de', group: 'concept' },
  { slug: 'snowflake', name: 'Snowflake', color: 'sql', icon: '❄️', q: 0, domain: 'de', group: 'concept' },
  { slug: 'databricks', name: 'Databricks', color: 'spark', icon: '🧱', q: 0, domain: 'de', group: 'concept' },
  { slug: 'modeling', name: 'Data Modeling', color: 'eval', icon: '🧩', q: 0, domain: 'de', group: 'concept' },
  { slug: 'python', name: 'Python', color: 'kafka', icon: '🐍', q: 0, domain: 'de', group: 'concept' },
  { slug: 'sysd', name: 'System Design', color: 'sysd', icon: '📐', q: 0, domain: 'de', group: 'concept' },
  { slug: 'typescript', name: 'TypeScript', color: 'sql', icon: '🟦', q: 0, domain: 'de', group: 'concept' },
  { slug: 'nodejs', name: 'Node.js', color: 'kafka', icon: '🟢', q: 0, domain: 'de', group: 'concept' },
  { slug: 'go', name: 'Go', color: 'kafka', icon: '🐹', q: 0, domain: 'de', group: 'concept' },
  { slug: 'rust', name: 'Rust', color: 'dbt', icon: '🦀', q: 0, domain: 'de', group: 'concept' },
  { slug: 'cpp', name: 'C++', color: 'sysd', icon: '🧮', q: 0, domain: 'de', group: 'concept' },
  { slug: 'scala', name: 'Scala', color: 'spark', icon: '🔺', q: 0, domain: 'de', group: 'concept' },
  { slug: 'flutter', name: 'Flutter', color: 'sql', icon: '🦋', q: 0, domain: 'de', group: 'concept' },
  // ── Concept tracks: AI Engineering ──
  { slug: 'rag', name: 'RAG', color: 'rag', icon: '🔍', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'llms', name: 'LLMs', color: 'rag', icon: '🧠', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'agents', name: 'AI Agents', color: 'rag', icon: '🤖', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'agentic-ai', name: 'Agentic AI', color: 'rag', icon: '🕹️', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'vectordb', name: 'Vector DB', color: 'sql', icon: '🧮', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'prompt', name: 'Prompt Eng', color: 'eval', icon: '💬', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'evals', name: 'LLM Evals', color: 'eval', icon: '🧪', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'mlsys', name: 'ML Systems', color: 'rag', icon: '🦾', q: 0, domain: 'ai', group: 'concept' },
  // ── Concept tracks: Cloud ──
  { slug: 'aws', name: 'AWS', color: 'dbt', icon: '🟧', q: 0, domain: 'de', group: 'concept' },
  { slug: 'gcp', name: 'Google Cloud', color: 'sql', icon: '🔵', q: 0, domain: 'de', group: 'concept' },
  { slug: 'azure', name: 'Azure', color: 'sysd', icon: '🔷', q: 0, domain: 'de', group: 'concept' },
  // ── Concept tracks: Cloud & vendor GenAI (the flagship AI services) ──
  { slug: 'bedrock', name: 'AWS Bedrock / GenAI', color: 'dbt', icon: '🟧', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'vertex-ai', name: 'Vertex AI', color: 'rag', icon: '🔵', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'azure-ai', name: 'Azure AI / Copilot', color: 'sysd', icon: '🔷', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'cortex', name: 'Snowflake Cortex', color: 'rag', icon: '❄️', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'mosaic', name: 'Databricks AI (Genie + Mosaic)', color: 'spark', icon: '🧱', q: 0, domain: 'ai', group: 'concept' },
  // ── Concept tracks: Vendor / integration ──
  { slug: 'palantir', name: 'Palantir Foundry', color: 'sysd', icon: '🛰️', q: 0, domain: 'de', group: 'concept' },
  { slug: 'data-integration', name: 'Data Integration', color: 'kafka', icon: '🔌', q: 0, domain: 'de', group: 'concept' },
  { slug: 'snaplogic', name: 'SnapLogic', color: 'dbt', icon: '🔗', q: 0, domain: 'de', group: 'concept' },
  { slug: 'aem', name: 'Adobe Experience Manager', color: 'rag', icon: '🅰️', q: 0, domain: 'de', group: 'concept' },
  { slug: 'workfront', name: 'Workfront Fusion', color: 'kafka', icon: '⚙️', q: 0, domain: 'de', group: 'concept' },
  // ── Concept tracks: Architecture / security ──
  { slug: 'architecture', name: 'Architecture', color: 'sysd', icon: '🏛️', q: 0, domain: 'de', group: 'concept' },
  { slug: 'security', name: 'Security', color: 'eval', icon: '🔐', q: 0, domain: 'de', group: 'concept' },
  // ── Concept tracks: Analytics / BI / stats / backend / DL (roles increment) ──
  { slug: 'statistics', name: 'Statistics', color: 'eval', icon: '🎲', q: 0, domain: 'de', group: 'concept' },
  { slug: 'bi', name: 'BI & Visualization', color: 'sql', icon: '📊', q: 0, domain: 'de', group: 'concept' },
  { slug: 'databases', name: 'Databases', color: 'dbt', icon: '🗄️', q: 0, domain: 'de', group: 'concept' },
  { slug: 'apis', name: 'APIs & Services', color: 'kafka', icon: '🔗', q: 0, domain: 'de', group: 'concept' },
  { slug: 'deep-learning', name: 'Deep Learning', color: 'rag', icon: '🧬', q: 0, domain: 'ai', group: 'concept' },
  { slug: 'tableau', name: 'Tableau', color: 'sql', icon: '📈', q: 0, domain: 'de', group: 'concept' },
  { slug: 'looker', name: 'Looker', color: 'sysd', icon: '🔭', q: 0, domain: 'de', group: 'concept' },
  { slug: 'hex', name: 'Hex', color: 'eval', icon: '⬡', q: 0, domain: 'de', group: 'concept' },
  // ── Deploy & ship ──
  { slug: 'git', name: 'Git', color: 'dbt', icon: '🔱', q: 0, domain: 'de', group: 'deploy' },
  { slug: 'docker', name: 'Docker', color: 'sql', icon: '🐳', q: 0, domain: 'de', group: 'deploy' },
  { slug: 'kubernetes', name: 'Kubernetes', color: 'sysd', icon: '☸️', q: 0, domain: 'de', group: 'deploy' },
  { slug: 'terraform', name: 'Terraform', color: 'rag', icon: '🏗️', q: 0, domain: 'de', group: 'deploy' },
  { slug: 'cicd', name: 'CI/CD', color: 'kafka', icon: '🔁', q: 0, domain: 'de', group: 'deploy' },
  { slug: 'observability', name: 'Observability', color: 'eval', icon: '📈', q: 0, domain: 'de', group: 'deploy' },
  // ── Behavioral & leadership ──
  { slug: 'behavioral', name: 'Behavioral', color: 'eval', icon: '🗣️', q: 0, domain: 'de', group: 'behavioral' },
  { slug: 'leadership', name: 'Leadership', color: 'rag', icon: '🧭', q: 0, domain: 'de', group: 'behavioral' },
  // ── Coding units (assemble/querybuild lessons) ──
  { slug: 'python-drills', name: 'Python Coding', color: 'kafka', icon: '🐍', q: 0, domain: 'de', group: 'coding' },
  { slug: 'sql-coding', name: 'SQL Coding', color: 'sql', icon: '🧮', q: 0, domain: 'de', group: 'coding' },
  // ── On-call / production lesson units ──
  { slug: 'spark-oncall', name: 'Spark On-Call', color: 'spark', icon: '🔥', q: 0, domain: 'de', group: 'oncall' },
  { slug: 'cr-sql', name: 'SQL Bug Hunt', color: 'sql', icon: '🔎', q: 0, domain: 'de', group: 'oncall' },
  { slug: 'airflow-oncall', name: 'Airflow On-Call', color: 'sysd', icon: '🐞', q: 0, domain: 'de', group: 'oncall' },
  { slug: 'data-reliability', name: 'Data Reliability', color: 'eval', icon: '🛡️', q: 0, domain: 'de', group: 'oncall' },
  // ── Interview craft lesson units ──
  { slug: 'interview-craft', name: 'Interview Craft', color: 'eval', icon: '🎯', q: 0, domain: 'de', group: 'craft' },
  { slug: 'prompt-lab', name: 'Prompt Lab', color: 'eval', icon: '🧪', q: 0, domain: 'ai', group: 'craft' },
];

export const TRACKS: Track[] = RAW_TRACKS.map((t) => ({
  ...t,
  q: GENERATED[t.slug]?.length || seedLessonCount(t.slug),
}));

/**
 * Skill categories — how the Library "Skills" tab is sectioned (a finer taxonomy than
 * the de/ai domain split). Single source of truth: order below = render order; any slug
 * not listed falls back to its domain bucket so new tracks still land somewhere sensible.
 */
export type SkillCategory =
  | 'Languages'
  | 'Coding practice'
  | 'Data Engineering'
  | 'AI Engineering'
  | 'Cloud & Vendor AI'
  | 'Analytics & BI'
  | 'Foundations'
  | 'Deploy & ship'
  | 'On-call & reliability'
  | 'Behavioral & craft';

export const SKILL_CATEGORY_ORDER: SkillCategory[] = [
  'Languages',
  'Coding practice',
  'Data Engineering',
  'AI Engineering',
  'Cloud & Vendor AI',
  'Analytics & BI',
  'Foundations',
  'Deploy & ship',
  'On-call & reliability',
  'Behavioral & craft',
];

const SKILL_CATEGORY_OF: Record<string, SkillCategory> = {
  // Languages (the coding skills)
  python: 'Languages', sql: 'Languages', pyspark: 'Languages', typescript: 'Languages',
  nodejs: 'Languages', go: 'Languages', rust: 'Languages', cpp: 'Languages',
  scala: 'Languages', flutter: 'Languages',
  // Interactive coding drills
  'python-drills': 'Coding practice', 'sql-coding': 'Coding practice',
  // Data Engineering tooling
  spark: 'Data Engineering', kafka: 'Data Engineering', dbt: 'Data Engineering',
  airflow: 'Data Engineering', snowflake: 'Data Engineering', databricks: 'Data Engineering',
  modeling: 'Data Engineering', 'data-integration': 'Data Engineering', snaplogic: 'Data Engineering',
  palantir: 'Data Engineering', aem: 'Data Engineering', workfront: 'Data Engineering',
  // AI Engineering
  rag: 'AI Engineering', llms: 'AI Engineering', agents: 'AI Engineering', 'agentic-ai': 'AI Engineering',
  vectordb: 'AI Engineering', prompt: 'AI Engineering', evals: 'AI Engineering',
  mlsys: 'AI Engineering', 'deep-learning': 'AI Engineering',
  // Cloud & vendor GenAI
  aws: 'Cloud & Vendor AI', gcp: 'Cloud & Vendor AI', azure: 'Cloud & Vendor AI',
  bedrock: 'Cloud & Vendor AI', 'vertex-ai': 'Cloud & Vendor AI', 'azure-ai': 'Cloud & Vendor AI',
  cortex: 'Cloud & Vendor AI', mosaic: 'Cloud & Vendor AI',
  // Analytics & BI
  bi: 'Analytics & BI', tableau: 'Analytics & BI', looker: 'Analytics & BI',
  hex: 'Analytics & BI', statistics: 'Analytics & BI',
  // Foundations (cross-cutting CS)
  sysd: 'Foundations', architecture: 'Foundations', databases: 'Foundations',
  apis: 'Foundations', security: 'Foundations',
  // Deploy & ship
  git: 'Deploy & ship', docker: 'Deploy & ship', kubernetes: 'Deploy & ship',
  terraform: 'Deploy & ship', cicd: 'Deploy & ship', observability: 'Deploy & ship',
  // On-call & reliability
  'spark-oncall': 'On-call & reliability', 'airflow-oncall': 'On-call & reliability',
  'cr-sql': 'On-call & reliability', 'data-reliability': 'On-call & reliability',
  // Behavioral & craft
  behavioral: 'Behavioral & craft', leadership: 'Behavioral & craft',
  'interview-craft': 'Behavioral & craft', 'prompt-lab': 'Behavioral & craft',
};

/** Which Skills-tab section a subject track belongs to (falls back to its domain bucket). */
export function skillCategory(slug: string): SkillCategory {
  const explicit = SKILL_CATEGORY_OF[slug];
  if (explicit) return explicit;
  return trackBySlug(slug)?.domain === 'ai' ? 'AI Engineering' : 'Data Engineering';
}

export interface Category {
  key: string;
  name: string;
  free: boolean;
}
export const CATEGORIES: Category[] = [
  { key: 'scn', name: 'Scenarios', free: true },
  { key: 'tr', name: 'Trade-offs', free: true },
  { key: 'dd', name: 'Deep dives', free: false },
  { key: 'ma', name: 'Most-asked', free: false },
];

export function trackBySlug(slug: string): Track | undefined {
  return TRACKS.find((t) => t.slug === slug);
}

/** The ordered tracks a role studies (registry-driven). `all` = every track. */
export function tracksForRole(roleKey: string): Track[] {
  if (roleKey === 'all') return TRACKS;
  const slugs = ROLE_TRACKS[roleKey] ?? ROLE_TRACKS['de'] ?? [];
  return slugs.map((s) => trackBySlug(s)).filter((t): t is Track => !!t);
}

// Per-track level counts derived from the (static-per-session) card bank — cached so the home path
// can curate by level on every render without rebuilding each bank repeatedly. (A reload re-inits the
// module, picking up fresh card levels after a re-tag.)
const _levelCountCache = new Map<string, Record<Level, number>>();
/** Per-level card counts for a track (drives level-aware curation + the track-screen breakdown). */
export function levelCountsForTrack(slug: string): Record<Level, number> {
  const cached = _levelCountCache.get(slug);
  if (cached) return cached;
  const counts: Record<Level, number> = { Jr: 0, Mid: 0, Sr: 0, Staff: 0, Principal: 0 };
  for (const c of bankForTrack(slug)) if (c.level) counts[c.level] += 1;
  _levelCountCache.set(slug, counts);
  return counts;
}

/** The tracks a role studies at a given level — every TOPIC spans tiers, so a track shows at any
 *  level where it has ≥1 card. `null` = "All levels" → every track. May be empty (the home path
 *  shows a hint when a role has no cards at the chosen level — e.g. Principal). */
export function tracksForRoleAtLevel(roleKey: string, level: Level | null): Track[] {
  const all = tracksForRole(roleKey);
  if (!level) return all;
  return all.filter((t) => levelCountsForTrack(t.slug)[level] > 0);
}

/** Domain filter for fresh/scenario content: a role's domain if homogeneous, else 'all'. */
export function roleDomain(roleKey: string): DomainFilter {
  const doms = new Set(tracksForRole(roleKey).map((t) => t.domain));
  if (doms.size === 1) return [...doms][0];
  return 'all';
}

/** The full question bank a role draws daily review from — its concept + coding tracks. */
export function bankForRole(roleKey: string): SessionCard[] {
  const tracks = tracksForRole(roleKey).filter((t) => t.group === 'concept' || t.group === 'coding');
  const seen = new Set<string>();
  const out: SessionCard[] = [];
  for (const t of tracks) {
    for (const card of bankForTrack(t.slug)) {
      if (!seen.has(card.id)) {
        seen.add(card.id);
        out.push(card);
      }
    }
  }
  return out;
}

/** Question list (title + level) for the Library track view — from the real bank. */
export function questionsFor(slug: string): QRow[] {
  return (GENERATED[slug] ?? []).map((c) => [c.q, c.level] as QRow);
}

export interface CardHit {
  card: SessionCard;
  track: Track;
  idxInTrack: number; // position in its track bank — used for the free/Pro gate
}

/**
 * Full-text search across every question in the role's tracks (not just track names).
 * Matches the question, its answer/why/framing, follow-up drill-downs, and the track name, so a
 * user can type a phrase they remember (e.g. "daily report") and jump straight to that card.
 */
export function searchCards(query: string, roleKey: string, limit = 16): CardHit[] {
  const ql = query.trim().toLowerCase();
  if (ql.length < 2) return [];
  const out: CardHit[] = [];
  const seen = new Set<string>();
  for (const t of tracksForRole(roleKey)) {
    const bank = bankForTrack(t.slug);
    for (let i = 0; i < bank.length; i++) {
      const card = bank[i];
      if (seen.has(card.id)) continue;
      const hay = [
        card.q,
        card.a,
        card.why,
        card.framing,
        t.name,
        ...(card.followups?.flatMap((f) => [f.q, f.a]) ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (hay.includes(ql)) {
        seen.add(card.id);
        out.push({ card, track: t, idxInTrack: i });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

const levelTag = levelLabel;

function cardFromGenerated(t: Track, c: GeneratedCard, i: number): SessionCard {
  return {
    id: `${t.slug}-${i}`,
    kind: 'flip',
    tk: t.color,
    tool: t.name,
    tag: levelTag(c.level),
    level: c.level,
    q: c.q,
    a: c.a,
    fj: c.fj,
    fs: c.fs,
    code: c.code,
    followups: c.followups,
  };
}

/** All cards for a single track (Library → track session). */
export function bankForTrack(slug: string): SessionCard[] {
  const now = Date.now();
  // Stay-current cards bound to this track. They keep their STABLE `fresh-…` id (NOT re-id'd) so the
  // same card has one identity on every surface — track, aggregate "Stay current", Save, SRS progress.
  const fresh = freshForTrack(now, slug);
  // Lesson units draw the richer diagnostic/coding cards; re-id THOSE as `${slug}-${i}` so the
  // Path's sequential-unlock + SRS progress (keyed on that id scheme) work unchanged. Fresh cards are
  // appended after and intentionally skip the re-id.
  const lessons = lessonsForTrack(slug, now);
  if (lessons.length) return [...lessons.map((c, i) => ({ ...c, id: `${slug}-${i}`, level: c.level ?? ('Mid' as Level) })), ...fresh];
  const t = trackBySlug(slug);
  if (!t) return fresh;
  return [...(GENERATED[slug] ?? []).map((c, i) => cardFromGenerated(t, c, i)), ...fresh];
}

/** Card count for a track's bank (lesson-aware; OTA may grow it). */
export function trackCardCount(slug: string): number {
  return bankForTrack(slug).length;
}

/** Best-effort resolver for a saved card id across fresh + daily highlights + every track bank.
 *  Returns undefined when the card no longer exists (expired / removed by OTA) so the Saved list can
 *  skip it defensively instead of crashing. */
export function findCardById(id: string): SessionCard | undefined {
  const now = Date.now();
  const fresh = freshSessionCards(now, 'all', Number.POSITIVE_INFINITY).find((c) => c.id === id);
  if (fresh) return fresh;
  const daily = DAILY.find((c) => c.id === id);
  if (daily) return daily;
  for (const t of TRACKS) {
    const hit = bankForTrack(t.slug).find((c) => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** The full question universe for a role/domain — the pool the scheduler draws "due" cards from. */
export function bankForDomain(domain: DomainFilter): SessionCard[] {
  return TRACKS.filter((t) => domain === 'all' || t.domain === domain).flatMap((t) =>
    (GENERATED[t.slug] ?? []).map((c, i) => cardFromGenerated(t, c, i))
  );
}

const AI_TK = new Set<TrackColorKey | string>(['rag']); // daily AI highlights use the rag accent
const tkDomain = (tk: string): Domain => (AI_TK.has(tk) ? 'ai' : 'de');

/** A few hand-curated daily highlights (incl. MCQ) mixed into the daily pool. */
export const DAILY: SessionCard[] = [
  {
    id: 'd-spark-spill', kind: 'choice', tk: 'spark', tool: 'Spark', tag: 'Scenario · review',
    q: 'Nightly Spark job runs 5× slower; UI shows heavy spill on shuffle. First move?',
    opts: [
      { t: 'Double the cluster size', ok: false },
      { t: 'Spark UI → inspect shuffle partition sizes & skew, raise shuffle.partitions / repartition to fit memory', ok: true },
      { t: 'Add .cache()', ok: false },
      { t: 'Rewrite in Pandas', ok: false },
    ],
    why: 'Spill = per-task working set exceeds memory — usually too few/skewed shuffle partitions, not too little cluster.',
    fj: '"Scale to 2×."', fs: '"Size partitions to memory first."',
  },
  {
    id: 'd-kafka-groups', kind: 'flip', tk: 'kafka', tool: 'Kafka', tag: 'Recall · due today',
    q: 'How do Kafka consumer groups parallelize — and what caps the parallelism?',
    a: 'Each partition is consumed by exactly one consumer in the group, so max parallelism = partition count; extra consumers sit idle. Rebalances reassign on join/leave.',
    fj: '"Add more consumers."', fs: '"Capped by partitions — repartition the topic first."',
  },
  {
    id: 'd-rag-retrieval', kind: 'flip', tk: 'rag', tool: 'RAG', tag: 'Recall · due today',
    q: 'RAG cites the wrong document though the right one is indexed. Where do you look first?',
    a: 'Retrieval, not generation: confirm the right chunk is in top-k, then check chunking, embedding-model match, and add a re-ranker — before touching the model.',
    fj: '"Fine-tune the model."', fs: '"Reproduce retrieval first — usually chunking or missing re-ranking."',
  },
  {
    id: 'd-rag-vs-ft', kind: 'choice', tk: 'rag', tool: 'RAG vs Fine-tune', tag: 'Trade-off · new',
    q: 'Answers must stay grounded in docs that change weekly. RAG or fine-tune?',
    opts: [
      { t: 'Fine-tune on the docs', ok: false },
      { t: 'RAG — retrieve current docs at query time', ok: true },
      { t: 'Train from scratch', ok: false },
    ],
    why: 'Changing, citable knowledge → RAG: update the index not the weights, get attribution. Fine-tune only for behavior/format.',
    fj: '"Fine-tune so it knows the docs."', fs: '"Changing + citable → RAG."',
  },
  {
    id: 'd-dbt-incremental', kind: 'flip', tk: 'dbt', tool: 'dbt', tag: 'Recall · new',
    q: 'What quietly breaks an incremental dbt model when a row arrives late?',
    a: 'If the incremental filter keys off an event timestamp, late rows before the high-water mark get skipped. Fix with a lookback window or a reliable updated_at + unique key for merge.',
    fj: '"Just full-refresh nightly."', fs: '"Lookback window + unique key; full-refresh only as a fallback."',
  },
  {
    id: 'o-sql-exec-order',
    kind: 'order',
    tk: 'sql',
    tool: 'SQL',
    tag: 'Mental model · Mid',
    q: 'Put these in the order the engine actually runs them.',
    order: {
      rows: [
        'SELECT customer_id, SUM(amount)',
        "WHERE created_at >= '2026-01-01'",
        'FROM orders o',
        'HAVING COUNT(*) > 5',
        'GROUP BY customer_id',
      ],
      accepted: [[2, 1, 4, 3, 0]], // FROM → WHERE → GROUP BY → HAVING → SELECT
      mono: true,
    },
    why: "FROM → WHERE → GROUP BY → HAVING → SELECT. That's why you can't reference a SELECT alias in WHERE, and why WHERE filters before aggregation but HAVING after.",
    fj: '"It runs top to bottom."',
    fs: '"Logical order ≠ written order — FROM/WHERE first, SELECT almost last."',
  },
  {
    id: 'e-spark-skew',
    kind: 'evidence',
    tk: 'spark',
    tool: 'PySpark',
    tag: 'Read the evidence · Sr',
    q: 'A nightly job is 5× slower with executor OOM. Tap the tell in the Stages panel.',
    evidence: {
      panel: {
        kind: 'table',
        cells: [
          ['Task', 'Shuffle', 'Spill', 'GC%', 'Time'],
          ['tasks 1–199', '~95MB', '0', '4%', '5s'],
          ['task 200', '14.2GB', '9.1GB', '38%', '4.2m'],
          ['executors', '8/8 ok', '—', 'mem 78%', '—'],
        ],
      },
      tells: [
        [2, 1],
        [2, 2],
      ],
      cause: [
        { t: 'Data skew — one hot key lands all rows on a single task', ok: true },
        { t: 'Too little executor memory', ok: false, why: 'Adding RAM lets the same one task limp along — it dies again next run.' },
        { t: 'GC pressure', ok: false, why: 'High GC% is a symptom of the oversized partition, not the cause.' },
        { t: 'A broadcast that is too large', ok: false, why: 'No broadcast here; the other 199 tasks are tiny.' },
      ],
      why: 'One task reads 14GB and spills 9GB while 199 are tiny — max ≈ 50× median. "executors 8/8, mem 78%" is the red herring. This is a single hot key → salt it or enable AQE skew-join.',
    },
    fj: '"Add executor memory."',
    fs: '"50× max/median + spill on one task = skew — salt the key or AQE."',
  },
  {
    id: 'e-sql-notin-null',
    kind: 'evidence',
    tk: 'sql',
    tool: 'SQL',
    tag: 'Spot the bug · Mid',
    q: 'One line here silently returns zero rows. Tap it.',
    evidence: {
      panel: {
        kind: 'code',
        lang: 'sql',
        lines: [
          'SELECT o.order_id, o.amount',
          'FROM orders o',
          'WHERE o.user_id NOT IN (',
          '  SELECT user_id',
          '  FROM blacklist',
          ');',
        ],
      },
      tells: [2],
      cause: [
        { t: 'NOT IN + a NULL in the subquery → every row UNKNOWN → 0 rows', ok: true },
        { t: 'Missing GROUP BY', ok: false, why: 'No aggregate here; GROUP BY is irrelevant.' },
        { t: 'orders needs an index', ok: false, why: 'An index changes speed, not the empty result.' },
      ],
      why: 'A single NULL in blacklist.user_id makes every row evaluate to UNKNOWN under NOT IN → the query returns nothing. Use NOT EXISTS (NULL-safe) or filter IS NOT NULL.',
    },
    fj: '"NOT IN reads cleaner."',
    fs: '"NOT IN + NULLs = silent empty set — reach for NOT EXISTS."',
  },
  {
    id: 'diag-spark-skew',
    kind: 'diag',
    tk: 'spark',
    tool: 'PySpark',
    tag: 'Diagnostic loop · Sr',
    incidentId: 'spark-oom-skew',
    q: 'Nightly job runs 5× slower and executors die with OOM. Work the loop.',
    diag: {
      steps: [
        {
          kind: 'inspect',
          prompt: 'Inspect — what first?',
          opts: [
            { t: 'Spark UI → Stages: compare max-vs-median task time, spill & GC', ok: true },
            { t: 'Add executor memory and rerun', ok: false },
            { t: 'Scale the cluster 2×', ok: false },
            { t: 'Add .cache() on the source', ok: false },
          ],
          consequence:
            'You changed config before reading evidence — burned cluster cost and it OOMs again next run. Look first.',
          why: 'Read the evidence before touching hardware. Open the Stages tab and find the outlier.',
        },
        {
          kind: 'evidence',
          prompt: 'Read the evidence — tap the tell',
          panel: {
            kind: 'table',
            cells: [
              ['Task', 'Shuffle', 'Spill', 'GC%', 'Time'],
              ['tasks 1–199', '~95MB', '0', '4%', '5s'],
              ['task 200', '14.2GB', '9.1GB', '38%', '4.2m'],
              ['executors', '8/8 ok', '—', 'mem 78%', '—'],
            ],
          },
          tells: [
            [2, 1],
            [2, 2],
          ],
          why: 'One task reads 14GB and spills 9GB while 199 are tiny — max ≈ 50× median. "executors 8/8, mem 78%" is the red herring. A single hot key.',
        },
        {
          kind: 'infer',
          prompt: 'Infer the cause',
          opts: [
            { t: 'Data skew — one hot key lands all rows on a single task', ok: true },
            { t: 'Too little executor memory', ok: false },
            { t: 'GC pressure', ok: false },
            { t: 'Oversized broadcast', ok: false },
          ],
          why: 'The 50× max/median + 9GB spill on one task IS skew. Add-RAM / GC are symptoms, not the cause.',
        },
        {
          kind: 'fix',
          prompt: 'Fix — match it to the cause',
          opts: [
            { t: 'Salt the key / enable AQE skew-join', ok: true },
            { t: 'Add executor memory', ok: false },
            { t: 'Broadcast the big side', ok: false },
            { t: 'Collect to driver, fix in Pandas', ok: false },
          ],
          why: 'Bigger heap → the same one task still dies, now paying double. Salt / AQE spreads the hot key.',
        },
        {
          kind: 'verify',
          prompt: 'Verify — how do you know?',
          opts: [
            { t: 'Re-run; confirm spill→0 and max-task time drops toward the median', ok: true },
            { t: "Assume it's fixed", ok: false },
            { t: 'Check the output row count', ok: false },
          ],
          why: 'Quantify: 42→9 min, no spill, cost −30%. Prevent: a skew alert + pinned shuffle.partitions.',
        },
      ],
      webx: {
        blurb:
          'You diagnosed it on paper. Now run the rep — a job that actually OOMs, the real Spark UI to query, an AI interviewer grading your root-cause + follow-ups.',
        problemId: 'spark-oom-skew',
      },
    },
    fj: '"Add memory / scale the cluster."',
    fs: '"Read the Stages tab first — 50× skew → salt or AQE, then verify spill→0."',
  },
  {
    id: 'c-py-mutable-default',
    kind: 'choice',
    tk: 'kafka',
    tool: 'Python',
    tag: 'Predict output · Mid',
    strict: true,
    q: 'What does this print?',
    lang: 'python',
    lines: ['def add(x, items=[]):', '    items.append(x); return items', 'print(add(1)); print(add(2))'],
    opts: [
      { t: '[1] [2]', ok: false, why: 'A fresh list each call would give this — but the default is shared.' },
      { t: '[1] [1, 2]', ok: true },
      { t: '[1] [1]', ok: false, why: 'The second call appends to the same list, so it grows.' },
      { t: 'TypeError', ok: false, why: 'Mutable defaults are legal Python — just dangerous.' },
    ],
    why: 'The default items=[] is created once at def-time and shared across calls — the classic mutable-default trap. Use items=None, then items = items or [].',
    fj: '"Fresh list each call."',
    fs: '"Mutable defaults persist across calls — use a None sentinel."',
  },
  {
    id: 'm-airflow-logical-date',
    kind: 'match',
    tk: 'sysd',
    tool: 'Airflow',
    tag: 'Idempotency · Mid',
    q: 'Backfills compute the wrong day. Tap the token that fixes it.',
    match: {
      template: ['run_date = context["', '"]'],
      blank: [
        { t: 'data_interval_start', ok: true },
        { t: 'datetime.now()', ok: false, why: 'Makes every backfill compute today — silently wrong.' },
        { t: 'execution_date', ok: false, why: 'The deprecated alias.' },
        { t: 'ds_nodash', ok: false, why: 'A formatted string, not the logical interval start.' },
      ],
      why: 'data_interval_start is the deterministic logical date, so a backfill for last March computes last March — not today.',
    },
    fj: '"now() is close enough."',
    fs: '"Templated logical date only — backfills must be reproducible."',
  },
  {
    id: 'm-sql-not-exists',
    kind: 'match',
    tk: 'sql',
    tool: 'SQL',
    tag: 'Rewrite · Sr',
    q: 'Rebuild the blacklist filter as a NULL-safe anti-join. Tap tokens in order.',
    match: {
      bank: [
        { t: 'WHERE NOT EXISTS (', pos: 0 },
        { t: 'WHERE b.user_id = o.user_id', pos: 2 },
        { t: 'NOT IN (', pos: -1 },
        { t: 'SELECT 1 FROM blacklist b', pos: 1 },
        { t: 'IS NULL', pos: -1 },
        { t: ')', pos: 3 },
      ],
      acceptedSeqs: [[0, 1, 2, 3]],
      why: 'NOT EXISTS short-circuits per row and is immune to NULLs in the subquery — the default for "rows in A not matched in B".',
    },
    fj: '"NOT IN, obviously."',
    fs: '"NOT EXISTS — NULL-safe and usually a better plan."',
  },
  {
    id: 'qb-sql-relational-division',
    kind: 'querybuild',
    tk: 'sql',
    tool: 'SQL',
    tag: 'Full query · Sr',
    q: 'List candidates who have ALL three required skills — Python, Tableau, PostgreSQL. Build it step by step.',
    querybuild: {
      setup: {
        schema: '# candidates(candidate_id, skill) — one row per skill',
        rows: ['123 → Python, Tableau, PostgreSQL', '234 → R, PowerBI, SQL Server', '345 → Python, Tableau'],
        expected: '123',
      },
      hints: [
        'the pattern — "has all of a set" is relational division.',
        'filter to the 3 skills, GROUP BY candidate_id, keep COUNT(*) = 3.',
      ],
      beats: [
        {
          kind: 'infer',
          prompt: 'The insight — how do you say "has ALL three"?',
          opts: [
            { t: 'Filter to the 3 skills, group by candidate, keep COUNT(*) = 3', ok: true },
            {
              t: "WHERE skill='Python' AND skill='Tableau' AND skill='PostgreSQL'",
              ok: false,
              why: 'A row holds one skill, so skill=A AND skill=B is always false → 0 rows.',
            },
            { t: 'Three queries, intersect the ids by hand', ok: false, why: 'Works, but relational division is one clean query.' },
          ],
          why: '"Has all of a set" = filter to the set, group, count = set size. This pattern is relational division.',
        },
        {
          kind: 'infer',
          prompt: 'Run it in your head on the example',
          opts: [
            { t: '123 only', ok: true },
            { t: '123 and 345', ok: false, why: '345 has only Python+Tableau (count 2, not 3).' },
            { t: 'all three', ok: false, why: '234 matches none of the three skills.' },
          ],
          why: 'Tracing the toy data is how you check the logic before you ever run it.',
        },
        {
          kind: 'infer',
          prompt: 'The load-bearing token: HAVING COUNT(*) = ?',
          opts: [
            { t: '3 — the number of required skills', ok: true },
            { t: '1', ok: false, why: 'That just means "has at least one of the three".' },
            { t: 'COUNT(DISTINCT candidate_id)', ok: false, why: 'Wrong axis — you count skills per candidate.' },
          ],
          why: 'Count = size of the required set. If skills could repeat, use COUNT(DISTINCT skill).',
        },
      ],
      assemble: {
        bank: [
          { t: 'SELECT candidate_id', pos: 0 },
          { t: "WHERE skill IN ('Python','Tableau','PostgreSQL')", pos: 2 },
          { t: "WHERE skill='Python' AND skill='Tableau'", pos: -1 },
          { t: 'FROM candidates', pos: 1 },
          { t: 'HAVING COUNT(*) = 3', pos: 4 },
          { t: 'HAVING COUNT(*) > 0', pos: -1 },
          { t: 'GROUP BY candidate_id', pos: 3 },
          { t: 'ORDER BY candidate_id', pos: 5 },
        ],
      },
      acceptedSeqs: [[0, 1, 2, 3, 4, 5]],
      webx: {
        blurb:
          'You built it from parts. Now write & Run it for real — type the query, hit Run against live Postgres, see the rows, Submit for an AI-graded read with follow-ups.',
        problemId: 'sql-candidates-all-skills',
      },
    },
    fj: '"AND the three skills in WHERE."',
    fs: '"Relational division — filter to the set, group, HAVING COUNT(*) = set size."',
  },
  {
    id: 'e-prompt-injection',
    kind: 'evidence',
    tk: 'rag',
    tool: 'Prompt Eng',
    tag: 'Injection · Sr',
    q: 'This prompt is injectable. Tap the line where untrusted input enters the instruction channel.',
    evidence: {
      panel: {
        kind: 'code',
        lang: 'python',
        lines: [
          'system = "You are a support agent. Follow policy."',
          'doc = retrieve(user_query)',
          'prompt = system + "\\n" + doc + "\\n" + user_query',
          'resp = llm(prompt)',
        ],
      },
      tells: [2],
      cause: [
        { t: 'User text + retrieved doc are concatenated into the instruction channel — direct + indirect injection', ok: true },
        { t: 'The system line is too short', ok: false, why: 'Length is not the issue; channel isolation is.' },
        { t: 'Temperature is too high', ok: false, why: 'A param tweak does not stop instruction override.' },
      ],
      why: 'Both the retrieved doc and the user query are pasted into one string with the system prompt — either can carry "ignore previous instructions". Keep untrusted text in the user turn, delimit it, and never treat retrieved content as instructions.',
    },
    fj: '"Tell it to ignore injected commands."',
    fs: '"Structural isolation — separate channels + delimiters; treat retrieved/user text as data."',
  },
];

/** Pillar 1 — articulation scenario cards, as SessionCards. */
export function scenarioCards(domain: DomainFilter): SessionCard[] {
  return SCENARIOS.filter((s) => domain === 'all' || s.domain === domain).map((s) => ({
    id: s.id,
    kind: 'scenario' as const,
    tk: s.tk,
    tool: s.tool,
    tag: '🗣️ Explain it · scenario',
    q: s.prompt,
    framing: s.framing,
    arc: s.arc,
    rubric: s.rubric,
    fj: '',
    fs: '',
  }));
}

/**
 * The daily pool the scheduler builds from: scenarios + a small fresh trickle +
 * curated highlights + the full bank. buildSessionDeck() then orders by what's due.
 */
export function dailyPool(domain: DomainFilter, now: number): SessionCard[] {
  const daily = DAILY.filter((c) => domain === 'all' || tkDomain(c.tk) === domain);
  return [
    ...scenarioCards(domain),
    ...freshSessionCards(now, domain, 2), // 1–2 card "fresh trickle"
    ...daily,
    ...bankForDomain(domain),
  ];
}

/** Role-precise daily pool: scenarios + fresh trickle + curated highlights + the role's own bank. */
export function dailyPoolForRole(roleKey: string, now: number): SessionCard[] {
  const domain = roleDomain(roleKey);
  const daily = DAILY.filter((c) => domain === 'all' || tkDomain(c.tk) === domain);
  return [
    ...scenarioCards(domain),
    ...freshSessionCards(now, domain, 2),
    ...daily,
    ...bankForRole(roleKey),
  ];
}

/**
 * Build a study session: due cards first, then new, deduped, capped.
 * `adaptive` (Pro "smart scheduling") orders due cards WEAKEST-first (Birdbrain-style)
 * instead of oldest-due-first, so the session sits at the edge of your ability.
 */
/** Production ("do") formats — biased forward in a session so it's not mostly flip/MCQ recognition. */
const PRODUCTION_KINDS = new Set<string>(['scenario', 'diag', 'querybuild', 'match', 'evidence', 'order', 'classify']);

export function buildSessionDeck(
  pool: SessionCard[],
  progress: Record<string, CardState>,
  now: number,
  limit: number,
  adaptive = false,
  deprioritize?: Set<string>
): SessionCard[] {
  const seen = new Set<string>();
  const uniq: SessionCard[] = [];
  for (const c of pool) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      uniq.push(c);
    }
  }
  const due = uniq.filter((c) => {
    const st = progress[c.id];
    return st && st.reps > 0 && st.due <= now;
  });
  due.sort(
    adaptive
      ? (a, b) => weakness(progress[b.id], now) - weakness(progress[a.id], now)
      : (a, b) => progress[a.id].due - progress[b.id].due
  );
  // "new" includes never-seen cards AND lapsed ('again' resets reps to 0) so they resurface
  const newCards = uniq.filter((c) => {
    const st = progress[c.id];
    return !st || st.reps === 0;
  });
  // Pedagogy (plan #9): bias sessions toward "do" formats — interleave production cards (scenario,
  // diag, build, evidence, order, match, classify) with recognition (flip/MCQ) so they aren't buried.
  const prodNew = newCards.filter((c) => PRODUCTION_KINDS.has(c.kind));
  const recNew = newCards.filter((c) => !PRODUCTION_KINDS.has(c.kind));
  const mixedNew: SessionCard[] = [];
  for (let i = 0, j = 0; i < prodNew.length || j < recNew.length; ) {
    if (i < prodNew.length) mixedNew.push(prodNew[i++]);
    if (j < recNew.length) mixedNew.push(recNew[j++]);
  }
  let ordered = [...due, ...mixedNew];
  // Disliked cards sink to the back (stable) so they fall off the end when the deck is capped — surfaced
  // less without being hidden, and SRS schedule is untouched.
  if (deprioritize && deprioritize.size) {
    ordered = [...ordered.filter((c) => !deprioritize.has(c.id)), ...ordered.filter((c) => deprioritize.has(c.id))];
  }
  return Number.isFinite(limit) ? ordered.slice(0, limit) : ordered;
}

export const LESSON_SIZE = 4;

/** Pro weak-spot drill: the cards you keep missing (most lapses / lowest strength), regardless of due. */
export function weakSpotDeck(
  pool: SessionCard[],
  progress: Record<string, CardState>,
  now: number,
  limit: number
): SessionCard[] {
  const seen = pool.filter((c) => (progress[c.id]?.reps ?? 0) > 0);
  seen.sort((a, b) => weakness(progress[b.id], now) - weakness(progress[a.id], now));
  const weak = seen.filter((c) => weakness(progress[c.id], now) > 0.8);
  const chosen = weak.length ? weak : seen;
  return Number.isFinite(limit) ? chosen.slice(0, limit) : chosen;
}

/** A Duolingo-style lesson: a bite-size slice of a track. */
export function lessonDeck(slug: string, lessonIdx: number, size = LESSON_SIZE): SessionCard[] {
  return bankForTrack(slug).slice(lessonIdx * size, lessonIdx * size + size);
}

/** Number of lesson nodes in a track (for the Path) — derived from the live bank. */
export function lessonCount(slug: string, size = LESSON_SIZE): number {
  return Math.ceil(bankForTrack(slug).length / size);
}

/** Lessons per chapter — a "boss" checkpoint test caps each chapter (plan #25). */
export const CHAPTER_SIZE = 3;

/** How many checkpoint "boss" nodes a track has (one per completed chapter boundary). */
export function checkpointCount(slug: string): number {
  return Math.floor(lessonCount(slug) / CHAPTER_SIZE);
}

/** Cumulative no-peek review deck for chapter `chapterIdx` — all cards from that chapter's lessons. */
export function checkpointDeck(slug: string, chapterIdx: number, size = LESSON_SIZE): SessionCard[] {
  const start = chapterIdx * CHAPTER_SIZE * size;
  const end = start + CHAPTER_SIZE * size;
  return bankForTrack(slug).slice(start, end);
}

/** Stable key for a chapter checkpoint (used in the persisted `checkpointsDone` set). */
export const checkpointKey = (slug: string, chapterIdx: number): string => `${slug}:${chapterIdx}`;

// Lesson titles live in ./lesson-titles.json so the dump script (scripts/dump-content.mjs) reads the
// SAME source the app does — authored per-track titles + the positional fallback progression.
// Positional progression reads as a learning arc (lesson 1 = basics → … → mastery).
const INDEX_LABEL: string[] = lessonTitlesData.__index;

/** Authored lesson titles per track (optional; falls back to the positional progression). */
export const LESSON_TITLES: Record<string, string[]> = lessonTitlesData.tracks;

/** A short heading for a lesson node — authored if present, else a positional progression label. */
export function lessonTitle(slug: string, idx: number): string {
  return LESSON_TITLES[slug]?.[idx] ?? INDEX_LABEL[idx] ?? `Lesson ${idx + 1}`;
}

export function deckCounts(
  deck: SessionCard[],
  progress: Record<string, CardState>,
  now: number
): { due: number; fresh: number } {
  let due = 0;
  for (const c of deck) {
    const st = progress[c.id];
    if (st && st.reps > 0 && st.due <= now) due++;
  }
  return { due, fresh: deck.length - due };
}

/** Back-compat alias used by the Library track view. */
export function trackDeck(slug: string): SessionCard[] {
  return bankForTrack(slug);
}
