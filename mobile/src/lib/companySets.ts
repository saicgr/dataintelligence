/**
 * Curated company question sets → COMPANY PACKS (the "LeetCode company tags" play).
 *
 * Two frequency signals rank a pack's cards, manual-first and fully offline:
 *   1. `topicWeights` — hand-curated 0..1 emphasis per debrief TOPIC (how hard this company
 *      leans on Spark vs SQL vs behavioral). Works from day one, no server needed.
 *   2. The crowdsourced `company_most_asked` aggregate (peerAnswers.ts) — layered on top in
 *      the pack UI once a company crosses the 20-debrief privacy threshold.
 *
 * Track-based (not card-id based) on purpose: track slugs are stable and guaranteed non-empty,
 * whereas hard-coding individual card ids would silently rot as content is regenerated.
 *
 * Packs are ROLE-AWARE: tapping Amazon gives Amazon × your current role (intersection of the
 * pack's tracks and the role's tracks), falling back to the full pack when the overlap is thin.
 */
import { bankForTrack, type SessionCard, tracksForRole } from './content';
import { type CardState, weakness } from './srs';
import type { MostAskedTopic } from './peerAnswers';

export interface CompanySet {
  label: string;
  emoji: string;
  blurb: string;
  /** Track slugs (must exist in content.ts TRACKS) most emphasized in this company's loops. */
  tracks: string[];
  /** Curated asked-frequency per debrief TOPIC (0..1). Drives the pack's frequency bars + ranking. */
  topicWeights: Record<string, number>;
}

export const COMPANY_SETS: Record<string, CompanySet> = {
  amazon: {
    label: 'Amazon',
    emoji: '📦',
    blurb: 'SQL + Spark + system design, heavy on Leadership Principles',
    tracks: ['sql', 'spark', 'modeling', 'sysd', 'aws', 'behavioral', 'leadership'],
    topicWeights: { SQL: 0.9, 'System design': 1, Behavioral: 0.95, Spark: 0.6, Python: 0.5 },
  },
  google: {
    label: 'Google',
    emoji: '🔍',
    blurb: 'SQL, system design, Python + GCP fundamentals',
    tracks: ['sql', 'sysd', 'python', 'gcp', 'modeling', 'behavioral'],
    topicWeights: { SQL: 0.85, 'System design': 0.95, Python: 0.9, Behavioral: 0.6 },
  },
  databricks: {
    label: 'Databricks',
    emoji: '🧱',
    blurb: 'Spark/PySpark internals, Lakehouse + Mosaic AI',
    tracks: ['spark', 'pyspark', 'databricks', 'mosaic', 'sql', 'sysd'],
    topicWeights: { Spark: 1, SQL: 0.7, 'System design': 0.75, Python: 0.6 },
  },
  snowflake: {
    label: 'Snowflake',
    emoji: '❄️',
    blurb: 'Snowflake + Cortex, SQL, modeling & integration',
    tracks: ['snowflake', 'cortex', 'sql', 'modeling', 'data-integration', 'sysd'],
    topicWeights: { SQL: 1, 'System design': 0.7, dbt: 0.5, Spark: 0.35 },
  },
  meta: {
    label: 'Meta',
    emoji: '∞',
    blurb: 'SQL, Python, system design + product data sense',
    tracks: ['sql', 'python', 'sysd', 'spark', 'modeling', 'behavioral'],
    topicWeights: { SQL: 1, Python: 0.9, 'System design': 0.8, Behavioral: 0.7 },
  },
  microsoft: {
    label: 'Microsoft',
    emoji: '🪟',
    blurb: 'Azure data stack, SQL + Python, collaborative design rounds',
    tracks: ['sql', 'azure', 'python', 'sysd', 'modeling', 'behavioral'],
    topicWeights: { SQL: 0.9, Python: 0.8, 'System design': 0.85, Behavioral: 0.75 },
  },
  netflix: {
    label: 'Netflix',
    emoji: '🎬',
    blurb: 'Streaming-scale pipelines: Spark, Kafka, observability',
    tracks: ['spark', 'kafka', 'sysd', 'sql', 'python', 'observability'],
    topicWeights: { Spark: 0.9, Kafka: 0.9, 'System design': 1, SQL: 0.6 },
  },
  uber: {
    label: 'Uber',
    emoji: '🚗',
    blurb: 'Real-time data: Kafka + Spark streaming, SQL at scale',
    tracks: ['kafka', 'spark', 'sql', 'sysd', 'python', 'modeling'],
    topicWeights: { Kafka: 1, Spark: 0.85, SQL: 0.85, 'System design': 0.9 },
  },
  stripe: {
    label: 'Stripe',
    emoji: '💳',
    blurb: 'Fintech rigor: SQL correctness, APIs, security-minded design',
    tracks: ['sql', 'python', 'sysd', 'modeling', 'kafka', 'security'],
    topicWeights: { SQL: 0.95, Python: 0.85, 'System design': 0.95, Behavioral: 0.55 },
  },
  apple: {
    label: 'Apple',
    emoji: '🍎',
    blurb: 'Privacy-first data platforms: SQL, Spark, careful design',
    tracks: ['sql', 'spark', 'python', 'sysd', 'modeling', 'behavioral'],
    topicWeights: { SQL: 0.85, 'System design': 0.9, Spark: 0.7, Behavioral: 0.7 },
  },
};

