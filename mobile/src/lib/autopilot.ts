/**
 * Interview Autopilot (Pro) — a recalibrating day-by-day prep plan from role + level +
 * interview date (+ optional target company pack + JD gap tracks).
 *
 * ARCHITECTURE: the plan is DERIVED — recomputed from live progress on every build, exactly
 * like resolveSpine/readinessForRole. Nothing about the schedule persists; only the user's
 * inputs and tiny per-day completion markers (store.autopilotDone) do. That's what makes it
 * recalibrate for free: study anything, anywhere, and tomorrow's ranking absorbs it.
 *
 * DETERMINISM: no randomness — a derived plan re-rendered mid-scroll must not reshuffle.
 * Ties break by spine order, then slug. `now` is injectable for tests.
 */
import { COMPANY_SETS } from './companySets';
import { bankForTrack, firstLessonAtLevel, type Level, lessonCount, lessonDeck, trackBySlug, tracksForRole } from './content';
import { buildCramPlan, daysUntil } from './cramPlan';
import { axisForTrack, readinessAxes } from './readiness';
import type { RoleKey } from './roles';
import { spineForRole } from './spine';
import { type CardState, pRecall, strength } from './srs';

export const HORIZON_DAYS = 21;
export const CRAM_THRESHOLD = 3;
export const MOCK_INTERVAL = 3;
const LESSON_SIZE = 4;

export type PlanItemKind = 'lesson' | 'weakspot' | 'company' | 'review' | 'mock' | 'warmup' | 'cheatsheet';

export interface PlanItem {
  /** Stable within a day: `${date}:${kind}` (lessons add `:${track}:${lessonIdx}`). */
  id: string;
  kind: PlanItemKind;
  title: string;
  sub: string;
  icon: string;
  /** This item's share of the day's card budget. */
  cards: number;
  track?: string;
  lessonIdx?: number;
  companyKey?: string;
  /** Sourced from the JD gap list → renders the ⚠️ accent. */
  isGap?: boolean;
  done: boolean;
}

export interface AutopilotDay {
  offset: number; // 0 = today
  date: string; // YYYY-MM-DD
  target: number; // card budget (cramPlan's quadratic ramp)
  isMockDay: boolean;
  isWarmUp: boolean; // the interview day itself
  items: PlanItem[];
}

export type AutopilotStatus = 'dormant' | 'expired' | 'active';

export interface RankedTrack {
  slug: string;
  name: string;
  readiness: number; // 0..1, unseen = 0
  priority: number;
  isGap: boolean;
  inCompany: boolean;
}

export interface AutopilotPlan {
  status: AutopilotStatus;
  daysUntil: number;
  isToday: boolean;
  horizonCapped: boolean;
  cram: boolean;
  days: AutopilotDay[];
  today: AutopilotDay | null;
  /** First undone item today — feeds the ContinueHero. */
  nextItem: PlanItem | null;
  focusTracks: RankedTrack[];
  summary: string;
}

export interface AutopilotInputs {
  role: RoleKey;
  userLevel: Level | null;
  interviewDate: string | null;
  progress: Record<string, CardState>;
  targetCompanyKey: string | null;
  jdGapTracks: string[];
  /** store.autopilotDone[todayIso] ?? [] */
  doneToday: string[];
  now?: number;
}

/** The plan-item id recordMock marks when a mock round finishes (string must match store.ts). */
export function mockItemId(date: string): string {
  return `${date}:mock`;
}

const EMPTY: AutopilotPlan = {
  status: 'dormant',
  daysUntil: 0,
  isToday: false,
  horizonCapped: false,
  cram: false,
  days: [],
  today: null,
  nextItem: null,
  focusTracks: [],
  summary: '',
};

/**
 * Rank the candidate tracks (role ∪ JD gaps ∪ company pack) by where study time pays most:
 * priority = (1 − readiness) + .30·isGap + .15·inCompany + .15·inWeakestAxis.
 */
