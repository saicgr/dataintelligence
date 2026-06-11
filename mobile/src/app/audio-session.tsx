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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

import { rankCompanyCards } from '../lib/companySets';
import {
  buildSessionDeck,
  dailyPoolForRole,
  type SessionCard,
} from '../lib/content';
import { haptic } from '../lib/feedback';
import { coverage, extractKeyPoints, suggestRating } from '../lib/keypoints';
import type { Rating } from '../lib/srs';
import { isProActive, useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { isAvailable, speak, stop as ttsStop } from '../lib/tts';
import { Btn, Card, H2, Row, Screen, T } from '../ui/kit';

/** Seconds the "answer out loud" prompt holds before the answer is read. */
const ANSWER_PAUSE_MS = 7000;
/** Voice mock gives a longer answer window — it's a real rep, not ambient review. */
const MOCK_PAUSE_MS = 12_000;
/** Hands-free grace: untouched grade screens auto-advance (pocket mode never stalls). */
const GRADE_TIMEOUT_MS = 8000;
/** Voice mock length (Pro). */
const MOCK_CARDS = 10;
/** Commute deck length — a hands-free session is "quick reps", not the 40-card Pro daily queue. */
const COMMUTE_CARDS = 15;

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
  // Voice mock (Pro): ?mode=mock — a SCORED hands-free round. Optional ?company=key
  // shapes the pool to that company pack. Keyed so switching modes remounts cleanly.
  const { mode, company } = useLocalSearchParams<{ mode?: string; company?: string }>();
  const mockMode = mode === 'mock';
  return <AudioInner key={`${mockMode}-${company ?? ''}`} mockMode={mockMode} company={company} />;
}

