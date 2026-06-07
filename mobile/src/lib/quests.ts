/**
 * Daily Quests — three small, rotating goals that reset each calendar day (Duolingo "Daily Quests").
 *
 * Pure + deterministic: `todaysQuests(seedDay)` picks 3 quests from a fixed pool, seeded by the
 * day string so every device shows the same trio on the same day (and a new trio tomorrow). No
 * dates are read internally — the caller passes the day string so this stays testable + tree-shakeable.
 *
 * Progress is computed from EXISTING store fields (cardsToday, dailyGoal, sessionDeck) plus a small
 * per-day counter map the store keeps (`questProgress`). Completion state itself is NOT stored here —
 * see INTEGRATION NOTES for the `questDay` / `questProgress` / `questsDone` fields the store should add.
 */

import type { SessionCard } from './content';

export type QuestId =
  | 'clear-due'
  | 'finish-diagnostic'
  | 'review-fresh'
  | 'hit-goal'
  | 'review-cards'
  | 'finish-lesson';

export interface Quest {
  id: QuestId;
  label: string;
  icon: string;
  /** Target count to complete the quest. */
  goal: number;
}

/** Canonical day key (UTC) — matches the store's `dayKey` so a quest day lines up with goal/streak days. */
export const questDayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * The full pool of quests we rotate through. Each ships a `goal` and the metric it reads.
 * `metric` tells the progress helpers which store field / counter to read:
 *  - 'cardsToday'  → unique cards reviewed today (store.cardsToday)
 *  - 'goal'        → did cardsToday reach dailyGoal (binary)
 *  - 'diag'        → diagnostics finished today (questProgress counter, bumped by the store)
 *  - 'fresh'       → fresh "stay current" cards reviewed today (questProgress counter)
 *  - 'lesson'      → path lessons finished today (questProgress counter)
 */
type Metric = 'cardsToday' | 'goal' | 'diag' | 'fresh' | 'lesson';

interface QuestDef extends Quest {
  metric: Metric;
}

const POOL: QuestDef[] = [
  { id: 'clear-due', label: 'Clear all due cards', icon: '📚', goal: 1, metric: 'goal' },
  { id: 'finish-diagnostic', label: 'Finish a diagnostic', icon: '🩺', goal: 1, metric: 'diag' },
  { id: 'review-fresh', label: 'Review a fresh card', icon: '🆕', goal: 1, metric: 'fresh' },
  { id: 'hit-goal', label: 'Hit your daily goal', icon: '🎯', goal: 1, metric: 'goal' },
  { id: 'review-cards', label: 'Review 5 cards', icon: '🃏', goal: 5, metric: 'cardsToday' },
  { id: 'finish-lesson', label: 'Finish a lesson', icon: '✅', goal: 1, metric: 'lesson' },
];

/** Deterministic 32-bit hash of a string → stable per-day seed (no Date read inside). */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const byId = new Map<QuestId, QuestDef>(POOL.map((q) => [q.id, q]));

/**
 * Today's three quests, seeded by the day string so the trio is stable within a day and rotates
 * daily. Always returns exactly 3 distinct quests (or fewer only if the pool itself shrinks).
 */
export function todaysQuests(seedDay: string): Quest[] {
  const want = Math.min(3, POOL.length);
  const order = [...POOL];
  // Fisher–Yates seeded by a per-day PRNG so the shuffle is deterministic for the given day.
  let state = hashSeed(seedDay) || 1;
  const rand = () => {
    // xorshift32 — fast, deterministic, good enough for picking quests.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, want).map((q) => ({ id: q.id, label: q.label, icon: q.icon, goal: q.goal }));
}

/** Inputs the progress helpers read — a thin slice of the store, kept dependency-free. */
export interface QuestProgressInputs {
  cardsToday: number;
  dailyGoal: number;
  /** Per-day counters the store bumps via `bumpQuest(metric)` (see INTEGRATION NOTES). */
  questProgress: Partial<Record<Metric, number>>;
}

/** Current numeric progress (0..goal) for one quest. */
export function questProgressValue(id: QuestId, s: QuestProgressInputs): number {
  const def = byId.get(id);
  if (!def) return 0;
  switch (def.metric) {
    case 'cardsToday':
      return Math.min(def.goal, s.cardsToday);
    case 'goal':
      return s.dailyGoal > 0 && s.cardsToday >= s.dailyGoal ? def.goal : 0;
    case 'diag':
    case 'fresh':
    case 'lesson':
      return Math.min(def.goal, s.questProgress[def.metric] ?? 0);
  }
}

/** 0..1 fraction for a progress bar. */
export function questFraction(id: QuestId, s: QuestProgressInputs): number {
  const def = byId.get(id);
  if (!def || def.goal <= 0) return 0;
  return Math.max(0, Math.min(1, questProgressValue(id, s) / def.goal));
}

/** True once the quest's progress meets its goal. */
export function questDone(id: QuestId, s: QuestProgressInputs): boolean {
  const def = byId.get(id);
  if (!def) return false;
  return questProgressValue(id, s) >= def.goal;
}

/** Count of today's quests completed (0..3) — handy for a "2/3 quests" header. */
export function questsCompleted(seedDay: string, s: QuestProgressInputs): number {
  return todaysQuests(seedDay).filter((q) => questDone(q.id, s)).length;
}

/**
 * Which metric (if any) a finished SessionCard deck should bump. The store calls this on
 * session-complete and routes the result through its `bumpQuest` action. Pure — no store import.
 */
export function questMetricForSession(kind: string, deck: SessionCard[]): Metric | null {
  if (kind === 'lesson') return 'lesson';
  if (kind === 'fresh') return 'fresh';
  // A deck counts as a "diagnostic" if it contains any diag-style production card.
  if (deck.some((cd) => cd.kind === 'diag')) return 'diag';
  return null;
}
