/**
 * Production-incident registry (plan C). Each incident is a curated on-call/diagnostic scenario
 * the user can pick from the Practice tab and work through (inspect → fix → verify). Decks reuse the
 * existing on-call tracks' cards via bankForTrack, so no new content authoring is required.
 */
import { bankForTrack, type SessionCard } from './content';
import type { TrackColorKey } from './theme';

export interface Incident {
  id: string;
  title: string;
  tool: string;
  icon: string;
  tk: TrackColorKey;
  blurb: string;
  slug: string; // the on-call track whose cards make up this incident
}

export const INCIDENTS: Incident[] = [
  {
    id: 'spark-oom-skew',
    title: 'Spark OOM + skew',
    tool: 'Spark',
    icon: '🔥',
    tk: 'spark',
    blurb: 'A nightly Spark job keeps OOM-ing. Read the Stages tab, find the skew, fix the grain.',
    slug: 'spark-oncall',
  },
  {
    id: 'airflow-nonidempotent',
    title: 'Airflow non-idempotent writes',
    tool: 'Airflow',
    icon: '🐞',
    tk: 'sysd',
    blurb: 'A re-run doubled the rows. Diagnose the non-idempotent write and make the DAG safe to retry.',
    slug: 'airflow-oncall',
  },
  {
    id: 'sql-null-bug',
    title: 'SQL NULL bug hunt',
    tool: 'SQL',
    icon: '🔎',
    tk: 'sql',
    blurb: 'A query silently drops rows in prod. Spot the NOT IN + NULL trap and rewrite it correctly.',
    slug: 'cr-sql',
  },
];

export function incidentById(id: string): Incident | undefined {
  return INCIDENTS.find((i) => i.id === id);
}

/** The cards for an incident — the on-call track's diagnostic deck. */
export function incidentDeck(id: string): SessionCard[] {
  const inc = incidentById(id);
  return inc ? bankForTrack(inc.slug) : [];
}
