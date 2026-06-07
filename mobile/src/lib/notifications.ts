/**
 * Smart re-engagement notifications (expo-notifications, Expo SDK 56).
 *
 * Three schedulers, all senior-toned (a "field note" / "tell", never a guilt mascot or
 * "keep your streak alive!"):
 *   - scheduleStreakReminder(streak, restDays) — one evening local nudge, ONLY if a streak
 *     is at risk today and today is NOT a scheduled rest day.
 *   - scheduleDueReminder(dueCount)            — "N cards are due for review" morning-ish nudge.
 *   - notifyFreshBatch(n)                      — "N new cards landed this week".
 *
 * Design constraints (matches reminders.native.ts conventions):
 *   - We DYNAMICALLY import expo-notifications (like iap.native.ts) so the bundle still builds
 *     and Expo Go still runs when the native module isn't linked. Real delivery needs an EAS/dev
 *     build (local notifications can't run in Expo Go reliably).
 *   - Every call NO-OPS gracefully on web, in Expo Go, when the module is missing, and when
 *     permission is denied. A notification failure must never block the app.
 *   - Each scheduler owns a STABLE identifier and cancels-its-own-id first, so rescheduling
 *     replaces rather than stacks duplicates.
 *   - Quiet hours: nothing is scheduled to fire before 09:00 or at/after 21:00 local.
 *
 * expo-notifications SDK 56 surface used (verified against
 * https://docs.expo.dev/versions/v56.0.0/sdk/notifications/):
 *   getPermissionsAsync(), requestPermissionsAsync(),
 *   scheduleNotificationAsync({ identifier, content, trigger }),
 *   cancelScheduledNotificationAsync(id),
 *   setNotificationChannelAsync(id, { name, importance }),
 *   SchedulableTriggerInputTypes.DAILY  -> { type:'daily', hour, minute }
 *   SchedulableTriggerInputTypes.DATE   -> { type:'date', date }
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ---- Quiet hours (local) -----------------------------------------------------
export const QUIET_START_HOUR = 9; // inclusive — nothing fires before 09:00
export const QUIET_END_HOUR = 21; // exclusive — nothing fires at/after 21:00

// Default fire times (kept inside the quiet-hours window).
const STREAK_HOUR = 19; // 7pm — evening nudge
const DUE_HOUR = 10; // 10am — daytime "due for review"

// Stable identifiers so reschedule = replace (never stack).
const ID_STREAK = 'fieldnotes-streak';
const ID_DUE = 'fieldnotes-due';
const ID_FRESH = 'fieldnotes-fresh';

// Expo Go strips push APIs and merely importing expo-notifications runs an auto-registration
// side-effect that red-boxes there. Skip the import entirely in Expo Go (matches reminders.native.ts).
const IN_EXPO_GO =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any = null;
let triedLoad = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lib(): Promise<any> {
  if (Platform.OS === 'web') return null; // web → always no-op
  if (!triedLoad) {
    triedLoad = true;
    if (IN_EXPO_GO) return mod; // never import in Expo Go (throws on load)
    try {
      mod = await import('expo-notifications');
    } catch {
      mod = null;
    }
  }
  return mod;
}

// ---- Permissions -------------------------------------------------------------

/**
 * Ask for notification permission. Returns true only if granted.
 * No-ops (returns false) on web / Expo Go / missing module. Safe to call from onboarding.
 */
export async function requestPermission(): Promise<boolean> {
  const N = await lib();
  if (!N?.getPermissionsAsync) return false;
  try {
    const cur = await N.getPermissionsAsync();
    if (cur?.status === 'granted') return true;
    if (cur && cur.canAskAgain === false) return false; // user permanently denied — don't nag
    const req = await N.requestPermissionsAsync?.();
    return req?.status === 'granted';
  } catch {
    return false;
  }
}

// Internal: returns the module only if permission is already granted (never prompts here —
// prompting belongs to requestPermission(), called once from onboarding).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ready(): Promise<any | null> {
  const N = await lib();
  if (!N?.scheduleNotificationAsync) return null;
  try {
    const perm = await N.getPermissionsAsync?.();
    if (perm && perm.status !== 'granted') return null; // not granted → silent no-op
  } catch {
    return null;
  }
  return N;
}

// Ensure an Android channel exists before scheduling (no-op on iOS / older Android).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureChannel(N: any): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync?.('reengage', {
      name: 'Reminders',
      importance: N.AndroidImportance?.DEFAULT ?? 3,
    });
  } catch {
    /* ignore */
  }
}

// ---- Quiet-hours helpers -----------------------------------------------------

/** True if the given local hour is inside the allowed window [QUIET_START, QUIET_END). */
export function withinQuietHours(hour: number): boolean {
  return hour >= QUIET_START_HOUR && hour < QUIET_END_HOUR;
}

/** Clamp an hour into the allowed window so we never schedule a fire outside quiet hours. */
function clampHour(hour: number): number {
  if (hour < QUIET_START_HOUR) return QUIET_START_HOUR;
  if (hour >= QUIET_END_HOUR) return QUIET_END_HOUR - 1;
  return hour;
}

// ---- Streak-at-risk evening nudge -------------------------------------------

// Senior-toned streak copy — a nudge framed as continuity, not guilt/mascot.
const STREAK_LINES = [
  'A short rep tonight keeps the thread going.',
  'Five minutes now beats a cold start tomorrow.',
  "One card and today's logged. Worth the two minutes.",
  'Quick review while it’s fresh — small, compounding.',
];