export const COMPANY_KEYS = Object.keys(COMPANY_SETS);

/** Debrief TOPIC names → the track slugs that teach them (the bridge between the
 *  crowdsourced aggregate, the curated weights, and actual cards). */
export const TOPIC_TO_TRACKS: Record<string, string[]> = {
  Spark: ['spark', 'pyspark', 'databricks'],
  RAG: ['rag', 'vectordb', 'llms'],
  Kafka: ['kafka'],
  SQL: ['sql', 'snowflake'],
  dbt: ['dbt'],
  'System design': ['sysd', 'architecture'],
  Python: ['python'],
  Behavioral: ['behavioral', 'leadership'],
};

/** The debrief topic a track slug teaches (first match), or null. */
export function topicForSlug(slug: string): string | null {
  for (const [topic, slugs] of Object.entries(TOPIC_TO_TRACKS)) {
    if (slugs.includes(slug)) return topic;
  }
  return null;
}

/** Concatenated, id-deduped bank for a company set. Empty array for an unknown key. */
export function companyBank(key: string): SessionCard[] {
  return companyCards(key).map((e) => e.card);
}

interface CompanyEntry {
  card: SessionCard;
  /** The pack track this card came from (cards keep no slug, so we tag at assembly). */
  slug: string;
}

function companyCards(key: string): CompanyEntry[] {
  const set = COMPANY_SETS[key];
  if (!set) return [];
  const seen = new Set<string>();
  const out: CompanyEntry[] = [];
  for (const slug of set.tracks) {
    for (const card of bankForTrack(slug)) {
      if (!seen.has(card.id)) {
        seen.add(card.id);
        out.push({ card, slug });
      }
    }
  }
  return out;
}

/** Pack cards through the ROLE lens: pack tracks ∩ role tracks, falling back to the whole
 *  pack when the overlap is too thin to be a useful session. */
function companyCardsForRole(key: string, role: string): CompanyEntry[] {
  const set = COMPANY_SETS[key];
  if (!set) return [];
  const roleSlugs = new Set(tracksForRole(role).map((t) => t.slug));
  const scoped = set.tracks.filter((s) => roleSlugs.has(s));
  if (scoped.length === 0) return companyCards(key);
  const seen = new Set<string>();
  const out: CompanyEntry[] = [];
  for (const slug of scoped) {
    for (const card of bankForTrack(slug)) {
      if (!seen.has(card.id)) {
        seen.add(card.id);
        out.push({ card, slug });
      }
    }
  }
  return out.length >= 10 ? out : companyCards(key);
}

export interface RankedCompanyCard {
  card: SessionCard;
  slug: string;
  topic: string | null;
  /** Asked-frequency score this card ranked by (curated + crowd + weakness). */
  score: number;
}

/**
 * The pack's cards ranked by asked-frequency: curated topic weight, plus the crowdsourced
 * share when ≥20 debriefs exist (passed in by the UI; deck-building skips it — offline),
 * plus a weakness nudge so what YOU miss floats up. Deterministic (no jitter): a pack
 * re-render must not reshuffle.
 */
export function rankCompanyCards(
  key: string,
  role: string,
  progress: Record<string, CardState>,
  now: number = Date.now(),
  remote?: MostAskedTopic[]
): RankedCompanyCard[] {
  const set = COMPANY_SETS[key];
  if (!set) return [];
  const shareByTopic = new Map<string, number>();
  for (const t of remote ?? []) shareByTopic.set(t.topic, t.share);
  return companyCardsForRole(key, role)
    .map(({ card, slug }) => {
      const topic = topicForSlug(slug);
      const curated = topic ? (set.topicWeights[topic] ?? 0.3) : 0.3;
      const crowd = topic ? (shareByTopic.get(topic) ?? 0) : 0;
      const weak = Math.min(1, weakness(progress[card.id], now));
      return { card, slug, topic, score: curated + 0.5 * crowd + 0.3 * weak };
    })
    .sort((a, b) => b.score - a.score || (a.card.id < b.card.id ? -1 : 1));
}

/** The pack's topics with curated weight + (optional) crowd share, for the frequency bars. */
export function packTopicBars(
  key: string,
  remote?: MostAskedTopic[]
): { topic: string; weight: number; share?: number; recent?: number }[] {
  const set = COMPANY_SETS[key];
  if (!set) return [];
  const remoteBy = new Map((remote ?? []).map((t) => [t.topic, t]));
  return Object.entries(set.topicWeights)
    .map(([topic, weight]) => {
      const r = remoteBy.get(topic);
      return { topic, weight, share: r?.share, recent: r?.recent };
    })
    .sort((a, b) => b.weight - a.weight);
}

/** Scan free text (a pasted JD) for a known company label. First hit wins; null otherwise. */
export function matchCompanyKey(text: string): string | null {
  const lower = text.toLowerCase();
  for (const key of COMPANY_KEYS) {
    if (lower.includes(COMPANY_SETS[key].label.toLowerCase())) return key;
  }
  return null;
}