export function rankFocusTracks(
  role: RoleKey,
  progress: Record<string, CardState>,
  jdGapTracks: string[],
  companyKey: string | null,
  now: number
): RankedTrack[] {
  const companyTracks = new Set(companyKey ? (COMPANY_SETS[companyKey]?.tracks ?? []) : []);
  const gapSet = new Set(jdGapTracks);
  const candidates = new Set<string>([
    ...tracksForRole(role).map((t) => t.slug),
    ...jdGapTracks,
    ...companyTracks,
  ]);
  // Weakest axis (lowest per-axis readiness) gets a boost so the plan attacks the soft flank.
  const axes = readinessAxes(role, progress, now);
  const weakestAxis = axes.length ? axes.reduce((a, b) => (b.value < a.value ? b : a)).axis : null;
  const spineOrder = new Map(spineForRole(role).map((s, i) => [s.track, i]));

  const out: RankedTrack[] = [];
  for (const slug of candidates) {
    const bank = bankForTrack(slug);
    const t = trackBySlug(slug);
    if (!t || bank.length === 0) continue; // OTA slug rot → inert
    let sum = 0;
    for (const card of bank) {
      const st = progress[card.id];
      if (st && st.reps > 0) sum += 0.6 * strength(st) + 0.4 * pRecall(st, now);
    }
    const readiness = sum / bank.length;
    const isGap = gapSet.has(slug);
    const inCompany = companyTracks.has(slug);
    const inWeakestAxis = weakestAxis != null && axisForTrack(slug) === weakestAxis;
    out.push({
      slug,
      name: t.name,
      readiness,
      isGap,
      inCompany,
      priority: 1 - readiness + (isGap ? 0.3 : 0) + (inCompany ? 0.15 : 0) + (inWeakestAxis ? 0.15 : 0),
    });
  }
  return out.sort(
    (a, b) =>
      b.priority - a.priority ||
      (spineOrder.get(a.slug) ?? Infinity) - (spineOrder.get(b.slug) ?? Infinity) ||
      (a.slug < b.slug ? -1 : 1)
  );
}

/** A lesson is organically done when every one of its cards has been seen — studying it from
 *  the regular Learn path completes the plan item without any marker. */
function lessonDone(slug: string, lessonIdx: number, progress: Record<string, CardState>): boolean {
  const cards = lessonDeck(slug, lessonIdx);
  return cards.length > 0 && cards.every((cd) => (progress[cd.id]?.reps ?? 0) > 0);
}

