/**
 * Interview-date cram plan — a pure, deterministic ramping study plan built from an
 * interview date (ISO) + role. Companion to jd.ts: the JD analyzer says WHAT to study,
 * this says WHEN and HOW HARD, intensifying toward the interview and capping with a
 * light "morning-of warm-up".
 *
 * No side effects, no network, no store/theme imports — just date math + card-count
 * curves so it stays trivially testable and reusable from any screen.
 */
import { ROLE_TRACKS, RoleKey, roleByKey } from './roles';

/** Local-midnight for a `YYYY-MM-DD` (or full ISO) string. Returns NaN-time Date if unparseable. */
function atLocalMidnight(iso: string): Date {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Today at local midnight (so the same calendar day always reads as 0 days away). */
function todayMidnight(now: number = Date.now()): Date {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const DAY = 86_400_000;

/**
 * Whole calendar days from today until the interview. 0 = interview is today,
 * negative = already passed, null = unparseable/empty input.
 */
export function daysUntil(dateIso: string | null | undefined, now: number = Date.now()): number | null {
  if (!dateIso) return null;
  const target = atLocalMidnight(dateIso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - todayMidnight(now).getTime()) / DAY);
}

/** One day in the ramp. `offset` 0 = today; `date` is that day's ISO (YYYY-MM-DD). */
export interface CramDay {
  offset: number;
  date: string;
  /** Suggested cards to review that day. */
  target: number;
  /** True for the interview day itself — a light "morning-of" warm-up rather than a grind. */
  warmUp: boolean;
}

export interface CramPlan {
  role: RoleKey;
  roleName: string;
  /** Days from today to the interview (clamped at 0 — see `daysUntil` for the raw value). */
  daysUntil: number;
  /** True when the interview is today (or in the past) → show the warm-up, not a long ramp. */
  isToday: boolean;
  /** True when the interview date is in the past. */
  isPast: boolean;
  /** Suggested cards to do TODAY (the head of `schedule`). */
  todayTarget: number;
  /** Whether today is the morning-of warm-up. */
  warmUpToday: boolean;
  /** Day-by-day ramp from today through the interview day (inclusive). */
  schedule: CramDay[];
  /** Total suggested cards across the whole plan. */
  totalCards: number;
  /** Tracks to focus on (role's tracks), surfaced for callers that want a focus list. */
  focusTracks: string[];
  /** One-line human summary of the plan. */
  summary: string;
}

/** Floor/ceil for the daily ramp so plans stay humane on both ends. */
const MIN_TARGET = 10;
const MAX_TARGET = 50;
/** A gentle morning-of warm-up — recall, don't cram. */
const WARMUP_TARGET = 8;

/**
 * Card target for a given day in an N-day run-up. Earlier days are lighter; the curve
 * ramps quadratically so the last few days before the interview are the heaviest, then
 * the interview day itself is a small warm-up.
 *
 * @param offset    days from today (0 = today)
 * @param daysLeft  whole days until the interview (>= 1)
 */
function targetForOffset(offset: number, daysLeft: number): number {
  if (offset >= daysLeft) return WARMUP_TARGET; // interview day = warm-up
  // progress 0..1 across the run-up; quadratic so intensity climbs toward the date.
  const denom = Math.max(1, daysLeft - 1);
  const p = Math.min(1, Math.max(0, offset / denom));
  const ramp = p * p;
  const raw = MIN_TARGET + ramp * (MAX_TARGET - MIN_TARGET);
  return Math.round(raw / 5) * 5; // round to a tidy multiple of 5
}

/** ISO `YYYY-MM-DD` for `offset` days after today (local). */
function isoForOffset(offset: number, now: number = Date.now()): string {
  const base = todayMidnight(now);
  const d = new Date(base.getTime() + offset * DAY);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Build a full ramping plan from an interview date + role. Pure: pass `now` to make
 * it deterministic in tests. Returns null only when the date is unparseable/empty.
 */
export function buildCramPlan(
  dateIso: string | null | undefined,
  role: RoleKey,
  now: number = Date.now()
): CramPlan | null {
  const raw = daysUntil(dateIso, now);
  if (raw == null) return null;

  const roleName = roleByKey(role)?.name ?? role;
  const focusTracks = ROLE_TRACKS[role] ?? [];
  const isPast = raw < 0;
  const isToday = raw <= 0;
  const daysLeft = Math.max(0, raw);

  const schedule: CramDay[] = [];
  if (isToday) {
    // Interview is today (or passed) — single warm-up entry, no long ramp.
    schedule.push({ offset: 0, date: isoForOffset(0, now), target: WARMUP_TARGET, warmUp: true });
  } else {
    for (let o = 0; o <= daysLeft; o++) {
      schedule.push({
        offset: o,
        date: isoForOffset(o, now),
        target: targetForOffset(o, daysLeft),
        warmUp: o === daysLeft,
      });
    }
  }

  const head = schedule[0];
  const totalCards = schedule.reduce((s, d) => s + d.target, 0);

  return {
    role,
    roleName,
    daysUntil: daysLeft,
    isToday,
    isPast,
    todayTarget: head.target,
    warmUpToday: head.warmUp,
    schedule,
    totalCards,
    focusTracks,
    summary: planSummary(roleName, daysLeft, isToday, isPast, totalCards),
  };
}

/** Short human one-liner describing the plan. Exported for reuse / direct testing. */
export function planSummary(
  roleName: string,
  daysLeft: number,
  isToday: boolean,
  isPast: boolean,
  totalCards: number
): string {
  if (isPast) return `Your ${roleName} interview date has passed — keep your skills warm with a daily review.`;
  if (isToday) return `It's interview day. A light ${roleName} warm-up to get sharp — recall, don't cram.`;
  if (daysLeft === 1) return `One day to go — final heavy ${roleName} push today, then a warm-up tomorrow.`;
  return `${daysLeft} days to your ${roleName} interview: a ramping plan of ~${totalCards} cards that intensifies toward the date.`;
}
