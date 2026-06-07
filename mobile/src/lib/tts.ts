// Text-to-speech wrapper around expo-speech (Expo SDK 56).
// API verified against https://docs.expo.dev/versions/v56.0.0/sdk/speech/
//   Speech.speak(text, { rate, pitch, language, onDone, onStopped, onError })
//   Speech.stop()  — interrupts current speech + clears the queue
//   Speech.isSpeakingAsync(): Promise<boolean>
//
// Graceful no-op on web (and anywhere the native module is unavailable) so callers
// never have to branch on platform — speak() resolves its onDone immediately there.
//
// NOTE: expo-speech is not yet a dependency. See INTEGRATION NOTES — run
//   npx expo install expo-speech
// The dynamic import below keeps this module importable (and type-correct) before
// the package is installed; until then isAvailable() returns false and speak() no-ops.
import { Platform } from 'react-native';

type SpeechModule = {
  speak: (
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      language?: string;
      voice?: string;
      onStart?: () => void;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: (e: unknown) => void;
    }
  ) => void;
  stop: () => void;
  isSpeakingAsync: () => Promise<boolean>;
};

let mod: SpeechModule | null | undefined; // undefined = not yet probed, null = unavailable

/** Lazily require expo-speech. Returns null on web or if the package isn't installed. */
function speech(): SpeechModule | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web') {
    mod = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    mod = require('expo-speech') as SpeechModule;
  } catch {
    mod = null;
  }
  return mod;
}

/** True when TTS can actually be performed on this platform/build. */
export function isAvailable(): boolean {
  return speech() != null;
}

export interface SpeakOptions {
  /** 1.0 = normal. Commute mode reads a touch slower for clarity. */
  rate?: number;
  pitch?: number;
  language?: string;
  /** Fires when the utterance finishes naturally (NOT when stop() interrupts it). */
  onDone?: () => void;
}

/**
 * Speak `text` aloud. Resolves the returned promise when the utterance ends
 * (done OR stopped OR error), so a hands-free loop can `await speak(...)` to
 * sequence question → pause → answer reliably. On web / no native module it
 * resolves on the next tick (treated as "done" instantly) so loops still advance.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  const s = speech();
  const clean = sanitize(text);
  if (!s || !clean) {
    if (opts.onDone) opts.onDone();
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (natural: boolean) => {
      if (settled) return;
      settled = true;
      if (natural && opts.onDone) opts.onDone();
      resolve();
    };
    try {
      s.speak(clean, {
        rate: opts.rate ?? 0.92,
        pitch: opts.pitch ?? 1.0,
        language: opts.language ?? 'en-US',
        onDone: () => finish(true),
        onStopped: () => finish(false),
        onError: () => finish(false),
      });
    } catch {
      finish(true);
    }
  });
}

/** Interrupt any current utterance and clear the queue. Safe to call when idle. */
export function stop(): void {
  const s = speech();
  try {
    s?.stop();
  } catch {
    /* no-op */
  }
}

/** Strip markdown/code noise so the spoken stream stays clean. */
function sanitize(text: string): string {
  return (text ?? '')
    .replace(/```[\s\S]*?```/g, ' (code block) ') // don't read code fences character-by-character
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
