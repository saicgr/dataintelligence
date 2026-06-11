import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { answerFeedback, haptic, sfx } from '../lib/feedback';
import { levelIndex } from '../lib/content';
import { coverage, extractKeyPoints, suggestRating } from '../lib/keypoints';
import { requestPermission } from '../lib/notifications';
import { buildRecallCheck } from '../lib/recallCheck';
import { dueLabel, dueWithin } from '../lib/srs';
import { isProActive, useActiveDeck, useStore } from '../lib/store';
import { radius, space, useTheme } from '../lib/theme';
import { AnimatedProgressBar, CardEnter, Confetti, CountUp, Pop } from './anim';
import { Btn, Card, Chip, Row, T, TrackBadge } from './kit';
import { Mascot } from './Mascot';
import { ResultFooter } from './ResultFooter';
import { StreakHero } from './StreakHero';
import { ClassifyView } from './ClassifyView';
import { CodeBlock } from './CodeBlock';
import { CodePanels } from './CodePanel';
import { DiagView } from './DiagView';
import { EvidenceView } from './EvidenceView';
import { MatchView } from './MatchView';
import { OrderView } from './OrderView';
import { QueryBuildView } from './QueryBuildView';
import { RichAnswer } from './RichAnswer';
import { ScenarioView } from './ScenarioView';

/** Cards between "good stopping point" checkpoints in long sessions. */
const CHECKPOINT_EVERY = 10;

