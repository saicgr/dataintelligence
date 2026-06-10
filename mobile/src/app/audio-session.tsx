// Hands-free / Commute mode — reads the daily role deck aloud, gives you a pause to
// answer out loud, then reveals + reads the answer and auto-advances. Built for
// screen-off / pocket use: huge tap targets, an audio mode that keeps playing while
// backgrounded, and a fully voice-driven loop you never have to look at.
//
// Expo APIs verified against SDK 56 docs:
//   expo-audio  → setAudioModeAsync({ playsInSilentMode, shouldPlayInBackground, interruptionMode })
//                 https://docs.expo.dev/versions/v56.0.0/sdk/audio/
//   expo-speech → wrapped in ../lib/tts (speak/stop/isAvailable)
//                 https://docs.expo.dev/versions/v56.0.0/sdk/speech/
//
// Owns no store state: it builds its own copy of the daily deck from role + progress
// so it can't desync the live SessionView. See INTEGRATION NOTES for wiring.
import { setAudioModeAsync } from 'expo-audio';
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import {
  buildSessionDeck,
  dailyPoolForRole,
  type SessionCard,
} from '../lib/content';
import { haptic } from '../lib/feedback';
import { extractKeyPoints, suggestRating } from '../lib/keypoints';
import type { Rating } from '../lib/srs';
import { isProActive, useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { isAvailable, speak, stop as ttsStop } from '../lib/tts';
import { Btn, Card, H2, Row, Screen, T } from '../ui/kit';

/** Seconds the "answer out loud" prompt holds before the answer is read. */
const ANSWER_PAUSE_MS = 7000;
/** Hands-free grace: untouched grade screens auto-advance (pocket mode never stalls). */
const GRADE_TIMEOUT_MS = 8000;

type Phase = 'idle' | 'question' | 'thinking' | 'answer' | 'grade' | 'done';

/** Render any card kind down to a plain question + answer string for speech. */
function speakable(card: SessionCard): { q: string; a: string } {
  // Strip trailing punctuation off the framing before joining — authored framings often end
  // with "." already, which produced "…end to end.. Explain why…" on screen and in speech.
  const q = card.framing ? `${card.framing.replace(/[.!?\s]+$/, '')}. ${card.q}` : card.q;
  let a = card.a ?? '';
  if (!a && card.opts?.length) {
    const correct = card.opts.find((o) => o.ok);
    a = correct ? correct.t : card.opts.map((o) => o.t).join('. ');
  }
  if (!a && card.rubric?.length) a = card.rubric.join('. ');
  if (card.fs) a = a ? `${a} Senior tell: ${card.fs}` : `Senior tell: ${card.fs}`;
  return { q, a: a || 'No spoken answer for this card — open it in the app.' };
}

export default function AudioSession() {
  const router = useRouter();
  const { c } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const unlocked = useStore(isProActive);
  const soundOn = useStore((s) => s.sound);
  const markVoiceTried = useStore((s) => s.markVoiceTried);
  // Opening voice recall at all earns the 🎙 badge.
  useEffect(() => {
    markVoiceTried();
  }, [markVoiceTried]);

  // Build a private copy of today's deck (does not touch sessionDeck/idx).
  const deckRef = useRef<SessionCard[]>([]);
  if (deckRef.current.length === 0) {
    const now = Date.now();
    deckRef.current = buildSessionDeck(
      dailyPoolForRole(role, now),
      progress,
      now,
      unlocked ? 40 : 15
    );
  }
  const deck = deckRef.current;

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [paused, setPaused] = useState(false);
  // Grade phase (#16): which key points the user says they covered.
  const [ticks, setTicks] = useState<boolean[]>([]);
  const [points, setPoints] = useState<string[]>([]);
  const rateById = useStore((s) => s.rateById);
  const pausedRef = useRef(false);
  const cancelled = useRef(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const available = isAvailable();
  const card = deck[idx];

  // Configure the audio session once: keep speaking in silent mode + while backgrounded
  // (screen-off intent), and mix politely with podcasts/music the commuter may have on.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  // Stop any speech + clear timers on unmount.
  useEffect(() => {
    return () => {
      cancelled.current = true;
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      if (gradeTimer.current) clearTimeout(gradeTimer.current);
      ttsStop();
    };
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      pauseTimer.current = setTimeout(resolve, ms);
    });

  const advance = useCallback(
    (from: number) => {
      const next = from + 1;
      if (next >= deck.length) {
        setPhase('done');
        void speak('Session complete. Nice work.');
        haptic.success();
        return;
      }
      haptic.light();
      setIdx(next);
      void runCard(next);
    },
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    [deck]
  );

  // Drive one card through question → think-pause → answer → self-grade, then advance.
  const runCard = useCallback(
    async (i: number) => {
      const cd = deck[i];
      if (!cd || cancelled.current) return;
      const { q, a } = speakable(cd);

      setPhase('question');
      await speak(`Question ${i + 1} of ${deck.length}. ${q}`);
      if (cancelled.current || pausedRef.current) return;

      setPhase('thinking');
      await speak('Answer out loud.');
      if (cancelled.current || pausedRef.current) return;
      await wait(ANSWER_PAUSE_MS);
      if (cancelled.current || pausedRef.current) return;

      setPhase('answer');
      await speak(a);
      if (cancelled.current || pausedRef.current) return;

      // The "did I nail it?" payoff (#16): tick the key points you covered, grade lands in SRS.
      const pts = extractKeyPoints(cd, 5);
      if (pts.length >= 2) {
        setPoints(pts);
        setTicks(pts.map(() => false));
        setPhase('grade');
        void speak('Which key points did you cover? Tap them, then grade yourself.');
        // Pure hands-free flow never stalls: untouched grade screens advance unrated.
        gradeTimer.current = setTimeout(() => advance(i), GRADE_TIMEOUT_MS);
        return;
      }
      advance(i);
    },
    [deck, advance]
  );

  /** Any grade-screen touch cancels the hands-free auto-advance. */
  const holdGrade = () => {
    if (gradeTimer.current) {
      clearTimeout(gradeTimer.current);
      gradeTimer.current = null;
    }
  };

  const finishGrade = (r: Rating | null) => {
    holdGrade();
    if (r && card) rateById(card.id, r);
    if (r) haptic.success();
    advance(idx);
  };

  const start = () => {
    cancelled.current = false;
    pausedRef.current = false;
    setPaused(false);
    void runCard(idx);
  };

  const togglePause = () => {
    if (paused) {
      // Resume: re-read the current card from the top of its phase.
      pausedRef.current = false;
      setPaused(false);
      haptic.light();
      void runCard(idx);
    } else {
      pausedRef.current = true;
      setPaused(true);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      ttsStop();
      haptic.medium();
    }
  };

  const skip = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    holdGrade();
    ttsStop();
    haptic.light();
    const next = idx + 1;
    if (next >= deck.length) {
      setPhase('done');
      return;
    }
    pausedRef.current = false;
    setPaused(false);
    setIdx(next);
    void runCard(next);
  };

  const exit = () => {
    cancelled.current = true;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    ttsStop();
    safeBack(router);
  };

  const phaseLabel: Record<Phase, string> = {
    idle: 'Tap start, then pocket your phone',
    question: 'Listen to the question',
    thinking: 'Answer out loud',
    answer: 'Here is a strong answer',
    grade: 'Did you nail it? Tap what you covered',
    done: 'All done',
  };

  const covered = ticks.filter(Boolean).length;
  const suggested = points.length ? suggestRating(covered / points.length) : null;

  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2>🎧 Commute mode</H2>
        <Btn label="Exit" variant="ghost" onPress={exit} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </Row>

      {!available && (
        <Card style={{ backgroundColor: 'transparent', borderColor: c.warn }}>
          <T weight="800" color={c.warn} size={13}>Voice unavailable here</T>
          <T muted size={12} style={{ marginTop: 4, lineHeight: 18 }}>
            Text-to-speech needs a real device (it&apos;s a no-op on web). The visual loop below still works.
          </T>
        </Card>
      )}

      {deck.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 28 }}>
          <T size={40}>📭</T>
          <T weight="800" size={16} style={{ marginTop: 8 }}>Nothing queued</T>
          <T muted size={13} style={{ marginTop: 6, textAlign: 'center' }}>
            No cards due for {role.toUpperCase()} right now. Come back after a daily session.
          </T>
        </Card>
      ) : (
        <View style={{ flex: 1, gap: space.md }}>
          {/* Big status block — readable at a glance, glanceable from a dock/mount. */}
          <Card style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
            <T muted size={13} weight="800" style={{ letterSpacing: 0.5 }}>
              {idx + 1} / {deck.length}
            </T>
            <T size={40}>{phase === 'thinking' ? '🗣️' : phase === 'answer' ? '✅' : phase === 'done' ? '🎉' : '🎧'}</T>
            <T weight="900" size={20} style={{ textAlign: 'center' }}>
              {phaseLabel[phase]}
            </T>
            {card && phase !== 'idle' && phase !== 'done' && phase !== 'grade' && (
              <T
                muted={phase === 'thinking'}
                size={15}
                style={{ textAlign: 'center', lineHeight: 22, paddingHorizontal: 6 }}>
                {phase === 'answer' ? speakable(card).a : speakable(card).q}
              </T>
            )}
            {phase === 'grade' && (
              <View style={{ alignSelf: 'stretch', gap: 9 }}>
                {points.map((p, i) => {
                  const on = ticks[i];
                  return (
                    <Btn
                      key={i}
                      label={`${on ? '☑' : '☐'}  ${p}`}
                      variant={on ? 'green' : 'neutral'}
                      onPress={() => {
                        holdGrade();
                        haptic.light();
                        setTicks((cur) => cur.map((v, j) => (j === i ? !v : v)));
                      }}
                      style={{ paddingVertical: 14 }}
                    />
                  );
                })}
                <T weight="800" size={13} style={{ textAlign: 'center' }} color={covered / Math.max(1, points.length) >= 0.6 ? c.success : c.muted}>
                  You covered {covered}/{points.length} key points
                </T>
              </View>
            )}
            {!soundOn && phase !== 'idle' && (
              <T size={11} color={c.warn}>App sound is off — voice still plays via the system.</T>
            )}
          </Card>

          {/* Controls — oversized targets, thumb-reachable, work without looking. */}
          {phase === 'idle' ? (
            <Btn
              label="▶  Start hands-free"
              variant="primary"
              onPress={start}
              style={{ paddingVertical: 22 }}
            />
          ) : phase === 'done' ? (
            <Row style={{ gap: 10 }}>
              <Btn
                label="Replay"
                variant="neutral"
                onPress={() => {
                  setIdx(0);
                  setPhase('idle');
                }}
                style={{ flex: 1, paddingVertical: 20 }}
              />
              <Btn label="Done" variant="green" onPress={exit} style={{ flex: 1, paddingVertical: 20 }} />
            </Row>
          ) : phase === 'grade' ? (
            <View style={{ gap: 10 }}>
              <Row style={{ gap: 10 }}>
                {(['again', 'good', 'easy'] as const).map((r) => (
                  <Btn
                    key={r}
                    label={`${r === 'again' ? '🔁 Again' : r === 'good' ? '✅ Good' : '⚡ Easy'}${suggested === r ? ' ←' : ''}`}
                    variant={r === 'again' ? 'neutral' : r === 'good' ? 'green' : 'navy'}
                    onPress={() => finishGrade(r)}
                    style={{ flex: 1, paddingVertical: 20, borderRadius: radius.lg, ...(suggested === r && { borderWidth: 3, borderColor: c.fg }) }}
                  />
                ))}
              </Row>
              <Btn label="Skip grading →" variant="ghost" onPress={() => finishGrade(null)} />
            </View>
          ) : (
            <Row style={{ gap: 10 }}>
              <Btn
                label={paused ? '▶  Resume' : '⏸  Pause'}
                variant={paused ? 'green' : 'navy'}
                onPress={togglePause}
                style={{ flex: 1, paddingVertical: 24, borderRadius: radius.lg }}
              />
              <Btn
                label="⏭  Skip"
                variant="neutral"
                onPress={skip}
                style={{ flex: 1, paddingVertical: 24, borderRadius: radius.lg }}
              />
            </Row>
          )}
        </View>
      )}
    </Screen>
  );
}