/**
 * Schedule the evening streak nudge — but ONLY if the streak is genuinely at risk today
 * AND today is not a scheduled rest day. Otherwise cancel any pending streak nudge.
 *
 * "At risk" = the user has a streak going (>=1) and hasn't completed today yet. The CALLER
 * decides timing: call this after a streak settle (store.rate). If today is already done,
 * pass streak as-is — we simply (re)arm the evening reminder, and the next-day settle will
 * cancel/replace it. The rest-day skip respects store.restDays (UTC weekday, 0=Sun..6=Sat).
 *
 * @param streak   current streak count
 * @param restDays scheduled rest days as UTC weekdays (0=Sun..6=Sat), per store.restDays
 */
export async function scheduleStreakReminder(
  streak: number,
  restDays: number[] = [],
): Promise<void> {
  const N = await ready();
  if (!N) return;
  try {
    // Always cancel our own pending streak nudge first (reschedule = replace).
    await N.cancelScheduledNotificationAsync?.(ID_STREAK);

    // No streak to protect → nothing to nudge.
    if (!streak || streak < 1) return;

    // Rest day → never nudge (the streak is protected; nudging would be guilt-y).
    const todayWeekday = new Date().getUTCDay();
    if (restDays.includes(todayWeekday)) return;

    // If the evening fire time has already passed today, the DAILY trigger fires tomorrow,
    // which is exactly what we want for a "don't lose it" cue.
    await ensureChannel(N);
    const body = STREAK_LINES[(streak - 1) % STREAK_LINES.length];
    await N.scheduleNotificationAsync({
      identifier: ID_STREAK,
      content: {
        title: `${streak}-day streak`,
        body,
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes?.DAILY ?? 'daily',
        hour: clampHour(STREAK_HOUR),
        minute: 0,
      },
    });
  } catch {
    /* never block the app on a notification failure */
  }
}

// ---- Due-for-review nudge ----------------------------------------------------

/**
 * Daytime "you have N cards due for review" nudge (spaced-repetition recall).
 * Cancels-its-own-id first. If dueCount <= 0, just cancels (nothing due → no nudge).
 * Fires daily inside quiet hours; the copy bakes in the count at schedule time.
 */
export async function scheduleDueReminder(dueCount: number): Promise<void> {
  const N = await ready();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync?.(ID_DUE);
    if (!dueCount || dueCount < 1) return;

    await ensureChannel(N);
    const body =
      dueCount === 1
        ? '1 card is due for review — a quick recall pass keeps it stuck.'
        : `${dueCount} cards are due for review — a quick recall pass keeps them stuck.`;
    await N.scheduleNotificationAsync({
      identifier: ID_DUE,
      content: { title: 'Due for review', body },
      trigger: {
        type: N.SchedulableTriggerInputTypes?.DAILY ?? 'daily',
        hour: clampHour(DUE_HOUR),
        minute: 0,
      },
    });
  } catch {
    /* swallow */
  }
}

// ---- Fresh-batch nudge -------------------------------------------------------

/**
 * "N new cards landed this week" — call after a fresh content pull (contentSync).
 * Schedules a one-shot DATE notification at the next in-window time:
 *   - if it's currently within quiet hours, fire ~a few seconds out (effectively now-ish);
 *   - otherwise fire at QUIET_START tomorrow/today, whichever is the next valid slot.
 * Cancels-its-own-id first; n <= 0 just cancels.
 */
export async function notifyFreshBatch(n: number): Promise<void> {
  const N = await ready();
  if (!N) return;
  try {
    await N.cancelScheduledNotificationAsync?.(ID_FRESH);
    if (!n || n < 1) return;

    await ensureChannel(N);

    const now = new Date();
    const fireAt = nextInWindow(now);

    const body =
      n === 1
        ? '1 new card landed this week — fresh from the field.'
        : `${n} new cards landed this week — fresh from the field.`;
    await N.scheduleNotificationAsync({
      identifier: ID_FRESH,
      content: { title: 'New this week', body },
      trigger: {
        type: N.SchedulableTriggerInputTypes?.DATE ?? 'date',
        date: fireAt,
      },
    });
  } catch {
    /* swallow */
  }
}

/**
 * Next Date at which it's acceptable to fire, respecting quiet hours.
 * - Inside the window now → +30s (deliver promptly without firing literally instantly).
 * - Before the window today → today at QUIET_START.
 * - After the window today → tomorrow at QUIET_START.
 */
function nextInWindow(now: Date): Date {
  const h = now.getHours();
  if (withinQuietHours(h)) {
    return new Date(now.getTime() + 30 * 1000);
  }
  const d = new Date(now);
  if (h >= QUIET_END_HOUR) {
    // after window → tomorrow morning
    d.setDate(d.getDate() + 1);
  }
  d.setHours(QUIET_START_HOUR, 0, 0, 0);
  return d;
}

// ---- Bulk cancel (optional convenience) -------------------------------------

/** Cancel every re-engagement notification this module owns. No-ops when unavailable. */
export async function cancelAllReengagement(): Promise<void> {
  const N = await lib();
  if (!N?.cancelScheduledNotificationAsync) return;
  try {
    await Promise.all([
      N.cancelScheduledNotificationAsync(ID_STREAK),
      N.cancelScheduledNotificationAsync(ID_DUE),
      N.cancelScheduledNotificationAsync(ID_FRESH),
    ]);
  } catch {
    /* swallow */
  }
}