export function SessionView() {
  const deck = useActiveDeck();
  const idx = useStore((s) => s.idx);
  const len = deck.length;
  // Long sessions need a sense of "almost done": every 10 cards a checkpoint offers a
  // graceful early finish (with the full summary) instead of a 40-card slog or a bare ✕.
  // Local state on purpose — the deck reference changes on every new session, which resets it.
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [skippedCp, setSkippedCp] = useState(0);
  useEffect(() => {
    setFinishedAt(null);
    setSkippedCp(0);
  }, [deck]);
  const done = finishedAt != null || idx >= len;
  const atCheckpoint =
    !done && idx > 0 && idx % CHECKPOINT_EVERY === 0 && skippedCp !== idx && len - idx > 2;

  return (
    <View style={{ gap: space.md }}>
      <Row style={{ gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ProgressBar value={len ? Math.min(finishedAt ?? idx, len) / len : 0} label={done ? 'Done' : `${idx + 1} / ${len}`} />
        </View>
        <SessionVitals />
      </Row>
      {done ? (
        <Done cardsDone={finishedAt ?? len} />
      ) : atCheckpoint ? (
        <CheckpointCard
          done={idx}
          left={len - idx}
          onFinish={() => setFinishedAt(idx)}
          onContinue={() => setSkippedCp(idx)}
        />
      ) : (
        <CardEnter key={idx}>
          <CardView />
        </CardEnter>
      )}
    </View>
  );
}

/** Mid-session breather: stop on a win (full summary) or keep rolling. */
function CheckpointCard({
  done,
  left,
  onFinish,
  onContinue,
}: {
  done: number;
  left: number;
  onFinish: () => void;
  onContinue: () => void;
}) {
  const { c } = useTheme();
  return (
    <CardEnter>
      <Card style={{ alignItems: 'center', padding: 22, gap: 6 }}>
        <T size={34}>✨</T>
        <T size={18} weight="900">{done} cards down — solid.</T>
        <T muted size={12.5} style={{ textAlign: 'center', lineHeight: 18 }}>
          {left} more in this deck. Stopping here still counts — your progress and streak are saved.
        </T>
        <View style={{ alignSelf: 'stretch', gap: 9, marginTop: 12 }}>
          <Btn
            label="Keep going ▶"
            variant="primary"
            onPress={() => {
              haptic.light();
              onContinue();
            }}
          />
          <Btn
            label="Finish with the win ✓"
            variant="ghost"
            onPress={() => {
              haptic.success();
              onFinish();
            }}
          />
        </View>
        <T muted size={10.5} style={{ marginTop: 2 }} color={c.muted}>Next checkpoint in {CHECKPOINT_EVERY} cards</T>
      </Card>
    </CardEnter>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const { c } = useTheme();
  return (
    <Row>
      <AnimatedProgressBar value={value} color={c.success} track={c.border} />
      <T muted weight="800" size={12}>
        {label}
      </T>
    </Row>
  );
}

/** Live in-session feedback (Duolingo juice): ⚡XP counts up per card, 🔥 combo grows on
 *  consecutive correct, and a miss flashes 💔 where the combo was. Feedback only — no
 *  hearts GATE: punishing "Again" would teach users to stop grading themselves honestly,
 *  which is the one behavior spaced repetition depends on. */
function SessionVitals() {
  const { c } = useTheme();
  const sessionXp = useStore((s) => s.sessionXp);
  const combo = useStore((s) => s.sessionCombo);
  const agains = useStore((s) => s.sessionAgains);
  const [broke, setBroke] = useState(false);
  const prevAgains = useRef(agains);
  useEffect(() => {
    if (agains > prevAgains.current) {
      setBroke(true);
      const t = setTimeout(() => setBroke(false), 1200);
      prevAgains.current = agains;
      return () => clearTimeout(t);
    }
    prevAgains.current = agains;
  }, [agains]);
  return (
    <Row style={{ gap: 8 }}>
      {broke ? (
        <Pop trigger={agains}>
          <T size={13} weight="900">💔</T>
        </Pop>
      ) : combo >= 2 ? (
        <Pop trigger={combo}>
          <Row style={{ gap: 2 }}>
            <T size={12} weight="900" color="#f76707">🔥</T>
            <T size={12} weight="900" color="#f76707">x{combo}</T>
          </Row>
        </Pop>
      ) : null}
      <Pop trigger={sessionXp}>
        <Row style={{ gap: 2, backgroundColor: c.navy + '1f', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 }}>
          <T size={11.5} weight="900" color={c.navy}>⚡</T>
          <CountUp to={sessionXp} style={{ fontSize: 11.5, fontWeight: '900', color: c.navy }} />
          <T size={11.5} weight="900" color={c.navy}> XP</T>
        </Row>
      </Pop>
    </Row>
  );
}

function CardView() {
  const { c, track } = useTheme();
  const router = useRouter();
  const deck = useActiveDeck();
  const { idx, reveal, lastChoice } = useStore();
  const doReveal = useStore((s) => s.doReveal);
  const choose = useStore((s) => s.choose);
  const rate = useStore((s) => s.rate);
  const unlocked = useStore(isProActive);
  const toggleSave = useStore((s) => s.toggleSave);
  const setFeedback = useStore((s) => s.setFeedback);
  const markVoiceTried = useStore((s) => s.markVoiceTried);
  const noteCheck = useStore((s) => s.noteCheck);

  const card = deck[idx];
  const saved = useStore((s) => (card ? s.savedIds.includes(card.id) : false));
  const reaction = useStore((s) => (card ? s.feedback[card.id] : undefined));
  const col = track(card?.tk ?? 'spark');
  const nearEnd = !unlocked && idx >= deck.length - 2;
  const swipeable = !!card && card.kind === 'flip' && reveal;

  const [jot, setJot] = useState('');
  // Recall check (#1): pick state survives the reveal so the suggested grade can ring a RateBtn.
  const [checkPick, setCheckPick] = useState<number | null>(null);
  const [checkOk, setCheckOk] = useState<boolean | null>(null);
  // Jot coverage (#16): when you typed/dictated a recall attempt, score it against the key points.
  const [jotTicks, setJotTicks] = useState<boolean[] | null>(null);
  const jotRef = useRef<TextInput>(null);
  const tx = useSharedValue(0);
  useEffect(() => {
    tx.value = 0;
    setJot('');
    setCheckPick(null);
    setCheckOk(null);
    setJotTicks(null);
  }, [idx, tx]);
  // NO auto-reveal after a recall-check pick (it used to fire after 550ms — too fast to read
  // which option was right). The verdict banner + Continue button make it self-paced instead.
  const flipPoints = card && card.kind === 'flip' ? extractKeyPoints(card, 5) : [];
  useEffect(() => {
    if (reveal && jot.trim().length > 0 && flipPoints.length >= 2 && jotTicks == null) {
      setJotTicks(coverage(jot, flipPoints));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);
  const jotRatio = jotTicks && flipPoints.length ? jotTicks.filter(Boolean).length / flipPoints.length : null;
  // The objective check wins; else the jot coverage suggests; else no suggestion.
  const suggestedGrade =
    checkOk != null ? (checkOk ? 'good' : 'again') : jotRatio != null ? suggestRating(jotRatio) : null;

  const pan = Gesture.Pan()
    .enabled(swipeable)
    // Only claim mostly-horizontal drags; let vertical drags scroll the page (fixes long cards).
    .activeOffsetX([-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 110) {
        const ok = e.translationX > 0;
        runOnJS(answerFeedback)(ok);
        runOnJS(rate)(ok ? 'good' : 'again');
        tx.value = 0;
      } else {
        tx.value = withSpring(0);
      }
    });

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: `${tx.value / 22}deg` }],
    opacity: 1 - Math.min(Math.abs(tx.value) / 320, 0.4),
  }));

  if (!card) return null;

  // Pillar 1 — articulation scenarios get their own produce-before-reveal flow (no swipe).
  if (card.kind === 'scenario') {
    return (
      <View>
        <ScenarioView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }

  // New tap-only diagnostic / coding formats — each its own player, no swipe.
  if (card.kind === 'order') {
    return (
      <View>
        <OrderView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'evidence') {
    return (
      <View>
        <EvidenceView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'diag') {
    return (
      <View>
        <DiagView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'match') {
    return (
      <View>
        <MatchView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'querybuild') {
    return (
      <View>
        <QueryBuildView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }
  if (card.kind === 'classify') {
    return (
      <View>
        <ClassifyView card={card} />
        <PaywallTail show={nearEnd} remaining={deck.length - idx} />
      </View>
    );
  }

  return (
    <View>
      <GestureDetector gesture={pan}>
        <Animated.View style={aStyle}>
          <Card style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 230 }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: col }} />
            <Row style={{ marginBottom: 11, flexWrap: 'wrap' }}>
              <TrackBadge label={card.tool} color={col} />
              <Chip label={card.tag} />
              <LevelChip cardLevel={card.level} />
            </Row>
            <T size={17} weight="700" style={{ lineHeight: 24 }}>
              {card.q}
            </T>

            {card.kind === 'flip' ? (
              reveal ? (
                <Reveal
                  answer={card.a ?? ''}
                  fj={card.fj}
                  fs={card.fs}
                  code={card.code}
                  followups={card.followups}
                  sourceUrl={card.sourceUrl}
                  sourceLabel={card.sourceLabel}
                  publishedAt={card.publishedAt}>
                  {checkOk != null && (
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: (checkOk ? c.success : c.danger) + '14',
                        borderLeftWidth: 3,
                        borderLeftColor: checkOk ? c.success : c.danger,
                        borderRadius: 8,
                        padding: 9,
                      }}>
                      <T size={11.5} weight="800" color={checkOk ? c.success : c.danger}>
                        {checkOk
                          ? '✓ You picked the strongest answer — suggested: Got it'
                          : '✗ You picked the trap — it returns at the end of this session'}
                      </T>
                    </View>
                  )}
                  {jotTicks != null && (
                    <View style={{ marginTop: 12, gap: 7 }}>
                      <T muted size={11.5} weight="800">
                        Your recall covered {jotTicks.filter(Boolean).length}/{flipPoints.length} key points — tap to adjust
                      </T>
                      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                        {flipPoints.map((p, i) => {
                          const on = jotTicks[i];
                          return (
                            <Pressable
                              key={i}
                              onPress={() => setJotTicks((cur) => (cur ? cur.map((v, j) => (j === i ? !v : v)) : cur))}
                              style={{
                                borderWidth: 1.5,
                                borderColor: on ? c.success : c.border,
                                backgroundColor: on ? c.success + '14' : 'transparent',
                                borderRadius: 999,
                                paddingVertical: 5,
                                paddingHorizontal: 10,
                              }}>
                              <T size={11} weight="700" color={on ? c.success : c.muted}>
                                {on ? '✓ ' : ''}{p}
                              </T>
                            </Pressable>
                          );
                        })}
                      </Row>
                    </View>
                  )}
                  {/* A wrong recall pick re-queues the card this session no matter how kindly
                      it's self-graded — the in-session retry promise must hold. */}
                  <Row style={{ gap: 9, marginTop: checkOk != null || jotTicks != null ? 8 : 14 }}>
                    <RateBtn label="🔁 Again" sub={dueLabel('again')} kind="again" suggested={suggestedGrade === 'again'} onPress={() => { answerFeedback(false); rate('again'); }} />
                    <RateBtn label="✅ Got it" sub={dueLabel('good')} kind="good" suggested={suggestedGrade === 'good'} onPress={() => { answerFeedback(true); rate('good', { retry: checkOk === false }); }} />
                    <RateBtn label="⚡ Easy" sub={dueLabel('easy')} kind="easy" suggested={suggestedGrade === 'easy'} onPress={() => { sfx.correct(); haptic.success(); rate('easy', { retry: checkOk === false }); }} />
                  </Row>
                  <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
                    <T muted size={11.5} weight="800">← swipe: Again</T>
                    <T muted size={11.5} weight="800">Got it: swipe →</T>
                  </Row>
                  <FeedbackRow
                    cardId={card.id}
                    saved={saved}
                    reaction={reaction}
                    onSave={() => toggleSave(card.id)}
                    onLike={() => setFeedback(card.id, 'like')}
                    onDislike={() => setFeedback(card.id, 'dislike')}
                  />
                </Reveal>
              ) : (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
                    <TextInput
                      ref={jotRef}
                      value={jot}
                      onChangeText={setJot}
                      placeholder="Recall it — type or talk your answer (optional)…"
                      placeholderTextColor={c.muted}
                      multiline
                      style={{
                        flex: 1,
                        borderWidth: 1.5,
                        borderColor: c.border,
                        borderRadius: radius.md,
                        padding: 11,
                        color: c.fg,
                        backgroundColor: c.surface,
                        minHeight: 60,
                        textAlignVertical: 'top',
                        fontSize: 13.5,
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        markVoiceTried();
                        jotRef.current?.focus();
                      }}
                      hitSlop={6}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: radius.md,
                        borderWidth: 1.5,
                        borderColor: c.border,
                        backgroundColor: c.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <T size={20}>🎙</T>
                    </Pressable>
                  </View>
                  {(() => {
                    const check = buildRecallCheck(card, deck);
                    if (!check) {
                      return (
                        <>
                          <Btn label="Reveal answer" variant="navy" onPress={doReveal} />
                          <T muted size={11.5} style={{ textAlign: 'center', marginTop: 10 }}>
                            Type, or tap 🎙 and use your keyboard&apos;s dictation — then reveal &amp; rate.
                          </T>
                        </>
                      );
                    }
                    return (
                      <View style={{ gap: 8 }}>
                        <T weight="800" size={12.5}>{check.prompt}</T>
                        {check.opts.map((o, i) => {
                          const picked = checkPick === i;
                          const showState = checkPick != null;
                          // Picked-and-right gets the green treatment on YOUR option (not just the
                          // answer key) — the tester couldn't tell which one they'd selected.
                          const bd = showState && o.ok ? c.success : picked ? c.danger : c.border;
                          return (
                            <Pressable
                              key={i}
                              disabled={checkPick != null}
                              onPress={() => {
                                setCheckPick(i);
                                setCheckOk(o.ok);
                                noteCheck(o.ok);
                                answerFeedback(o.ok);
                              }}
                              style={{
                                borderWidth: 2,
                                borderColor: bd,
                                borderRadius: radius.md,
                                padding: 12,
                                backgroundColor: showState && o.ok ? c.success + '14' : picked ? c.danger + '12' : c.surface,
                                opacity: showState && !o.ok && !picked ? 0.55 : 1,
                              }}>
                              <Row style={{ gap: 7, alignItems: 'flex-start' }}>
                                {showState && (o.ok || picked) ? (
                                  <T size={12.5} weight="900" color={o.ok ? c.success : c.danger}>{o.ok ? '✓' : '✗'}</T>
                                ) : null}
                                <T size={12.5} style={{ lineHeight: 18, flex: 1 }}>{o.t}</T>
                                {picked ? <T size={10} weight="800" color={o.ok ? c.success : c.danger}>your pick</T> : null}
                              </Row>
                            </Pressable>
                          );
                        })}
                        {checkPick == null ? (
                          <Pressable onPress={doReveal} hitSlop={6} style={{ alignSelf: 'center', marginTop: 2 }}>
                            <T muted size={11.5} weight="800">skip → just reveal</T>
                          </Pressable>
                        ) : (
                          // Duolingo moment: a verdict banner + self-paced Continue (the old 550ms
                          // auto-reveal yanked the colors away before they could be read).
                          <View
                            style={{
                              backgroundColor: (checkOk ? c.success : c.danger) + '18',
                              borderColor: checkOk ? c.success : c.danger,
                              borderWidth: 1.5,
                              borderRadius: radius.md,
                              padding: 12,
                              gap: 9,
                              marginTop: 2,
                            }}>
                            <T weight="900" size={13.5} color={checkOk ? c.success : c.danger}>
                              {checkOk ? '✓ Spot on!' : '✗ That one’s the trap'}
                            </T>
                            {!checkOk && (
                              <T size={11.5} muted style={{ lineHeight: 16 }}>
                                The answer that holds up is highlighted green — this card comes back at the end of the session.
                              </T>
                            )}
                            <Btn label="Continue →" variant={checkOk ? 'green' : 'navy'} onPress={doReveal} />
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              )
            ) : (
              <>
                <ChoiceBlock
                  card={card}
                  reveal={reveal}
                  lastChoice={lastChoice}
                  onChoose={choose}
                  onContinue={() => {
                    // Tradeoff (#8): ANY defensible position is success; only indefensible picks lapse.
                    if (card.tradeoff) {
                      const defensible = lastChoice != null && !!card.opts?.[lastChoice]?.ok;
                      rate(defensible ? 'good' : 'again');
                      return;
                    }
                    const correctIdx = card.opts?.findIndex((o) => o.ok) ?? -1;
                    const wrong = lastChoice != null && lastChoice !== correctIdx;
                    // Non-strict wrong picks keep the gentle 'good' SRS grade but still re-queue
                    // this session — a missed MCQ should come back, Duolingo-style.
                    rate(card.strict && wrong ? 'again' : 'good', { retry: wrong });
                  }}
                />
                {reveal && (
                  <FeedbackRow
                    cardId={card.id}
                    saved={saved}
                    reaction={reaction}
                    onSave={() => toggleSave(card.id)}
                    onLike={() => setFeedback(card.id, 'like')}
                    onDislike={() => setFeedback(card.id, 'dislike')}
                  />
                )}
              </>
            )}
          </Card>
        </Animated.View>
      </GestureDetector>

      {nearEnd && (
        <Pressable onPress={() => router.push('/paywall')} style={{ marginTop: 12 }}>
          <T muted size={11.5} weight="700" style={{ textAlign: 'center' }}>
            {deck.length - idx} card{deck.length - idx > 1 ? 's' : ''} left in today&apos;s free session ·{' '}
            <T color={track('rag')} weight="800" size={11.5}>
              go unlimited
            </T>
          </T>
        </Pressable>
      )}
    </View>
  );
}

/** Shared "free session almost over" upsell tail, reused by every card-kind branch. */
function PaywallTail({ show, remaining }: { show: boolean; remaining: number }) {
  const router = useRouter();
  const { track } = useTheme();
  if (!show) return null;
  return (
    <Pressable onPress={() => router.push('/paywall')} style={{ marginTop: 12 }}>
      <T muted size={11.5} weight="700" style={{ textAlign: 'center' }}>
        {remaining} card{remaining > 1 ? 's' : ''} left in today&apos;s free session ·{' '}
        <T color={track('rag')} weight="800" size={11.5}>
          go unlimited
        </T>
      </T>
    </Pressable>
  );
}

function ChoiceBlock({
  card,
  reveal,
  lastChoice,
  onChoose,
  onContinue,
}: {
  card: {
    opts?: { t: string; ok: boolean; why?: string }[];
    why?: string;
    fj: string;
    fs: string;
    lines?: string[];
    followups?: { q: string; a: string }[];
    tradeoff?: boolean;
  };
  reveal: boolean;
  lastChoice: number | null;
  onChoose: (i: number) => void;
  onContinue: () => void;
}) {
  const { c, scheme } = useTheme();
  const opts = card.opts ?? [];
  const correctIdx = opts.findIndex((o) => o.ok);
  // Tradeoff (#8): any defensible (ok) pick counts — there's no single "correct" option.
  const gotIt = card.tradeoff ? lastChoice != null && !!opts[lastChoice]?.ok : lastChoice === correctIdx;
  const fired = useRef(false);
  useEffect(() => {
    if (reveal && !fired.current) {
      fired.current = true;
      answerFeedback(gotIt);
    } else if (!reveal) {
      fired.current = false;
    }
  }, [reveal, gotIt]);

  return (
    <View style={{ marginTop: 14, gap: 9 }}>
      {card.tradeoff && (
        <Row style={{ gap: 6 }}>
          <T size={12}>⚖️</T>
          <T size={11.5} weight="800" color={c.accentInk}>
            Tradeoff call — several picks are defensible. Commit to a position.
          </T>
        </Row>
      )}
      {card.lines ? <CodeBlock lines={card.lines} /> : null}
      {opts.map((o, i) => {
        let bd = c.border;
        let bg = c.card;
        if (reveal) {
          if (o.ok) {
            bd = c.success;
            bg = scheme === 'dark' ? 'rgba(63,185,80,.10)' : 'rgba(26,158,87,.10)';
          } else if (i === lastChoice) {
            bd = c.danger;
            bg = scheme === 'dark' ? 'rgba(248,81,73,.10)' : 'rgba(232,69,60,.09)';
          }
        }
        return (
          <View key={i}>
            <Pressable
              disabled={reveal}
              onPress={() => onChoose(i)}
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'flex-start',
                borderWidth: 2,
                borderColor: bd,
                backgroundColor: bg,
                borderRadius: radius.md,
                padding: 13,
                opacity: reveal && !o.ok && i !== lastChoice ? 0.5 : 1,
              }}>
              <View
                style={{
                  width: 23,
                  height: 23,
                  borderRadius: 7,
                  backgroundColor: c.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <T weight="800" size={12}>
                  {String.fromCharCode(65 + i)}
                </T>
              </View>
              <T size={13} style={{ flex: 1, lineHeight: 18 }}>
                {o.t}
              </T>
              {reveal && card.tradeoff && i === lastChoice && o.ok && (
                <View style={{ backgroundColor: c.success, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7, alignSelf: 'center' }}>
                  <T color="#fff" weight="900" size={8.5}>YOUR POSITION</T>
                </View>
              )}
            </Pressable>
            {reveal && o.why ? (
              <T size={11.5} color={c.muted} style={{ marginTop: 4, marginLeft: 6, lineHeight: 16 }}>
                {o.why}
              </T>
            ) : null}
          </View>
        );
      })}

      {reveal && (
        <View style={{ marginTop: 4 }}>
          <RichAnswer text={card.why ?? ''} size={13} />
          <RedFlag fj={card.fj} fs={card.fs} />
          <StuckHelp followups={card.followups} />
          <ResultFooter
            ok={gotIt}
            message={
              gotIt
                ? card.tradeoff
                  ? 'Defensible — now read why the other positions hold too.'
                  : undefined
                : card.tradeoff
                  ? 'That position doesn’t survive scrutiny here — read the whys above.'
                  : 'A common trap — review the explanation above.'
            }
            continueLabel="Continue →"
            onContinue={onContinue}
          />
        </View>
      )}
    </View>
  );
}

function Reveal({
  answer,
  fj,
  fs,
  code,
  followups,
  sourceUrl,
  sourceLabel,
  publishedAt,
  children,
}: {
  answer: string;
  fj: string;
  fs: string;
  code?: import('../lib/content').CodePanel[];
  followups?: { q: string; a: string }[];
  sourceUrl?: string;
  sourceLabel?: string;
  publishedAt?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <RichAnswer text={answer} size={13} />
      {code?.length ? <CodePanels panels={code} /> : null}
      <RedFlag fj={fj} fs={fs} />
      {/* #7b — depth on demand: follow-ups collapse behind one deliberate tap (shorter reveal). */}
      <StuckHelp
        followups={followups}
        icon="🔎"
        label={`Go deeper · ${followups?.length ?? 0} follow-up${(followups?.length ?? 0) === 1 ? '' : 's'}`}
      />
      {sourceUrl ? <SourceRow url={sourceUrl} label={sourceLabel} publishedAt={publishedAt} /> : null}
      {children}
    </View>
  );
}

/** Drill-down: tappable follow-up questions that expand to reveal their answer. */
function Followups({ items, hideHeader }: { items: { q: string; a: string }[]; hideHeader?: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ marginTop: hideHeader ? 7 : 13, gap: 7 }}>
      {hideHeader ? null : (
        <T muted weight="800" size={11} style={{ letterSpacing: 0.4 }}>
          DRILL DEEPER
        </T>
      )}
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <Pressable
            key={i}
            onPress={() => {
              haptic.selection();
              setOpen(isOpen ? null : i);
            }}
            style={{
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              padding: 11,
              backgroundColor: isOpen ? c.surface : 'transparent',
            }}>
            <Row style={{ alignItems: 'flex-start', gap: 8 }}>
              <T size={12.5} weight="800" color={c.accentInk}>
                {isOpen ? '▾' : '▸'}
              </T>
              <T size={13} weight="700" style={{ flex: 1, lineHeight: 19 }}>
                {f.q}
              </T>
            </Row>
            {isOpen ? (
              <View style={{ marginTop: 8, paddingLeft: 20 }}>
                <RichAnswer text={f.a} size={12.5} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Tutor-feel expander (no runtime AI): a "still stuck?" affordance that progressively reveals the
 * pre-authored follow-up drill-downs — a different angle on the same idea. Flip cards already show
 * follow-ups inline; this brings the same help to choice/MCQ reveals where they were hidden.
 */
function StuckHelp({
  followups,
  icon = '🤔',
  label = 'Still stuck? Explain it another way',
}: {
  followups?: { q: string; a: string }[];
  icon?: string;
  label?: string;
}) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  if (!followups?.length) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Pressable
        onPress={() => {
          haptic.selection();
          setOpen((o) => !o);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          paddingVertical: 11,
          paddingHorizontal: 12,
          backgroundColor: open ? c.surface : 'transparent',
        }}>
        <T size={14}>{icon}</T>
        <T size={13} weight="800" style={{ flex: 1 }}>
          {label}
        </T>
        <T size={12.5} weight="800" color={c.accentInk}>
          {open ? '▾' : '▸'}
        </T>
      </Pressable>
      {open ? <Followups items={followups} hideHeader /> : null}
    </View>
  );
}

function SourceRow({ url, label, publishedAt }: { url: string; label?: string; publishedAt?: string }) {
  const { scheme } = useTheme();
  const link = scheme === 'dark' ? '#4dabf7' : '#1c7ed6';
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{
        marginTop: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: scheme === 'dark' ? 'rgba(77,171,247,.10)' : 'rgba(28,126,214,.08)',
        borderRadius: radius.sm,
        paddingVertical: 8,
        paddingHorizontal: 11,
      }}>
      <T size={12}>🔗</T>
      <T size={11.5} weight="800" color={link} style={{ flex: 1 }}>
        Verified · {label ?? 'official source'}
        {publishedAt ? `  ·  ${publishedAt}` : ''}
      </T>
      <T size={11.5} weight="800" color={link}>open ↗</T>
    </Pressable>
  );
}

/** #6 — tells a Senior+ user the card IS at their level (or a stretch / a fundamentals refresher). */
function LevelChip({ cardLevel }: { cardLevel?: import('../lib/content').Level }) {
  const { c } = useTheme();
  const userLevel = useStore((s) => s.userLevel);
  if (!cardLevel || !userLevel) return null;
  const diff = levelIndex(cardLevel) - levelIndex(userLevel);
  // -1/0 reads as "at level" noise-free; only call out the meaningful gaps.
  const label = diff > 0 ? '⤴ Stretch' : diff <= -2 ? '🌱 Fundamentals' : diff === 0 ? '🎯 Your level' : null;
  if (!label) return null;
  const color = diff > 0 ? '#7048e8' : diff === 0 ? c.success : c.muted;
  return (
    <View style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 }}>
      <T size={10} weight="800" color={color}>{label}</T>
    </View>
  );
}

function RedFlag({ fj, fs }: { fj: string; fs: string }) {
  const { c } = useTheme();
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: c.danger, paddingLeft: 12, marginTop: 11 }}>
      <T size={12.5} style={{ lineHeight: 19 }}>
        <T color={c.danger} weight="800" size={12.5}>
          Junior:{' '}
        </T>
        {fj}
      </T>
      <T size={12.5} style={{ lineHeight: 19 }}>
        <T color={c.success} weight="800" size={12.5}>
          Senior:{' '}
        </T>
        {fs}
      </T>
    </View>
  );
}