export function buildAutopilot(inputs: AutopilotInputs): AutopilotPlan {
  const now = inputs.now ?? Date.now();
  const raw = daysUntil(inputs.interviewDate, now);
  if (raw == null) return EMPTY;
  if (raw < 0) return { ...EMPTY, status: 'expired' };

  const cramPlan = buildCramPlan(inputs.interviewDate, inputs.role, now);
  if (!cramPlan) return EMPTY;

  const focusTracks = rankFocusTracks(inputs.role, inputs.progress, inputs.jdGapTracks, inputs.targetCompanyKey, now);
  const companySet = inputs.targetCompanyKey ? COMPANY_SETS[inputs.targetCompanyKey] : undefined;
  const cram = raw < CRAM_THRESHOLD && raw > 0;
  const horizonCapped = raw > HORIZON_DAYS;
  const doneSet = new Set(inputs.doneToday);

  // Lesson cursor walks the ranked tracks across days; today's lessonIdx is REAL
  // (firstLessonAtLevel), future days are projected forward and clamped.
  const cursor = focusTracks.map((t) => ({
    slug: t.slug,
    name: t.name,
    isGap: t.isGap,
    next: firstLessonAtLevel(t.slug, inputs.userLevel, inputs.progress),
    count: lessonCount(t.slug),
  }));
  let cursorIdx = 0;
  const takeLesson = (): { slug: string; name: string; isGap: boolean; lessonIdx: number } | null => {
    for (let hop = 0; hop < cursor.length; hop++) {
      const c = cursor[(cursorIdx + hop) % cursor.length];
      if (c.next < c.count) {
        cursorIdx = (cursorIdx + hop + 1) % cursor.length;
        const lessonIdx = c.next;
        c.next += 1;
        return { slug: c.slug, name: c.name, isGap: c.isGap, lessonIdx };
      }
    }
    return null;
  };

  const days: AutopilotDay[] = [];
  const lastOffset = Math.min(raw, HORIZON_DAYS);
  for (const d of cramPlan.schedule) {
    if (d.offset > lastOffset) break;
    const isWarmUp = d.warmUp;
    // Mocks count backward from the day BEFORE the interview, every MOCK_INTERVAL days.
    const isMockDay =
      !isWarmUp && raw >= 1 && d.offset <= raw - 1 && (raw - 1 - d.offset) % MOCK_INTERVAL === 0 && (d.offset >= 1 || raw === 1);

    const items: PlanItem[] = [];
    const dn = (id: string) => (d.offset === 0 ? doneSet.has(id) : false);

    if (isWarmUp) {
      // Interview day: recall + cheat-sheet review only — the taper.
      const top = focusTracks[0];
      const sheetTrack = companySet?.tracks.find((s) => bankForTrack(s).length > 0) ?? top?.slug;
      items.push({
        id: `${d.date}:warmup`,
        kind: 'warmup',
        title: 'Morning-of warm-up',
        sub: 'Recall, don’t cram — your weakest cards, lightly',
        icon: '☀️',
        cards: d.target,
        done: dn(`${d.date}:warmup`),
      });
      if (sheetTrack) {
        items.push({
          id: `${d.date}:cheatsheet`,
          kind: 'cheatsheet',
          title: 'Review your cheat sheet',
          sub: trackBySlug(sheetTrack)?.name ?? sheetTrack,
          icon: '📄',
          cards: 0,
          track: sheetTrack,
          done: dn(`${d.date}:cheatsheet`),
        });
      }
    } else if (cram) {
      // <3 days: no new material — review + weak spots + (company) only.
      items.push({
        id: `${d.date}:review`,
        kind: 'review',
        title: 'Clear your due cards',
        sub: 'The scheduled queue first',
        icon: '📚',
        cards: Math.max(4, Math.round(d.target * 0.25)),
        done: dn(`${d.date}:review`),
      });
      items.push({
        id: `${d.date}:weakspot`,
        kind: 'weakspot',
        title: 'Weak-spots drill',
        sub: 'Your most-missed cards, weakest first',
        icon: '🎯',
        cards: Math.round(d.target * (companySet ? 0.4 : 0.75)),
        done: dn(`${d.date}:weakspot`),
      });
      if (companySet && inputs.targetCompanyKey) {
        items.push({
          id: `${d.date}:company`,
          kind: 'company',
          title: `${companySet.label} drill`,
          sub: 'Your target company’s ranked pack',
          icon: companySet.emoji,
          cards: Math.round(d.target * 0.35),
          companyKey: inputs.targetCompanyKey,
          done: dn(`${d.date}:company`),
        });
      }
    } else {
      // Normal day: review ~20% → lessons ~50% → company ~15% → weak spots remainder.
      const mockCost = isMockDay ? 8 : 0;
      const budget = Math.max(8, d.target - mockCost);
      items.push({
        id: `${d.date}:review`,
        kind: 'review',
        title: 'Clear your due cards',
        sub: 'The scheduled queue first',
        icon: '📚',
        cards: Math.max(2, Math.round(budget * 0.2)),
        done: dn(`${d.date}:review`),
      });
      const nLessons = Math.max(1, Math.round((budget * 0.5) / LESSON_SIZE));
      for (let i = 0; i < nLessons; i++) {
        const l = takeLesson();
        if (!l) break;
        const id = `${d.date}:lesson:${l.slug}:${l.lessonIdx}`;
        items.push({
          id,
          kind: 'lesson',
          title: `${l.name} · lesson ${l.lessonIdx + 1}`,
          sub: l.isGap ? '⚠️ JD gap — they will ask this' : 'Next up in your weakest area',
          icon: '🧭',
          cards: LESSON_SIZE,
          track: l.slug,
          lessonIdx: l.lessonIdx,
          isGap: l.isGap,
          // Lessons derive done-ness from progress — off-plan study counts (today only;
          // future days are projections and always open).
          done: d.offset === 0 ? lessonDone(l.slug, l.lessonIdx, inputs.progress) : false,
        });
      }
      if (companySet && inputs.targetCompanyKey) {
        items.push({
          id: `${d.date}:company`,
          kind: 'company',
          title: `${companySet.label} drill`,
          sub: 'Your target company’s ranked pack',
          icon: companySet.emoji,
          cards: Math.max(3, Math.round(budget * 0.15)),
          companyKey: inputs.targetCompanyKey,
          done: dn(`${d.date}:company`),
        });
      }
      items.push({
        id: `${d.date}:weakspot`,
        kind: 'weakspot',
        title: 'Weak-spots drill',
        sub: 'Your most-missed cards, weakest first',
        icon: '🎯',
        cards: Math.max(3, Math.round(budget * 0.15)),
        done: dn(`${d.date}:weakspot`),
      });
    }
    if (isMockDay) {
      items.push({
        id: mockItemId(d.date),
        kind: 'mock',
        title: d.offset === raw - 1 ? 'Final mock — day before' : 'Mock round',
        sub: 'Timed, no peeking — scored at the end',
        icon: '⏱️',
        cards: 8,
        done: dn(mockItemId(d.date)),
      });
    }

    days.push({ offset: d.offset, date: d.date, target: d.target, isMockDay, isWarmUp, items });
  }

  const today = days[0] ?? null;
  const nextItem = today?.items.find((i) => !i.done) ?? null;
  const gapCount = focusTracks.filter((t) => t.isGap).length;
  const summary = cramPlan.summary + (gapCount ? ` ${gapCount} JD gap track${gapCount === 1 ? '' : 's'} prioritized.` : '');

  return {
    status: 'active',
    daysUntil: raw,
    isToday: raw === 0,
    horizonCapped,
    cram,
    days,
    today,
    nextItem,
    focusTracks,
    summary,
  };
}
