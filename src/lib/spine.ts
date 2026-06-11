/**
 * "Start here" spine (#4) — a curated, ordered prep sequence per role (the LeetCode-Top-150 /
 * Grokking idea): which tracks to hit, in what order, and roughly how many cards each.
 *
 * Founder-editable data: tweak SPINES below role-by-role; every other role derives a sensible
 * fallback from its ROLE_TRACKS registry order. Progress is resolved purely from the persisted
 * SRS `progress` map — no new state, no migration.
 */
import { bankForTrack, firstLessonAtLevel, type Level, trackBySlug } from './content';
import { ROLE_TRACKS, type RoleKey } from './roles';
import type { CardState } from './srs';

export interface SpineStep {
  /** Track slug this step studies. */
  track: string;
  /** Cards to clear in that track for this step (cumulative across repeated tracks). */
  count: number;
  /** Optional human label ("SQL you will be asked"); falls back to the track name. */
  label?: string;
}

const STEP = 8; // default cards per step (~2 lessons)

/** Hand-curated spines for flagship roles. Order = study order. Founder edits this literal. */
export const SPINES: Partial<Record<RoleKey, SpineStep[]>> = {
  de: [
    { track: 'sql', count: STEP, label: 'SQL you will be asked' },
    { track: 'sql-coding', count: STEP, label: 'Prove it in code' },
    { track: 'spark', count: STEP },
    { track: 'python-drills', count: STEP },
    { track: 'modeling', count: STEP },
    { track: 'kafka', count: STEP },
    { track: 'airflow', count: STEP },
    { track: 'sysd', count: STEP, label: 'Design the pipeline' },
    { track: 'data-reliability', count: STEP, label: 'On-call judgment' },
    { track: 'sql', count: STEP * 2, label: 'SQL depth' },
    { track: 'spark', count: STEP * 2, label: 'Spark internals' },
    { track: 'behavioral', count: 4 },
    { track: 'interview-craft', count: 4, label: 'Land the story' },
  ],
  ai: [
    { track: 'llms', count: STEP, label: 'LLM fundamentals they screen on' },
    { track: 'rag', count: STEP },
    { track: 'prompt', count: STEP },
    { track: 'agents', count: STEP },
    { track: 'vectordb', count: STEP },
    { track: 'evals', count: STEP, label: 'Evals — the senior differentiator' },
    { track: 'python-drills', count: STEP },
    { track: 'rag', count: STEP * 2, label: 'RAG failure modes' },
    { track: 'mlsys', count: STEP },
    { track: 'behavioral', count: 4 },
    { track: 'interview-craft', count: 4 },
  ],
  'java-dev': [
    { track: 'java', count: STEP, label: 'Core Java they always ask' },
    { track: 'java-coding', count: 8, label: 'Spot the bug' },
    { track: 'java', count: STEP * 2, label: 'Concurrency & JVM' },
    { track: 'apis', count: STEP },
    { track: 'databases', count: STEP },
    { track: 'sql', count: STEP },
    { track: 'sysd', count: STEP, label: 'Design a service' },
    { track: 'java-coding', count: 16, label: 'Harder bugs' },
    { track: 'behavioral', count: 4 },
    { track: 'interview-craft', count: 4 },
  ],
  'python-dev': [
    { track: 'python', count: STEP, label: 'Core Python they always ask' },
    { track: 'python-drills', count: STEP, label: 'Prove it in code' },
    { track: 'apis', count: STEP },
    { track: 'databases', count: STEP },
    { track: 'sql', count: STEP },
    { track: 'python', count: STEP * 2, label: 'Async, GIL & internals' },
    { track: 'sysd', count: STEP, label: 'Design a service' },
    { track: 'behavioral', count: 4 },
    { track: 'interview-craft', count: 4 },
  ],
  'ts-dev': [
    { track: 'typescript', count: STEP, label: 'TS questions they always ask' },
    { track: 'typescript-coding', count: 8, label: 'Spot the bug' },
    { track: 'nodejs', count: STEP, label: 'Event loop & Node internals' },
    { track: 'nodejs-coding', count: 8 },
    { track: 'apis', count: STEP },
    { track: 'databases', count: STEP },
    { track: 'sysd', count: STEP, label: 'Design a service' },
    { track: 'behavioral', count: 4 },
    { track: 'interview-craft', count: 4 },
  ],
  'go-dev': [
    { track: 'go', count: STEP, label: 'Core Go they always ask' },
    { track: 'go-coding', count: 8, label: 'Spot the bug' },
    { track: 'go', count: STEP * 2, label: 'Goroutines & channels' },
    { track: 'apis', count: STEP },
    { track: 'sysd', count: STEP, label: 'Design a service' },
    { track: 'kubernetes', count: STEP },
    { track: 'behavioral', count: 4 },
    { track: 'interview-craft', count: 4 },
  ],
};

/** Steps for any role: curated when available, else derived from its registry order. */
export function spineForRole(role: RoleKey): SpineStep[] {
  const curated = SPINES[role];
  if (curated?.length) return curated.filter((s) => bankForTrack(s.track).length > 0);
  const tracks = (ROLE_TRACKS[role] ?? []).filter((slug) => bankForTrack(slug).length > 0);
  return tracks.slice(0, 10).map((track) => ({ track, count: STEP }));
}

export interface ResolvedStep extends SpineStep {
  /** Cumulative card quota for this track up to and including this step. */
  quota: number;
  seen: number;
  done: boolean;
  name: string;
}

/** Resolve done/current state for every step from the persisted progress map. */
export function resolveSpine(role: RoleKey, progress: Record<string, CardState>): ResolvedStep[] {
  const steps = spineForRole(role);
  const quotaByTrack: Record<string, number> = {};
  const seenByTrack: Record<string, number> = {};
  return steps.map((s) => {
    if (seenByTrack[s.track] == null) {
      seenByTrack[s.track] = bankForTrack(s.track).filter((c) => (progress[c.id]?.reps ?? 0) > 0).length;
    }
    // Repeated tracks accumulate: "sql · 8" then "SQL depth · 16" means 24 total in sql.
    quotaByTrack[s.track] = (quotaByTrack[s.track] ?? 0) + s.count;
    const quota = quotaByTrack[s.track];
    const seen = seenByTrack[s.track];
    return {
      ...s,
      quota,
      seen: Math.min(seen, quota),
      done: seen >= quota,
      name: trackBySlug(s.track)?.name ?? s.track,
    };
  });
}

/** The next recommended step (first not-done), with the lesson to open. Null when complete. */
export function nextSpineStep(
  role: RoleKey,
  progress: Record<string, CardState>,
  userLevel: Level | null
): { step: ResolvedStep; index: number; lessonIdx: number } | null {
  const steps = resolveSpine(role, progress);
  const index = steps.findIndex((s) => !s.done);
  if (index === -1) return null;
  const step = steps[index];
  return { step, index, lessonIdx: firstLessonAtLevel(step.track, userLevel, progress) };
}

/** Chunk the spine into a "Day 1-N plan" (~2 steps/day) for the home PlanList. */
export function spineDays(role: RoleKey, progress: Record<string, CardState>): { day: number; steps: ResolvedStep[] }[] {
  const steps = resolveSpine(role, progress);
  const days: { day: number; steps: ResolvedStep[] }[] = [];
  for (let i = 0; i < steps.length; i += 2) {
    days.push({ day: days.length + 1, steps: steps.slice(i, i + 2) });
  }
  return days;
}