function RateBtn({
  label,
  sub,
  kind,
  suggested,
  onPress,
}: {
  label: string;
  sub: string;
  kind: 'again' | 'good' | 'easy';
  /** Ring this button as the recall-check-suggested grade (self-grade stays authoritative). */
  suggested?: boolean;
  onPress: () => void;
}) {
  const { c, scheme } = useTheme();
  const color = { again: c.danger, good: c.success, easy: '#1c7ed6' }[kind];
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: 6,
        backgroundColor: scheme === 'dark' ? color + '24' : color + '1f',
        alignItems: 'center',
        borderWidth: suggested ? 2 : 0,
        borderColor: suggested ? color : 'transparent',
      }}>
      <T weight="800" size={13} color={color}>
        {label}
      </T>
      <T size={10} weight="700" color={color} style={{ opacity: 0.8, marginTop: 2 }}>
        {sub}
      </T>
    </Pressable>
  );
}

/** Save / Like / Dislike / Report — a content-quality + bookmark row below the SRS grade buttons.
 *  Save is independent of like/dislike; tapping the active reaction clears it (handled in the store).
 *  The ⚠︎ pill (#7) expands an inline report panel — categories + optional note, reviewed by a human. */
function FeedbackRow({
  cardId,
  saved,
  reaction,
  onSave,
  onLike,
  onDislike,
}: {
  cardId: string;
  saved: boolean;
  reaction: 'like' | 'dislike' | undefined;
  onSave: () => void;
  onLike: () => void;
  onDislike: () => void;
}) {
  const { c, scheme } = useTheme();
  const reported = useStore((s) => !!s.reports[cardId]);
  const [reportOpen, setReportOpen] = useState(false);
  const pill = (active: boolean, color: string) => ({
    flex: 1 as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    borderRadius: radius.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: active ? color : c.border,
    backgroundColor: active ? (scheme === 'dark' ? color + '24' : color + '1a') : 'transparent',
  });
  const save = '#1c7ed6';
  const warn = '#e8590c';
  return (
    <View>
      <Row style={{ gap: 9, marginTop: 12 }}>
        <Pressable onPress={onSave} style={pill(saved, save)}>
          <T size={12.5}>{saved ? '🔖' : '💾'}</T>
          <T size={12} weight="800" color={saved ? save : c.muted}>{saved ? 'Saved' : 'Save'}</T>
        </Pressable>
        <Pressable onPress={onLike} style={pill(reaction === 'like', c.success)}>
          <T size={12.5}>👍</T>
          <T size={12} weight="800" color={reaction === 'like' ? c.success : c.muted}>Like</T>
        </Pressable>
        <Pressable onPress={onDislike} style={pill(reaction === 'dislike', c.danger)}>
          <T size={12.5}>👎</T>
          <T size={12} weight="800" color={reaction === 'dislike' ? c.danger : c.muted}>Dislike</T>
        </Pressable>
        <Pressable
          onPress={() => setReportOpen((o) => !o)}
          accessibilityLabel={reported ? 'Issue reported' : 'Report an issue with this card'}
          style={pill(reported || reportOpen, warn)}>
          <T size={12.5}>⚠️</T>
          <T size={12} weight="800" color={reported || reportOpen ? warn : c.muted}>{reported ? 'Sent' : 'Issue'}</T>
        </Pressable>
      </Row>
      {reportOpen && <ReportPanel cardId={cardId} reported={reported} onDone={() => setReportOpen(false)} />}
    </View>
  );
}

