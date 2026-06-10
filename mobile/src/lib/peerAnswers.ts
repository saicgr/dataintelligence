/**
 * Peer answers + most-asked-at-company — the community data moat.
 *
 * Every scenario answer a player commits can be contributed (anonymized) to a shared
 * pool; after submitting they see a few highly-rated peer answers for the same card.
 * Separately, post-interview debriefs aggregate into a "most asked at <company>" list.
 *
 * Reuses the single existing Supabase client + `hasSupabase` guard (src/lib/supabase.ts).
 * Every export degrades gracefully to an empty array / no-op when Supabase is unconfigured,
 * so the UI can call these unconditionally.
 *
 * Backed by:
 *   supabase/migrations/0003_peer_answers.sql   (scenario_answers + top_peer_answers + vote RPC)
 *   supabase/migrations/0004_company_most_asked.sql (company_most_asked RPC over debriefs)
 */
import { supabase } from './supabase';

export interface PeerAnswer {
  id: string;
  body: string;
  votes: number;
  createdAt: number;
}

export interface MostAskedTopic {
  topic: string;
  /** how many debriefs at this company mentioned the topic */
  n: number;
  /** total debriefs recorded for this company (>= 20, the privacy threshold) */
  debriefs: number;
  /** n / debriefs, 0..1 — share of debriefs that mentioned this topic */
  share: number;
  /** Mentions in the last 90 days (recency signal). Absent until migration 0009 is applied. */
  recent?: number;
}

const MIN_BODY = 1;
const MAX_BODY = 2000;

/** Strip anything that could deanonymize before it ever leaves the device. */
function sanitize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_BODY);
}

/**
 * Contribute one anonymized scenario answer to the shared pool. No identity is sent or
 * stored (see migration 0003 — the table has no user column). `userId` is accepted only
 * so callers don't have to special-case signed-out users; it is intentionally NOT sent.
 * Returns the new row's id, or null when not stored (offline / empty / error).
 */
export async function submitScenarioAnswer(
  cardId: string,
  text: string,
  _userId?: string | null
): Promise<string | null> {
  void _userId; // anonymized by design — accepted for caller convenience, never stored
  if (!supabase) return null;
  const body = sanitize(text);
  if (body.length < MIN_BODY) return null;
  const { data, error } = await supabase
    .from('scenario_answers')
    .insert({ card_id: cardId, body })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** A few highly-rated anonymized peer answers for a card. Empty array when unavailable. */
export async function topPeerAnswers(cardId: string, limit = 3): Promise<PeerAnswer[]> {
  if (!supabase || !cardId) return [];
  const { data, error } = await supabase.rpc('top_peer_answers', {
    card_in: cardId,
    lim: limit,
  });
  if (error || !data) return [];
  return (data as { id: string; body: string; votes: number; created_at: string }[]).map((r) => ({
    id: r.id,
    body: r.body,
    votes: r.votes,
    createdAt: r.created_at ? Date.parse(r.created_at) : 0,
  }));
}

/** Upvote a peer answer (single-direction). Returns the new count, or null on failure. */
export async function upvotePeerAnswer(answerId: string): Promise<number | null> {
  if (!supabase || !answerId) return null;
  const { data, error } = await supabase.rpc('vote_scenario_answer', { answer_in: answerId });
  if (error || data == null) return null;
  return typeof data === 'number' ? data : null;
}

/**
 * Most-asked topics at a company, aggregated from the existing debriefs table. The server
 * enforces the >= 20-debrief privacy threshold, so this returns [] for companies without
 * enough data (and never exposes an individual debrief). Empty array when unconfigured.
 */
export async function mostAskedAtCompany(company: string, limit = 8): Promise<MostAskedTopic[]> {
  if (!supabase || !company.trim()) return [];
  const { data, error } = await supabase.rpc('company_most_asked', {
    company_in: company.trim(),
    lim: limit,
  });
  if (error || !data) return [];
  return (data as { topic: string; n: number; debriefs: number; share: number; recent?: number }[]).map((r) => ({
    topic: r.topic,
    n: r.n,
    debriefs: r.debriefs,
    share: typeof r.share === 'number' ? r.share : 0,
    // `recent` only exists once migration 0009 lands server-side — optional by design.
    ...(typeof r.recent === 'number' ? { recent: r.recent } : {}),
  }));
}

/** Companies we have enough debriefs on to surface (counts only, no per-row data). */
export async function companiesWithData(): Promise<{ company: string; debriefs: number }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('company_debrief_counts');
  if (error || !data) return [];
  return (data as { company: string; debriefs: number }[]).map((r) => ({
    company: r.company,
    debriefs: r.debriefs,
  }));
}
