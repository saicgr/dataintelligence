/**
 * Live weekly contest — a synchronous, ranked timed round (the event the async leagues lack).
 *
 * Each ISO week is one contest (see contests.ts / migration 0007). You play a timed rapid-fire
 * round (reusing mock.ts deck + scoring), submit your BEST score, and land on this week's ranked
 * board. The countdown is days-left-in-week; when it rolls over the board finalizes and a new
 * contest opens. Self-contained: reads role/progress + userId from the store, routes via expo-router.
 */
import { useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { type Leaderboard } from '../lib/leagues';
import { daysLeftInWeek, fetchContestBoard, submitContestScore } from '../lib/contests';
import { scheduleContestReminder } from '../lib/notifications';
import { buildMockDeck, correctIndex, type MockAnswer, MOCK_SECONDS_PER_Q, scoreMock } from '../lib/mock';
import { haptic, sfx } from '../lib/feedback';
import { useStore } from '../lib/store';
import { radius, useTheme } from '../lib/theme';
import { CardEnter, Confetti, CountUp, Pop, PressableScale, Shake } from '../ui/anim';
import { Btn, Card, H2, Row, Screen, T, TrackBadge } from '../ui/kit';
import { LeagueBoard } from '../ui/LeagueBoard';

type Phase = 'intro' | 'playing' | 'done';

export default function Contest() {
  const router = useRouter();
  const { c, track } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const userId = useStore((s) => s.userId);

  const [round, setRound] = useState(0);
  // `round` is a deliberate cache-bust so replay rebuilds the deck (mirrors mock.tsx).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deck = useMemo(() => buildMockDeck(role, progress), [role, progress, round]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<MockAnswer[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MOCK_SECONDS_PER_Q);
  const [shake, setShake] = useState(0);
  const [board, setBoard] = useState<Leaderboard | null>(null);

  const daysLeft = daysLeftInWeek();
  const card = deck[idx];
  const myBest = board?.me?.xp ?? 0;

  const loadBoard = useCallback(
    (myScore: number) => {
      void fetchContestBoard(userId, myScore).then(setBoard);
    },
    [userId]
  );

  // Show the current standings / personal best on the intro, and arm a "closes soon" nudge.
  useEffect(() => {
    loadBoard(0);
    void scheduleContestReminder(daysLeft);
  }, [loadBoard, daysLeft]);

  const commit = useCallback(
    (choice: number | null) => {
      const cur = deck[idx];
      if (!cur) return;
      const ok = choice != null && choice === correctIndex(cur);
      setAnswers((a) => [...a, { id: cur.id, choice, correct: ok }]);
      setPicked(null);
      if (idx + 1 >= deck.length) {
        setPhase('done');
      } else {
        setIdx((i) => i + 1);
        setSecondsLeft(MOCK_SECONDS_PER_Q);
      }
    },
    [deck, idx]
  );

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          haptic.error();
          commit(null);
          return MOCK_SECONDS_PER_Q;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, idx, commit]);

  const onPick = (i: number) => {
    if (picked != null) return;
    setPicked(i);
    const ok = i === correctIndex(card);
    if (ok) {
      haptic.success();
      sfx.correct?.();
    } else {
      haptic.error();
      setShake((n) => n + 1);
    }
    setTimeout(() => commit(i), 240);
  };

  // ── INTRO ───────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <Screen>
        <Pressable onPress={() => safeBack(router)}>
          <T muted weight="700" size={13}>‹ Close</T>
        </Pressable>
        <CardEnter>
          <Card style={{ alignItems: 'center', padding: 26, gap: 8 }}>
            <T size={46}>⚡</T>
            <T size={22} weight="900">Weekly contest</T>
            <T muted size={13} style={{ textAlign: 'center', lineHeight: 20 }}>
              {deck.length > 0
                ? `One ranked timed round against everyone this week. ${deck.length} questions, ${MOCK_SECONDS_PER_Q}s each — your best score counts. Board resets when the week rolls over.`
                : 'One ranked timed round against everyone this week — your best score counts. Board resets when the week rolls over.'}
            </T>
            <Row style={{ marginTop: 6, gap: 8 }}>
              <Stat label="Closes in" value={`${daysLeft}d`} color={track('spark')} />
              <Stat label="Your best" value={myBest ? `${myBest}%` : '—'} color={c.accentInk} />
              <Stat label="Per Q" value={`${MOCK_SECONDS_PER_Q}s`} color={track('sql')} />
            </Row>
          </Card>
        </CardEnter>

        {deck.length === 0 ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <T muted size={13} style={{ textAlign: 'center', lineHeight: 19 }}>
              Your current role has no quiz-ready (multiple-choice) questions, so there&apos;s nothing to
              enter this round with yet. Drill your role&apos;s topics instead — they count toward your streak.
            </T>
            {/* Never dead-end: hand the user the path the copy describes (mirrors mock.tsx). */}
            <Btn label="Drill topics →" variant="navy" onPress={() => router.replace('/(tabs)/practice')} />
          </Card>
        ) : (
          <Btn
            label={myBest ? 'Beat your score ▶' : 'Enter the contest ▶'}
            variant="navy"
            onPress={() => {
              setRound((r) => r + 1);
              setIdx(0);
              setAnswers([]);
              setPicked(null);
              setSecondsLeft(MOCK_SECONDS_PER_Q);
              setPhase('playing');
            }}
          />
        )}

        {board && (
          <>
            <H2>This week&apos;s board</H2>
            <Card>
              <LeagueBoard board={board} />
            </Card>
            {!board.live && (
              <T muted size={11} style={{ textAlign: 'center', lineHeight: 16 }}>
                Showing a sample board. Sign in &amp; configure sync to compete live.
              </T>
            )}
          </>
        )}
      </Screen>
    );
  }

  // ── DONE ────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <DoneScreen
        answers={answers}
        userId={userId}
        board={board}
        onSubmitted={loadBoard}
        onReplay={() => {
          setRound((r) => r + 1);
          setIdx(0);
          setAnswers([]);
          setPicked(null);
          setSecondsLeft(MOCK_SECONDS_PER_Q);
          setPhase('intro');
        }}
        onExit={() => safeBack(router)}
      />
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  const low = secondsLeft <= 5;
  return (
    <Screen scroll={false}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T muted weight="800" size={12.5}>Q{idx + 1} / {deck.length}</T>
        <Pop trigger={secondsLeft}>
          <View style={{ backgroundColor: low ? c.danger : c.navy, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 13 }}>
            <T weight="900" size={14} color="#fff">{secondsLeft}s</T>
          </View>
        </Pop>
      </Row>

      <Row style={{ gap: 4 }}>
        {deck.map((_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: i < idx ? c.success : i === idx ? track('spark') : c.border }}
          />
        ))}
      </Row>

      <Shake trigger={shake} style={{ flex: 1 }}>
        <CardEnter key={idx} style={{ flex: 1 }}>
          <Card style={{ flex: 1, gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <TrackBadge label={card.tool} color={track(card.tk)} />
              <T muted weight="800" size={11}>{card.tag}</T>
            </Row>
            <T weight="800" size={16} style={{ lineHeight: 23 }}>{card.q}</T>
            <View style={{ gap: 9, marginTop: 2 }}>
              {(card.opts ?? []).map((o, i) => {
                const chosen = picked === i;
                return (
                  <PressableScale key={i} hapticStyle="none" disabled={picked != null} onPress={() => onPick(i)}>
                    <View
                      style={{
                        borderWidth: 2,
                        borderColor: chosen ? track('spark') : c.border,
                        backgroundColor: chosen ? track('spark') : c.card,
                        borderRadius: radius.md,
                        padding: 14,
                      }}>
                      <T weight="700" size={14} color={chosen ? '#fff' : c.fg} style={{ lineHeight: 20 }}>{o.t}</T>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </Card>
        </CardEnter>
      </Shake>

      <T muted size={11} style={{ textAlign: 'center' }}>No reveal — your score posts to the board at the end.</T>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 14 }}>
      <T weight="900" size={17} color={color}>{value}</T>
      <T muted size={10.5} weight="800" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</T>
    </View>
  );
}

function DoneScreen({
  answers,
  userId,
  board,
  onSubmitted,
  onReplay,
  onExit,
}: {
  answers: MockAnswer[];
  userId: string | null;
  board: Leaderboard | null;
  onSubmitted: (score: number) => void;
  onReplay: () => void;
  onExit: () => void;
}) {
  const { c } = useTheme();
  const result = scoreMock(answers);
  const pctN = Math.round(result.pct * 100);
  const ringColor = result.passed ? c.success : pctN >= 50 ? c.warn : c.danger;

  // Submit once on mount, then refresh the board with the new score.
  useEffect(() => {
    haptic[result.passed ? 'success' : 'light']?.();
    void submitContestScore(userId, pctN).then(() => onSubmitted(pctN));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      {result.passed && <Confetti />}
      <CardEnter>
        <Card style={{ alignItems: 'center', padding: 26, gap: 6 }}>
          <T size={46}>{result.passed ? '🏆' : pctN >= 50 ? '💪' : '📋'}</T>
          <T size={22} weight="900">{result.passed ? 'Posted a strong score' : 'Score posted'}</T>
          <Row style={{ alignItems: 'baseline', gap: 2, marginTop: 4 }}>
            <CountUp to={pctN} style={{ color: ringColor, fontWeight: '900', fontSize: 52 }} />
            <T weight="900" size={26} color={ringColor}>%</T>
          </Row>
          <T muted size={13} weight="700">{result.correct} of {result.total} correct</T>
        </Card>
      </CardEnter>

      {board && (
        <>
          <H2>This week&apos;s board</H2>
          <Card>
            <LeagueBoard board={board} />
          </Card>
        </>
      )}

      <Row style={{ gap: 10, marginTop: 6 }}>
        <Btn label="Try again" variant="neutral" onPress={onReplay} style={{ flex: 1 }} />
        <Btn label="Done" variant="green" onPress={onExit} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
