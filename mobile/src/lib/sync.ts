import { CardState } from './srs';
import { supabase } from './supabase';

export type ProgressMap = Record<string, CardState>;

export interface DebriefInput {
  company: string;
  level: string;
  outcome: string;
  topics: string[];
  notes?: string;
}

export async function pushProgress(userId: string, progress: ProgressMap): Promise<void> {
  if (!supabase) return;
  const rows = Object.entries(progress).map(([card_id, s]) => ({
    user_id: userId,
    card_id,
    ease: s.ease,
    interval_days: s.interval,
    reps: s.reps,
    lapses: s.lapses,
    due_at: s.due ? new Date(s.due).toISOString() : null,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) await supabase.from('card_progress').upsert(rows);
}

export async function pullProgress(userId: string): Promise<ProgressMap> {
  if (!supabase) return {};
  const { data } = await supabase.from('card_progress').select('*').eq('user_id', userId);
  const map: ProgressMap = {};
  for (const r of data ?? []) {
    map[r.card_id] = {
      ease: r.ease,
      interval: r.interval_days,
      reps: r.reps,
      lapses: r.lapses,
      due: r.due_at ? Date.parse(r.due_at) : 0,
    };
  }
  return map;
}

export async function pushStats(userId: string, streak: number, xp: number): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('user_stats')
    .upsert({ user_id: userId, streak, xp, updated_at: new Date().toISOString() });
}

export interface FeedbackState {
  feedback: Record<string, 'like' | 'dislike'>;
  savedIds: string[];
}

/** Upsert one card's reaction (save + like/dislike). Last-write-wins by updated_at, server-side. */
export async function pushFeedback(
  userId: string,
  cardId: string,
  saved: boolean,
  feedback: 'like' | 'dislike' | null
): Promise<void> {
  if (!supabase) return;
  await supabase.from('card_feedback').upsert({
    user_id: userId,
    card_id: cardId,
    saved,
    feedback,
    updated_at: new Date().toISOString(),
  });
}

export async function pullFeedback(userId: string): Promise<FeedbackState> {
  if (!supabase) return { feedback: {}, savedIds: [] };
  const { data } = await supabase.from('card_feedback').select('*').eq('user_id', userId);
  const feedback: Record<string, 'like' | 'dislike'> = {};
  const savedIds: string[] = [];
  for (const r of data ?? []) {
    if (r.feedback === 'like' || r.feedback === 'dislike') feedback[r.card_id] = r.feedback;
    if (r.saved) savedIds.push(r.card_id);
  }
  return { feedback, savedIds };
}

export async function insertDebrief(userId: string, d: DebriefInput): Promise<void> {
  if (!supabase) return;
  await supabase.from('debriefs').insert({
    user_id: userId,
    company: d.company,
    level: d.level,
    outcome: d.outcome,
    topics: d.topics,
    notes: d.notes ?? null,
  });
}

export async function writeEntitlement(
  userId: string,
  productId: string,
  platform: string,
  receipt: unknown
): Promise<void> {
  if (!supabase) return;
  await supabase.from('entitlements').upsert({
    user_id: userId,
    product_id: productId,
    platform,
    receipt: receipt as never,
  });
}

/** All product ids this user owns server-side (cross-device / reinstall safety net). */
export async function listUserEntitlements(userId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('entitlements').select('product_id').eq('user_id', userId);
  return (data ?? []).map((r: { product_id: string }) => r.product_id);
}

/** "Most asked at <company>" — server enforces the 20+ debrief privacy threshold. */
export async function fetchMostAsked(company: string): Promise<{ topic: string; n: number }[]> {
  if (!supabase || !company) return [];
  const { data } = await supabase.rpc('most_asked', { company_in: company });
  return (data as { topic: string; n: number }[] | null) ?? [];
}
