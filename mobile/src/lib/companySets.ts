/**
 * Curated company question sets (plan GAP 6). Fixes the cold-start of the crowdsourced
 * `mostAskedAtCompany` (which shows nothing until 20+ debriefs): these are hand-picked, day-one
 * bundles of the tracks each company leans on, so a user can drill "what Amazon asks" immediately.
 *
 * Track-based (not card-id based) on purpose: track slugs are stable and guaranteed non-empty,
 * whereas hard-coding individual card ids would silently rot as content is regenerated. Each set is
 * the union of its tracks' banks, deduped. Card-id-level curation can layer on later if needed.
 */
import { bankForTrack, type SessionCard } from './content';

export interface CompanySet {
  label: string;
  blurb: string;
  /** Track slugs (must exist in content.ts TRACKS) most emphasized in this company's loops. */
  tracks: string[];
}

export const COMPANY_SETS: Record<string, CompanySet> = {
  amazon: {
    label: 'Amazon',
    blurb: 'SQL + Spark + system design, heavy on Leadership Principles',
    tracks: ['sql', 'spark', 'modeling', 'sysd', 'aws', 'behavioral', 'leadership'],
  },
  google: {
    label: 'Google',
    blurb: 'SQL, system design, Python + GCP fundamentals',
    tracks: ['sql', 'sysd', 'python', 'gcp', 'modeling', 'behavioral'],
  },
  databricks: {
    label: 'Databricks',
    blurb: 'Spark/PySpark internals, Lakehouse + Mosaic AI',
    tracks: ['spark', 'pyspark', 'databricks', 'mosaic', 'sql', 'sysd'],
  },
  snowflake: {
    label: 'Snowflake',
    blurb: 'Snowflake + Cortex, SQL, modeling & integration',
    tracks: ['snowflake', 'cortex', 'sql', 'modeling', 'data-integration', 'sysd'],
  },
  meta: {
    label: 'Meta',
    blurb: 'SQL, Python, system design + product data sense',
    tracks: ['sql', 'python', 'sysd', 'spark', 'modeling', 'behavioral'],
  },
};

export const COMPANY_KEYS = Object.keys(COMPANY_SETS);

/** Concatenated, id-deduped bank for a company set. Empty array for an unknown key. */
export function companyBank(key: string): SessionCard[] {
  const set = COMPANY_SETS[key];
  if (!set) return [];
  const seen = new Set<string>();
  const out: SessionCard[] = [];
  for (const slug of set.tracks) {
    for (const card of bankForTrack(slug)) {
      if (!seen.has(card.id)) {
        seen.add(card.id);
        out.push(card);
      }
    }
  }
  return out;
}
