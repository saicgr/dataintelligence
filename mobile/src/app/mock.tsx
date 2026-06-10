/**
 * Mock interview round — a self-serve, fully automated timed rapid-fire quiz.
 *
 * No human, no peeking, no reveal-after-answer: a visible countdown clock ticks per question,
 * you lock in one answer (or the clock runs out = miss), and we advance immediately. At the end
 * you get a score, the list of missed cards, and a "Drill these" button into the weak-spot drill.
 *
 * Self-contained: reads role/progress from the store for deck building and routes via expo-router,
 * but does NOT touch SessionView internals or the daily SRS schedule. Score persistence is best-effort
 * through an optional `recordMock` store action (see INTEGRATION NOTES) — absence is a graceful no-op.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../lib/nav';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  buildMockDeck,
  correctIndex,
  type MockAnswer,
  MOCK_SECONDS_PER_Q,
  scoreMock,
} from '../lib/mock';
import { COMPANY_SETS, rankCompanyCards } from '../lib/companySets';
import { type SessionCard } from '../lib/content';
import { haptic, sfx } from '../lib/feedback';
import { useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { CardEnter, Confetti, CountUp, Pop, PressableScale, Shake } from '../ui/anim';
import { Btn, Card, H2, Row, Screen, T, TrackBadge } from '../ui/kit';

type Phase = 'intro' | 'playing' | 'done';

export default function MockInterview() {
  const router = useRouter();
  const { c, track } = useTheme();
  const role = useStore((s) => s.role);
  const progress = useStore((s) => s.progress);
  const startWeakspot = useStore((s) => s.startWeakspot);
  // Optional persistence hook — present once store.recordMock is wired (see INTEGRATION NOTES).
  const recordMock = useStore((s) => (s as { recordMock?: (score: number, missed: string[]) => void }).recordMock);

  // Company-shaped mock (Company Packs): ?company=<key> swaps the pool for the pack's ranked cards.
  const { company } = useLocalSearchParams<{ company?: string }>();
  const companySet = company ? COMPANY_SETS[company] : undefined;

  // Deck is frozen for the lifetime of one round (rebuilt only on replay).
  const [round, setRound] = useState(0);
  const deck = useMemo(
    () =>
      buildMockDeck(
        role,
        progress,
        Date.now(),
        companySet && company ? rankCompanyCards(company, role, progress).map((r) => r.card) : undefined
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [role, progress, round, company]
  );

  const [phase, setPhase] = useState<Phase>('intro');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<MockAnswer[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MOCK_SECONDS_PER_Q);
  const [shake, setShake] = useState(0);

  const card = deck[idx];

  // ── advance to the next card (or finish) ──────────────────────────────────
  const commit = useCallback(
    (choice: number | null) => {
      const cur = deck[idx];
      if (!cur) return;
      const ok = choice != null && choice === correctIndex(cur);
      const next = [...answers, { id: cur.id, choice, correct: ok }];
      setAnswers(next);
      setPicked(null);
      if (idx + 1 >= deck.length) {
        setPhase('done');
      } else {
        setIdx((i) => i + 1);
        setSecondsLeft(MOCK_SECONDS_PER_Q);
      }
    },
    [answers, deck, idx]
  );

  // ── per-question countdown clock ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          // time's up → record a miss and move on (no reveal).
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
    if (picked != null) return; // one lock-in per question, no changing
    setPicked(i);
    const ok = i === correctIndex(card);
    if (ok) {
      haptic.success();
      sfx.correct?.();
    } else {
      haptic.error();
      setShake((n) => n + 1);
    }
    // Brief beat so the tap registers visually, then advance (still no answer reveal).
    setTimeout(() => commit(i), 260);
  };

  // ── INTRO ─────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <Screen>
        <Pressable onPress={() => safeBack(router)}>
          <T muted weight="700" size={13}>‹ Close</T>
        </Pressable>
        <CardEnter>
          <Card style={{ alignItems: 'center', padding: 26, gap: 8 }}>
            <T size={46}>{companySet ? companySet.emoji : '⏱️'}</T>
            <T size={22} weight="900">{companySet ? `${companySet.label} mock` : 'Mock interview'}</T>
            <T muted size={13} style={{ textAlign: 'center', lineHeight: 20 }}>
              {deck.length} rapid-fire questions. {MOCK_SECONDS_PER_Q}s each, on the clock — no peeking,
              no second guesses. Lock in your answer and move. We score you at the end and hand you the
              ones you missed.
            </T>
            <Row style={{ marginTop: 6, gap: 8 }}>
              <Stat label="Questions" value={String(deck.length)} color={track('spark')} />
              <Stat label="Per Q" value={`${MOCK_SECONDS_PER_Q}s`} color={track('sql')} />
              <Stat label="To pass" value="80%" color={c.success} />
            </Row>
          </Card>
        </CardEnter>
        {deck.length === 0 ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <T muted size={13} style={{ textAlign: 'center' }}>
              No quiz-ready questions for this role yet. Drill a few topics first, then come back.
            </T>
            {/* Never dead-end: hand the user the path the copy describes. */}
            <Btn label="Drill topics →" variant="navy" onPress={() => router.replace('/(tabs)/practice')} />
          </Card>
        ) : (
          <Btn
            label="Start the clock ▶"
            variant="navy"
            onPress={() => {
              setPhase('playing');
              setSecondsLeft(MOCK_SECONDS_PER_Q);
            }}
          />
        )}
      </Screen>
    );
  }

  // ── DONE ────────────────────────────────────────────────────────────────--
  if (phase === 'done') {
    const result = scoreMock(answers);
    const missed = result.missedIds
      .map((id) => deck.find((d) => d.id === id))
      .filter((d): d is SessionCard => !!d);
    // Best-effort persistence; no-op until store.recordMock exists.
    return (
      <DoneScreen
        pct={result.pct}
        correct={result.correct}
        total={result.total}
        passed={result.passed}
        missed={missed}
        onPersist={() => recordMock?.(Math.round(result.pct * 100), result.missedIds)}
        onReplay={() => {
          setRound((r) => r + 1);
          setIdx(0);
          setAnswers([]);
          setPicked(null);
          setSecondsLeft(MOCK_SECONDS_PER_Q);
          setPhase('intro');
        }}
        onDrill={() => {
          startWeakspot();
          router.replace('/');
        }}
        onExit={() => safeBack(router)}
      />
    );
  }

  // ── PLAYING ─────────────────────────────────────────────────────────────--
  const low = secondsLeft <= 5;
  return (
    <Screen scroll={false}>
      {/* Progress + clock header */}
      <Row style={{ justifyContent: 'space-between' }}>
        <T muted weight="800" size={12.5}>
          Q{idx + 1} / {deck.length}
        </T>
        <Pop trigger={secondsLeft}>
          <View
            style={{
              backgroundColor: low ? c.danger : c.navy,
              borderRadius: 999,
              paddingVertical: 5,
              paddingHorizontal: 13,
            }}>
            <T weight="900" size={14} color="#fff">
              {secondsLeft}s
            </T>
          </View>
        </Pop>
      </Row>

      {/* Segmented progress bar */}
      <Row style={{ gap: 4 }}>
        {deck.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              backgroundColor: i < idx ? c.success : i === idx ? track('spark') : c.border,
            }}
          />
        ))}
      </Row>

      <Shake trigger={shake} style={{ flex: 1 }}>
        <CardEnter key={idx} style={{ flex: 1 }}>
          <Card style={{ flex: 1, gap: 12 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <TrackBadge label={card.tool} color={track(card.tk)} />
              <T muted weight="800" size={11}>
                {card.tag}
              </T>
            </Row>
            <T weight="800" size={16} style={{ lineHeight: 23 }}>
              {card.q}
            </T>

            <View style={{ gap: 9, marginTop: 2 }}>
              {(card.opts ?? []).map((o, i) => {
                const chosen = picked === i;
                return (
                  <PressableScale
                    key={i}
                    hapticStyle="none"
                    disabled={picked != null}
                    onPress={() => onPick(i)}>
                    <View
                      style={{
                        borderWidth: 2,
                        borderColor: chosen ? track('spark') : c.border,
                        backgroundColor: chosen ? track('spark') : c.card,
                        borderRadius: radius.md,
                        padding: 14,
                      }}>
                      <T weight="700" size={14} color={chosen ? '#fff' : c.fg} style={{ lineHeight: 20 }}>
                        {o.t}
                      </T>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          </Card>
        </CardEnter>
      </Shake>

      <T muted size={11} style={{ textAlign: 'center' }}>
        No reveal — you&apos;ll see what you missed at the end.
      </T>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: c.surface,
        borderRadius: radius.md,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }}>
      <T weight="900" size={17} color={color}>
        {value}
      </T>
      <T muted size={10.5} weight="800" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </T>
    </View>
  );
}

function DoneScreen({
  pct,
  correct,
  total,
  passed,
  missed,
  onPersist,
  onReplay,
  onDrill,
  onExit,
}: {
  pct: number;
  correct: number;
  total: number;
  passed: boolean;
  missed: SessionCard[];
  onPersist: () => void;
  onReplay: () => void;
  onDrill: () => void;
  onExit: () => void;
}) {
  const { c, track } = useTheme();
  // Persist once, on mount of the summary.
  useEffect(() => {
    onPersist();
    haptic[passed ? 'success' : 'light']?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pctN = Math.round(pct * 100);
  const ringColor = passed ? c.success : pctN >= 50 ? c.warn : c.danger;

  return (
    <Screen>
      {passed && <Confetti />}
      <CardEnter>
        <Card style={{ alignItems: 'center', padding: 26, gap: 6 }}>
          <T size={46}>{passed ? '🏆' : pctN >= 50 ? '💪' : '📋'}</T>
          <T size={22} weight="900">
            {passed ? 'Strong round' : pctN >= 50 ? 'Getting there' : 'Worth a redo'}
          </T>
          <Row style={{ alignItems: 'baseline', gap: 2, marginTop: 4 }}>
            <CountUp to={pctN} style={{ color: ringColor, fontWeight: '900', fontSize: 52 }} />
            <T weight="900" size={26} color={ringColor}>
              %
            </T>
          </Row>
          <T muted size={13} weight="700">
            {correct} of {total} correct
          </T>
        </Card>
      </CardEnter>

      {missed.length > 0 ? (
        <>
          <H2>Missed — {missed.length}</H2>
          {missed.map((m, i) => (
            <CardEnter key={m.id} delay={i * 40}>
              <Card style={{ gap: 8, padding: 14 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <TrackBadge label={m.tool} color={track(m.tk)} />
                  <T muted weight="800" size={11}>
                    {m.tag}
                  </T>
                </Row>
                <T weight="700" size={13.5} style={{ lineHeight: 20 }}>
                  {m.q}
                </T>
                {m.opts?.some((o) => o.ok) && (
                  <View
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: c.success,
                      paddingLeft: 11,
                      marginTop: 2,
                    }}>
                    <T size={12.5} color={c.success} weight="800">
                      Answer
                    </T>
                    <T size={13} style={{ lineHeight: 19 }}>
                      {m.opts.find((o) => o.ok)?.t}
                    </T>
                  </View>
                )}
              </Card>
            </CardEnter>
          ))}
          <Btn label={`Drill these ${missed.length} weak spots ▶`} variant="navy" onPress={onDrill} />
        </>
      ) : (
        <Card style={{ padding: 16 }}>
          <T size={13} style={{ textAlign: 'center', lineHeight: 20 }}>
            Clean sweep — nothing missed. Run it back to keep the streak honest.
          </T>
        </Card>
      )}

      <Row style={{ gap: 10, marginTop: space.xs }}>
        <Btn label="Run it again" variant="neutral" onPress={onReplay} style={{ flex: 1 }} />
        <Btn label="Done" variant="green" onPress={onExit} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
