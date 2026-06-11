/**
 * Duolingo-style feedback: preloaded sound effects + haptics, gated by the user's
 * sound/haptics settings, no-op on web, and crash-proof (every call try/caught).
 *
 * Imperative on purpose — `sfx.*()` / `haptic.*()` are plain functions callable from
 * store actions, gesture worklets (via runOnJS), and view event handlers. They read the
 * latest settings via useStore.getState() so toggles take effect immediately.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- RN bundles assets via static require() */
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { useStore } from './store';

const isWeb = Platform.OS === 'web';

// require() must be static literals so the bundler includes the assets.
const SOURCES = {
  correct: require('../../assets/sfx/correct.wav'),
  wrong: require('../../assets/sfx/wrong.wav'),
  complete: require('../../assets/sfx/complete.wav'),
  streak: require('../../assets/sfx/streak.wav'),
  levelUp: require('../../assets/sfx/levelup.wav'),
  tap: require('../../assets/sfx/tap.wav'),
} as const;
type Key = keyof typeof SOURCES;

const players: Partial<Record<Key, AudioPlayer>> = {};
let ready = false;

/** Preload all players once (call from the root layout). Idempotent + async. */
export async function initFeedback(): Promise<void> {
  if (isWeb || ready) return;
  ready = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // ignore — SFX still play, just respect the silent switch
  }
  (Object.keys(SOURCES) as Key[]).forEach((k) => {
    try {
      const p = createAudioPlayer(SOURCES[k]);
      p.volume = 0.6;
      players[k] = p;
    } catch {
      // a missing/corrupt asset just disables that one sound
    }
  });
}

const soundOn = () => {
  try {
    return useStore.getState().sound;
  } catch {
    return true;
  }
};
const hapticsOn = () => {
  try {
    return useStore.getState().haptics;
  } catch {
    return true;
  }
};

function fire(k: Key) {
  if (isWeb || !soundOn()) return;
  const p = players[k];
  if (!p) return;
  try {
    p.seekTo(0); // restart short SFX even if it just played
    p.play();
  } catch {
    // ignore playback errors
  }
}

export const sfx = {
  correct: () => fire('correct'),
  wrong: () => fire('wrong'),
  complete: () => fire('complete'),
  streak: () => fire('streak'),
  levelUp: () => fire('levelUp'),
  tap: () => fire('tap'),
};

function buzz(fn: () => Promise<void>) {
  if (isWeb || !hapticsOn()) return;
  fn().catch(() => {});
}

export const haptic = {
  success: () => buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  light: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  selection: () => buzz(() => Haptics.selectionAsync()),
};

/** Convenience: the right sound+haptic for a correct/incorrect answer. */
export function answerFeedback(ok: boolean): void {
  if (ok) {
    sfx.correct();
    haptic.success();
  } else {
    sfx.wrong();
    haptic.error();
  }
}