const REPORT_CATS: { cat: import('../lib/store').ReportCategory; label: string }[] = [
  { cat: 'inaccurate', label: 'Inaccurate' },
  { cat: 'outdated', label: 'Outdated' },
  { cat: 'typo', label: 'Typo' },
  { cat: 'unclear', label: 'Unclear' },
  { cat: 'alt-answer', label: 'Better answer' },
];

/** Inline report form (#7) — category chips + optional note. A human reviews every report. */
function ReportPanel({ cardId, reported, onDone }: { cardId: string; reported: boolean; onDone: () => void }) {
  const { c } = useTheme();
  const reportCard = useStore((s) => s.reportCard);
  const [cat, setCat] = useState<import('../lib/store').ReportCategory | null>(null);
  const [note, setNote] = useState('');
  if (reported) {
    return (
      <T size={12} weight="700" color={c.success} style={{ marginTop: 10, textAlign: 'center' }}>
        ✓ Reported — thanks. A human reviews every report.
      </T>
    );
  }
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      <T muted size={11.5} weight="800">What&apos;s wrong with this card?</T>
      <Row style={{ flexWrap: 'wrap', gap: 7 }}>
        {REPORT_CATS.map((rc) => (
          <Pressable
            key={rc.cat}
            onPress={() => { haptic.selection(); setCat(rc.cat); }}
            style={{
              borderWidth: 1.5,
              borderColor: cat === rc.cat ? c.accentInk : c.border,
              backgroundColor: cat === rc.cat ? c.surface : 'transparent',
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 11,
            }}>
            <T size={11.5} weight="800" color={cat === rc.cat ? c.accentInk : c.muted}>{rc.label}</T>
          </Pressable>
        ))}
      </Row>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={cat === 'alt-answer' ? 'Your better answer…' : 'Anything else? (optional)'}
        placeholderTextColor={c.muted}
        multiline
        style={{
          borderWidth: 1.5,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: 10,
          color: c.fg,
          backgroundColor: c.surface,
          minHeight: 48,
          textAlignVertical: 'top',
          fontSize: 12.5,
        }}
      />
      <Btn
        label="Send report"
        variant="navy"
        onPress={() => {
          if (!cat) { haptic.error(); return; }
          reportCard(cardId, cat, note);
          haptic.success();
          onDone();
        }}
      />
    </View>
  );
}

