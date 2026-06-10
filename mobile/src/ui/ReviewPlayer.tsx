/**
 * Review Mode (audio) — Pro bottom-sheet player that reads a track's Q&A cards aloud:
 * question → PAUSE_DURATION_MS recall silence → answer → CARD_GAP_MS → next card.
 *
 * Built on the commute-mode plumbing: tts.speak() resolves when the utterance ends and
 * fires onDone ONLY on a natural finish — so an utterance that ends *without* onDone while
 * we still think we're playing means the OS interrupted us (phone call, Siri). We land in
 * 'paused' and never auto-resume; the user taps play. Resume restarts the CURRENT card from
 * its question (expo-speech has no mid-utterance seek).
 *
 * Background playback: setAudioModeAsync({ shouldPlayInBackground, playsInSilentMode }) +
 * the iOS "audio" UIBackgroundMode already in app.json keep TTS reading with the screen
 * locked. TRUE lock-screen media controls need an expo-audio AudioPlayer playing a real
 * source (setActiveForLockScreen) — not possible for raw TTS; deferred (see plan).
 *
 * Session state is component-local by design: it does NOT survive app restarts.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync } from 'expo-audio';

import type { SessionCard, Track } from '../lib/content';
import { haptic } from '../lib/feedback';
import { CARD_GAP_MS, PAUSE_DURATION_MS } from '../lib/reviewAudio';
import { space, useTheme } from '../lib/theme';
import { isAvailable, speak, stop as ttsStop } from '../lib/tts';
import { Btn, Row, T } from './kit';

type Phase = 'init' | 'question' | 'pause' | 'answer' | 'gap' | 'paused' | 'done';

const STATUS: Record<Phase, string> = {
  init: 'Preparing audio…',
  question: 'Reading question…',
  pause: 'Think it through…',
  answer: 'Reading answer…',
  gap: 'Next card…',
  paused: 'Paused',
  done: 'Session complete ✓',
};

const isWeb = Platform.OS === 'web';
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function ReviewPlayer({ track, cards, onClose }: { track: Track; cards: SessionCard[]; onClose: () => void }) {
  const { c, track: trackColor } = useTheme();
  const insets = useSafeAreaInsets();
  const col = trackColor(track.color);
  const voice = isAvailable();

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('init');
  // Generation counter — bumping it cancels the in-flight loop at its next checkpoint.
  const gen = useRef(0);
  const idxRef = useRef(0);
  // Race guard: playback may not start until the audio session is configured.
  const audioMode = useRef<Promise<void> | null>(null);

  const single = cards.length <= 1;

  function ensureAudioMode(): Promise<void> {
    if (isWeb) return Promise.resolve();
    if (!audioMode.current) {
      audioMode.current = setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch(() => {
        /* keep playing in-foreground even if the mode call fails */
      });
    }
    return audioMode.current;
  }

  /** Speak one utterance; returns 'ok' | 'cancelled' (we stopped it) | 'interrupted' (OS did). */
  async function utter(text: string, g: number): Promise<'ok' | 'cancelled' | 'interrupted'> {
    let natural = false;
    await speak(text, { onDone: () => (natural = true) });
    if (gen.current !== g) return 'cancelled';
    return natural ? 'ok' : 'interrupted';
  }

  async function runFrom(start: number) {
    await ensureAudioMode(); // gate on the async session init — no racing it
    const g = ++gen.current;
    let cur = start;
    while (cur < cards.length) {
      if (gen.current !== g) return;
      idxRef.current = cur;
      setIdx(cur);
      const card = cards[cur];

      setPhase('question');
      const q = await utter(card.q, g);
      if (q === 'cancelled') return;
      if (q === 'interrupted') return setPhase('paused'); // call/Siri — wait for the user

      setPhase('pause');
      await sleep(PAUSE_DURATION_MS);
      if (gen.current !== g) return;

      setPhase('answer');
      const a = await utter(card.a ?? '', g);
      if (a === 'cancelled') return;
      if (a === 'interrupted') return setPhase('paused');

      setPhase('gap');
      await sleep(CARD_GAP_MS);
      if (gen.current !== g) return;
      cur += 1;
    }
    if (gen.current === g) setPhase('done');
  }

  const play = () => {
    haptic.light();
    void runFrom(phase === 'done' ? 0 : idxRef.current);
  };
  const pause = () => {
    haptic.light();
    gen.current += 1; // cancel the loop before stop() so its onStopped reads as 'cancelled'
    ttsStop();
    setPhase('paused');
  };
  const jump = (dir: 1 | -1) => {
    if (single) return; // disabled — no error
    haptic.selection();
    gen.current += 1;
    ttsStop();
    const next = idxRef.current + dir;
    if (next >= cards.length) {
      // Skip past the last card → stop and show the complete state.
      setPhase('done');
      return;
    }
    const target = Math.max(0, next); // back on card 1 restarts card 1
    idxRef.current = target;
    setIdx(target);
    void runFrom(target);
  };

  // Auto-start on open; cancel + silence any in-flight utterance on close/unmount
  // (covers sheet close, navigating away / switching tracks, and app teardown).
  useEffect(() => {
    if (voice) void runFrom(0);
    return () => {
      gen.current += 1;
      ttsStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playing = phase === 'question' || phase === 'pause' || phase === 'answer' || phase === 'gap';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.22)', justifyContent: 'flex-end', ...(isWeb && { alignItems: 'center' }) }}
        onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: c.border,
            paddingHorizontal: space.md,
            paddingTop: 10,
            paddingBottom: insets.bottom + 18,
            gap: 12,
            ...(isWeb && { width: '100%', maxWidth: 440 }),
          }}>
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 999, backgroundColor: c.border }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 8, flex: 1 }}>
              <T size={16}>{track.icon}</T>
              <T weight="800" size={14} numberOfLines={1} style={{ flex: 1 }}>
                {track.name} · Review Mode
              </T>
            </Row>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close player">
              <T weight="800" size={13} color={c.muted}>Close</T>
            </Pressable>
          </Row>

          {!voice ? (
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 14 }}>
              <T size={30}>🔇</T>
              <T muted size={13} style={{ textAlign: 'center', lineHeight: 19 }}>
                Voice isn’t available on web — open FieldNotes on your phone to listen hands-free.
              </T>
            </View>
          ) : (
            <>
              <T weight="800" size={11.5} color={col} style={{ letterSpacing: 0.4 }}>
                CARD {idx + 1} OF {cards.length}
              </T>
              <T size={15} weight="700" numberOfLines={3} style={{ lineHeight: 21, minHeight: 42 }}>
                {cards[idx]?.q}
              </T>
              {/* Visible status so a long answer never reads as a frozen player. */}
              <T muted size={12} weight="700">{STATUS[phase]}</T>

              {phase === 'done' ? (
                <Btn label="↻ Replay track" variant="navy" onPress={play} />
              ) : (
                <Row style={{ justifyContent: 'center', gap: 26, marginTop: 2 }}>
                  <Ctl label="⏮" a11y="Previous card" disabled={single || phase === 'init'} onPress={() => jump(-1)} />
                  <Ctl
                    big
                    label={playing ? '⏸' : '▶'}
                    a11y={playing ? 'Pause' : 'Play'}
                    disabled={phase === 'init'}
                    onPress={playing ? pause : play}
                  />
                  <Ctl label="⏭" a11y="Next card" disabled={single || phase === 'init'} onPress={() => jump(1)} />
                </Row>
              )}
              <T muted size={10.5} style={{ textAlign: 'center', lineHeight: 15 }}>
                Keeps reading with the screen locked. Code &amp; interactive cards are skipped.
              </T>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Ctl({ label, a11y, onPress, disabled, big }: { label: string; a11y: string; onPress: () => void; disabled?: boolean; big?: boolean }) {
  const { c } = useTheme();
  const size = big ? 64 : 48;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: c.border,
        backgroundColor: c.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}>
      <T size={big ? 24 : 18}>{label}</T>
    </Pressable>
  );
}
