/**
 * In-app store review prompt (plan GAP 7). Ask for a rating only at a HIGH moment (a passed mock,
 * a milestone streak) and only rarely — Apple/Google throttle the native dialog anyway, but we add
 * our own guard so we never nag: at most once per 60 days and a hard cap of 3 lifetime asks.
 *
 * Fully guarded: no-ops on web, when the module/dialog is unavailable, or when throttled. A review
 * prompt must never block or crash the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY_LAST = 'fieldnotes-review-last';
const KEY_COUNT = 'fieldnotes-review-count';
const MIN_GAP_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const MAX_ASKS = 3;

/**
 * Maybe show the native review dialog. Call at a celebratory moment (mock pass, streak milestone).
 * Returns true if the prompt was actually requested. Throttled + capped + crash-proof.
 */
export async function maybeRequestReview(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const [lastRaw, countRaw] = await Promise.all([
      AsyncStorage.getItem(KEY_LAST),
      AsyncStorage.getItem(KEY_COUNT),
    ]);
    const last = lastRaw ? Number(lastRaw) : 0;
    const count = countRaw ? Number(countRaw) : 0;
    const now = Date.now();
    if (count >= MAX_ASKS) return false;
    if (last && now - last < MIN_GAP_MS) return false;

    const StoreReview = await import('expo-store-review');
    const available = (await StoreReview.isAvailableAsync?.()) ?? false;
    if (!available) return false;

    await StoreReview.requestReview();
    await Promise.all([
      AsyncStorage.setItem(KEY_LAST, String(now)),
      AsyncStorage.setItem(KEY_COUNT, String(count + 1)),
    ]);
    return true;
  } catch {
    return false;
  }
}