function AudioInner({ mockMode, company }: { mockMode: boolean; company?: string }) {
  const router = useRouter();
  const { c } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const unlocked = useStore(isProActive);
  const soundOn = useStore((s) => s.sound);
  const markVoiceTried = useStore((s) => s.markVoiceTried);
  const startWeakspot = useStore((s) => s.startWeakspot);
  useEffect(() => {
    if (mockMode && !unlocked) router.replace('/paywall');
  }, [mockMode, unlocked, router]);
  // Opening voice recall at all earns the 🎙 badge.
  useEffect(() => {
    markVoiceTried();
  }, [markVoiceTried]);

  // Build a private copy of today's deck (does not touch sessionDeck/idx).
  const deckRef = useRef<SessionCard[]>([]);
  if (deckRef.current.length === 0) {
    const now = Date.now();
    if (mockMode) {
      // Mock pool: gradable-by-voice cards (≥2 key points so coverage scoring works),
      // from the company pack when given, else the role's daily pool.
      const pool = company
        ? rankCompanyCards(company, role, progress, now).map((r) => r.card)
        : dailyPoolForRole(role, now);
      deckRef.current = pool.filter((cd) => extractKeyPoints(cd, 5).length >= 2).slice(0, MOCK_CARDS);
    } else {
      deckRef.current = buildSessionDeck(dailyPoolForRole(role, now), progress, now, COMMUTE_CARDS);
    }
  }
  const deck = deckRef.current;
  // Mock scoring: ≥ 'good' (self-graded off the key-point ticks) counts as correct.
  const mockResults = useRef<{ id: string; ok: boolean }[]>([]);

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

  // Stop any speech + clear timers + release the mic on unmount.
  useEffect(() => {
    return () => {
      cancelled.current = true;
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      if (gradeTimer.current) clearTimeout(gradeTimer.current);
      ttsStop();
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      pauseTimer.current = setTimeout(resolve, ms);
    });

  // ── Web Speech API auto-scoring (mock mode, browsers only — no native dep) ──────────
  // While you answer aloud, the transcript pre-ticks the key points via coverage();
  // you can still correct the ticks before grading. Mic denied / unsupported → manual ticks.
  const recRef = useRef<{ stop: () => void } | null>(null);
  const transcriptRef = useRef('');
  const startListening = () => {
    if (Platform.OS !== 'web' || !mockMode) return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR() as {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        start: () => void;
        stop: () => void;
      };
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.onresult = (e) => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) t += `${e.results[i][0].transcript} `;
        transcriptRef.current = t;
      };
      rec.start();
      recRef.current = rec;
    } catch {
      /* mic unavailable — self-grade fallback */
    }
  };
  const stopListening = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
  };

  const advance = useCallback(
    (from: number) => {
      const next = from + 1;
      if (next >= deck.length) {
        setPhase('done');
        if (mockMode) {
          const ok = mockResults.current.filter((r) => r.ok).length;
          void speak(`Mock complete. ${ok} of ${deck.length}. ${ok >= deck.length * 0.8 ? 'Strong round.' : 'Drill the misses next.'}`);
        } else {
          void speak('Session complete. Nice work.');
        }
        haptic.success();
        return;
      }
      haptic.light();
      setIdx(next);
      void runCard(next);
    },
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    [deck, mockMode]
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
      transcriptRef.current = '';
      startListening(); // web mock: capture the spoken answer for auto-scoring
      await wait(mockMode ? MOCK_PAUSE_MS : ANSWER_PAUSE_MS);
      stopListening();
      if (cancelled.current || pausedRef.current) return;

      setPhase('answer');
      await speak(a);
      if (cancelled.current || pausedRef.current) return;

      // The "did I nail it?" payoff (#16): tick the key points you covered, grade lands in SRS.
      const pts = extractKeyPoints(cd, 5);
      if (pts.length >= 2) {
        setPoints(pts);
        // Pre-tick from the spoken transcript when we have one (web mock); still correctable.
        setTicks(transcriptRef.current.trim() ? coverage(transcriptRef.current, pts) : pts.map(() => false));
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
    if (mockMode && card) mockResults.current.push({ id: card.id, ok: r === 'good' || r === 'easy' });
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
      stopListening();
      ttsStop();
      haptic.medium();
    }
  };

  const skip = () => {
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    holdGrade();
    stopListening();
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
        <H2>{mockMode ? '⏱ Voice mock' : '🎧 Commute mode'}</H2>
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
            {mockMode && phase === 'done' && (
              <T weight="900" size={30} color={mockResults.current.filter((r) => r.ok).length >= deck.length * 0.8 ? c.success : c.warn}>
                {mockResults.current.filter((r) => r.ok).length}/{deck.length}
              </T>
            )}
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
            <View style={{ gap: 10 }}>
              <Btn
                label={mockMode ? `▶  Start voice mock · ${deck.length} questions` : '▶  Start hands-free'}
                variant="primary"
                onPress={start}
                style={{ paddingVertical: 22 }}
              />
              {!mockMode && (
                <Btn
                  label={unlocked ? '⏱  Voice mock — scored round →' : '⏱  Voice mock — scored round (Pro) →'}
                  variant="ghost"
                  onPress={() => router.replace(unlocked ? ('/audio-session?mode=mock' as Parameters<typeof router.replace>[0]) : '/paywall')}
                />
              )}
            </View>
          ) : phase === 'done' ? (
            <Row style={{ gap: 10 }}>
              {mockMode && mockResults.current.some((r) => !r.ok) ? (
                <Btn
                  label="🎯 Drill misses"
                  variant="navy"
                  onPress={() => {
                    // Misses were already rated 'again' → they lead the weak-spot deck.
                    startWeakspot();
                    router.replace('/');
                  }}
                  style={{ flex: 1, paddingVertical: 20 }}
                />
              ) : (
                <Btn
                  label="Replay"
                  variant="neutral"
                  onPress={() => {
                    mockResults.current = [];
                    setIdx(0);
                    setPhase('idle');
                  }}
                  style={{ flex: 1, paddingVertical: 20 }}
                />
              )}
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
