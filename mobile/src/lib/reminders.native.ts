// Native daily reminder via expo-notifications. Web/default falls back to reminders.ts (no-op).
// Dynamic import (like iap.native.ts) so the bundle still builds / Expo Go still runs if the
// native module isn't linked. Needs an EAS/dev build to actually fire (not Expo Go).
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go (executionEnvironment 'storeClient') removed expo-notifications' push APIs in SDK 53,
// and merely importing the module runs an auto-registration side-effect that THROWS a red-box
// error in Expo Go. So skip the import entirely there — reminders just no-op until a dev/EAS build.
const IN_EXPO_GO = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

// Content-led teasers (a senior tell), NOT streak-guilt. Local notifications can't run JS at
// fire time, so the copy is pre-baked and rotated by day.
const TEASERS = [
  "Today's senior tell: why 'just add more consumers' fails in Kafka.",
  "Today's senior tell: a Spark OOM is usually skew, not too little RAM.",
  "Today's senior tell: RAG citing the wrong doc? Check retrieval before the model.",
  "Today's senior tell: a new model is a delta to re-eval, not a free upgrade.",
  "Today's senior tell: late-arriving rows quietly break incremental dbt models.",
  "Today's senior tell: hybrid search (BM25 + vector) beats either alone on real queries.",
  "Today's senior tell: enforce access control as a pre-filter at the index, never post-filter.",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any = null;
let triedLoad = false;
async function lib(): Promise<any> {
  if (!triedLoad) {
    triedLoad = true;
    if (IN_EXPO_GO) return mod; // never import expo-notifications in Expo Go (it throws on load)
    try {
      mod = await import('expo-notifications');
    } catch {
      mod = null;
    }
  }
  return mod;
}

const REMINDER_ID = 'fieldnotes-daily';

export async function setDailyReminder(enabled: boolean, hour = 19): Promise<void> {
  const N = await lib();
  if (!N?.scheduleNotificationAsync) return; // module missing (Expo Go without dev build) → no-op
  try {
    // cancel-first so toggling on/off never stacks duplicates
    await N.cancelAllScheduledNotificationsAsync?.();
    if (!enabled) return;

    const perm = await N.getPermissionsAsync?.();
    if (perm && perm.status !== 'granted') {
      const req = await N.requestPermissionsAsync?.();
      if (req && req.status !== 'granted') return; // denied → graceful no-op
    }

    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync?.('daily', {
        name: 'Daily senior tell',
        importance: N.AndroidImportance?.DEFAULT ?? 3,
      });
    }

    const body = TEASERS[new Date().getDate() % TEASERS.length];
    await N.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: 'ByteShards', body },
      trigger: {
        type: N.SchedulableTriggerInputTypes?.DAILY ?? 'daily',
        hour,
        minute: 0,
      },
    });
  } catch {
    /* never block the app on a notification failure */
  }
}
