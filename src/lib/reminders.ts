/**
 * One gentle daily reminder (Duolingo-style cue — content-led, NOT guilt).
 *
 * Real scheduling needs `expo-notifications` + a dev build (it can't run in Expo Go,
 * and isn't a dependency yet), so this is a documented seam that records the user's
 * preference and no-ops safely until the package is installed. We deliberately do NOT
 * static-import expo-notifications so the bundle stays clean.
 *
 * To make it real:
 *   1) npx expo install expo-notifications
 *   2) implement scheduleDailyReminder() below with
 *      Notifications.scheduleNotificationAsync({ trigger: { hour, minute, repeats: true } })
 *      and a content hook ("Today's senior tell: …"), NOT "keep your streak alive".
 */

const DEFAULT_HOUR = 19; // 7pm local — one cue, not nagging

export async function setDailyReminder(enabled: boolean, hour: number = DEFAULT_HOUR): Promise<void> {
  // Seam: wire expo-notifications here once installed.
  if (__DEV__) {
    console.log(`[reminders] daily reminder ${enabled ? `ON @ ${hour}:00` : 'OFF'} (stub — install expo-notifications to deliver)`);
  }
}