/** Push-permission priming (plan #4): asked AFTER a completed session, not during onboarding. */
function NotifPrime() {
  const notifAsked = useStore((s) => s.notifAsked);
  const setNotifAsked = useStore((s) => s.setNotifAsked);
  if (notifAsked) return null;
  return (
    <Card style={{ gap: 10 }}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <T size={20}>🔔</T>
        <View style={{ flex: 1 }}>
          <T weight="800" size={14}>Keep your streak alive?</T>
          <T muted size={12} style={{ lineHeight: 17, marginTop: 2 }}>
            One gentle daily nudge — no spam. Change it anytime in Profile.
          </T>
        </View>
      </Row>
      <Row style={{ gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Btn label="Not now" variant="ghost" onPress={() => setNotifAsked(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn label="Enable" variant="primary" onPress={() => { void requestPermission(); setNotifAsked(true); }} />
        </View>
      </Row>
    </Card>
  );
}

/** End-of-session summary (#12): what you earned, how you did, and tomorrow's hook.
 *  `cardsDone` < deck.length when the user took a checkpoint's early finish. */
function Done({ cardsDone }: { cardsDone?: number }) {
  const router = useRouter();
  const { c } = useTheme();
  const deck = useActiveDeck();
  const replay = useStore((s) => s.replay);
  const endSession = useStore((s) => s.endSession);
  const freezes = useStore((s) => s.freezes);
  const playful = useStore((s) => s.playful);
  const cardsToday = useStore((s) => s.cardsToday);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const sessionXp = useStore((s) => s.sessionXp);
  const sessionHits = useStore((s) => s.sessionHits);
  const sessionMisses = useStore((s) => s.sessionMisses);
  const bestCombo = useStore((s) => s.sessionBestCombo);
  const progress = useStore((s) => s.progress);
  const goalMet = cardsToday >= dailyGoal;
  const checks = sessionHits + sessionMisses;
  const accuracy = checks > 0 ? Math.round((sessionHits / checks) * 100) : null;
  const dueTomorrow = dueWithin(progress, Date.now(), 1);
  return (
    <View style={{ gap: space.md }}>
      {playful ? <Confetti /> : null}
      <StreakHero variant="compact" />
      <NotifPrime />
      <Card style={{ alignItems: 'center', padding: 24 }}>
      {playful ? <Mascot mood="celebrate" size={96} /> : <T size={38}>✓</T>}
      <T size={22} weight="900" style={{ marginTop: 6 }}>
        {goalMet ? 'Daily goal complete' : 'Session complete'}
      </T>
      <Row style={{ marginTop: 14, gap: 9, alignSelf: 'stretch' }}>
        <Pop trigger={sessionXp} style={{ flex: 1 }}>
          <StatTile label="XP earned" color="#e8590c">
            <Row style={{ gap: 2, justifyContent: 'center' }}>
              <T weight="900" size={20} color="#e8590c">+</T>
              <CountUp to={sessionXp} style={{ fontWeight: '900', fontSize: 20, color: '#e8590c' }} />
            </Row>
          </StatTile>
        </Pop>
        <StatTile label="Cards" color="#1c7ed6">
          <T weight="900" size={20} color="#1c7ed6">{cardsDone ?? deck.length}</T>
        </StatTile>
        {accuracy != null && (
          <StatTile label="Accuracy" color={accuracy >= 70 ? c.success : c.warn}>
            <T weight="900" size={20} color={accuracy >= 70 ? c.success : c.warn}>{accuracy}%</T>
          </StatTile>
        )}
      </Row>
      <Row style={{ marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Chip label={`📈 ${Math.min(cardsToday, dailyGoal)}/${dailyGoal} today`} kind="amber" />
        {bestCombo >= 3 && (
          <Chip label={`🔥 best run x${bestCombo} · +${Math.min(5, Math.ceil(bestCombo / 3))} XP combo`} kind="amber" />
        )}
        {freezes > 0 && <Chip label={`🧊 ${freezes} freeze${freezes > 1 ? 's' : ''}`} kind="amber" />}
      </Row>
      <T muted size={12.5} style={{ marginTop: 12, textAlign: 'center', lineHeight: 19 }}>
        {dueTomorrow > 0
          ? `📅 ${dueTomorrow} card${dueTomorrow > 1 ? 's' : ''} due tomorrow — come back to keep them fresh.`
          : '📅 Nothing due yet — fresh cards land tomorrow.'}
      </T>
      <View style={{ marginTop: 16, alignSelf: 'stretch', gap: 10 }}>
        <Btn label="Done — see you tomorrow" variant="primary" onPress={endSession} />
        <Btn label="📣 Share my streak" variant="navy" onPress={() => router.push('/share')} />
        <Btn label="📝 Just interviewed? Log a debrief" variant="ghost" onPress={() => router.push('/debrief')} />
        <Btn label="📚 Browse the library" variant="ghost" onPress={() => router.push('/library')} />
        <Btn label="↻ Replay this set" variant="ghost" onPress={replay} />
      </View>
      </Card>
    </View>
  );
}

function StatTile({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  const { c, scheme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: 'center',
        gap: 2,
        backgroundColor: scheme === 'dark' ? color + '1f' : color + '14',
        borderWidth: 1,
        borderColor: color + '44',
      }}>
      {children}
      <T size={10} weight="800" color={c.muted} style={{ letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {label}
      </T>
    </View>
  );
}
